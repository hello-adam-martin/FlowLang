# FlowLang Features

This document provides a comprehensive reference for all implemented features in FlowLang. These are production-ready capabilities that you can use today.

For future enhancements and planned features, see [ideas.md](./ideas.md).

## Overview

FlowLang is a Python-based workflow orchestration language that allows you to describe task flows in YAML format. The project follows a design-first, TDD-style approach to building workflows that can be deployed as REST APIs and integrated with any application.

**Current Status**: 8 out of 17 major features fully implemented

**Completed Feature Categories**:
- Client SDKs (Python and TypeScript)
- Event-Driven Triggers (Webhook and Schedule)
- Flow Composition & Subflows
- Testing Framework
- Flow Templates & Gallery
- Flow Cancellation
- Database Integration Helpers
- Developer Experience Tools

---

## Client SDKs

**Status**: Fully implemented for both Python and TypeScript/JavaScript

**Location**: `src/flowlang/client.py` (Python), `clients/typescript/` (TypeScript)

Enable easy integration with FlowLang servers from any application using type-safe, feature-rich client libraries.

### Python Client SDK

The Python client provides both async and sync methods for flow execution with automatic retry logic and streaming support.

**Installation**:
```bash
pip install flowlang
```

**Basic Usage**:
```python
from flowlang import FlowLangClient

# Async usage
async with FlowLangClient("http://localhost:8000") as client:
    result = await client.execute_flow("HelloWorld", {"user_name": "Alice"})
    print(result.outputs["message"])

# Sync usage
client = FlowLangClient("http://localhost:8000")
result = client.execute_flow_sync("HelloWorld", {"user_name": "Alice"})
print(result.outputs["message"])
```

**Advanced Features**:
```python
# Streaming execution with events
async for event in client.execute_flow_stream("MyFlow", {"input": "value"}):
    if event["event"] == "step_completed":
        print(f"Completed: {event['data']['step_id']}")

# Flow management
flows = await client.list_flows()
info = await client.get_flow_info("MyFlow")
health = await client.health_check()

# Execution management
result = await client.execute_flow("LongFlow", inputs)
execution_id = result.execution_id

# Cancel running execution
await client.cancel_execution("LongFlow", execution_id)

# Check execution status
status = await client.get_execution_status("LongFlow", execution_id)
```

**Implemented Features**:
- Type-safe flow execution with `FlowExecutionResult`
- Async and sync support (both `execute_flow()` and `execute_flow_sync()`)
- Automatic retry logic with exponential backoff
- Streaming support via Server-Sent Events (`execute_flow_stream()`)
- Rich exception handling (`FlowExecutionError`, `FlowNotReadyError`, `FlowNotFoundError`)
- Flow information queries (`list_flows()`, `get_flow_info()`)
- Health checks (`health_check()`)
- Execution management (`cancel_execution()`, `get_execution_status()`)
- Context managers (async `async with` and sync `with`)
- Custom headers for authentication
- Configurable timeouts and retry policies

### TypeScript/JavaScript Client SDK

The TypeScript client provides a modern, type-safe API with zero dependencies and support for both browser and Node.js environments.

**Installation**:
```bash
npm install @flowlang/client
```

**Basic Usage**:
```typescript
import { FlowLangClient } from '@flowlang/client';

const client = new FlowLangClient({ baseUrl: 'http://localhost:8000' });

// Execute a flow
const result = await client.executeFlow('HelloWorld', { user_name: 'Alice' });
console.log(result.outputs.message);
```

**Advanced Features**:
```typescript
// Streaming with events
await client.executeFlowStream('MyFlow', { input: 'value' }, {
  onEvent: (eventType, data) => {
    if (eventType === 'step_completed') {
      console.log(`Completed: ${data.step_id}`);
    }
  },
  onError: (error) => console.error('Stream error:', error),
  onComplete: () => console.log('Stream complete')
});

// Flow management
const flows = await client.listFlows();
const info = await client.getFlowInfo('MyFlow');
const health = await client.healthCheck();

// Execution management
const result = await client.executeFlow('LongFlow', inputs);
await client.cancelExecution('LongFlow', result.execution_id);
const status = await client.getExecutionStatus('LongFlow', result.execution_id);

// Custom configuration
const client = new FlowLangClient({
  baseUrl: 'http://localhost:8000',
  headers: { 'Authorization': 'Bearer token' },
  retries: 3,
  timeout: 30000
});
```

**Implemented Features**:
- Full TypeScript support with generics and complete type definitions
- Promise-based API with modern async/await
- Automatic retry with exponential backoff
- Streaming events via Server-Sent Events
- Rich error classes (`FlowExecutionError`, `FlowNotReadyError`, `FlowNotFoundError`)
- Browser and Node.js support
- Zero dependencies (uses native fetch API)
- Tree-shakeable for minimal bundle size
- Build tooling (tsup for ESM/CJS/types output)
- Testing setup with vitest
- Comprehensive documentation and examples
- Published as `@flowlang/client` npm package

---

## Event-Driven Triggers

**Status**: Webhook and Schedule triggers fully implemented

**Location**: `src/flowlang/triggers/`, `docs/triggers.md`

Enable flows to be triggered automatically by external events such as HTTP webhooks or scheduled times (cron).

### Webhook Triggers

Automatically create HTTP endpoints that trigger flow execution when called.

**Configuration in flow.yaml**:
```yaml
flow: ProcessOrder
triggers:
  - type: webhook
    path: /webhooks/orders/new
    method: POST
    auth:
      type: api_key
      header: X-API-Key
      key: ${WEBHOOK_SECRET}
    async: false  # Sync/async execution
    input_mapping: body
```

