"""
FlowLang Testing Framework

Provides pytest-compatible base classes, task mocking, assertion helpers,
and YAML fixture loading for testing FlowLang flows and tasks.

Usage:
    from flowlang.testing import FlowTest

    class TestMyFlow(FlowTest):
        flow_path = "flow.yaml"
        tasks_file = "flow.py"

        async def test_success_case(self):
            result = await self.execute_flow({"input": "value"})
            self.assert_success(result)
            self.assert_output_equals(result, "output_key", "expected_value")
"""

import asyncio
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Callable, Union
from unittest.mock import Mock, AsyncMock
import yaml

from flowlang.executor import FlowExecutor
from flowlang.registry import TaskRegistry
from flowlang.context import FlowContext
from flowlang.exceptions import FlowExecutionError, TaskNotFoundError


class MockTaskRegistry(TaskRegistry):
    """
    Enhanced TaskRegistry with mocking capabilities for testing.

    Allows replacing real task implementations with mocks while
    maintaining the registry interface.
    """

    def __init__(self):
        super().__init__()
        self._mocks: Dict[str, Dict[str, Any]] = {}
        self._call_history: Dict[str, List[Dict[str, Any]]] = {}

    def mock_task(
        self,
        task_name: str,
        return_value: Any = None,
        side_effect: Optional[Callable] = None,
        raises: Optional[Exception] = None
    ):
        """
        Mock a task with specified behavior.

        Args:
            task_name: Name of task to mock
            return_value: Value to return when task is called
            side_effect: Callable to execute instead (for complex mocking)
            raises: Exception to raise when task is called
        """
        self._mocks[task_name] = {
            'return_value': return_value,
            'side_effect': side_effect,
            'raises': raises
        }
        self._call_history[task_name] = []

        # Create mock function
        async def mock_fn(**kwargs):
            # Record call
            self._call_history[task_name].append({
                'kwargs': kwargs.copy(),
                'timestamp': time.time()
            })

            # Handle raises
            if raises is not None:
                raise raises

            # Handle side_effect
            if side_effect is not None:
                result = side_effect(**kwargs)
                if asyncio.iscoroutine(result):
                    return await result
                return result

            # Return value
            return return_value

        # Register mock function
        self._tasks[task_name] = mock_fn
        self._task_metadata[task_name] = {
            'description': f'Mock: {task_name}',
            'implemented': True,
            'is_async': True,
            'signature': None
        }

    def clear_mocks(self):
        """Clear all mocks and call history."""
        self._mocks.clear()
        self._call_history.clear()

    def get_call_count(self, task_name: str) -> int:
        """Get number of times a task was called."""
        return len(self._call_history.get(task_name, []))

    def get_call_args(self, task_name: str, call_index: int = 0) -> Dict[str, Any]:
        """Get arguments from a specific call to a task."""
        calls = self._call_history.get(task_name, [])
        if call_index >= len(calls):
            raise IndexError(f"Task '{task_name}' was called {len(calls)} times, cannot get call {call_index}")
        return calls[call_index]['kwargs']

    def assert_task_called(self, task_name: str, times: Optional[int] = None):
        """Assert that a task was called the expected number of times."""
        actual_calls = self.get_call_count(task_name)

        if times is None:
            if actual_calls == 0:
                raise AssertionError(f"Task '{task_name}' was not called")
        else:
            if actual_calls != times:
                raise AssertionError(
                    f"Task '{task_name}' was called {actual_calls} times, expected {times}"
                )

    def assert_task_not_called(self, task_name: str):
        """Assert that a task was never called."""
        actual_calls = self.get_call_count(task_name)
        if actual_calls > 0:
            raise AssertionError(f"Task '{task_name}' was called {actual_calls} times, expected 0")

    def assert_task_called_with(self, task_name: str, **expected_kwargs):
        """Assert that a task was called with specific arguments."""
        calls = self._call_history.get(task_name, [])

        if not calls:
            raise AssertionError(f"Task '{task_name}' was not called")

        # Check if any call matches expected kwargs
        for call in calls:
            if all(call['kwargs'].get(k) == v for k, v in expected_kwargs.items()):
                return

        raise AssertionError(
            f"Task '{task_name}' was not called with {expected_kwargs}. "
            f"Actual calls: {[c['kwargs'] for c in calls]}"
        )


