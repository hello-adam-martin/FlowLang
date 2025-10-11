/**
 * FlowLang TypeScript Client
 *
 * Type-safe client for calling FlowLang flows via REST API.
 */

import type {
  ClientConfig,
  FlowExecutionResult,
  FlowInfo,
  HealthCheckResponse,
  ExecuteOptions,
  StreamOptions,
  EventCallback,
} from './types';
import {
  FlowLangError,
  FlowExecutionError,
  FlowNotReadyError,
  FlowNotFoundError,
  TimeoutError,
  NetworkError,
} from './errors';
import { processSSEStream } from './sse-parser';

/**
 * FlowLang Client
 *
 * Promise-based client for executing FlowLang workflows.
 *
 * @example
 * ```typescript
 * const client = new FlowLangClient({ baseUrl: 'http://localhost:8000' });
 *
 * // Execute a flow
 * const result = await client.executeFlow('HelloWorld', { user_name: 'Alice' });
 * console.log(result.outputs);
 *
 * // Stream execution events
 * await client.executeFlowStream('MyFlow', { input: 'value' }, {
 *   onEvent: (eventType, data) => {
 *     console.log(`${eventType}:`, data);
 *   }
 * });
 * ```
 */
export class FlowLangClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retryAttempts: number;
  private readonly retryDelay: number;
  private readonly retryBackoff: number;
  private readonly headers: Record<string, string>;

  /**
   * Create a new FlowLang client
   *
   * @param config - Client configuration
   */
  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = config.timeout ?? 30000;
    this.retryAttempts = config.retryAttempts ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;
    this.retryBackoff = config.retryBackoff ?? 2.0;
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  /**
   * Execute a flow
   *
   * @param flowName - Name of the flow to execute
   * @param inputs - Input parameters for the flow
   * @param options - Execution options
   * @returns Flow execution result
   * @throws {FlowNotFoundError} If the flow doesn't exist
   * @throws {FlowNotReadyError} If the flow has unimplemented tasks
   * @throws {FlowExecutionError} If the flow execution fails
   */
  async executeFlow<T = Record<string, any>>(
    flowName: string,
    inputs?: Record<string, any>,
    options?: ExecuteOptions
  ): Promise<FlowExecutionResult<T>> {
    const url = `${this.baseUrl}/flows/${flowName}/execute`;
    const body = { inputs: inputs ?? {} };
    const timeout = options?.timeout ?? this.timeout;

    const response = await this.requestWithRetry('POST', url, body, timeout);

    // Handle 404
    if (response.status === 404) {
      throw new FlowNotFoundError(flowName);
    }

    const data = await response.json();

    // Handle 503 (flow not ready)
    if (response.status === 503) {
      throw new FlowNotReadyError(
        data.error || 'Flow not ready',
        data.pending_tasks || [],
        data.implementation_progress
      );
    }

    const result: FlowExecutionResult<T> = {
      success: data.success ?? false,
      outputs: data.outputs,
      error: data.error,
      errorDetails: data.error_details,
      executionTimeMs: data.execution_time_ms,
      flow: data.flow || flowName,
      terminated: data.terminated,
      terminationReason: data.termination_reason,
    };

    // Throw error if execution failed
    if (!result.success) {
      throw new FlowExecutionError(
        result.error || 'Flow execution failed',
        result.errorDetails,
        result.flow
      );
    }

    return result;
  }

  /**
   * Execute a flow with streaming events (Server-Sent Events)
   *
   * @param flowName - Name of the flow to execute
   * @param inputs - Input parameters for the flow
   * @param options - Stream options including event callback
   * @returns Final flow execution result
   * @throws {FlowNotFoundError} If the flow doesn't exist
   * @throws {FlowNotReadyError} If the flow has unimplemented tasks
   * @throws {FlowExecutionError} If the flow execution fails
   */
  async executeFlowStream<T = Record<string, any>>(
    flowName: string,
    inputs?: Record<string, any>,
    options?: StreamOptions
  ): Promise<FlowExecutionResult<T>> {
    const url = `${this.baseUrl}/flows/${flowName}/execute/stream`;
    const body = { inputs: inputs ?? {} };
    const timeout = options?.timeout ?? this.timeout;
    const onEvent = options?.onEvent;

    let finalResult: FlowExecutionResult<T> | null = null;

    // Track events internally
    const eventCallback: EventCallback = async (eventType, data) => {
      // Handle flow completion events
      if (eventType === 'flow_completed') {
        finalResult = {
          success: data.success ?? true,
          outputs: data.outputs || {},
          executionTimeMs: data.duration_ms,
          flow: flowName,
          terminated: data.terminated,
          terminationReason: data.termination_reason,
        };
      } else if (eventType === 'flow_failed' || eventType === 'error') {
        finalResult = {
          success: false,
          error: data.error,
          errorDetails: data.error_details,
          flow: flowName,
        };
      }

      // Call user's event handler
      if (onEvent) {
        await onEvent(eventType, data);
      }
    };

    const response = await this.requestWithRetry('POST', url, body, timeout);

    // Handle 404
    if (response.status === 404) {
      throw new FlowNotFoundError(flowName);
    }

    // Handle 503 (flow not ready)
    if (response.status === 503) {
      // Read error event from stream
      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        const { value } = await reader.read();
        if (value) {
          const text = decoder.decode(value);
          const match = text.match(/data: ({.*})/);
          if (match) {
            const data = JSON.parse(match[1]);
            throw new FlowNotReadyError(
              data.error || 'Flow not ready',
              data.pending_tasks || [],
              data.implementation_progress
            );
          }
        }
      }
      throw new FlowNotReadyError('Flow not ready');
    }

    // Process SSE stream
    if (!response.body) {
      throw new FlowLangError('Response body is empty');
    }

    await processSSEStream(response.body, eventCallback);

    // Check if we got a final result
    if (!finalResult) {
      throw new FlowLangError('Stream ended without completion event');
    }

    // Throw error if execution failed
    if (!finalResult.success) {
      throw new FlowExecutionError(
        finalResult.error || 'Flow execution failed',
        finalResult.errorDetails,
        finalResult.flow
      );
    }

    return finalResult;
  }

  /**
   * List all available flows
   *
   * @returns Array of flow information
   */
  async listFlows(): Promise<FlowInfo[]> {
    const url = `${this.baseUrl}/flows`;
    const response = await this.requestWithRetry('GET', url);

    if (!response.ok) {
      throw new FlowLangError(`Failed to list flows: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get information about a specific flow
   *
   * @param flowName - Name of the flow
   * @returns Flow information
   * @throws {FlowNotFoundError} If the flow doesn't exist
   */
  async getFlowInfo(flowName: string): Promise<FlowInfo> {
    const url = `${this.baseUrl}/flows/${flowName}`;
    const response = await this.requestWithRetry('GET', url);

    if (response.status === 404) {
      throw new FlowNotFoundError(flowName);
    }

    if (!response.ok) {
      throw new FlowLangError(`Failed to get flow info: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Check API server health
   *
   * @returns Health check response
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    const url = `${this.baseUrl}/health`;
    const response = await this.requestWithRetry('GET', url);

    if (!response.ok) {
      throw new FlowLangError(`Health check failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Make an HTTP request with automatic retry logic
   *
   * @param method - HTTP method
   * @param url - Request URL
   * @param body - Request body (optional)
   * @param timeout - Request timeout in milliseconds
   * @returns Response object
   */
  private async requestWithRetry(
    method: string,
    url: string,
    body?: any,
    timeout?: number
  ): Promise<Response> {
    let lastError: Error | null = null;
    let delay = this.retryDelay;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          timeout ?? this.timeout
        );

        const response = await fetch(url, {
          method,
          headers: this.headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return response;
        }

        // Retry on server errors (5xx) and rate limits (429)
        if (response.status >= 500 || response.status === 429) {
          if (attempt < this.retryAttempts - 1) {
            await this.sleep(delay);
            delay *= this.retryBackoff;
            continue;
          }
        }

        return response;
      } catch (error) {
        lastError = error as Error;

        // Handle timeout
        if (error instanceof Error && error.name === 'AbortError') {
          if (attempt < this.retryAttempts - 1) {
            await this.sleep(delay);
            delay *= this.retryBackoff;
            continue;
          }
          throw new TimeoutError(timeout ?? this.timeout);
        }

        // Handle network errors
        if (attempt < this.retryAttempts - 1) {
          await this.sleep(delay);
          delay *= this.retryBackoff;
          continue;
        }

        throw new NetworkError(
          `Request failed after ${this.retryAttempts} attempts: ${error}`,
          error as Error
        );
      }
    }

    throw new NetworkError(
      `Request failed after ${this.retryAttempts} attempts: ${lastError}`,
      lastError || undefined
    );
  }

  /**
   * Cancel a running flow execution
   *
   * @param flowName - Name of the flow
   * @param executionId - ID of the execution to cancel
   * @returns Cancellation response
   * @throws {FlowNotFoundError} If the execution doesn't exist
   */
  async cancelExecution(
    flowName: string,
    executionId: string
  ): Promise<{ success: boolean; message: string; execution_id: string; flow?: string }> {
    const url = `${this.baseUrl}/flows/${flowName}/executions/${executionId}/cancel`;
    const response = await this.requestWithRetry('POST', url);

    if (response.status === 404) {
      throw new FlowNotFoundError(executionId);
    }

    return await response.json();
  }

  /**
   * Get the status of a flow execution
   *
   * @param flowName - Name of the flow
   * @param executionId - ID of the execution
   * @returns Execution status
   * @throws {FlowNotFoundError} If the execution doesn't exist
   */
  async getExecutionStatus(
    flowName: string,
    executionId: string
  ): Promise<{
    execution_id: string;
    flow_name: string;
    status: string;
    start_time: string;
    end_time?: string;
    cancel_reason?: string;
    error?: string;
  }> {
    const url = `${this.baseUrl}/flows/${flowName}/executions/${executionId}`;
    const response = await this.requestWithRetry('GET', url);

    if (response.status === 404) {
      throw new FlowNotFoundError(executionId);
    }

    return await response.json();
  }

  /**
   * List all executions for a flow
   *
   * @param flowName - Name of the flow
   * @returns List of executions
   * @throws {FlowNotFoundError} If the flow doesn't exist
   */
  async listExecutions(
    flowName: string
  ): Promise<{
    flow: string;
    executions: Array<{
      execution_id: string;
      flow_name: string;
      status: string;
      start_time: string;
      end_time?: string;
      cancel_reason?: string;
      error?: string;
    }>;
    count: number;
  }> {
    const url = `${this.baseUrl}/flows/${flowName}/executions`;
    const response = await this.requestWithRetry('GET', url);

    if (response.status === 404) {
      throw new FlowNotFoundError(flowName);
    }

    return await response.json();
  }

  /**
   * Sleep for a specified duration
   *
   * @param ms - Duration in milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