**Calling the Webhook**:
```bash
curl -X POST http://localhost:8000/webhooks/orders/new \
  -H "X-API-Key: your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "12345", "amount": 99.99}'
```

**Implemented Features**:
- Automatic webhook endpoint creation (FastAPI routers)
- Authentication:
  - API key authentication (custom header)
  - Bearer token authentication
  - Constant-time comparison for security
- Multiple HTTP methods (GET, POST, PUT, DELETE, PATCH)
- Input mapping strategies:
  - `body`: Extract from request body (JSON)
  - `query`: Extract from query parameters
  - `headers`: Extract from request headers
  - `path`: Extract from path parameters
  - `all`: Combine all sources
- Execution modes:
  - Sync: Wait for flow completion and return results
  - Async: Return immediately, execute in background
- Request metadata injection (`_webhook` in context)
- Hot reload support
- Status tracking and monitoring endpoints

**Example**:
See `flows/examples/webhook_example/` for a complete working example.

### Scheduled Execution

Execute flows automatically on a schedule using cron expressions.

**Configuration in flow.yaml**:
```yaml
flow: DailyReport
triggers:
  - type: schedule
    id: daily_report
    cron: "0 9 * * *"  # Every day at 9am
    timezone: America/New_York
    max_instances: 1
    enabled: true
```

**Cron Expression Format**:
```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

**Common Patterns**:
```yaml
# Every hour at minute 0
cron: "0 * * * *"

# Every day at 2:30 AM
cron: "30 2 * * *"

# Every Monday at 9 AM
cron: "0 9 * * 1"

# Every 15 minutes
cron: "*/15 * * * *"

# First day of every month at midnight
cron: "0 0 1 * *"
```

**Implemented Features**:
- Cron-based scheduling (5-field cron expressions)
- Timezone support (all IANA timezones with DST handling)
- Overlap prevention (max_instances)
- Background scheduler loop with async execution
- Next execution calculation (croniter)
- Schedule metadata injection (`_schedule` in context)
- Multiple schedules per flow
- Enable/disable flag
- Hot reload support
- Status tracking with execution counts

**Example**:
See `flows/examples/schedule_example/` for a complete working example.

### Trigger Management API

Both `FlowServer` and `MultiFlowServer` provide REST endpoints for trigger management:

```bash
# List all triggers for a flow
GET /flows/{flow_name}/triggers

# Get trigger status and metrics
GET /flows/{flow_name}/triggers/{trigger_id}
```

**Response includes**:
- Trigger type and configuration
- Status (running/stopped)
- Execution count
- Error count
- Last execution time
- Next execution time (for schedule triggers)

### Documentation

Comprehensive documentation available in `docs/triggers.md` (1655 lines) covering:
- Quick start for both webhook and schedule triggers
- Configuration reference
- Authentication strategies
- Input mapping patterns
- Error handling
- Security best practices
- Integration examples

---

## Flow Composition & Subflows

**Status**: Fully implemented with discovery, circular dependency detection, and error propagation

**Location**: `src/flowlang/subflow_loader.py`, `src/flowlang/executor.py`, `docs/subflows.md`, `flows/examples/subflow_composition/`

Enable reusable workflows and composition patterns by calling one flow from another, building complex workflows from simple, testable components.

### Basic Subflow Execution

**Syntax in flow.yaml**:
```yaml
steps:
  - subflow: validate_user
    id: validation
    inputs:
      user_id: ${inputs.user_id}
      required_role: "customer"
    outputs:
      - is_valid
      - user_data
      - user_role

  - if: ${validation.is_valid} == true
    then:
      - subflow: process_payment
        id: payment
        inputs:
          user_id: ${validation.user_data.id}
          amount: ${inputs.amount}

      - subflow: send_notification
        id: notify
        inputs:
          user_id: ${inputs.user_id}
          message: "Payment confirmed!"
```

### Subflow Discovery

FlowLang automatically discovers subflows using multiple strategies:

**Method 1: Subdirectory** (Recommended)
```
my_project/
├── flow.yaml (main)
└── validate_user/
    └── flow.yaml (subflow)
```

**Method 2: Direct YAML**
```
my_project/
├── flow.yaml (main)
└── validate_user.yaml (subflow)
```

**Method 3: Sibling Directories**
```
flows/
├── main_flow/flow.yaml
└── validate_user/flow.yaml
```

**Method 4: Parent Directory Search** (up to 3 levels)

### Implemented Features

**SubflowLoader**:
- Intelligent subflow discovery with multiple strategies
- Caching for performance
- `list_available_subflows()` method
- Clear cache functionality

**Circular Dependency Protection**:
- Call stack tracking across all executions
- Automatic detection of cycles (A → B → A)
- Clear error messages with full cycle path
- `enter_subflow()` and `exit_subflow()` with try/finally

**Subflow Execution**:
- Nested executor creation (reuses registry and loader)
- Input passing with variable resolution
- Output capturing and parent context integration
- Cancellation token propagation
- Event emission (subflow_started, subflow_completed, subflow_failed)
- Execution time tracking per subflow

**Error Handling**:
- Error propagation from subflow to parent
- Early exit support from subflows
- on_error handlers for subflow steps
- Automatic cleanup with finally blocks

### Example Flow

Complete working example: `flows/examples/subflow_composition/`

**Structure**:
```
subflow_composition/
├── flow.yaml (OrderCheckout - main flow)
├── validate_user/flow.yaml (user validation)
├── process_payment/flow.yaml (payment processing)
└── send_notification/flow.yaml (notifications)
```

**Main Flow Pattern**:
```yaml
flow: OrderCheckout

