/**
 * FlowLang TypeScript Client - Type Definitions
 */

/**
 * Configuration options for FlowLangClient
 */
export interface ClientConfig {
  /** Base URL of the FlowLang API server */
  baseUrl: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Number of retry attempts for failed requests (default: 3) */
  retryAttempts?: number;
  /** Initial delay between retries in milliseconds (default: 1000) */
  retryDelay?: number;
  /** Backoff multiplier for retry delays (default: 2.0) */
  retryBackoff?: number;
  /** Optional custom headers to send with requests */
  headers?: Record<string, string>;
}

/**
 * Result of a flow execution
 */
export interface FlowExecutionResult<T = Record<string, any>> {
  /** Whether the flow executed successfully */
  success: boolean;
  /** Flow outputs (if success) */
  outputs?: T;
  /** Error message (if failed) */
  error?: string;
  /** Detailed error information (if failed) */
  errorDetails?: string;
  /** Execution time in milliseconds */
  executionTimeMs?: number;
  /** Name of the executed flow */
  flow: string;
  /** List of unimplemented tasks (if not ready) */
  pendingTasks?: string[];
  /** Implementation progress (e.g., '3/5 (60%)') */
  implementationProgress?: string;
  /** Whether flow was terminated early via exit step */
  terminated?: boolean;
  /** Reason for early termination */
  terminationReason?: string;
}

/**
 * Schema for a flow input parameter
 */
export interface FlowInputSchema {
  /** Input parameter name */
  name: string;
  /** Input type (string, integer, boolean, etc.) */
  type: string;
  /** Whether the input is required */
  required?: boolean;
  /** Input description */
  description?: string;
}

/**
 * Schema for a flow output
 */
export interface FlowOutputSchema {
  /** Output name */
  name: string;
  /** Output value or reference */
  value?: string;
}

/**
 * Information about a flow
 */
export interface FlowInfo {
  /** Flow name */
  name: string;
  /** Flow description */
  description?: string;
  /** Input schema */
  inputs: FlowInputSchema[];
  /** Output schema */
  outputs: FlowOutputSchema[];
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  /** Health status */
  status: string;
  /** Flow name (single-flow mode) */
  flow?: string;
  /** Number of tasks implemented */
  tasksImplemented?: number;
  /** Total number of tasks */
  tasksTotal?: number;
  /** Number of pending tasks */
  tasksPending?: number;
  /** Whether all tasks are implemented */
  implementationComplete?: boolean;
  /** Whether the server is ready */
  ready: boolean;
  /** List of unimplemented task names */
  pendingTaskNames?: string[];
  /** Server type (multi-flow mode) */
  serverType?: string;
  /** Number of flows (multi-flow mode) */
  flowsCount?: number;
  /** Whether all flows are ready (multi-flow mode) */
  allFlowsReady?: boolean;
  /** Aggregate task statistics (multi-flow mode) */
  aggregateTasks?: {
    total: number;
    implemented: number;
    pending: number;
    progress: string;
  };
  /** Individual flow statuses (multi-flow mode) */
  flows?: Array<{
    name: string;
    ready: boolean;
    tasksImplemented: number;
    tasksTotal: number;
    tasksPending: number;
    progress: string;
    pendingTaskNames: string[];
  }>;
}

/**
 * Event types for streaming execution
 */
export type FlowEventType =
  | 'flow_started'
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'flow_completed'
  | 'flow_failed'
  | 'error';

/**
 * Event data for streaming execution
 */
export interface FlowEvent {
  /** Event type */
  type: FlowEventType;
  /** Event data */
  data: Record<string, any>;
}

/**
 * Callback function for streaming events
 */
export type EventCallback = (eventType: FlowEventType, data: Record<string, any>) => void | Promise<void>;

/**
 * Options for executing a flow
 */
export interface ExecuteOptions {
  /** Input parameters for the flow */
  inputs?: Record<string, any>;
  /** Timeout override for this specific execution (milliseconds) */
  timeout?: number;
}

/**
 * Options for streaming flow execution
 */
export interface StreamOptions extends ExecuteOptions {
  /** Callback function called for each event */
  onEvent?: EventCallback;
}
