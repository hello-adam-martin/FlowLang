"""
Tests for the FlowLang testing framework.

Tests the FlowTest base class, MockTaskRegistry, assertion helpers,
and YAML fixture loading.
"""

import pytest
import tempfile
import os
from pathlib import Path

from flowlang.testing import FlowTest, MockTaskRegistry, YAMLFixtureLoader
from flowlang.registry import TaskRegistry
from flowlang.exceptions import FlowExecutionError


# Test MockTaskRegistry

@pytest.mark.asyncio
async def test_mock_task_registry_basic():
    """Test basic task mocking with return value."""
    registry = MockTaskRegistry()

    # Mock a task
    registry.mock_task('TestTask', return_value={'result': 'mocked'})

    # Execute mocked task
    task_fn = registry.get_task('TestTask')
    result = await task_fn(input="test")

    assert result == {'result': 'mocked'}
    assert registry.get_call_count('TestTask') == 1


@pytest.mark.asyncio
async def test_mock_task_with_side_effect():
    """Test task mocking with side effect function."""
    registry = MockTaskRegistry()

    # Mock with side effect
    def side_effect_fn(**kwargs):
        return {'computed': kwargs['value'] * 2}

    registry.mock_task('ComputeTask', side_effect=side_effect_fn)

    # Execute
    task_fn = registry.get_task('ComputeTask')
    result = await task_fn(value=21)

    assert result == {'computed': 42}


@pytest.mark.asyncio
async def test_mock_task_with_async_side_effect():
    """Test task mocking with async side effect function."""
    registry = MockTaskRegistry()

    # Mock with async side effect
    async def async_side_effect(**kwargs):
        return {'name': kwargs['name'].upper()}

    registry.mock_task('FormatTask', side_effect=async_side_effect)

    # Execute
    task_fn = registry.get_task('FormatTask')
    result = await task_fn(name='alice')

    assert result == {'name': 'ALICE'}


@pytest.mark.asyncio
async def test_mock_task_raises_exception():
    """Test task mocking with exception."""
    registry = MockTaskRegistry()

    # Mock to raise exception
    registry.mock_task('FailTask', raises=ValueError("Task failed"))

    # Execute should raise
    task_fn = registry.get_task('FailTask')
    with pytest.raises(ValueError, match="Task failed"):
        await task_fn()


def test_mock_registry_call_tracking():
    """Test call history tracking."""
    registry = MockTaskRegistry()
    registry.mock_task('TrackedTask', return_value={'status': 'ok'})

    # No calls yet
    assert registry.get_call_count('TrackedTask') == 0

    # Make calls
    import asyncio
    asyncio.run(registry.get_task('TrackedTask')(param1='a', param2='b'))
    asyncio.run(registry.get_task('TrackedTask')(param1='c', param2='d'))

    # Check call count
    assert registry.get_call_count('TrackedTask') == 2

    # Check call args
    first_call = registry.get_call_args('TrackedTask', 0)
    assert first_call == {'param1': 'a', 'param2': 'b'}

    second_call = registry.get_call_args('TrackedTask', 1)
    assert second_call == {'param1': 'c', 'param2': 'd'}


def test_mock_registry_assert_task_called():
    """Test assert_task_called helper."""
    registry = MockTaskRegistry()
    registry.mock_task('Task1', return_value={})

    # Should fail - not called yet
    with pytest.raises(AssertionError, match="was not called"):
        registry.assert_task_called('Task1')

    # Call it
    import asyncio
    asyncio.run(registry.get_task('Task1')())

    # Should pass
    registry.assert_task_called('Task1')
    registry.assert_task_called('Task1', times=1)

    # Should fail - wrong count
    with pytest.raises(AssertionError, match="called 1 times, expected 2"):
        registry.assert_task_called('Task1', times=2)


def test_mock_registry_assert_task_not_called():
    """Test assert_task_not_called helper."""
    registry = MockTaskRegistry()
    registry.mock_task('Task1', return_value={})

    # Should pass - not called
    registry.assert_task_not_called('Task1')

    # Call it
    import asyncio
    asyncio.run(registry.get_task('Task1')())

    # Should fail
    with pytest.raises(AssertionError, match="called 1 times, expected 0"):
        registry.assert_task_not_called('Task1')