steps:
  # Subflow 1: Validate user
  - subflow: validate_user
    id: validation
    inputs:
      user_id: ${inputs.user_id}
      required_role: "customer"
    outputs:
      - is_valid
      - user_data

  # Conditional execution
  - if: ${validation.is_valid} == false
    then:
      - subflow: send_notification
        inputs:
          message: "Validation failed"
      - exit:
          reason: "User validation failed"

  # Subflow 2: Process payment
  - subflow: process_payment
    id: payment
    inputs:
      amount: ${inputs.amount}
      user_id: ${inputs.user_id}
    outputs:
      - transaction_id
    on_error:
      - subflow: send_notification
        inputs:
          message: "Payment failed"

  # Subflow 3: Send success notification
  - subflow: send_notification
    id: notify
    inputs:
      message: "Order confirmed!"
      notification_type: "all"
```

### Python API

```python
from pathlib import Path
from flowlang import FlowExecutor, TaskRegistry, SubflowLoader

# Create loader
loader = SubflowLoader(Path("./flows"))

# List available subflows
subflows = loader.list_available_subflows()
# ['validate_user', 'process_payment', 'send_notification']

# Create executor with loader
registry = TaskRegistry()
executor = FlowExecutor(registry, loader)

# Execute - subflows automatically discovered and loaded
result = await executor.execute_flow(
    flow_yaml,
    inputs={"user_id": "user_123"}
)
```

### Key Benefits

**Modularity**:
- Each subflow handles one concern
- Easy to understand and test
- Changes isolated to specific subflows

**Reusability**:
- Write once, use everywhere
- Consistent behavior across flows
- Reduced code duplication

**Testability**:
- Test each subflow independently
- Mock subflows in parent flow tests
- Build integration tests for composition

**Organization**:
- Clear directory structure
- Self-contained subflows
- Easy to locate and modify

### Documentation

Comprehensive documentation: `docs/subflows.md` (1000+ lines)
- Quick start guide
- Syntax reference
- Discovery strategies
- Error handling patterns
- Best practices
- Complete API reference
- Real-world examples

### Tests

Comprehensive test suite: `tests/test_subflows.py` (8/8 passing)
- Basic subflow execution
- Nested subflows (subflow calling subflow)
- Circular dependency detection
- Error propagation
- Subflow with conditionals
- Discovery methods validation
- Error handling (subflow not found, missing loader)

---

## Testing Framework

**Status**: Fully implemented with pytest integration, mocking, and YAML fixtures

**Location**: `src/flowlang/testing.py`, `docs/testing.md`, example tests in `flows/examples/hello_world/tests/`

Enable thorough testing of flows and tasks with a comprehensive testing framework designed for FlowLang's async execution model.

### FlowTest Base Class

The `FlowTest` base class provides a pytest-compatible foundation for flow testing with built-in mocking and assertion helpers.

**Basic Usage**:
```python
from flowlang.testing import FlowTest
import pytest
from pathlib import Path

class TestHelloWorld(FlowTest):
    flow_path = str(Path(__file__).parent.parent / "flow.yaml")
    tasks_file = str(Path(__file__).parent.parent / "flow.py")

    @pytest.mark.asyncio
    async def test_valid_user(self):
        await self.setup_method()

        # Mock tasks
        self.mock_task('ValidateUser', return_value={'is_valid': True})
        self.mock_task('GenerateGreeting', return_value={
            'greeting': 'Hello, Alice!',
            'timestamp': '2025-10-14T10:00:00Z'
        })

        # Execute flow
        result = await self.execute_flow({"user_name": "Alice"})

        # Assertions
        self.assert_success(result)
        self.assert_output_equals(result, 'message', 'Hello, Alice!')
        self.assert_task_called('ValidateUser', times=1)
```

### Task Mocking

**MockTaskRegistry** provides comprehensive mocking capabilities:

```python
# Mock with return value
self.mock_task('TaskName', return_value={'result': 'value'})

# Mock with exception
self.mock_task('TaskName', raises=ValueError("Invalid input"))

# Mock with side effect function
def custom_behavior(param1, param2):
    return {'computed': param1 + param2}

self.mock_task('TaskName', side_effect=custom_behavior)

# Mock with async side effect
async def async_behavior(param):
    await asyncio.sleep(0.1)
    return {'delayed': param}

self.mock_task('TaskName', side_effect=async_behavior)
```

### Assertion Helpers

**Success/Failure Assertions**:
```python
self.assert_success(result)
self.assert_failure(result)
self.assert_error_contains(result, 'expected error message')
```

**Output Assertions**:
```python
self.assert_output_equals(result, 'field_name', expected_value)
self.assert_output_contains(result, 'field_name', substring)
self.assert_output_exists(result, 'field_name')

# Type checking
self.assert_output_matches_schema(result, 'field_name', {
    'type': 'object',
    'required': ['id', 'name'],
    'properties': {
        'id': {'type': 'string'},
        'name': {'type': 'string'}
    }
})
```

**Task Call Assertions**:
```python
self.assert_task_called('TaskName', times=1)
self.assert_task_not_called('TaskName')
self.assert_task_called_with('TaskName', param1='value1', param2='value2')
```

**Performance Assertions**:
```python
self.assert_execution_time_under(result, 1.0)  # seconds
```

### YAML Fixtures

Load test cases from YAML files for data-driven testing:

**tests/fixtures/test_cases.yaml**:
```yaml
test_cases:
  - name: valid_user
    description: Test greeting for valid user
    inputs:
      user_name: "Alice"
    mock_tasks:
      ValidateUser:
        return_value:
          is_valid: true
      GenerateGreeting:
        return_value:
          greeting: "Hello, Alice!"
    expected_outputs:
      message: "Hello, Alice!"
    expect_success: true

  - name: invalid_user
    description: Test error handling
    inputs:
      user_name: ""
    mock_tasks:
      ValidateUser:
        return_value:
          is_valid: false
    expect_success: false
    expected_error_contains: "validation"
