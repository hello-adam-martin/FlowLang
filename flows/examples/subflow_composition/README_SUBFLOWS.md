# Subflow Composition Example

This example demonstrates **Flow Composition** - one of FlowLang's most powerful features for building modular, reusable workflows.

## What Are Subflows?

Subflows allow you to:
- **Break down complex workflows** into smaller, manageable pieces
- **Reuse common logic** across multiple flows
- **Organize workflows** by domain or functionality
- **Test components independently** before composing them
- **Maintain separation of concerns** in your workflow architecture

## Example Architecture

This example implements an **Order Checkout** workflow composed of three independent subflows:

```
OrderCheckout (Main Flow)
├── validate_user/      # User validation subflow
├── process_payment/    # Payment processing subflow
└── send_notification/  # Notification subflow
```

Each subflow is:
- **Independent**: Can be tested and used separately
- **Reusable**: Can be called from multiple parent flows
- **Self-contained**: Has its own inputs, outputs, and logic

## Flow Structure

### Main Flow: OrderCheckout

**Purpose**: Orchestrate the complete checkout process

**Subflows Used**:
1. `validate_user` - Verify user credentials and permissions
2. `process_payment` - Handle payment transaction
3. `send_notification` - Send confirmation notifications

**Key Features**:
- Conditional logic based on subflow outputs
- Error handling for failed subflows
- Multiple notification calls (failure and success paths)
- Data passing between subflows

### Subflow 1: ValidateUser

**Location**: `validate_user/flow.yaml`

**Purpose**: Validate user exists, has correct role, and is active

**Inputs**:
- `user_id` (string) - User to validate
- `required_role` (string, optional) - Required permission level

**Outputs**:
- `is_valid` (boolean) - Whether user passed validation
- `user_data` (object) - User information
- `user_role` (string) - User's role
- `status` (string) - Account status

**Logic**:
1. Check if user exists
2. Verify user has required role
3. Confirm user account is active
4. Early exit if validation fails

### Subflow 2: ProcessPayment

**Location**: `process_payment/flow.yaml`

**Purpose**: Process payment transaction with validation

**Inputs**:
- `amount` (number) - Payment amount
- `currency` (string) - Currency code
- `payment_method` (string) - Payment method ID
- `user_id` (string) - User making payment

**Outputs**:
- `success` (boolean) - Payment succeeded
- `transaction_id` (string) - Transaction reference
- `amount_charged` (number) - Actual amount charged
- `payment_method_type` (string) - Type of payment method
- `record_id` (string) - Database record ID

**Logic**:
1. Validate payment amount
2. Validate payment method
3. Charge payment method (with retries)
4. Record transaction in database
5. Early exit on validation failures

### Subflow 3: SendNotification

**Location**: `send_notification/flow.yaml`

**Purpose**: Send notifications via multiple channels

**Inputs**:
- `user_id` (string) - User to notify
- `message` (string) - Notification message
- `notification_type` (string) - Channel: email, sms, push, or all
- `priority` (string, optional) - Priority level

**Outputs**:
- `success` (boolean) - Notification sent
- `log_id` (string) - Notification log ID
- `notification_type` (string) - Channel used

**Logic**:
1. Get user notification preferences
2. Switch based on notification type
3. Send via selected channel(s)
4. Support parallel sending for "all" type
5. Log notification

## Subflow Syntax

### Basic Subflow Call

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
```

### Using Subflow Outputs

```yaml
- if: ${validation.is_valid} == true
  then:
    - subflow: process_payment
      id: payment
      inputs:
        user_id: ${validation.user_data.id}  # Use nested data
        amount: ${inputs.amount}
```

### Error Handling

```yaml
- subflow: process_payment
  id: payment
  inputs:
    amount: ${calculate.final_amount}
  on_error:
    - subflow: send_notification
      inputs:
        message: "Payment failed"
        notification_type: "email"
```

## Key Patterns Demonstrated

### 1. **Sequential Composition**
Subflows execute one after another, passing data forward:
```
ValidateUser → ProcessPayment → SendNotification
```

### 2. **Conditional Execution**
Parent flow decides whether to call subflow based on conditions:
```yaml
- if: ${validation.is_valid} == false
  then:
    - subflow: send_notification  # Only on failure
      inputs:
        message: "Validation failed"
```

### 3. **Multiple Calls**
Same subflow called multiple times with different inputs:
```yaml
# Call 1: Failure notification
- subflow: send_notification
  id: notify_failure
  inputs:
    message: "Order checkout failed"

# Call 2: Success notification
- subflow: send_notification
  id: notify_success
  inputs:
    message: "Order confirmed!"
```

### 4. **Data Flow**
Data flows through subflows:
```
validate_user.user_data → process_payment.user_id → send_notification.user_id
```

### 5. **Early Exit from Subflows**
Subflows can terminate early and return partial outputs:
```yaml
# In validate_user/flow.yaml
- if: ${check_exists.exists} == false
  then:
    - exit:
        reason: "User not found"
        outputs:
          is_valid: false
          reason: "User does not exist"
