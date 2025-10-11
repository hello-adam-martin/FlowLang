"""
FlowLang Cancellation System

Provides cancellation tokens and cleanup handlers for flow execution.
"""

import asyncio
from typing import Callable, List, Optional, Any
from datetime import datetime


class CancellationToken:
    """
    Token that can be used to cancel flow execution.

    Thread-safe cancellation mechanism that allows graceful shutdown
    of running flows with cleanup handlers.
    """

    def __init__(self):
        self._cancelled = False
        self._cancel_reason: Optional[str] = None
        self._cancel_time: Optional[datetime] = None
        self._cleanup_handlers: List[Callable] = []
        self._lock = asyncio.Lock()

    async def cancel(self, reason: Optional[str] = None):
        """
        Cancel the execution.

        Args:
            reason: Optional reason for cancellation
        """
        async with self._lock:
            if self._cancelled:
                return  # Already cancelled

            self._cancelled = True
            self._cancel_reason = reason or "Execution cancelled"
            self._cancel_time = datetime.utcnow()

    def is_cancelled(self) -> bool:
        """Check if cancellation has been requested."""
        return self._cancelled

    def check_cancelled(self):
        """
        Check if cancelled and raise exception if so.

        Raises:
            CancellationError: If cancellation has been requested
        """
        if self._cancelled:
            raise CancellationError(self._cancel_reason or "Execution cancelled")

    def get_cancel_reason(self) -> Optional[str]:
        """Get the reason for cancellation."""
        return self._cancel_reason

    def get_cancel_time(self) -> Optional[datetime]:
        """Get the time when cancellation was requested."""
        return self._cancel_time

    def add_cleanup_handler(self, handler: Callable):
        """
        Add a cleanup handler to be called on cancellation.

        Handlers are called in reverse order (LIFO) to properly unwind resources.

        Args:
            handler: Async or sync callable to execute on cleanup
        """
        self._cleanup_handlers.append(handler)

    async def run_cleanup_handlers(self):
        """
        Run all registered cleanup handlers in reverse order (LIFO).

        Cleanup handlers are called even if previous handlers fail.
        Errors are collected and logged but do not stop cleanup.
        """
        errors = []

        # Run in reverse order (LIFO - last registered runs first)
        for handler in reversed(self._cleanup_handlers):
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler()
                else:
                    handler()
            except Exception as e:
                errors.append(e)

        # Clear handlers after running
        self._cleanup_handlers.clear()

        return errors


class CancellationError(Exception):
    """
    Exception raised when flow execution is cancelled.

    This is a control flow exception (like FlowTerminationException)
    and should be caught by the executor to handle graceful shutdown.
    """

    def __init__(self, reason: str = "Execution cancelled"):
        self.reason = reason
        super().__init__(reason)


class ExecutionHandle:
    """
    Handle to a running flow execution.

    Provides methods to cancel execution and query status.
    """

    def __init__(self, execution_id: str, flow_name: str, token: CancellationToken):
        self.execution_id = execution_id
        self.flow_name = flow_name
        self.token = token
        self.start_time = datetime.utcnow()
        self.end_time: Optional[datetime] = None
        self.status: str = "running"  # running, completed, failed, cancelled
        self.result: Optional[Any] = None
        self.error: Optional[str] = None

    async def cancel(self, reason: Optional[str] = None):
        """Cancel this execution."""
        await self.token.cancel(reason)

    def is_cancelled(self) -> bool:
        """Check if this execution has been cancelled."""
        return self.token.is_cancelled()

    def mark_completed(self, result: Any):
        """Mark execution as completed successfully."""
        self.status = "completed"
        self.result = result
        self.end_time = datetime.utcnow()

    def mark_failed(self, error: str):
        """Mark execution as failed."""
        self.status = "failed"
        self.error = error
        self.end_time = datetime.utcnow()

    def mark_cancelled(self):
        """Mark execution as cancelled."""
        self.status = "cancelled"
        self.end_time = datetime.utcnow()

    def to_dict(self) -> dict:
        """Convert to dictionary representation."""
        return {
            "execution_id": self.execution_id,
            "flow_name": self.flow_name,
            "status": self.status,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "cancel_reason": self.token.get_cancel_reason(),
            "error": self.error,
        }