```

**Using YAML Fixtures**:
```python
from flowlang.testing import FlowTest, YAMLFixtureLoader
import pytest

class TestWithFixtures(FlowTest):
    flow_path = "flow.yaml"
    tasks_file = "flow.py"

    @pytest.mark.asyncio
    async def test_from_fixtures(self):
        await self.setup_method()

        loader = YAMLFixtureLoader("tests/fixtures/test_cases.yaml")
        test_cases = loader.load_test_cases()

        for test_case in test_cases:
            # Apply mocks
            for task_name, mock_config in test_case.get('mock_tasks', {}).items():
                self.mock_task(task_name, **mock_config)

            # Execute
            result = await self.execute_flow(test_case['inputs'])

            # Assertions
            if test_case.get('expect_success'):
                self.assert_success(result)
                for key, expected in test_case.get('expected_outputs', {}).items():
                    self.assert_output_equals(result, key, expected)
```

### Scaffolder Integration

When you scaffold a new flow, FlowLang automatically generates test templates:

```bash
flowlang scaffolder scaffold flow.yaml -o ./project
```

Generated test file includes:
- Three test patterns: fully mocked, real implementation, partial mocking
- pytest-asyncio compatible
- Smart test generation based on flow structure
- Example assertions for each test

### Implemented Features

**MockTaskRegistry**:
- Task mocking with `return_value`, `side_effect`, and `raises`
- Call tracking and history
- Assertion methods (`assert_task_called`, `assert_task_called_with`, etc.)
- Async and sync side effects
- Call count and argument inspection

**FlowTest Base Class**:
- pytest-compatible test base class
- Flow loading from YAML and task files
- Execution helpers (`execute_flow`, `setup_method`, `teardown_method`)
- Execution time tracking

**Assertion Helpers**:
- `assert_success()` / `assert_failure()`
- `assert_output_equals()` / `assert_output_contains()` / `assert_output_exists()`
- `assert_output_matches_schema()` - Type checking for outputs
- `assert_error_contains()` - Error message assertions
- `assert_task_called()` / `assert_task_not_called()`
- `assert_task_called_with()` - Argument verification
- `assert_execution_time_under()` - Performance testing

**YAML Fixtures** (YAMLFixtureLoader):
- Load test cases from YAML files
- Data-driven testing support
- Test case parametrization
- Mock configuration in fixtures
- Expected outputs and error assertions

### Example Test Patterns

See comprehensive examples in:
- `flows/examples/hello_world/tests/test_flow.py` - 11 test methods demonstrating all patterns
- `flows/examples/hello_world/tests/fixtures/test_cases.yaml` - YAML fixture examples
- `docs/testing.md` - Complete testing guide (1200+ lines)

### Documentation

Comprehensive testing documentation available in `docs/testing.md` including:
- Quick start guide
- API reference for all testing classes
- 8+ testing patterns with examples
- Best practices
- Troubleshooting guide
- Integration with pytest and pytest-asyncio

---

## Flow Templates & Gallery

**Status**: Core template system implemented with interactive creation

**Location**: `src/flowlang/templates.py`, `scripts/create_flow_from_template.sh`, `templates/`

Create new flow projects from pre-built templates with variable substitution for rapid project initialization.

### Interactive Template Creation

The recommended way to create from templates is using the interactive script:

```bash
./scripts/create_flow_from_template.sh
```

This script:
- Shows available templates with descriptions
- Prompts for template selection
- Prompts for flow name
- Prompts for each template variable with sensible defaults
- Automatically runs scaffolder to generate complete project
- Results in 100% implemented, production-ready flow

### CLI Commands

For programmatic or scripted usage:

```bash
# List available templates
python -m flowlang template list

# Show template variables
python -m flowlang template vars APIIntegration

# Create from template
python -m flowlang template create APIIntegration output/ \
  --var FLOW_NAME=MyAPI \
  --var API_BASE_URL=https://api.example.com \
  --var API_KEY_ENV_VAR=API_KEY \
  --var AUTH_HEADER_NAME=Authorization \
  --var AUTH_HEADER_PREFIX=Bearer
```

### Available Templates

**APIIntegration** (10 tasks, 100% implemented):

A production-ready REST API client template with:
- Authentication (API key or bearer token)
- Retry logic with exponential backoff
- Error handling and classification
- Request/response validation
- Smart error recovery

**Variables**:
- `FLOW_NAME` - Name of your flow
- `FLOW_DESCRIPTION` - Description of what the flow does
- `API_BASE_URL` - Base URL of the API to integrate with
- `API_KEY_ENV_VAR` - Environment variable name for API key
- `AUTH_HEADER_NAME` - HTTP header name for authentication
- `AUTH_HEADER_PREFIX` - Prefix for auth header value (e.g., "Bearer")

**Example Usage**:
```bash
./scripts/create_flow_from_template.sh

# Choose template: 1 (APIIntegration)
# Flow name: GitHubAPI
# Base URL: https://api.github.com
# API key variable: GITHUB_TOKEN
# Header name: Authorization
# Header prefix: token

