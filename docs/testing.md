# FlowLang Testing Framework

Comprehensive testing framework for FlowLang flows with pytest integration, task mocking, assertion helpers, and YAML fixtures.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [FlowTest Base Class](#flowtest-base-class)
- [Task Mocking](#task-mocking)
- [Assertion Helpers](#assertion-helpers)
- [YAML Fixtures](#yaml-fixtures)
- [Testing Patterns](#testing-patterns)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Overview

The FlowLang testing framework provides:

- **FlowTest**: pytest-compatible base class for flow testing
- **MockTaskRegistry**: Enhanced registry with mocking and call tracking
- **Assertion Helpers**: Specialized assertions for flow results
- **YAML Fixtures**: Data-driven testing with fixture files
- **Async Support**: Full async/await support with pytest-asyncio

## Quick Start

### Installation

The testing framework is included with FlowLang. Ensure you have pytest installed:

```bash
pip install pytest pytest-asyncio
```

### Basic Test Example

```python
from flowlang.testing import FlowTest
import pytest
from pathlib import Path

class TestMyFlow(FlowTest):
    """Test suite for MyFlow"""

    flow_path = str(Path(__file__).parent.parent / "flow.yaml")
    tasks_file = str(Path(__file__).parent.parent / "flow.py")

    @pytest.mark.asyncio
    async def test_success_case(self):
        """Test successful flow execution"""
        await self.setup_method()

        # Mock tasks
        self.mock_task('ProcessData', return_value={'result': 'success'})

        # Execute flow
        result = await self.execute_flow({'input': 'test_data'})

        # Assertions
        self.assert_success(result)
        self.assert_output_equals(result, 'result', 'success')
```

Run tests:

```bash
pytest tests/test_flow.py -v
```

## FlowTest Base Class

The `FlowTest` class provides the foundation for flow testing.

### Class Attributes

```python
class TestMyFlow(FlowTest):
    # Required: path to flow definition
    flow_path: str = "path/to/flow.yaml"

    # Optional: path to task implementations
    tasks_file: str = "path/to/flow.py"
```

### Setup and Teardown

```python
@pytest.mark.asyncio
async def test_example(self):
    # Setup is required before each test
    await self.setup_method()

    # Your test code here

    # Teardown happens automatically
    # (or call explicitly if needed)
    await self.teardown_method()
```

### Executing Flows

```python
# Execute with inputs
result = await self.execute_flow({
    'user_name': 'Alice',
    'email': 'alice@example.com'
})

# Result structure:
# {
#     'success': True/False,
#     'outputs': {...},
#     'error': 'error message' (if failed)
# }
```

### Execution Time

```python
result = await self.execute_flow(inputs)

# Get execution time in seconds
execution_time = self.get_execution_time()
print(f"Flow took {execution_time:.3f}s")
```

## Task Mocking

### Basic Mocking

```python
# Mock with return value
self.mock_task('TaskName', return_value={'key': 'value'})

# Mock with exception
self.mock_task('TaskName', raises=ValueError("Something went wrong"))

# Mock with side effect function
def custom_logic(**kwargs):
    return {'result': kwargs['input'] * 2}

self.mock_task('TaskName', side_effect=custom_logic)
```

### Async Side Effects

```python
# Async side effect
async def async_logic(**kwargs):
    await asyncio.sleep(0.1)
    return {'result': 'async result'}

self.mock_task('TaskName', side_effect=async_logic)
```

### Call Tracking

```python
# Check if task was called
self.assert_task_called('TaskName')

# Check call count
self.assert_task_called('TaskName', times=3)

# Check task was NOT called
self.assert_task_not_called('TaskName')

# Check task was called with specific arguments
self.assert_task_called_with('TaskName', user_id='123', action='create')

# Get call count
count = self.get_task_call_count('TaskName')

# Get call arguments
args = self.get_task_call_args('TaskName', call_index=0)
```

### Clearing Mocks

```python
# Clear all mocks (useful between test cases)
self.clear_mocks()
```

## Assertion Helpers

### Success/Failure

```python
# Assert flow succeeded
self.assert_success(result)

# Assert flow failed
self.assert_failure(result)

# Assert flow failed with specific error
self.assert_failure(result, expected_error="Database connection")
```

### Output Assertions

```python
# Assert output equals expected value
self.assert_output_equals(result, 'user_id', '12345')

# Assert output contains substring
self.assert_output_contains(result, 'message', 'Hello')

# Assert output exists
self.assert_output_exists(result, 'created_at')

# Assert output matches schema
self.assert_output_matches_schema(result, 'user', {
    'id': str,
    'name': str,
    'age': int
})
```

### Error Assertions

```python
# Assert error message contains substring
self.assert_error_contains(result, 'connection timeout')
```

### Performance Assertions

```python
# Assert execution completed within time limit
self.assert_execution_time_under(0.5)  # 500ms
```

## YAML Fixtures

YAML fixtures enable data-driven testing with reusable test cases.

### Fixture File Format

Create `tests/fixtures/test_cases.yaml`:

```yaml
test_cases:
  - name: valid_user
    description: Test with valid user data
    inputs:
      user_name: "Alice"
      email: "alice@example.com"
    mock_tasks:
      ValidateUser:
        return_value:
          is_valid: true
      CreateUser:
        return_value:
          user_id: "12345"
    expected_outputs:
      user_id: "12345"
    expect_success: true

  - name: invalid_email
    description: Test with invalid email
    inputs:
      user_name: "Bob"
      email: "invalid-email"
    mock_tasks:
      ValidateUser:
        return_value:
          is_valid: false
          error: "Invalid email format"
    expect_success: false
    expected_error_contains: "Invalid email"
```

### Loading Fixtures

```python
from flowlang.testing import YAMLFixtureLoader

# Load all test cases
test_cases = YAMLFixtureLoader.load_fixtures('tests/fixtures/test_cases.yaml')

# Iterate over test cases
for test_case in test_cases:
    name = test_case['name']
    inputs = test_case['inputs']
    # ... use test case
```

### Parametrized Tests with Fixtures

```python
@pytest.mark.asyncio
async def test_from_fixtures(self):
    """Test all cases from YAML fixture file"""
    await self.setup_method()

    # Load test cases
    test_cases = YAMLFixtureLoader.load_fixtures('tests/fixtures/test_cases.yaml')

    for test_case in test_cases:
        # Clear mocks for each case
        self.clear_mocks()

        # Apply mocks from fixture
        for task_name, mock_config in test_case.get('mock_tasks', {}).items():
            if 'return_value' in mock_config:
                self.mock_task(task_name, return_value=mock_config['return_value'])
            elif 'raises' in mock_config:
                self.mock_task(task_name, raises=Exception(mock_config['raises']))

        # Execute flow
        result = await self.execute_flow(test_case['inputs'])

        # Verify expectations
        if test_case.get('expect_success'):
            self.assert_success(result)

            # Check expected outputs
            for key, value in test_case.get('expected_outputs', {}).items():
                self.assert_output_equals(result, key, value)
        else:
            self.assert_failure(result)

            if 'expected_error_contains' in test_case:
                self.assert_error_contains(result, test_case['expected_error_contains'])
```

## Testing Patterns

### Pattern 1: Fully Mocked Tests

Test flow structure without requiring task implementations.

```python
@pytest.mark.asyncio
async def test_flow_structure(self):
    """Test flow logic with all tasks mocked"""
    await self.setup_method()

    # Mock all tasks
    self.mock_task('FetchData', return_value={'data': [1, 2, 3]})
    self.mock_task('ProcessData', return_value={'result': 'processed'})
    self.mock_task('SaveResult', return_value={'saved': True})

    # Execute
    result = await self.execute_flow({'id': '123'})

    # Verify flow succeeded
    self.assert_success(result)

    # Verify task execution order
    self.assert_task_called('FetchData', times=1)
    self.assert_task_called('ProcessData', times=1)
    self.assert_task_called('SaveResult', times=1)
```

### Pattern 2: Real Implementation Tests

Test with actual task implementations.

```python
@pytest.mark.skip(reason="Remove when tasks are implemented")
@pytest.mark.asyncio
async def test_real_implementation(self):
    """Test with real task implementations"""
    await self.setup_method()

    # No mocking - uses real implementations
    result = await self.execute_flow({
        'input_data': 'real data'
    })

    # Verify actual behavior
    self.assert_success(result)
    self.assert_output_exists(result, 'processed_data')
```

### Pattern 3: Partial Mocking

Test specific tasks while mocking external dependencies.

```python
@pytest.mark.asyncio
async def test_partial_mocking(self):
    """Test with some real tasks and some mocked"""
    await self.setup_method()

    # Mock only external services
    self.mock_task('SendEmail', return_value={'sent': True})
    self.mock_task('CallExternalAPI', return_value={'status': 'ok'})

    # Real implementations for business logic tasks
    # (ValidateInput, ProcessData, etc. use real code)

    result = await self.execute_flow(inputs)

    self.assert_success(result)
```

### Pattern 4: Error Path Testing

Test error handling and recovery.

```python
@pytest.mark.asyncio
async def test_error_handling(self):
    """Test flow behavior when tasks fail"""
    await self.setup_method()

    # First task succeeds
    self.mock_task('Step1', return_value={'data': 'ok'})

    # Second task fails
    self.mock_task('Step2', raises=ValueError("Database error"))

    # Execute
    result = await self.execute_flow(inputs)

    # Verify failure
    self.assert_failure(result)
    self.assert_error_contains(result, 'Database error')
```

### Pattern 5: Conditional Flow Testing

Test different execution paths.

```python
@pytest.mark.asyncio
async def test_conditional_paths(self):
    """Test if/then/else branches"""
    await self.setup_method()

    # Test the "then" branch
    self.mock_task('CheckCondition', return_value={'is_valid': True})
    self.mock_task('ThenBranchTask', return_value={'result': 'then'})

    result = await self.execute_flow(inputs)

    self.assert_success(result)
    self.assert_task_called('ThenBranchTask')
    self.assert_task_not_called('ElseBranchTask')

    # Clear and test the "else" branch
    self.clear_mocks()
    self.mock_task('CheckCondition', return_value={'is_valid': False})
    self.mock_task('ElseBranchTask', return_value={'result': 'else'})

    result = await self.execute_flow(inputs)

    self.assert_success(result)
    self.assert_task_called('ElseBranchTask')
    self.assert_task_not_called('ThenBranchTask')
```

### Pattern 6: Side Effect Testing

Test complex task logic with side effects.

```python
@pytest.mark.asyncio
async def test_with_side_effects(self):
    """Test using side effect functions"""
    await self.setup_method()

    call_count = 0

    def counting_side_effect(**kwargs):
        nonlocal call_count
        call_count += 1
        return {'count': call_count, 'input': kwargs.get('value')}

    self.mock_task('Counter', side_effect=counting_side_effect)

    result = await self.execute_flow({'value': 'test'})

    self.assert_success(result)
    assert call_count == 1
```

### Pattern 7: Performance Testing

Test execution time and throughput.

```python
@pytest.mark.asyncio
async def test_performance(self):
    """Test flow performance"""
    await self.setup_method()

    # Mock with minimal work
    self.mock_task('Task1', return_value={'data': 'ok'})
    self.mock_task('Task2', return_value={'data': 'ok'})

    # Execute
    result = await self.execute_flow(inputs)

    # Verify performance
    self.assert_success(result)
    self.assert_execution_time_under(0.1)  # Should be fast with mocks
```

### Pattern 8: Data-Driven Testing

Use YAML fixtures for multiple test cases.

```python
@pytest.mark.asyncio
async def test_multiple_scenarios(self):
    """Test multiple scenarios from fixtures"""
    await self.setup_method()

    test_cases = YAMLFixtureLoader.load_fixtures('tests/fixtures/scenarios.yaml')

    for test_case in test_cases:
        # Setup mocks for this case
        self.clear_mocks()
        for task, config in test_case['mock_tasks'].items():
            self.mock_task(task, **config)

        # Execute
        result = await self.execute_flow(test_case['inputs'])

        # Verify
        if test_case['expect_success']:
            self.assert_success(result)
        else:
            self.assert_failure(result)
```

## Best Practices

### 1. Always Call setup_method

```python
@pytest.mark.asyncio
async def test_example(self):
    # Required: call setup_method first
    await self.setup_method()

    # Your test code...
```

### 2. Clear Mocks Between Test Cases

```python
@pytest.mark.asyncio
async def test_multiple_cases(self):
    await self.setup_method()

    # Test case 1
    self.mock_task('Task', return_value={'result': 1})
    result1 = await self.execute_flow(inputs1)

    # Clear before test case 2
    self.clear_mocks()

    # Test case 2
    self.mock_task('Task', return_value={'result': 2})
    result2 = await self.execute_flow(inputs2)
```

### 3. Use Descriptive Test Names

```python
# Good
async def test_user_registration_with_valid_email(self):
    """Test user registration flow with valid email address"""
    pass

# Less clear
async def test_user_reg(self):
    pass
```

### 4. Test One Behavior Per Test

```python
# Good: focused test
async def test_invalid_email_returns_error(self):
    """Test that invalid email returns validation error"""
    await self.setup_method()
    self.mock_task('ValidateEmail', return_value={'valid': False})
    result = await self.execute_flow({'email': 'invalid'})
    self.assert_failure(result)

# Less ideal: testing multiple behaviors
async def test_everything(self):
    # Tests multiple scenarios in one test
    pass
```

### 5. Use pytest.mark.skip for Unimplemented Tests

```python
@pytest.mark.skip(reason="Task not yet implemented")
@pytest.mark.asyncio
async def test_future_feature(self):
    """Test for feature that will be implemented later"""
    pass
```

### 6. Document Mock Behavior

```python
@pytest.mark.asyncio
async def test_example(self):
    await self.setup_method()

    # Mock ValidateUser to return invalid status
    # This simulates a user failing validation
    self.mock_task('ValidateUser', return_value={
        'is_valid': False,
        'reason': 'Email already exists'
    })

    result = await self.execute_flow(inputs)
    self.assert_failure(result)
```

### 7. Use Fixtures for Reusable Test Data

```yaml
# tests/fixtures/common_inputs.yaml
test_cases:
  - name: admin_user
    inputs:
      user_type: "admin"
      permissions: ["read", "write", "delete"]

  - name: regular_user
    inputs:
      user_type: "user"
      permissions: ["read"]
```

### 8. Test Both Success and Failure Paths

```python
@pytest.mark.asyncio
async def test_success_path(self):
    """Test the happy path"""
    await self.setup_method()
    # ... test success case

@pytest.mark.asyncio
async def test_failure_path(self):
    """Test error handling"""
    await self.setup_method()
    # ... test failure case
```

## Examples

### Complete Test Suite Example

See `flows/examples/hello_world/tests/test_flow.py` for a comprehensive example including:

- Fully mocked tests
- Real implementation tests (skipped)
- Error handling tests
- Side effect tests
- Sequential execution tests
- Performance tests

### YAML Fixture Example

See `flows/examples/hello_world/tests/fixtures/test_cases.yaml` for examples of:

- Valid input scenarios
- Invalid input scenarios
- Error scenarios
- Edge cases
- Performance test cases

## Troubleshooting

### Tests Not Being Collected

If pytest doesn't collect your test class:

```python
# Incorrect: FlowTest had __init__ in older versions
class TestMyFlow(FlowTest):
    def __init__(self):  # Don't do this!
        super().__init__()

# Correct: No __init__ needed
class TestMyFlow(FlowTest):
    flow_path = "flow.yaml"
    tasks_file = "flow.py"
```

### Setup/Teardown Warnings

If you see warnings about coroutines not being awaited:

```python
# Make sure you're calling setup_method in each test
@pytest.mark.asyncio
async def test_example(self):
    await self.setup_method()  # Required!
    # ... test code
```

### Module Import Errors

If you get import errors when loading tasks:

```python
# Ensure paths are absolute
from pathlib import Path

class TestMyFlow(FlowTest):
    flow_path = str(Path(__file__).parent.parent / "flow.yaml")
    tasks_file = str(Path(__file__).parent.parent / "flow.py")
```

## Running Tests

```bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_flow.py -v

# Run specific test
pytest tests/test_flow.py::TestMyFlow::test_success_case -v

# Run with coverage
pytest tests/ --cov=flow --cov-report=html

# Run tests matching pattern
pytest tests/ -k "success" -v

# Show print statements
pytest tests/ -v -s
```

## See Also

- [FlowLang Documentation](../CLAUDE.md)
- [Example Tests](../flows/examples/hello_world/tests/test_flow.py)
- [YAML Fixtures](../flows/examples/hello_world/tests/fixtures/test_cases.yaml)
- [pytest Documentation](https://docs.pytest.org/)
- [pytest-asyncio Documentation](https://pytest-asyncio.readthedocs.io/)