```

## Benefits of This Architecture

### Modularity
- Each subflow handles one concern
- Easy to understand and maintain
- Changes isolated to specific subflows

### Reusability
- `validate_user` can be used in login, registration, profile update
- `process_payment` reusable for subscriptions, purchases, refunds
- `send_notification` works across all user interactions

### Testability
- Test each subflow independently
- Mock subflows when testing parent
- Integration tests verify composition

### Organization
- Clear directory structure
- Each subflow is self-contained
- Easy to locate and modify logic

## Running the Example

### Option 1: Direct Execution

```python
import asyncio
from pathlib import Path
from flowlang import FlowExecutor, TaskRegistry, SubflowLoader

# Create registry and implement tasks
registry = TaskRegistry()

# ... implement tasks ...

# Create subflow loader
base_path = Path("flows/examples/subflow_composition")
loader = SubflowLoader(base_path)

# Create executor with loader
executor = FlowExecutor(registry, loader)

# Execute main flow
result = await executor.execute_flow(
    "flow.yaml",
    inputs={
        "user_id": "user_123",
        "order_id": "order_456",
        "amount": 99.99,
        "currency": "USD",
        "payment_method": "pm_xyz"
    }
)
```

### Option 2: REST API Server

```bash
cd flows/examples/subflow_composition
./tools/start_server.sh
```

Then execute via HTTP:

```bash
curl -X POST http://localhost:8000/flows/OrderCheckout/execute \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "user_id": "user_123",
      "order_id": "order_456",
      "amount": 99.99,
      "currency": "USD",
      "payment_method": "pm_xyz"
    }
  }'
```

## Subflow Discovery

FlowLang automatically discovers subflows using multiple strategies:

1. **Subdirectory with flow.yaml**: `validate_user/flow.yaml`
2. **Direct YAML file**: `validate_user.yaml`
3. **Sibling directories**: `../other_flow/flow.yaml`
4. **Parent directories**: Up to 3 levels up

List available subflows:

```python
loader = SubflowLoader(Path("flows/examples/subflow_composition"))
subflows = loader.list_available_subflows()
print(subflows)  # ['validate_user', 'process_payment', 'send_notification']
```

## Error Handling

Subflows propagate errors to parent flows:

```yaml
# In main flow
- subflow: process_payment
  id: payment
  on_error:
    # Handle payment failure
    - task: LogError
    - subflow: send_notification
      inputs:
        message: "Payment failed"
    - exit:
        reason: "Payment processing failed"
```

## Circular Dependency Protection

FlowLang prevents infinite loops:

```
Flow A calls Flow B calls Flow A
    ↓
Circular subflow dependency detected: A → B → A
```

The call stack is tracked automatically.

## Best Practices

### 1. Keep Subflows Focused
Each subflow should have a single, clear responsibility.

✅ Good: `validate_user`, `process_payment`, `send_notification`
❌ Bad: `do_everything`

### 2. Define Clear Interfaces
Document inputs and outputs clearly:

```yaml
flow: ValidateUser
description: Validate user credentials and permissions

inputs:
  - name: user_id
    type: string
    required: true
    description: User ID to validate  # Clear description

outputs:
  - name: is_valid
    value: ${check.is_valid}  # Clear output mapping
```

### 3. Handle Errors Gracefully
Subflows should either succeed completely or fail with clear error messages:

```yaml
- if: ${validation_failed}
  then:
    - exit:
        reason: "Clear error message"
        outputs:
          success: false
          error: "Detailed explanation"
```

### 4. Make Subflows Reusable
Avoid hard-coding values specific to one use case:

✅ Good: `required_role` as input parameter
❌ Bad: Hard-coded role check

### 5. Use Nested Directories
Organize subflows in subdirectories for large projects:

```
my_project/
├── flow.yaml (main)
├── validation/
│   ├── validate_user/flow.yaml
│   └── validate_order/flow.yaml
└── payment/
    ├── process_payment/flow.yaml
    └── refund_payment/flow.yaml
```

## Comparison: With vs Without Subflows

### Without Subflows (Monolithic)
```yaml
flow: OrderCheckout
steps:
  - task: CheckUserExists       # 50+ lines
  - task: CheckUserRole         # of validation
  - task: CheckUserStatus       # logic
  - task: ValidateAmount        # 40+ lines
  - task: ValidatePaymentMethod # of payment
  - task: ChargePaymentMethod   # logic
  - task: GetUserPreferences    # 30+ lines
  - task: SendEmail             # of notification
  - task: SendSMS               # logic
  # ... 120+ lines total, hard to maintain
```

### With Subflows (Modular)
```yaml
flow: OrderCheckout
steps:
  - subflow: validate_user      # 3 lines
  - subflow: process_payment    # 3 lines
  - subflow: send_notification  # 3 lines
  # ... 9 lines total, easy to understand
```

## Next Steps

- Implement the task stubs in `flow.py`
- Add tests for each subflow independently
- Create additional subflows for other use cases
- Compose subflows in new parent flows

## Related Documentation

- [FlowLang Documentation](../../../docs/)
- [Testing Guide](../../../docs/testing.md)
- [Flow Executor API](../../../src/flowlang/executor.py)
- [Subflow Loader API](../../../src/flowlang/subflow_loader.py)