# Result: flows/GitHubAPI/ with 100% implemented flow
```

### Template Structure

Each template includes:

```
templates/
└── APIIntegration/
    ├── flow.yaml           # Flow definition with {{VARIABLES}}
    ├── flow.py             # Task implementations with {{VARIABLES}}
    ├── README.md           # Documentation template
    └── template_info.yaml  # Metadata and variable definitions
```

**Variable Substitution**:
- Variables use `{{VARIABLE_NAME}}` syntax
- Processed in all file types (YAML, Python, Markdown)
- Binary files copied as-is

### Implemented Features

**Template System**:
- Template discovery and listing
- Variable substitution in all text files
- Variable validation and documentation
- Scaffolder-compatible format
- Smart handling of binary files

**Interactive Creation**:
- Interactive prompts with defaults
- Template selection menu
- Variable input with validation
- Automatic scaffolder integration
- Preserves template implementations via smart merge

**Template Metadata**:
- Template descriptions
- Variable definitions with defaults
- Category/tags for organization
- Usage examples

### Creating Custom Templates

To create your own template:

1. Create a directory in `templates/` (e.g., `templates/MyTemplate/`)
2. Add `flow.yaml`, `flow.py`, and other files with `{{VARIABLES}}`
3. Create `template_info.yaml`:

```yaml
name: MyTemplate
description: Description of what this template does
category: integration
variables:
  - name: FLOW_NAME
    description: Name of the flow
    default: MyFlow
  - name: API_URL
    description: API endpoint URL
    required: true
```

4. Use scaffolder-compatible format in `flow.py`:
```python
def create_task_registry():
    registry = TaskRegistry()

    @registry.register('{{FLOW_NAME}}Task')
    async def task_impl(param):
        # Implementation with {{VARIABLES}}
        return {'result': '{{DEFAULT_VALUE}}'}

    return registry
```

5. Test with interactive script or CLI

### Extensibility

Templates are designed for extension:
- Add new templates by creating template directories
- Template system automatically discovers new templates
- Variable substitution works for any file type
- Community templates can be shared and distributed

---

## Flow Cancellation

**Status**: Fully implemented with execution tracking and cancellation endpoints

**Location**: `src/flowlang/cancellation.py`, `src/flowlang/server.py`

Gracefully cancel running flows with proper cleanup and resource management.

### Cancellation Token

The `CancellationToken` class provides thread-safe cancellation management:

```python
from flowlang.cancellation import CancellationToken

token = CancellationToken()

# Check if cancelled
if token.is_cancelled():
    return {'status': 'cancelled'}

# Cancel with reason
await token.cancel(reason="User requested cancellation")

# Add cleanup handlers (run in LIFO order)
token.add_cleanup_handler(lambda: cleanup_resources())
```

### Flow-Level Cancellation Support

Define cleanup handlers in flow.yaml:

```yaml
flow: DataProcessing

on_cancel:  # Runs when flow is cancelled
  - task: CleanupTempFiles
  - task: ReleaseResources
  - task: SendCancellationNotification

steps:
  - task: LongRunningTask
```

### Task-Level Cleanup

Add cleanup handlers from within tasks:

```python
@registry.register('ProcessData')
async def process_data(data: list, context: FlowContext):
    # Register cleanup handler
    def cleanup():
        # Cleanup logic here
        logging.info("Cleaning up resources")

    context.add_cleanup_handler(cleanup)

    # Check for cancellation periodically
    for item in data:
        if context.is_cancelled():
            return {'status': 'cancelled', 'processed': 0}

        # Process item...

    return {'processed': len(data)}
```

### Server Endpoints

Both `FlowServer` and `MultiFlowServer` support cancellation:

```bash
# Cancel a running execution
POST /flows/{flow_name}/executions/{execution_id}/cancel

# List all executions for a flow
GET /flows/{flow_name}/executions

# Get execution status
GET /flows/{flow_name}/executions/{execution_id}
```

**Example Response**:
```json
{
  "execution_id": "abc123",
  "flow_name": "DataProcessing",
  "status": "cancelled",
  "start_time": "2025-10-14T10:00:00Z",
  "end_time": "2025-10-14T10:05:30Z",
  "duration_seconds": 330.5,
  "cancellation_reason": "User requested cancellation"
}
```

### Python Client SDK

```python
from flowlang import FlowLangClient

async with FlowLangClient("http://localhost:8000") as client:
    # Start execution
    result = await client.execute_flow("LongRunningFlow", inputs)
    execution_id = result.execution_id

    # Cancel execution
    cancel_result = await client.cancel_execution("LongRunningFlow", execution_id)
    print(f"Cancelled: {cancel_result['status']}")

    # Check status
    status = await client.get_execution_status("LongRunningFlow", execution_id)
    print(f"Status: {status['status']}")
```

### TypeScript Client SDK

```typescript
import { FlowLangClient } from '@flowlang/client';

const client = new FlowLangClient({ baseUrl: 'http://localhost:8000' });

// Cancel execution
await client.cancelExecution('LongRunningFlow', executionId);

// Get execution status
const status = await client.getExecutionStatus('LongRunningFlow', executionId);
console.log(`Status: ${status.status}`);
```

### Execution Tracking

The `ExecutionHandle` class tracks execution lifecycle:

```python
from flowlang.cancellation import ExecutionHandle

handle = ExecutionHandle(flow_name="MyFlow")

# Execution completes
handle.complete(result={'output': 'value'})

# Or execution fails
handle.fail(error_message="Task failed")

# Or execution cancelled
await handle.token.cancel(reason="User cancelled")