def test_mock_registry_assert_task_called_with():
    """Test assert_task_called_with helper."""
    registry = MockTaskRegistry()
    registry.mock_task('Task1', return_value={})

    import asyncio

    # Call with specific args
    asyncio.run(registry.get_task('Task1')(name='Alice', age=30))
    asyncio.run(registry.get_task('Task1')(name='Bob', age=25))

    # Should pass - matches first call
    registry.assert_task_called_with('Task1', name='Alice', age=30)

    # Should pass - matches second call
    registry.assert_task_called_with('Task1', name='Bob')

    # Should fail - no matching call
    with pytest.raises(AssertionError, match="was not called with"):
        registry.assert_task_called_with('Task1', name='Charlie')


def test_mock_registry_clear_mocks():
    """Test clearing mocks."""
    registry = MockTaskRegistry()
    registry.mock_task('Task1', return_value={})

    import asyncio
    asyncio.run(registry.get_task('Task1')())

    assert registry.get_call_count('Task1') == 1

    # Clear mocks
    registry.clear_mocks()

    assert registry.get_call_count('Task1') == 0


# Test FlowTest base class

class TestFlowTestClass:
    """Tests for FlowTest base class using a simple test flow."""

    @pytest.fixture
    def test_flow_dir(self):
        """Create a temporary directory with a test flow."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create simple flow.yaml
            flow_yaml = """
flow: TestFlow
description: Simple test flow

inputs:
  - name: message
    type: string
    required: true

steps:
  - task: FormatMessage
    id: format
    inputs:
      message: ${inputs.message}
    outputs:
      - formatted

outputs:
  - name: result
    value: ${format.formatted}
"""
            flow_path = Path(tmpdir) / "flow.yaml"
            flow_path.write_text(flow_yaml)

            # Create simple flow.py
            flow_py = """
from flowlang import TaskRegistry

def create_task_registry():
    registry = TaskRegistry()

    @registry.register('FormatMessage', description='Format a message')
    async def format_message(message: str):
        return {'formatted': f"Formatted: {message}"}

    return registry
