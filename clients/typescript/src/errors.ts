/**
 * FlowLang TypeScript Client - Custom Errors
 */

/**
 * Base error class for FlowLang client errors
 */
export class FlowLangError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlowLangError';
    Object.setPrototypeOf(this, FlowLangError.prototype);
  }
}

/**
 * Error thrown when a flow execution fails
 */
export class FlowExecutionError extends FlowLangError {
  /** Detailed error information */
  errorDetails?: string;
  /** Name of the flow that failed */
  flow?: string;

  constructor(message: string, errorDetails?: string, flow?: string) {
    super(message);
    this.name = 'FlowExecutionError';
    this.errorDetails = errorDetails;
    this.flow = flow;
    Object.setPrototypeOf(this, FlowExecutionError.prototype);
  }
}

/**
 * Error thrown when a flow is not ready for execution (tasks not implemented)
 */
export class FlowNotReadyError extends FlowLangError {
  /** List of unimplemented tasks */
  pendingTasks: string[];
  /** Implementation progress (e.g., '3/5 (60%)') */
  progress?: string;

  constructor(message: string, pendingTasks: string[] = [], progress?: string) {
    super(message);
    this.name = 'FlowNotReadyError';
    this.pendingTasks = pendingTasks;
    this.progress = progress;
    Object.setPrototypeOf(this, FlowNotReadyError.prototype);
  }
}

/**
 * Error thrown when a flow is not found
 */
export class FlowNotFoundError extends FlowLangError {
  /** Name of the flow that was not found */
  flowName: string;

  constructor(flowName: string) {
    super(`Flow not found: ${flowName}`);
    this.name = 'FlowNotFoundError';
    this.flowName = flowName;
    Object.setPrototypeOf(this, FlowNotFoundError.prototype);
  }
}

/**
 * Error thrown when a request times out
 */
export class TimeoutError extends FlowLangError {
  /** Timeout duration in milliseconds */
  timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Error thrown when network request fails
 */
export class NetworkError extends FlowLangError {
  /** Original error */
  cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}