# Export status
status = handle.to_dict()
# {
#   'execution_id': 'uuid...',
#   'flow_name': 'MyFlow',
#   'status': 'completed',
#   'start_time': '...',
#   'end_time': '...',
#   'duration_seconds': 5.2
# }
```

### Implemented Features

**CancellationToken**:
- Thread-safe cancellation state management
- Automatic cleanup handler execution (LIFO order)
- Check methods: `is_cancelled()`, `check_cancelled()`
- Async cancellation with reason tracking
- Supports multiple cleanup handlers

**ExecutionHandle**:
- Unique execution tracking by UUID
- Status tracking: running, completed, failed, cancelled
- Start/end time and duration tracking
- Result storage for completed executions
- Cancellation reason tracking
- Export to dict for API responses

**Server Integration**:
- Global execution tracking across all flows
- Cancellation endpoints for active executions
- List executions with status filtering
- Execution details retrieval

**Flow Executor Integration**:
- Cancellation checks between steps
- Cancellation checks in loops
- on_cancel handler execution
- Cleanup handler management

**Client SDK Support**:
- Full integration in Python and TypeScript clients
- Cancel, list, and status methods
- Type-safe responses

### Use Cases

- User-initiated cancellation (changed their mind)
- Timeout enforcement (cancel after max duration)
- Resource constraints (cancel low-priority flows)
- Cascading cancellations (parent flow cancelled)
- Emergency shutdowns
- Cost control (stop expensive operations)

---

## Database Integration Helpers

**Status**: Fully implemented with 5 database types and batch operations

**Location**: `src/flowlang/connections/`, `docs/database-integration.md`, `flows/examples/database_batch_import/`

Use databases in flows without writing Python code. Built-in tasks for common database operations with connection pooling and transaction support.

### Supported Databases

FlowLang includes production-ready connection plugins for:
- PostgreSQL (`pg_*` tasks)
- MySQL (`mysql_*` tasks)
- SQLite (`sqlite_*` tasks)
- MongoDB (`mongo_*` tasks)
- Redis (`redis_*` tasks)

### Connection Configuration

Define connections in flow.yaml:

```yaml
connections:
  db:
    type: postgres
    url: ${env.DATABASE_URL}
    pool_size: 10
    timeout: 30

  cache:
    type: redis
    url: ${env.REDIS_URL}
    max_connections: 50

  mongo:
    type: mongodb
    url: ${env.MONGODB_URL}
    database: myapp
```

### PostgreSQL Tasks

**Query (SELECT)**:
```yaml
- pg_query:
    id: fetch_users
    connection: db
    query: "SELECT * FROM users WHERE created_at > $1 LIMIT 100"
    params: [${inputs.since_date}]
    outputs:
      - rows
      - count
```

**Execute (INSERT/UPDATE/DELETE)**:
```yaml
- pg_execute:
    id: update_status
    connection: db
    query: "UPDATE orders SET status = $1 WHERE order_id = $2"
    params: ["processed", ${inputs.order_id}]
    outputs:
      - rows_affected
```

**Transaction (Multiple Operations)**:
```yaml
- pg_transaction:
    id: transfer
    connection: db
    queries:
      - query: "UPDATE accounts SET balance = balance - $1 WHERE id = $2"
        params: [${inputs.amount}, ${inputs.from_account}]
      - query: "UPDATE accounts SET balance = balance + $1 WHERE id = $2"
        params: [${inputs.amount}, ${inputs.to_account}]
    outputs:
      - results
      - count
```

**Batch Insert (10-30x Faster)**:
```yaml
- pg_batch_insert:
    id: import_users
    connection: db
    table: users
    records: ${inputs.user_list}
    batch_size: 1000
    outputs:
      - inserted_count
      - batches
      - table
```

**Batch Update (10-30x Faster)**:
```yaml
- pg_batch_update:
    id: update_prices
    connection: db
    table: products
    key_field: product_id
    updates: ${inputs.price_changes}
    batch_size: 1000
    outputs:
      - updated_count
      - batches
```

### MySQL Tasks

All PostgreSQL tasks are available with `mysql_` prefix:
- `mysql_query`
- `mysql_execute`
- `mysql_transaction`
- `mysql_batch_insert`
- `mysql_batch_update`

**Configuration**:
```yaml
connections:
  db:
    type: mysql
    host: localhost
    port: 3306
    user: ${env.MYSQL_USER}
    password: ${env.MYSQL_PASSWORD}
    database: myapp
```

### SQLite Tasks

All PostgreSQL tasks are available with `sqlite_` prefix:
- `sqlite_query`
- `sqlite_execute`
- `sqlite_transaction`
- `sqlite_batch_insert`
- `sqlite_batch_update`

**Configuration**:
```yaml
connections:
  db:
    type: sqlite
    database: /path/to/database.db
```

### MongoDB Tasks

**Find Multiple Documents**:
```yaml
- mongo_find:
    id: find_users
    connection: mongo
    collection: users
    filter: {"status": "active"}
    limit: 100
    outputs:
      - documents
      - count
```

**Find One Document**:
```yaml
- mongo_find_one:
    id: find_user
    connection: mongo
    collection: users
    filter: {"user_id": ${inputs.user_id}}
    outputs:
      - document
```

**Insert**:
```yaml
- mongo_insert:
    id: create_user
    connection: mongo
    collection: users
    document: ${inputs.user_data}
    outputs:
      - inserted_id
```

**Update**:
```yaml
- mongo_update:
    id: update_user
    connection: mongo
    collection: users
    filter: {"user_id": ${inputs.user_id}}
    update: {"$set": {"status": "inactive"}}
    outputs:
      - matched_count
      - modified_count
