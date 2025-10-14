# Flow Composition & Subflows

FlowLang supports **subflows** - the ability to call one flow from another, enabling modular, reusable workflow architectures.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Subflow Syntax](#subflow-syntax)
- [Subflow Discovery](#subflow-discovery)
- [Data Flow](#data-flow)
- [Error Handling](#error-handling)
- [Circular Dependency Protection](#circular-dependency-protection)
- [Best Practices](#best-practices)
- [Examples](#examples)
- [API Reference](#api-reference)

## Overview

### What Are Subflows?

Subflows allow you to:

- **Decompose complex workflows** into smaller, manageable pieces
- **Reuse common logic** across multiple flows
- **Organize workflows** by domain or functionality
- **Test components independently** before composing them
- **Maintain separation of concerns** in your architecture

### Benefits

**Modularity**:
- Each subflow handles one specific concern
- Easy to understand, test, and maintain
- Changes isolated to specific subflows

**Reusability**:
- Write once, use everywhere
- Consistent behavior across flows
- Reduce code duplication

**Testability**:
- Test each subflow independently
- Mock subflows when testing parent flows
- Build integration tests for composition

**Organization**:
- Clear directory structure
- Self-contained subflows
- Easy to locate and modify

## Quick Start

### 1. Create a Subflow

Create `validate_user/flow.yaml`:

```yaml
flow: ValidateUser
description: Validate user credentials

inputs:
  - name: user_id
    type: string
    required: true

steps:
  - task: CheckUserExists
    id: check
    inputs:
      user_id: ${inputs.user_id}
    outputs:
      - exists
      - user_data

outputs:
  - name: is_valid
    value: ${check.exists}
  - name: user_data
    value: ${check.user_data}
```

### 2. Call the Subflow

In your main `flow.yaml`:

```yaml
flow: MainFlow
description: Main flow using subflow

inputs:
  - name: user_id
    type: string

steps:
  - subflow: validate_user
    id: validation
    inputs:
      user_id: ${inputs.user_id}
    outputs:
      - is_valid
      - user_data

  - if: ${validation.is_valid} == true
    then:
      - task: ProcessUser
        inputs:
          user: ${validation.user_data}

outputs:
  - name: validated
    value: ${validation.is_valid}
```

### 3. Execute with SubflowLoader

```python
from pathlib import Path
from flowlang import FlowExecutor, TaskRegistry, SubflowLoader

# Create loader pointing to directory containing subflows
loader = SubflowLoader(Path("./flows"))

# Create executor with loader
registry = TaskRegistry()
# ... register tasks ...

executor = FlowExecutor(registry, loader)

# Execute flow - subflows are automatically discovered
result = await executor.execute_flow(
    flow_yaml,
    inputs={"user_id": "user_123"}
)
```

## Subflow Syntax

### Basic Subflow Call

```yaml
steps:
  - subflow: subflow_name
    id: step_id
    inputs:
      param1: ${inputs.value}
      param2: "literal"
    outputs:
      - output1
      - output2
```

### Components

**`subflow`** (required):
- Name of the subflow to call
- Must match a discoverable flow (see [Subflow Discovery](#subflow-discovery))

**`id`** (optional):
- Step identifier for referencing outputs
- Defaults to subflow name if not specified

**`inputs`** (optional):
- Input parameters to pass to the subflow
- Can use variable resolution (`${...}`)
- Must match subflow's declared inputs

**`outputs`** (optional):
- List of outputs to capture from subflow
- References use step_id: `${step_id.output_name}`

### Conditional Subflow Execution

```yaml
- if: ${condition}
  then:
    - subflow: success_flow
      id: success
      inputs:
        data: ${inputs.data}
  else:
    - subflow: failure_flow
      id: failure
      inputs:
        error: "Condition failed"
```

### Subflow in Loops

```yaml
- for_each: ${inputs.items}
  as: item
  do:
    - subflow: process_item
      id: process
      inputs:
        item_data: ${item}
```

### Multiple Subflow Calls

```yaml
steps:
  # Call 1
  - subflow: validate
    id: validation
    inputs:
      user_id: ${inputs.user_id}

  # Call 2 (uses output from Call 1)
  - subflow: process
    id: processing
    inputs:
      user_data: ${validation.user_data}

  # Call 3
  - subflow: notify
    id: notification
    inputs:
      result: ${processing.result}
```

## Subflow Discovery

The `SubflowLoader` automatically discovers subflows using multiple strategies.

### Discovery Order

1. **Subdirectory with flow.yaml**: `{base_path}/{subflow_name}/flow.yaml`
2. **Direct YAML file**: `{base_path}/{subflow_name}.yaml`
3. **Sibling directory**: `{base_path}/../{subflow_name}/flow.yaml`
4. **Parent directories**: Up to 3 levels up

### Directory Structure Examples

**Method 1: Subdirectories** (Recommended)
```
my_project/
├── flow.yaml (main flow)
└── validate_user/
    └── flow.yaml (subflow)
```

**Method 2: Direct YAML Files**
```
my_project/
├── flow.yaml (main flow)
└── validate_user.yaml (subflow)
```

**Method 3: Sibling Directories**
```
flows/
├── main_flow/
│   └── flow.yaml (calls validate_user)
└── validate_user/
    └── flow.yaml (subflow)
```

### List Available Subflows

```python
from pathlib import Path
from flowlang import SubflowLoader

loader = SubflowLoader(Path("./flows"))
subflows = loader.list_available_subflows()
print(subflows)  # ['validate_user', 'process_payment', 'send_notification']
```

### Caching

Subflows are cached after first load for performance:

```python
# First call: Loads from disk
flow_yaml, flow_def = loader.load_subflow("validate_user")

# Second call: Returns from cache
flow_yaml, flow_def = loader.load_subflow("validate_user")

# Clear cache if needed
loader.clear_cache()
```

## Data Flow

### Passing Data to Subflows

```yaml
- subflow: process_data
  id: process
  inputs:
    # Simple value
    user_id: ${inputs.user_id}

    # Nested field access
    email: ${validation.user_data.email}

    # Complex object
    config:
      timeout: 30
      retries: 3

    # List
    items: ${previous_step.items}
```

### Receiving Data from Subflows

```yaml
- subflow: validate_user
  id: validation
  outputs:
    - is_valid
    - user_data
    - user_role

# Access subflow outputs
- task: ProcessUser
  inputs:
    # Direct output
    valid: ${validation.is_valid}

    # Nested field from output
    email: ${validation.user_data.email}

    # Full output object
    user: ${validation.user_data}
```

### Nested Contexts

Each subflow executes in its own context:

```
Parent Flow Context
├── inputs: {user_id: "123"}
├── outputs: {validation: {...}}
│
└─> Subflow Context (validate_user)
    ├── inputs: {user_id: "123"}  # Passed from parent
    └── outputs: {is_valid: true, user_data: {...}}  # Returned to parent
```

Subflows cannot access parent context directly - all data must be passed via `inputs`.

## Error Handling

### Errors Propagate to Parent

If a subflow fails, the error propagates to the parent flow:

```yaml
- subflow: process_payment
  id: payment
  inputs:
    amount: ${inputs.amount}
  on_error:
    # Handle subflow failure
    - task: LogError
      inputs:
        error: "Payment processing failed"
    - subflow: send_notification
      inputs:
        message: "Payment failed"
    - exit:
        reason: "Cannot complete without payment"
```

### Subflow Error Handling

Subflows can handle their own errors:

```yaml
# In subflow: process_payment/flow.yaml
steps:
  - task: ChargeCard
    id: charge
    inputs:
      amount: ${inputs.amount}
    retry:
      max_attempts: 3
      delay: 2
      backoff: 2
    on_error:
      - task: LogPaymentError
      - exit:
          reason: "Payment method declined"
          outputs:
            success: false
            error: "Card declined"
```

### Early Exit from Subflows

Subflows can exit early and return partial outputs:

```yaml
# In subflow
- if: ${validation_failed}
  then:
    - exit:
        reason: "Validation failed"
        outputs:
          is_valid: false
          reason: "User not found"
```

Parent receives the outputs:

```yaml
# In parent
- subflow: validate_user
  id: validation
  outputs:
    - is_valid
    - reason

- if: ${validation.is_valid} == false
  then:
    - task: HandleInvalidUser
      inputs:
        reason: ${validation.reason}
```

## Circular Dependency Protection

FlowLang automatically detects circular dependencies.

### How It Works

The `SubflowLoader` maintains a call stack:

```
Flow A calls Flow B
  └─> Flow B calls Flow C
        └─> Flow C calls Flow A  ❌ CIRCULAR DEPENDENCY!
```

Error message:
```
Circular subflow dependency detected: A → B → C → A
```

### Call Stack Tracking

```python
loader = SubflowLoader(base_path)

# Before entering subflow
loader.enter_subflow("validate_user")

try:
    # Execute subflow
    ...
finally:
    # Always exit, even on error
    loader.exit_subflow("validate_user")

# Check current stack
stack = loader.get_call_stack()
print(stack)  # ['main_flow', 'validate_user']
```

### Avoiding Circular Dependencies

**Bad Design** (Circular):
```
FlowA → FlowB → FlowA  ❌
```

**Good Design** (Extract Common Logic):
```
FlowA → CommonFlow
FlowB → CommonFlow  ✅
```

## Best Practices

### 1. Keep Subflows Focused

Each subflow should have a single, clear responsibility.

✅ **Good**:
```
validate_user/     # Only validates users
process_payment/   # Only handles payments
send_notification/ # Only sends notifications
```

❌ **Bad**:
```
do_everything/     # Too broad, hard to reuse
```

### 2. Define Clear Interfaces

Document inputs and outputs clearly:

```yaml
flow: ValidateUser
description: Validate user credentials and permissions

inputs:
  - name: user_id
    type: string
    required: true
    description: User ID to validate

  - name: required_role
    type: string
    required: false
    description: Required role for access (default: any)

outputs:
  - name: is_valid
    value: ${check.is_valid}
    # Boolean indicating if user passed validation

  - name: user_data
    value: ${check.user_data}
    # Complete user object if valid
```

### 3. Make Subflows Reusable

Avoid hard-coding values specific to one use case:

✅ **Good** (Parameterized):
```yaml
inputs:
  - name: required_role
    type: string  # Configurable

steps:
  - task: CheckRole
    inputs:
      role: ${inputs.required_role}  # Uses parameter
```

❌ **Bad** (Hard-coded):
```yaml
steps:
  - task: CheckRole
    inputs:
      role: "admin"  # Fixed value, not reusable
```

### 4. Handle Errors Gracefully

Subflows should either succeed completely or fail with clear messages:

```yaml
- if: ${validation_failed}
  then:
    - exit:
        reason: "User validation failed"  # Clear reason
        outputs:
          success: false
          error: "User ${inputs.user_id} not found or inactive"  # Detailed message
```

### 5. Use Descriptive Names

Subflow names should clearly indicate their purpose:

✅ **Good**:
- `validate_user`
- `process_payment`
- `send_confirmation_email`

❌ **Bad**:
- `flow1`
- `helper`
- `process`

### 6. Organize with Directories

For large projects, group related subflows:

```
my_project/
├── flow.yaml (main)
├── validation/
│   ├── validate_user/
│   ├── validate_order/
│   └── validate_payment_method/
├── payment/
│   ├── process_payment/
│   └── refund_payment/
└── notifications/
    ├── send_email/
    ├── send_sms/
    └── send_push/
```

### 7. Test Independently

Test each subflow in isolation before composition:

```python
# Test subflow alone
async def test_validate_user():
    loader = SubflowLoader(Path("./flows"))
    executor = FlowExecutor(registry, loader)

    result = await executor.execute_flow(
        "validate_user/flow.yaml",
        inputs={"user_id": "test_user"}
    )

    assert result['success']
    assert result['outputs']['is_valid']
```

### 8. Document Dependencies

In README or comments, list what subflows a flow uses:

```yaml
flow: OrderCheckout
description: |
  Complete order checkout workflow.

  **Subflows Used**:
  - validate_user: Verify user credentials
  - process_payment: Handle payment transaction
  - send_notification: Send confirmation
```

## Examples

### Example 1: User Authentication Flow

```yaml
flow: AuthenticateUser

inputs:
  - name: username
    type: string
  - name: password
    type: string

steps:
  - subflow: validate_credentials
    id: validation
    inputs:
      username: ${inputs.username}
      password: ${inputs.password}
    outputs:
      - is_valid
      - user_id

  - if: ${validation.is_valid} == true
    then:
      - subflow: create_session
        id: session
        inputs:
          user_id: ${validation.user_id}
        outputs:
          - session_token
          - expires_at

      - subflow: log_login
        id: log
        inputs:
          user_id: ${validation.user_id}
          timestamp: ${session.expires_at}

outputs:
  - name: success
    value: ${validation.is_valid}
  - name: session_token
    value: ${session.session_token}
```

### Example 2: Data Processing Pipeline

```yaml
flow: ProcessDataPipeline

inputs:
  - name: data_source
    type: string

steps:
  - subflow: extract_data
    id: extract
    inputs:
      source: ${inputs.data_source}
    outputs:
      - raw_data
      - record_count

  - subflow: transform_data
    id: transform
    inputs:
      data: ${extract.raw_data}
    outputs:
      - transformed_data
      - errors

  - subflow: validate_data
    id: validate
    inputs:
      data: ${transform.transformed_data}
    outputs:
      - valid_records
      - invalid_records

  - subflow: load_data
    id: load
    inputs:
      records: ${validate.valid_records}
    outputs:
      - loaded_count
      - database_id

outputs:
  - name: success
    value: true
  - name: records_processed
    value: ${load.loaded_count}
  - name: errors
    value: ${transform.errors}
```

### Example 3: Approval Workflow

```yaml
flow: ApprovalWorkflow

inputs:
  - name: request_id
    type: string
  - name: approver_id
    type: string

steps:
  - subflow: validate_request
    id: request_validation
    inputs:
      request_id: ${inputs.request_id}
    outputs:
      - is_valid
      - request_data

  - subflow: validate_approver
    id: approver_validation
    inputs:
      approver_id: ${inputs.approver_id}
      required_role: "approver"
    outputs:
      - is_valid
      - approver_data

  - if:
      all:
        - "${request_validation.is_valid} == true"
        - "${approver_validation.is_valid} == true"
    then:
      - subflow: record_approval
        id: approval
        inputs:
          request_id: ${inputs.request_id}
          approver_id: ${inputs.approver_id}

      - subflow: notify_requester
        id: notification
        inputs:
          user_id: ${request_validation.request_data.requester_id}
          message: "Your request has been approved"

outputs:
  - name: approved
    value: true
  - name: approval_id
    value: ${approval.approval_id}
```

## API Reference

### SubflowLoader

**Location**: `src/flowlang/subflow_loader.py`

#### Constructor

```python
SubflowLoader(base_path: Optional[Path] = None)
```

**Parameters**:
- `base_path`: Base directory for subflow discovery (defaults to current directory)

#### Methods

**`load_subflow(subflow_name: str) -> Tuple[str, Dict]`**

Load a subflow by name.

```python
flow_yaml, flow_def = loader.load_subflow("validate_user")
```

**Returns**: Tuple of (yaml_string, flow_definition_dict)

**Raises**:
- `FlowExecutionError`: If subflow not found
- `FlowValidationError`: If subflow YAML is invalid

---

**`enter_subflow(subflow_name: str)`**

Mark entry into a subflow (for circular dependency detection).

```python
loader.enter_subflow("validate_user")
```

**Raises**: `FlowExecutionError` if circular dependency detected

---

**`exit_subflow(subflow_name: str)`**

Mark exit from a subflow.

```python
loader.exit_subflow("validate_user")
```

---

**`get_call_stack() -> List[str]`**

Get the current subflow call stack.

```python
stack = loader.get_call_stack()
print(stack)  # ['main_flow', 'validate_user', 'check_permissions']
```

---

**`list_available_subflows() -> List[str]`**

List all discoverable subflows in the base path.

```python
subflows = loader.list_available_subflows()
print(subflows)  # ['validate_user', 'process_payment', ...]
```

---

**`clear_cache()`**

Clear the subflow cache.

```python
loader.clear_cache()
```

### FlowExecutor with Subflows

**Constructor**:

```python
FlowExecutor(registry: TaskRegistry, subflow_loader: Optional[SubflowLoader] = None)
```

**Parameters**:
- `registry`: TaskRegistry with task implementations
- `subflow_loader`: Optional SubflowLoader for subflow discovery

**Example**:

```python
from flowlang import FlowExecutor, TaskRegistry, SubflowLoader
from pathlib import Path

registry = TaskRegistry()
# ... register tasks ...

loader = SubflowLoader(Path("./flows"))
executor = FlowExecutor(registry, loader)

result = await executor.execute_flow(flow_yaml, inputs={...})
```

### Events

Subflow execution emits the following events:

**`subflow_started`**:
```python
{
    'subflow_name': 'validate_user',
    'step_id': 'validation',
    'inputs': {'user_id': '123'},
    'call_stack': ['main_flow', 'validate_user']
}
```

**`subflow_completed`**:
```python
{
    'subflow_name': 'validate_user',
    'step_id': 'validation',
    'outputs': {'is_valid': True, ...},
    'duration_ms': 150.5
}
```

**`subflow_failed`**:
```python
{
    'subflow_name': 'validate_user',
    'step_id': 'validation',
    'error': 'User not found',
    'error_type': 'FlowExecutionError',
    'duration_ms': 50.2
}
```

## See Also

- [Complete Example](../flows/examples/subflow_composition/) - Order checkout with subflows
- [Testing Guide](./testing.md) - Testing subflows independently
- [CLAUDE.md](../CLAUDE.md) - Development guide and architecture