class FlowTest:
    """
    Base class for flow tests with assertion helpers and mocking support.

    Subclass this and set flow_path and tasks_file to test your flows.

    Example:
        class TestMyFlow(FlowTest):
            flow_path = "flow.yaml"
            tasks_file = "flow.py"

            async def test_basic(self):
                result = await self.execute_flow({"input": "test"})
                self.assert_success(result)
    """

    # Subclasses should set these
    flow_path: Optional[str] = None
    tasks_file: Optional[str] = None

    # Initialized by setup_method
    registry: Optional[MockTaskRegistry] = None
    executor: Optional[FlowExecutor] = None
    flow_yaml: Optional[str] = None
    _execution_start_time: Optional[float] = None
    _execution_end_time: Optional[float] = None

    async def setup_method(self):
        """
        Setup method called before each test.
        Override to add custom setup logic.
        """
        await self.load_flow()

    async def teardown_method(self):
        """
        Teardown method called after each test.
        Override to add custom cleanup logic.
        """
        if self.registry:
            self.registry.clear_mocks()

    async def load_flow(self, flow_path: Optional[str] = None, tasks_file: Optional[str] = None):
        """
        Load flow definition and tasks.

        Args:
            flow_path: Path to flow.yaml (defaults to self.flow_path)
            tasks_file: Path to flow.py (defaults to self.tasks_file)
        """
        flow_path = flow_path or self.flow_path
        tasks_file = tasks_file or self.tasks_file

        if not flow_path:
            raise ValueError("flow_path must be set or provided")

        # Load flow YAML
        flow_file = Path(flow_path)
        if not flow_file.exists():
            raise FileNotFoundError(f"Flow file not found: {flow_path}")

        with open(flow_file) as f:
            self.flow_yaml = f.read()

        # Create mock registry
        self.registry = MockTaskRegistry()

        # Load tasks if provided
        if tasks_file:
            tasks_path = Path(tasks_file)
            if tasks_path.exists():
                # Import tasks module
                import importlib.util
                spec = importlib.util.spec_from_file_location("test_tasks", tasks_path)
                if spec and spec.loader:
                    module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(module)

                    # Look for create_task_registry function
                    if hasattr(module, 'create_task_registry'):
                        real_registry = module.create_task_registry()
                        # Copy real tasks and metadata to mock registry
                        for task_name in real_registry._tasks:
                            self.registry._tasks[task_name] = real_registry._tasks[task_name]
                            self.registry._task_metadata[task_name] = real_registry._task_metadata[task_name]

        # Create executor
        self.executor = FlowExecutor(self.registry)

    async def execute_flow(
        self,
        inputs: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute the flow with given inputs.

        Args:
            inputs: Input dictionary for the flow

        Returns:
            Flow execution result
        """
        if not self.executor or not self.flow_yaml:
            await self.load_flow()

        self._execution_start_time = time.time()
        try:
            result = await self.executor.execute_flow(
                self.flow_yaml,
                inputs=inputs or {}
            )
            return result
        finally:
            self._execution_end_time = time.time()

    def get_execution_time(self) -> float:
        """Get execution time of last flow run in seconds."""
        if self._execution_start_time is None or self._execution_end_time is None:
            raise RuntimeError("No flow execution has completed yet")
        return self._execution_end_time - self._execution_start_time

    # Task mocking helpers

    def mock_task(
        self,
        task_name: str,
        return_value: Any = None,
        side_effect: Optional[Callable] = None,
        raises: Optional[Exception] = None
    ):
        """
        Mock a task. See MockTaskRegistry.mock_task for details.
        """
        if not self.registry:
            raise RuntimeError("Registry not initialized. Call load_flow() first.")
        self.registry.mock_task(task_name, return_value, side_effect, raises)

    def clear_mocks(self):
        """Clear all task mocks."""
        if self.registry:
            self.registry.clear_mocks()

    # Assertion helpers

    def assert_success(self, result: Dict[str, Any]):
        """Assert that flow execution succeeded."""
        if not result.get('success'):
            error_msg = result.get('error', 'Unknown error')
            raise AssertionError(f"Flow execution failed: {error_msg}")

    def assert_failure(self, result: Dict[str, Any], expected_error: Optional[str] = None):
        """
        Assert that flow execution failed.

        Args:
            result: Flow execution result
            expected_error: Optional substring that should appear in error message
        """
        if result.get('success'):
            raise AssertionError("Expected flow to fail but it succeeded")

        if expected_error:
            actual_error = result.get('error', '')
            if expected_error not in actual_error:
                raise AssertionError(
                    f"Expected error to contain '{expected_error}', "
                    f"but got: {actual_error}"
                )

    def assert_error_contains(self, result: Dict[str, Any], expected_substring: str):
        """
        Assert that error message contains expected substring.

        Args:
            result: Flow execution result
            expected_substring: Substring to find in error message
        """
        if result.get('success'):
            raise AssertionError("Expected flow to fail but it succeeded")

        error_msg = result.get('error', '')
        if expected_substring not in error_msg:
            raise AssertionError(
                f"Error message does not contain '{expected_substring}':\n"
                f"  Actual error: {error_msg}"
            )

    def assert_output_equals(self, result: Dict[str, Any], key: str, expected_value: Any):
        """
        Assert that a flow output matches expected value.

        Args:
            result: Flow execution result
            key: Output key to check
            expected_value: Expected value
        """
        outputs = result.get('outputs', {})
        if key not in outputs:
            raise AssertionError(f"Output key '{key}' not found in result. Available: {list(outputs.keys())}")

        actual_value = outputs[key]
        if actual_value != expected_value:
            raise AssertionError(
                f"Output '{key}' mismatch:\n"
                f"  Expected: {expected_value}\n"
                f"  Actual: {actual_value}"
            )

    def assert_output_contains(self, result: Dict[str, Any], key: str, expected_substring: str):
        """
        Assert that a string output contains expected substring.

        Args:
            result: Flow execution result
            key: Output key to check
            expected_substring: Substring to find
        """
        outputs = result.get('outputs', {})
        if key not in outputs:
            raise AssertionError(f"Output key '{key}' not found in result")

        actual_value = str(outputs[key])
        if expected_substring not in actual_value:
            raise AssertionError(
                f"Output '{key}' does not contain '{expected_substring}':\n"
                f"  Actual: {actual_value}"
            )

    def assert_output_exists(self, result: Dict[str, Any], key: str):
        """
        Assert that an output key exists in the result.

        Args:
            result: Flow execution result
            key: Output key to check
        """
        outputs = result.get('outputs', {})
        if key not in outputs:
            raise AssertionError(
                f"Output key '{key}' not found in result. "
                f"Available keys: {list(outputs.keys())}"
            )

    def assert_output_matches_schema(self, result: Dict[str, Any], key: str, schema: Dict[str, type]):
        """
        Assert that an output dict matches expected schema.

        Args:
            result: Flow execution result
            key: Output key to check
            schema: Dict mapping field names to expected types
        """
        outputs = result.get('outputs', {})
        if key not in outputs:
            raise AssertionError(f"Output key '{key}' not found in result")

        actual_value = outputs[key]
        if not isinstance(actual_value, dict):
            raise AssertionError(f"Output '{key}' is not a dict: {type(actual_value)}")

        for field, expected_type in schema.items():
            if field not in actual_value:
                raise AssertionError(f"Output '{key}' missing field '{field}'")

            actual_type = type(actual_value[field])
            if actual_type != expected_type:
                raise AssertionError(
                    f"Output '{key}.{field}' has wrong type:\n"
                    f"  Expected: {expected_type.__name__}\n"
                    f"  Actual: {actual_type.__name__}"
                )

    def assert_execution_time_under(self, max_seconds: float):
        """
        Assert that flow execution completed within time limit.

        Args:
            max_seconds: Maximum allowed execution time in seconds
        """
        execution_time = self.get_execution_time()
        if execution_time > max_seconds:
            raise AssertionError(
                f"Execution took {execution_time:.3f}s, expected under {max_seconds}s"
            )

    def assert_task_called(self, task_name: str, times: Optional[int] = None):
        """
        Assert that a task was called the expected number of times.

        Args:
            task_name: Name of task to check
            times: Expected number of calls (None means at least once)
        """
        if not self.registry:
            raise RuntimeError("Registry not initialized")
        self.registry.assert_task_called(task_name, times)

    def assert_task_not_called(self, task_name: str):
        """Assert that a task was never called."""
        if not self.registry:
            raise RuntimeError("Registry not initialized")
        self.registry.assert_task_not_called(task_name)

    def assert_task_called_with(self, task_name: str, **expected_kwargs):
        """
        Assert that a task was called with specific arguments.

        Args:
            task_name: Name of task to check
            **expected_kwargs: Expected keyword arguments
        """
        if not self.registry:
            raise RuntimeError("Registry not initialized")
        self.registry.assert_task_called_with(task_name, **expected_kwargs)

    def get_task_call_count(self, task_name: str) -> int:
        """Get number of times a task was called."""
        if not self.registry:
            raise RuntimeError("Registry not initialized")
        return self.registry.get_call_count(task_name)

    def get_task_call_args(self, task_name: str, call_index: int = 0) -> Dict[str, Any]:
        """Get arguments from a specific task call."""
        if not self.registry:
            raise RuntimeError("Registry not initialized")
        return self.registry.get_call_args(task_name, call_index)


class YAMLFixtureLoader:
    """
    Load test cases from YAML fixture files.

    Supports data-driven testing by defining test cases in YAML format.

    Example fixture file (fixtures/test_cases.yaml):
        test_cases:
          - name: valid_input
            inputs: {user_name: "Alice"}
            expected_outputs: {message: "Hello, Alice!"}

          - name: empty_input
            inputs: {user_name: ""}
            expect_error: true
            expected_error: "user_name is required"
    """

    @staticmethod
    def load_fixtures(fixture_path: Union[str, Path]) -> List[Dict[str, Any]]:
        """
        Load test cases from YAML file.

        Args:
            fixture_path: Path to YAML fixture file

        Returns:
            List of test case dictionaries
        """
        fixture_file = Path(fixture_path)
        if not fixture_file.exists():
            raise FileNotFoundError(f"Fixture file not found: {fixture_path}")

        with open(fixture_file) as f:
            data = yaml.safe_load(f)

        if not isinstance(data, dict) or 'test_cases' not in data:
            raise ValueError("Fixture file must contain 'test_cases' key")

        return data['test_cases']

    @staticmethod
    def parametrize_from_yaml(fixture_path: Union[str, Path]):
        """
        Decorator to parametrize tests from YAML fixtures.

        Usage:
            @YAMLFixtureLoader.parametrize_from_yaml("fixtures/test_cases.yaml")
            async def test_from_fixture(self, test_case):
                result = await self.execute_flow(test_case['inputs'])
                if test_case.get('expect_error'):
                    self.assert_failure(result)
                else:
                    self.assert_success(result)
        """
        def decorator(test_func):
            # Load fixtures
            test_cases = YAMLFixtureLoader.load_fixtures(fixture_path)

            # Create parametrized test function
            async def parametrized_test(self):
                for test_case in test_cases:
                    test_name = test_case.get('name', 'unnamed')
                    try:
                        await test_func(self, test_case)
                    except Exception as e:
                        raise AssertionError(f"Test case '{test_name}' failed: {e}")

            parametrized_test.__name__ = test_func.__name__
            return parametrized_test

        return decorator


# Pytest fixtures for convenience
try:
    import pytest

    @pytest.fixture
    async def flow_test():
        """Pytest fixture that provides a FlowTest instance."""
        test = FlowTest()
        await test.setup_method()
        yield test
        await test.teardown_method()

    @pytest.fixture
    def mock_registry():
        """Pytest fixture that provides a MockTaskRegistry."""
        return MockTaskRegistry()

except ImportError:
    # pytest not installed, skip fixture definitions
    pass


__all__ = [
    'FlowTest',
    'MockTaskRegistry',
    'YAMLFixtureLoader',
]