```

**Delete**:
```yaml
- mongo_delete:
    id: delete_user
    connection: mongo
    collection: users
    filter: {"user_id": ${inputs.user_id}}
    outputs:
      - deleted_count
```

**Count**:
```yaml
- mongo_count:
    id: count_users
    connection: mongo
    collection: users
    filter: {"status": "active"}
    outputs:
      - count
```

**Aggregate**:
```yaml
- mongo_aggregate:
    id: user_stats
    connection: mongo
    collection: orders
    pipeline:
      - {"$match": {"status": "completed"}}
      - {"$group": {"_id": "$user_id", "total": {"$sum": "$amount"}}}
    outputs:
      - results
      - count
```

### Redis Tasks

**Get**:
```yaml
- redis_get:
    id: get_cache
    connection: cache
    key: "user:${inputs.user_id}"
    outputs:
      - value
```

**Set**:
```yaml
- redis_set:
    id: set_cache
    connection: cache
    key: "user:${inputs.user_id}"
    value: ${inputs.user_data}
    ex: 3600  # Expiration in seconds
    outputs:
      - success
```

**Delete**:
```yaml
- redis_delete:
    id: clear_cache
    connection: cache
    key: "user:${inputs.user_id}"
    outputs:
      - deleted
```

**Exists**:
```yaml
- redis_exists:
    id: check_cache
    connection: cache
    key: "user:${inputs.user_id}"
    outputs:
      - exists
```

**Expire**:
```yaml
- redis_expire:
    id: set_expiry
    connection: cache
    key: "session:${inputs.session_id}"
    seconds: 1800
    outputs:
      - success
```

**Increment**:
```yaml
- redis_incr:
    id: increment_counter
    connection: cache
    key: "page_views:${inputs.page_id}"
    outputs:
      - new_value
```

**Hash Operations**:
```yaml
- redis_hgetall:
    id: get_user_data
    connection: cache
    key: "user:${inputs.user_id}"
    outputs:
      - hash

- redis_hset:
    id: update_field
    connection: cache
    key: "user:${inputs.user_id}"
    field: "last_seen"
    value: ${inputs.timestamp}
    outputs:
      - created
```

### Batch Operations Performance

Batch operations provide massive performance improvements:

**Benchmark Results** (1000 records):
- Individual inserts: 12.5 seconds
- Batch insert (batch_size=500): 0.8 seconds
- **Speedup: 15.6x faster**

**When to Use Batch Operations**:
- Importing data from files (CSV, JSON)
- Bulk updates from API responses
- Data migrations
- Any operation touching >100 records

**Best Practices**:
- Use batch_size between 500-1000 for optimal performance
- Monitor memory usage for very large batches
- Use transactions for consistency requirements

### Connection Injection

Use database connections in custom tasks:

```python
from flowlang.connections import get_connection

@registry.register('CustomDatabaseTask')
async def custom_task(user_id: str, context: FlowContext):
    # Get connection from context
    db = await get_connection(context, 'db')

    # Use connection
    result = await db.fetchrow(
        "SELECT * FROM users WHERE id = $1",
        user_id
    )

    return {'user': dict(result)}
```

### CLI Commands

```bash
# List available database plugins
flowlang connection list

# Show plugin details
flowlang connection info postgres

# Install plugin dependencies
flowlang connection install postgres

# Generate connection config
flowlang connection scaffold postgres --name primary_db
```

### Example Flow

Complete working example with batch operations:
- **Location**: `flows/examples/database_batch_import/`
- **Features**: Batch insert, batch update, validation, error handling, performance metrics
- **Status**: 100% implemented (6/6 tasks)

**Usage**:
```bash
cd flows/examples/database_batch_import
./tools/start_server.sh

curl -X POST http://localhost:8000/flows/DatabaseBatchImport/execute \
  -H "Content-Type: application/json" \
  -d '{"inputs": {"source": "sample", "record_count": 1000, "batch_size": 500}}'
```

### Implemented Features

- Multiple Database Support: PostgreSQL, MySQL, SQLite, MongoDB, Redis
- Connection Pooling: Automatic pooling with asyncpg, aiomysql
- Transaction Support: Multi-step atomic operations with automatic rollback
- Query Parameterization: SQL injection prevention
- Batch Operations: 10-30x faster bulk insert/update
- Connection Injection: Automatic injection into custom tasks
- Environment Variables: Secure credential management
- Error Handling: Comprehensive exception handling with retries
- Zero-boilerplate: Use database tasks directly in YAML without Python code

### Documentation

Comprehensive documentation available in `docs/database-integration.md` (1000+ lines):
- Quick start for all 5 database types
- Connection configuration
- All built-in tasks with examples
- Batch operations with performance benchmarks
- Best practices and security guidelines
- CLI commands for connection management

### Security Best Practices

- Always use parameterized queries (never string interpolation)
- Store credentials in environment variables
- Use least-privilege database users
- Enable SSL/TLS for production connections
- Monitor and log database access
- Use connection pooling limits

---

## Developer Experience Tools

**Status**: Fully implemented

**Location**: `src/flowlang/cli_*.py`, `src/flowlang/__main__.py`

Comprehensive CLI tools for project management, environment validation, and developer productivity.

### flowlang init - Interactive Project Creation

Create new flow projects with an interactive wizard:

```bash
# Interactive mode (recommended)
flowlang init

# With options
flowlang init my-project --template APIIntegration --name MyAPI

# Quick start with defaults
flowlang init . --name QuickFlow --description "A quick test flow"

