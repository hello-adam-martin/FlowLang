"""
FlowLang exception classes
"""


class FlowLangError(Exception):
    """Base exception for all FlowLang errors"""
    pass


class TaskNotFoundError(FlowLangError):
    """Raised when a task is not found in the registry"""
    def __init__(self, task_name: str):
        self.task_name = task_name
        super().__init__(f"Task '{task_name}' not found in registry")


class FlowValidationError(FlowLangError):
    """Raised when a flow definition is invalid"""
    pass


class FlowExecutionError(FlowLangError):
    """Raised when a flow execution fails"""
    pass


class NotImplementedTaskError(FlowLangError):
    """Raised when a task stub has not been implemented yet"""
    def __init__(self, task_name: str):
        self.task_name = task_name
        super().__init__(
            f"Task '{task_name}' is not implemented yet. "
            f"Please implement this task before running the flow."
        )


class MaxRetriesExceededError(FlowExecutionError):
    """Raised when maximum retry attempts are exceeded"""
    def __init__(self, task_name: str, attempts: int):
        self.task_name = task_name
        self.attempts = attempts
        super().__init__(
            f"Task '{task_name}' failed after {attempts} retry attempts"
        )


class TimeoutError(FlowExecutionError):
    """Raised when a task execution times out"""
    def __init__(self, task_name: str, timeout: int):
        self.task_name = task_name
        self.timeout = timeout
        super().__init__(
            f"Task '{task_name}' timed out after {timeout} seconds"
        )


class FlowTerminationException(FlowLangError):
    """
    Raised when an 'exit' step is executed to terminate flow execution.

    This is a control flow exception, not an error. It indicates intentional
    early termination of the flow.
    """
    def __init__(self, reason: str = None, outputs: dict = None):
        self.reason = reason or "Flow terminated by exit step"
        self.outputs = outputs or {}
        super().__init__(self.reason)
