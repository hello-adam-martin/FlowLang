"""
TaskRegistry - Register and manage task implementations
"""
from typing import Any, Callable, Dict, Optional
import inspect
from .exceptions import TaskNotFoundError, NotImplementedTaskError


class TaskRegistry:
    """
    Registry for task implementations.

    Tasks are registered by name and can be either sync or async functions.
    """

    def __init__(self):
        """Initialize an empty task registry"""
        self._tasks: Dict[str, Callable] = {}
        self._task_metadata: Dict[str, Dict[str, Any]] = {}

    def register(
        self,
        name: str,
        description: Optional[str] = None,
        implemented: bool = True
    ):
        """
        Decorator to register a task function.

        Args:
            name: The name of the task (used in YAML flows)
            description: Optional description of what the task does
            implemented: Whether the task is implemented (False creates a stub)

        Example:
            @registry.register('SendEmail')
            async def send_email(to: str, subject: str, body: str):
                # Implementation here
                return {'sent': True}
        """
        def decorator(func: Callable) -> Callable:
            self._tasks[name] = func
            self._task_metadata[name] = {
                'description': description or func.__doc__,
                'implemented': implemented,
                'is_async': inspect.iscoroutinefunction(func),
                'signature': inspect.signature(func),
            }
            return func
        return decorator

    def get_task(self, name: str) -> Callable:
        """
        Get a task by name.

        Args:
            name: The name of the task

        Returns:
            The task function

        Raises:
            TaskNotFoundError: If the task is not registered
            NotImplementedTaskError: If the task is a stub
        """
        if name not in self._tasks:
            raise TaskNotFoundError(name)

        metadata = self._task_metadata[name]
        if not metadata['implemented']:
            raise NotImplementedTaskError(name)

        return self._tasks[name]

    def has_task(self, name: str) -> bool:
        """Check if a task is registered"""
        return name in self._tasks

    def is_implemented(self, name: str) -> bool:
        """Check if a task is implemented (not a stub)"""
        if name not in self._tasks:
            return False
        return self._task_metadata[name]['implemented']

    def list_tasks(self) -> Dict[str, Dict[str, Any]]:
        """
        List all registered tasks with their metadata.

        Returns:
            Dictionary mapping task names to their metadata
        """
        return {
            name: {
                'description': meta['description'],
                'implemented': meta['implemented'],
                'is_async': meta['is_async'],
            }
            for name, meta in self._task_metadata.items()
        }

    def get_implementation_status(self) -> Dict[str, Any]:
        """
        Get implementation status of all tasks.

        Returns:
            Dictionary with counts and list of unimplemented tasks
        """
        total = len(self._tasks)
        implemented = sum(
            1 for meta in self._task_metadata.values()
            if meta['implemented']
        )
        unimplemented = [
            name for name, meta in self._task_metadata.items()
            if not meta['implemented']
        ]

        return {
            'total': total,
            'implemented': implemented,
            'unimplemented_count': total - implemented,
            'unimplemented_tasks': unimplemented,
            'progress': f"{implemented}/{total}",
            'percentage': (implemented / total * 100) if total > 0 else 0,
        }

    def create_stub(self, name: str, description: Optional[str] = None):
        """
        Create a stub task that raises NotImplementedTaskError.

        Args:
            name: The name of the task
            description: Optional description of what the task should do
        """
        async def stub(**kwargs):
            raise NotImplementedTaskError(name)

        self._tasks[name] = stub
        self._task_metadata[name] = {
            'description': description,
            'implemented': False,
            'is_async': True,
            'signature': None,
        }

    def __repr__(self):
        status = self.get_implementation_status()
        return f"TaskRegistry({status['progress']} tasks implemented)"