# Skip git initialization
flowlang init --no-git
```

**Features**:
- Template selection with descriptions
- Interactive prompts for all template variables
- Sensible defaults for all options
- Automatic git repository initialization
- Complete project scaffolding
- Creates fully functional flow with tests

**Workflow**:
1. Choose target directory (or use current)
2. Select template from available templates
3. Enter flow name and description
4. Provide template-specific variables
5. Git init (optional)
6. Result: Complete, working flow project

### flowlang doctor - Environment Validation

Validate your FlowLang installation and environment:

```bash
# Quick health check
flowlang doctor

# Detailed diagnostics
flowlang doctor --verbose

# Auto-fix common issues
flowlang doctor --fix
```

**Checks**:
- Python version (>= 3.8 required)
- FlowLang installation and version
- Virtual environment detection and status
- Git availability
- Template system validation
- Core dependencies:
  - pyyaml (YAML parsing)
  - fastapi (REST API)
  - uvicorn (ASGI server)
  - pydantic (data validation)

**Output**:
```
FlowLang Environment Check
==========================

✓ Python 3.12.0 (>= 3.8 required)
✓ FlowLang 0.1.0 installed
✓ Virtual environment: /path/to/myenv
✓ Git available
✓ Template system OK (1 templates)
✓ Dependencies installed:
  - pyyaml 6.0.1
  - fastapi 0.104.1
  - uvicorn 0.24.0
  - pydantic 2.5.0

All checks passed! ✓
```

**Auto-Fix**:
The `--fix` flag attempts to automatically resolve common issues:
- Install missing dependencies
- Repair template system
- Fix virtual environment issues

### flowlang version - Version Information

Display version and environment details:

```bash
# Human-readable format
flowlang version

# JSON output
flowlang version --json
```

**Output**:
```
FlowLang version 0.1.0
Python 3.12.0
Platform: darwin
```

**JSON Format**:
```json
{
  "flowlang_version": "0.1.0",
  "python_version": "3.12.0",
  "platform": "darwin",
  "install_path": "/path/to/flowlang"
}
```

### flowlang upgrade - Update FlowLang

Upgrade to the latest version of FlowLang:

```bash
# Check for updates (without installing)
flowlang upgrade --check

# Upgrade to latest stable
flowlang upgrade

# Include pre-release versions
flowlang upgrade --pre
```

**Features**:
- Checks PyPI for latest version
- Shows current and available versions
- Confirms before upgrading
- Supports pre-release versions
- Uses pip for safe upgrades

### flowlang completions - Shell Completion

Generate shell completion scripts for bash, zsh, or fish:

```bash
# Bash
flowlang completions bash >> ~/.bash_completion
source ~/.bash_completion

# Zsh
mkdir -p ~/.zsh/completions
flowlang completions zsh > ~/.zsh/completions/_flowlang
# Add to ~/.zshrc: fpath=(~/.zsh/completions $fpath)
# Then run: compinit

# Fish
mkdir -p ~/.config/fish/completions
flowlang completions fish > ~/.config/fish/completions/flowlang.fish
```

**Completion Features**:
- Command completion (init, doctor, version, etc.)
- Option completion (--template, --verbose, etc.)
- Context-aware suggestions
- Works with partial commands

### Entry Points

FlowLang CLI is accessible in two ways:

**Console Script** (after pip install):
```bash
flowlang init
flowlang doctor
flowlang version
```

**Module Entry** (always available):
```bash
python -m flowlang init
python -m flowlang doctor
python -m flowlang version
```

### Other Development Commands

**Flow Validation**:
```bash
python -m flowlang validate flow.yaml --tasks-file flow.py
```

**Watch Mode** (live testing):
```bash
python -m flowlang watch flow.yaml --test-inputs inputs.json
```

**Template Management**:
```bash
python -m flowlang template list
python -m flowlang template create APIIntegration ./output --var KEY=value
```

**Scaffolder**:
```bash
python -m flowlang scaffolder scaffold flow.yaml -o ./project
python -m flowlang scaffolder update flow.yaml -o ./project
```

**Server**:
```bash
python -m flowlang.server --project ./my-project --port 8000 --reload
python -m flowlang.server --multi ./flows --reload
```

### Implemented Features

**CLI Framework**:
- Consistent command structure
- Rich help text for all commands
- Color-coded output (success/error/warning)
- Progress indicators for long operations
- Interactive prompts with defaults
- Error handling with helpful messages

**Developer Productivity**:
- Quick project setup (init)
- Environment troubleshooting (doctor)
- Easy updates (upgrade)
- Shell integration (completions)
- Version tracking (version)

**Integration**:
- Works with template system
- Integrates with scaffolder
- Git repository management
- Virtual environment detection
- Dependency management

---

## Summary

FlowLang has implemented 8 major feature categories, providing a solid foundation for workflow orchestration:

1. **Client SDKs** - Python and TypeScript clients for easy integration
2. **Event-Driven Triggers** - Webhook and schedule triggers for automation
3. **Flow Composition & Subflows** - Modular, reusable workflow patterns
4. **Testing Framework** - Comprehensive testing with pytest integration
5. **Flow Templates & Gallery** - Rapid project creation from templates
6. **Flow Cancellation** - Graceful cancellation with cleanup
7. **Database Integration** - Built-in tasks for 5 database types with batch operations
8. **Developer Experience Tools** - CLI commands for productivity

These features make FlowLang production-ready for:
- API integrations and orchestration
- Data processing pipelines
- Event-driven automation
- Scheduled workflows
- Database operations at scale
- Multi-step business processes
- Complex conditional logic
- Reusable workflow components

For future enhancements and planned features, see [ideas.md](./ideas.md).

For development guidelines and architecture details, see [CLAUDE.md](../CLAUDE.md).