"""
            tasks_path = Path(tmpdir) / "flow.py"
            tasks_path.write_text(flow_py)

            yield tmpdir

    @pytest.mark.asyncio
    async def test_flow_test_basic_execution(self, test_flow_dir):
        """Test basic flow execution with FlowTest."""
        class TestMyFlow(FlowTest):
            flow_path = str(Path(test_flow_dir) / "flow.yaml")
            tasks_file = str(Path(test_flow_dir) / "flow.py")

        test = TestMyFlow()
        await test.setup_method()

        # Execute flow
        result = await test.execute_flow({'message': 'Hello'})

        # Should succeed
        test.assert_success(result)
        test.assert_output_equals(result, 'result', 'Formatted: Hello')

        await test.teardown_method()

    @pytest.mark.asyncio
    async def test_flow_test_with_mock(self, test_flow_dir):
        """Test flow execution with mocked task."""
        class TestMyFlow(FlowTest):
            flow_path = str(Path(test_flow_dir) / "flow.yaml")
            tasks_file = str(Path(test_flow_dir) / "flow.py")

        test = TestMyFlow()
        await test.setup_method()

        # Mock the task
        test.mock_task('FormatMessage', return_value={'formatted': 'MOCKED OUTPUT'})

        # Execute flow
        result = await test.execute_flow({'message': 'Hello'})

        # Should use mocked output
        test.assert_success(result)
        test.assert_output_equals(result, 'result', 'MOCKED OUTPUT')

        # Check task was called
        test.assert_task_called('FormatMessage', times=1)
        test.assert_task_called_with('FormatMessage', message='Hello')

        await test.teardown_method()

    @pytest.mark.asyncio
    async def test_flow_test_execution_time(self, test_flow_dir):
        """Test execution time tracking."""
        class TestMyFlow(FlowTest):
            flow_path = str(Path(test_flow_dir) / "flow.yaml")
            tasks_file = str(Path(test_flow_dir) / "flow.py")

        test = TestMyFlow()
        await test.setup_method()

        # Execute flow
        await test.execute_flow({'message': 'Hello'})

        # Check execution time
        exec_time = test.get_execution_time()
        assert exec_time > 0
        assert exec_time < 1.0  # Should be very fast

        # Assert execution time under limit
        test.assert_execution_time_under(1.0)

        await test.teardown_method()


# Test assertion helpers

@pytest.mark.asyncio
async def test_assert_success():
    """Test assert_success helper."""
    test = FlowTest()

    # Should pass
    test.assert_success({'success': True})

    # Should fail
    with pytest.raises(AssertionError, match="Flow execution failed"):
        test.assert_success({'success': False, 'error': 'Something went wrong'})


@pytest.mark.asyncio
async def test_assert_failure():
    """Test assert_failure helper."""
    test = FlowTest()

    # Should pass
    test.assert_failure({'success': False, 'error': 'Task failed'})

    # Should fail - flow succeeded
    with pytest.raises(AssertionError, match="Expected flow to fail"):
        test.assert_failure({'success': True})

    # Test with expected error message
    test.assert_failure(
        {'success': False, 'error': 'Task XYZ failed'},
        expected_error='XYZ'
    )

    # Should fail - wrong error message
    with pytest.raises(AssertionError, match="Expected error to contain"):
        test.assert_failure(
            {'success': False, 'error': 'Task ABC failed'},
            expected_error='XYZ'
        )


@pytest.mark.asyncio
async def test_assert_output_equals():
    """Test assert_output_equals helper."""
    test = FlowTest()

    result = {
        'status': 'success',
        'outputs': {
            'name': 'Alice',
            'age': 30
        }
    }

    # Should pass
    test.assert_output_equals(result, 'name', 'Alice')
    test.assert_output_equals(result, 'age', 30)

    # Should fail - wrong value
    with pytest.raises(AssertionError, match="Output 'name' mismatch"):
        test.assert_output_equals(result, 'name', 'Bob')

    # Should fail - missing key
    with pytest.raises(AssertionError, match="Output key 'missing' not found"):
        test.assert_output_equals(result, 'missing', 'value')


@pytest.mark.asyncio
async def test_assert_output_contains():
    """Test assert_output_contains helper."""
    test = FlowTest()

    result = {
        'status': 'success',
        'outputs': {
            'message': 'Hello, World!'
        }
    }

    # Should pass
    test.assert_output_contains(result, 'message', 'World')

    # Should fail
    with pytest.raises(AssertionError, match="does not contain"):
        test.assert_output_contains(result, 'message', 'Goodbye')


@pytest.mark.asyncio
async def test_assert_output_matches_schema():
    """Test assert_output_matches_schema helper."""
    test = FlowTest()

    result = {
        'status': 'success',
        'outputs': {
            'user': {
                'name': 'Alice',
                'age': 30,
                'active': True
            }
        }
    }

    # Should pass
    test.assert_output_matches_schema(
        result,
        'user',
        {'name': str, 'age': int, 'active': bool}
    )

    # Should fail - wrong type
    with pytest.raises(AssertionError, match="has wrong type"):
        test.assert_output_matches_schema(
            result,
            'user',
            {'name': str, 'age': str}  # age is int, not str
        )

    # Should fail - missing field
    with pytest.raises(AssertionError, match="missing field"):
        test.assert_output_matches_schema(
            result,
            'user',
            {'name': str, 'email': str}  # email doesn't exist
        )


# Test YAMLFixtureLoader

def test_yaml_fixture_loader_basic():
    """Test loading fixtures from YAML file."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create fixture file
        fixture_yaml = """
test_cases:
  - name: case1
    inputs: {x: 1, y: 2}
    expected_outputs: {sum: 3}

  - name: case2
    inputs: {x: 5, y: 7}
    expected_outputs: {sum: 12}
"""
        fixture_path = Path(tmpdir) / "fixtures.yaml"
        fixture_path.write_text(fixture_yaml)

        # Load fixtures
        test_cases = YAMLFixtureLoader.load_fixtures(fixture_path)

        assert len(test_cases) == 2
        assert test_cases[0]['name'] == 'case1'
        assert test_cases[0]['inputs'] == {'x': 1, 'y': 2}
        assert test_cases[1]['name'] == 'case2'


def test_yaml_fixture_loader_missing_file():
    """Test loading from non-existent file."""
    with pytest.raises(FileNotFoundError):
        YAMLFixtureLoader.load_fixtures('/nonexistent/file.yaml')


def test_yaml_fixture_loader_invalid_format():
    """Test loading invalid fixture format."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create invalid fixture file (missing test_cases key)
        fixture_yaml = """
invalid_key:
  - name: case1
"""
        fixture_path = Path(tmpdir) / "fixtures.yaml"
        fixture_path.write_text(fixture_yaml)

        with pytest.raises(ValueError, match="must contain 'test_cases' key"):
            YAMLFixtureLoader.load_fixtures(fixture_path)


@pytest.mark.asyncio
async def test_yaml_fixture_parametrize_decorator():
    """Test parametrize_from_yaml decorator."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create test flow
        flow_yaml = """
flow: AddFlow
inputs:
  - name: a
    type: integer
  - name: b
    type: integer
steps:
  - task: Add
    id: add
    inputs:
      a: ${inputs.a}
      b: ${inputs.b}
    outputs:
      - sum
outputs:
  - name: result
    value: ${add.sum}
"""
        flow_path = Path(tmpdir) / "flow.yaml"
        flow_path.write_text(flow_yaml)

        flow_py = """
from flowlang import TaskRegistry

def create_task_registry():
    registry = TaskRegistry()

    @registry.register('Add')
    async def add_task(a: int, b: int):
        return {'sum': a + b}

    return registry
"""
        tasks_path = Path(tmpdir) / "flow.py"
        tasks_path.write_text(flow_py)

        # Create fixtures
        fixture_yaml = """
test_cases:
  - name: simple_addition
    inputs: {a: 2, b: 3}
    expected_result: 5

  - name: negative_numbers
    inputs: {a: -5, b: 10}
    expected_result: 5
"""
        fixture_path = Path(tmpdir) / "fixtures.yaml"
        fixture_path.write_text(fixture_yaml)

        # Create test instance
        test = FlowTest()
        test.flow_path = str(flow_path)
        test.tasks_file = str(tasks_path)

        await test.setup_method()

        # Load and run fixtures
        test_cases = YAMLFixtureLoader.load_fixtures(fixture_path)
        for test_case in test_cases:
            result = await test.execute_flow(test_case['inputs'])
            test.assert_success(result)
            test.assert_output_equals(result, 'result', test_case['expected_result'])

        await test.teardown_method()


# Integration test with real flow execution

@pytest.mark.asyncio
async def test_full_integration_with_conditionals():
    """Test FlowTest with a flow containing conditionals."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create flow with conditional
        flow_yaml = """
flow: ConditionalFlow
inputs:
  - name: value
    type: integer
steps:
  - task: CheckValue
    id: check
    inputs:
      value: ${inputs.value}
    outputs:
      - is_positive
  - if: ${check.is_positive}
    then:
      - task: FormatPositive
        id: format_pos
        inputs:
          value: ${inputs.value}
        outputs:
          - message
    else:
      - task: FormatNegative
        id: format_neg
        inputs:
          value: ${inputs.value}
        outputs:
          - message
"""
        flow_path = Path(tmpdir) / "flow.yaml"
        flow_path.write_text(flow_yaml)

        flow_py = """
from flowlang import TaskRegistry

def create_task_registry():
    registry = TaskRegistry()

    @registry.register('CheckValue')
    async def check_value(value: int):
        return {'is_positive': value > 0}

    @registry.register('FormatPositive')
    async def format_positive(value: int):
        return {'message': f'{value} is positive'}

    @registry.register('FormatNegative')
    async def format_negative(value: int):
        return {'message': f'{value} is negative or zero'}

    return registry
"""
        tasks_path = Path(tmpdir) / "flow.py"
        tasks_path.write_text(flow_py)

        # Test with FlowTest
        test = FlowTest()
        test.flow_path = str(flow_path)
        test.tasks_file = str(tasks_path)
        await test.setup_method()

        # Test positive case - flow should succeed
        result = await test.execute_flow({'value': 42})
        test.assert_success(result)

        # Test negative case - flow should also succeed
        result = await test.execute_flow({'value': -5})
        test.assert_success(result)

        await test.teardown_method()


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
