# FlowLang End-to-End Tutorial: Building with Claude Agents

This tutorial demonstrates building a complete FlowLang project using Claude Code's agent suite. You'll learn **when and how to invoke specific agents** to guide you through requirements, design, implementation, testing, and deployment.

## What You'll Learn

- **How to invoke and work with FlowLang's Claude agents** throughout development
- **When to use each agent** (Business Analyst, Business Process Designer, YAML Flow Expert, Test Developer, Task Implementer, Flow Orchestrator)
- **Project setup in `/flows` directory** using FlowLang CLI tools
- **Agent coordination patterns** for complex workflows
- **Best practices** for agent-driven development

## The FlowLang Agent Suite

FlowLang provides six specialized Claude agents:

1. **Business Analyst** - Gathers requirements and clarifies business needs
2. **Business Process Designer** - Translates requirements into flow.yaml
3. **YAML Flow Expert** - Validates and optimizes flow definitions
4. **Test Developer** - Creates comprehensive test suites
5. **Task Implementer** - Implements task functions in Python
6. **Flow Orchestrator** - Coordinates end-to-end project lifecycle

Each agent is an expert in their domain and has deep knowledge of FlowLang patterns, connection plugins, and best practices.

## Prerequisites

- Python 3.8+ installed
- FlowLang installed (`pip install -e .` from repository root)
- Claude Code CLI or Claude.ai access
- Basic understanding of YAML and Python
- Code editor of your choice

## Tutorial Overview

We'll build an **order processing system** with these capabilities:
- Validate order data (items, quantities, customer info)
- Check inventory availability
- Process payment via payment gateway
- Update inventory after purchase
- Send confirmation email
- Handle errors with retry logic
- Support cancellation with refunds

**Estimated Time**: 60-75 minutes

### Why Project-First Workflow?

This tutorial follows a **project-first workflow** where we:

1. **Create project structure FIRST** (Phase 0) before any requirements or design work
2. **Save all artifacts in proper locations** from the start
3. **Avoid awkward "copy files into project" steps** later
4. **Maintain clear working directory context** throughout

**Traditional (backwards) approach**:
```
❌ Design flow.yaml somewhere
❌ Create project later
❌ Copy flow.yaml into project
❌ Confusion about file locations
```

**FlowLang project-first approach**:
```
✅ Create project structure first
✅ Save REQUIREMENTS.md in project root
✅ Create flow directory, then save flow.yaml in it
✅ Everything in the right place from the start
✅ Clear, natural workflow
```

This mirrors real-world development where you set up your repository structure before writing code.

### Project Structure Evolution

Here's how the project structure evolves through each phase:

```
Phase 0 (Project Setup):
/flows/order-system/
└── project.yaml

Phase 1 (Requirements):
/flows/order-system/
├── project.yaml
└── REQUIREMENTS.md          # ← Added

Phase 2 (Flow Design):
/flows/order-system/
├── project.yaml
├── REQUIREMENTS.md
└── order-processing/        # ← New directory
    └── flow.yaml            # ← Added

Phase 3 (Validation):
(No new files - flow.yaml is refined in place)

Phase 4 (Code Generation):
/flows/order-system/
├── project.yaml
├── REQUIREMENTS.md
└── order-processing/
    ├── flow.yaml
    ├── flow.py              # ← Generated
    ├── api.py               # ← Generated
    ├── README.md            # ← Generated
    ├── tests/               # ← Generated
    │   └── test_tasks.py
    └── tools/               # ← Generated
        ├── start_server.sh
        └── generate.sh

Phases 5-8 (Test, Implement, Develop, Deploy):
(Modify existing files - no structural changes)
```

---

## Phase 0: Project Setup

Before gathering requirements or designing flows, we need a project structure. Use the FlowLang CLI to initialize the project.

### Why Start with Project Setup?

Starting with project setup ensures:
- All artifacts (requirements, designs, code) live in the correct location from the start
- No awkward "copy files into project" steps later
- Proper organization from day one
- Team members know where to find everything

### Step 1: Create Parent Project

Use the FlowLang CLI to create the project. The CLI is smart enough to find the `flows/` directory automatically!

**Option 1: Provide all details upfront**
```bash
# From anywhere in the FlowLang repository:
python -m flowlang project init order-system \
  --name "Order Processing System" \
  --description "Customer order processing workflows"

# Output:
# 📁 Found flows/ directory: /Users/adam/Projects/FlowLang/flows
#    Creating project: /Users/adam/Projects/FlowLang/flows/order-system
```

**Option 2: Interactive mode** (prompts for name and description)
```bash
# Just provide the project directory name:
python -m flowlang project init order-system

# You'll be prompted:
# 📁 Create New FlowLang Project
# ============================================================
# Project name: Order Processing System
# Description (optional): Customer order processing workflows
```

**How it works**:
- The CLI automatically detects the `flows/` directory in your repository
- No need to `cd` to a specific location first!
- If you're already in `flows/`, it uses that directory
- If `flows/` exists in current directory, it uses that
- If in a FlowLang repository, it finds and uses the repository's `flows/` directory
- Fallback: uses relative path if no `flows/` directory found

**Flexibility**: You can still use explicit paths if needed:
```bash
# Use absolute path
python -m flowlang project init /path/to/my-project

# Use relative path with slashes
python -m flowlang project init ../other-location/my-project
```

This creates:

```
/flows/order-system/
└── project.yaml
```

### Step 2: Review Generated Project Configuration

The generated `project.yaml`:

```yaml
project: Order Processing System
description: Customer order processing workflows
version: 1.0.0
settings:
  shared_connections:
    postgres:
      type: postgresql
      host: ${DATABASE_HOST}
      database: ${DATABASE_NAME}
      user: ${DATABASE_USER}
      password: ${DATABASE_PASSWORD}
    stripe:
      type: rest
      base_url: "https://api.stripe.com/v1"
      auth_token: ${STRIPE_API_KEY}
    sendgrid:
      type: rest
      base_url: "https://api.sendgrid.com/v3"
      auth_token: ${SENDGRID_API_KEY}
  tags:
    - ecommerce
    - order-processing
  contact:
    team: Engineering
    email: eng@example.com
flows:
  # Flows will be added here as we create them
```

### Step 3: Update Connections (Optional)

You can manually edit `project.yaml` to configure shared connections for your environment. For this tutorial, the default configuration above works well.

**Project structure at this point**:

```
/flows/order-system/
└── project.yaml
```

**Working Directory**: `/flows/order-system/` (all subsequent work happens here)

**Note**: For simple project setup like this, you don't need the Flow Orchestrator agent - just use the CLI directly. Save agent invocation for more complex coordination tasks.

---

## Phase 1: Requirements Gathering with Business Analyst

Before writing any code, we need clear requirements. The **Business Analyst agent** specializes in gathering and clarifying business needs without technical jargon.

### Step 1: Invoke the Business Analyst Agent

In Claude Code, use a command like this:

```
Use the business-analyst agent to help me gather requirements for
an order processing system. I need to validate orders, check inventory,
process payments, and send confirmations.
```

### Step 2: Interactive Requirements Gathering

The Business Analyst will ask probing questions like:

- What information is required in an order?
- How do you determine if inventory is sufficient?
- What payment methods do you support?
- What happens if payment fails?
- What notifications need to be sent?
- Who are the stakeholders?
- What are the success criteria?

### Step 3: Save Requirements in Project Root

After the conversation, the Business Analyst saves the requirements document as `REQUIREMENTS.md` in the project root:

**File Location**: `/flows/order-system/REQUIREMENTS.md`

**Working Directory**: Make sure you're in `/flows/order-system/` before creating the file

```markdown
# Order Processing System Requirements

## Business Objective
Process customer orders efficiently with proper validation,
inventory management, and payment processing.

## Business Rules
1. Orders must include: customer_id, items (product_id, quantity),
   payment_method
2. All items must be in stock before processing
3. Payment is processed immediately after inventory check
4. Inventory is decremented only after successful payment
5. Confirmation email sent after inventory update
6. Failed payments trigger notification to customer
7. Order cancellation requires payment refund

## Process Steps
1. Validate order data (required fields, valid formats)
2. Check inventory for all items
3. Calculate total price
4. Process payment
5. Update inventory (decrement stock)
6. Send confirmation email
7. Log order completion

## Error Scenarios
- Invalid order data → reject immediately
- Insufficient inventory → notify customer, don't process
- Payment failure → retry 3 times, then notify customer
- Email failure → log error but don't fail order

## Success Criteria
- Orders processed in < 5 seconds
- Payment success rate > 99%
- Zero inventory discrepancies
- All orders logged for auditing

## Integrations
- Inventory database (PostgreSQL)
- Payment gateway API (Stripe)
- Email service (SendGrid)
- Order database (PostgreSQL)
```

**Project structure after Phase 1**:

```
/flows/order-system/
├── project.yaml
└── REQUIREMENTS.md    # ← New: Requirements document
```

**Key Benefit**: The Business Analyst ensures you understand the problem before jumping to solutions. Requirements are saved in the project root, serving as the specification for all flows in this project.

---

## Phase 2: Flow Design with Business Process Designer

Now we translate requirements into a flow.yaml definition. The **Business Process Designer agent** excels at creating well-structured workflows.

### Step 1: Create Flow Directory

First, create a directory for the main order processing flow:

```bash
# From /flows/order-system/
cd /Users/adam/Projects/FlowLang/flows/order-system
mkdir order-processing
cd order-processing
```

**Working Directory**: `/flows/order-system/order-processing/`

### Step 2: Invoke the Business Process Designer Agent

```
Use the business-process-designer agent to create a flow.yaml
for the order processing system based on the requirements in
/flows/order-system/REQUIREMENTS.md. Save the flow.yaml in the
current directory (order-processing/).
```

### Step 3: Flow Design

The Business Process Designer analyzes the requirements and creates `flow.yaml` in the current directory:

**File Location**: `/flows/order-system/order-processing/flow.yaml`

```yaml
flow: OrderProcessing
description: Process customer orders with validation, inventory check, payment, and confirmation

inputs:
  - name: order_id
    type: string
    required: true
    description: Unique order identifier
  - name: customer_id
    type: string
    required: true
  - name: items
    type: array
    required: true
    description: List of {product_id, quantity}
  - name: payment_method
    type: string
    required: true

steps:
  # Step 1: Validate order data
  - task: ValidateOrderData
    id: validate_order
    inputs:
      order_id: ${inputs.order_id}
      customer_id: ${inputs.customer_id}
      items: ${inputs.items}
      payment_method: ${inputs.payment_method}
    outputs:
      - is_valid
      - validation_errors

  # Early exit if validation fails
  - if: ${validate_order.is_valid} == false
    then:
      - task: LogError
        id: log_validation_error
        inputs:
          error_type: "validation_failed"
          error_message: ${validate_order.validation_errors}
          order_id: ${inputs.order_id}
      - exit:
          reason: "Invalid order data"
          outputs:
            status: "rejected"
            reason: ${validate_order.validation_errors}

  # Step 2: Check inventory for all items
  - task: CheckInventory
    id: check_inventory
    inputs:
      items: ${inputs.items}
    outputs:
      - in_stock
      - unavailable_items
    retry:
      max_attempts: 3
      delay: 1
      backoff: exponential

  # Early exit if items unavailable
  - if: ${check_inventory.in_stock} == false
    then:
      - task: NotifyInsufficientInventory
        id: notify_inventory
        inputs:
          customer_id: ${inputs.customer_id}
          unavailable_items: ${check_inventory.unavailable_items}
      - exit:
          reason: "Insufficient inventory"
          outputs:
            status: "rejected"
            reason: "inventory_unavailable"
            unavailable_items: ${check_inventory.unavailable_items}

  # Step 3: Calculate total price
  - task: CalculateTotal
    id: calculate_total
    inputs:
      items: ${inputs.items}
    outputs:
      - total_amount
      - item_prices

  # Step 4: Process payment
  - task: ProcessPayment
    id: process_payment
    inputs:
      customer_id: ${inputs.customer_id}
      amount: ${calculate_total.total_amount}
      payment_method: ${inputs.payment_method}
      order_id: ${inputs.order_id}
    outputs:
      - payment_id
      - payment_status
      - transaction_time
    retry:
      max_attempts: 3
      delay: 2
      backoff: exponential
    on_error:
      - task: NotifyPaymentFailure
        id: notify_payment_failure
        inputs:
          customer_id: ${inputs.customer_id}
          order_id: ${inputs.order_id}
      - exit:
          reason: "Payment processing failed"
          outputs:
            status: "failed"
            reason: "payment_failed"

  # Step 5: Update inventory (decrement stock)
  - task: UpdateInventory
    id: update_inventory
    inputs:
      items: ${inputs.items}
      order_id: ${inputs.order_id}
    outputs:
      - updated_products
      - update_time
    retry:
      max_attempts: 5
      delay: 1
      backoff: exponential

  # Step 6: Send confirmation email (parallel with logging)
  - parallel:
      - task: SendConfirmationEmail
        id: send_confirmation
        inputs:
          customer_id: ${inputs.customer_id}
          order_id: ${inputs.order_id}
          items: ${inputs.items}
          total_amount: ${calculate_total.total_amount}
          payment_id: ${process_payment.payment_id}
        outputs:
          - email_sent
          - email_id
        on_error:
          - task: LogError
            id: log_email_error
            inputs:
              error_type: "email_failed"
              error_message: ${metadata.last_error}
              order_id: ${inputs.order_id}

      - task: LogOrderCompletion
        id: log_completion
        inputs:
          order_id: ${inputs.order_id}
          customer_id: ${inputs.customer_id}
          payment_id: ${process_payment.payment_id}
          total_amount: ${calculate_total.total_amount}
          completion_time: ${process_payment.transaction_time}
        outputs:
          - log_id

outputs:
  - name: status
    value: "completed"
  - name: order_id
    value: ${inputs.order_id}
  - name: payment_id
    value: ${process_payment.payment_id}
  - name: total_amount
    value: ${calculate_total.total_amount}
  - name: log_id
    value: ${log_completion.log_id}

# Cancellation handler (refund payment)
on_cancel:
  - task: RefundPayment
    id: refund_payment
    inputs:
      payment_id: ${process_payment.payment_id}
      amount: ${calculate_total.total_amount}
  - task: RestoreInventory
    id: restore_inventory
    inputs:
      items: ${inputs.items}
      order_id: ${inputs.order_id}
```

**Key Features**:
- ✅ Guard clauses for early exits (validation, inventory)
- ✅ Retry logic on critical operations (inventory check, payment)
- ✅ Error handlers with notifications
- ✅ Parallel execution (email + logging)
- ✅ Cancellation handler (refund + restore inventory)
- ✅ Clear data flow with ${variable} references

**Project structure after Phase 2**:

```
/flows/order-system/
├── project.yaml
├── REQUIREMENTS.md
└── order-processing/         # ← New: Flow directory
    └── flow.yaml             # ← New: Flow definition
```

**Working Directory**: Still in `/flows/order-system/order-processing/`

---

## Phase 3: Flow Validation with YAML Flow Expert

The flow looks good, but let's optimize it. The **YAML Flow Expert agent** validates syntax and improves performance.

### Step 1: Invoke the YAML Flow Expert Agent

**Working Directory**: Make sure you're still in `/flows/order-system/order-processing/`

```
Use the yaml-flow-expert agent to validate and optimize the flow.yaml
in the current directory. Check for performance improvements, best practices,
and generate a visualization.
```

### Step 2: Validation and Optimization

The YAML Flow Expert reviews the flow and provides feedback:

```
✅ Flow Validation Results:

Syntax: ✅ Valid
Structure: ✅ Well-organized
Error Handling: ✅ Comprehensive

Performance Optimizations Applied:
1. Email and logging already parallelized ✅
2. Retry backoff configured properly ✅
3. Early exits prevent unnecessary processing ✅

Best Practices Applied:
1. Guard clauses used (avoid nested conditionals) ✅
2. Descriptive step IDs ✅
3. Clear input/output mappings ✅
4. Cancellation handler present ✅

Suggestions:
1. Consider caching product prices if frequently accessed
2. Add rate limiting if payment gateway has limits
3. Consider timeout on payment processing (future feature)

Mermaid Visualization:
[Generates flow diagram showing all steps and decision points]
```

The YAML Flow Expert might suggest minor tweaks:

```yaml
# Optimization: Cache product prices to reduce database calls
- task: FetchProductPrices
  id: fetch_prices
  inputs:
    product_ids: ${inputs.items.*.product_id}  # Extract all product IDs
  outputs:
    - price_cache
  retry:
    max_attempts: 3
    delay: 1

# Then use cached prices in CalculateTotal
- task: CalculateTotal
  id: calculate_total
  inputs:
    items: ${inputs.items}
    price_cache: ${fetch_prices.price_cache}  # Use cache
  outputs:
    - total_amount
    - item_prices
```

**Key Benefit**: The YAML Flow Expert catches issues early and optimizes for performance before any code is written. Changes are made directly to the flow.yaml in your working directory.

---

## Phase 4: Code Generation with Flow Orchestrator

Now that the flow is designed and validated, let's generate all the supporting code. The **Flow Orchestrator agent** manages scaffolding and project structure.

### Step 1: Invoke the Flow Orchestrator Agent

**Working Directory**: Still in `/flows/order-system/order-processing/`

```
Use the flow-orchestrator agent to scaffold the complete project
structure from the flow.yaml in the current directory. Generate
flow.py, api.py, tests, and helper scripts.
```

### Step 2: Run Scaffolder

The Flow Orchestrator runs the scaffolder to generate all project files:

```bash
python -m flowlang scaffolder scaffold flow.yaml -o .

# Generated:
# - flow.py (task stubs)
# - api.py (FastAPI server)
# - tests/test_tasks.py (test stubs)
# - tools/start_server.sh
# - tools/generate.sh
# - README.md
```

### Step 3: Review Generated Structure

**Project structure after Phase 4**:

```
/flows/order-system/
├── project.yaml
├── REQUIREMENTS.md
└── order-processing/
    ├── flow.yaml                  # Flow definition (from Phase 2)
    ├── flow.py                    # ← New: Task stubs
    ├── api.py                     # ← New: FastAPI server
    ├── README.md                  # ← New: Documentation
    ├── tests/                     # ← New: Test directory
    │   └── test_tasks.py          #        Test stubs
    └── tools/                     # ← New: Helper scripts
        ├── start_server.sh        #        Server launcher
        └── generate.sh            #        Update helper
```

**Working Directory**: Still in `/flows/order-system/order-processing/`

### Step 4: Check Implementation Status

```bash
# Start server to see progress (already in correct directory)
./tools/start_server.sh

# In another terminal
curl http://localhost:8000/health

# Response:
{
  "status": "ready",
  "flow_name": "OrderProcessing",
  "implementation_progress": "0/13",  # 13 tasks, 0 implemented
  "unimplemented_tasks": [
    "ValidateOrderData",
    "LogError",
    "CheckInventory",
    "NotifyInsufficientInventory",
    "CalculateTotal",
    "ProcessPayment",
    "NotifyPaymentFailure",
    "UpdateInventory",
    "SendConfirmationEmail",
    "LogOrderCompletion",
    "RefundPayment",
    "RestoreInventory",
    "FetchProductPrices"
  ]
}
```

**Key Benefit**: Flow Orchestrator handles all project setup automatically. You get a complete, ready-to-implement project structure.

---

## Phase 5: Test Creation with Test Developer

Before implementing tasks, we write tests (TDD approach). The **Test Developer agent** creates comprehensive test suites.

### Step 1: Invoke the Test Developer Agent

```
Use the test-developer agent to create comprehensive tests for my
OrderProcessing flow. Include fixtures for test data, connection mocks,
and both happy path and error scenarios.
```

### Step 2: Test Suite Generation

The Test Developer creates `tests/test_tasks.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from flow import create_task_registry

@pytest.fixture
def registry():
    """Create task registry"""
    return create_task_registry()

@pytest.fixture
def sample_order():
    """Sample valid order data"""
    return {
        'order_id': 'ORD-12345',
        'customer_id': 'CUST-789',
        'items': [
            {'product_id': 'PROD-1', 'quantity': 2},
            {'product_id': 'PROD-2', 'quantity': 1}
        ],
        'payment_method': 'credit_card'
    }

@pytest.fixture
def mock_postgres(monkeypatch):
    """Mock PostgreSQL connection"""
    mock_conn = AsyncMock()
    monkeypatch.setattr('flow.get_connection', lambda name: mock_conn)
    return mock_conn

# ValidateOrderData tests
@pytest.mark.asyncio
async def test_validate_order_data_valid(registry, sample_order):
    """Test validation with valid order"""
    task = registry.get_task('ValidateOrderData')
    result = await task.implementation(**sample_order)

    assert result['is_valid'] is True
    assert result['validation_errors'] is None

@pytest.mark.asyncio
async def test_validate_order_data_missing_customer_id(registry):
    """Test validation with missing customer_id"""
    task = registry.get_task('ValidateOrderData')
    result = await task.implementation(
        order_id='ORD-123',
        customer_id='',  # Missing
        items=[{'product_id': 'P1', 'quantity': 1}],
        payment_method='credit_card'
    )

    assert result['is_valid'] is False
    assert 'customer_id' in result['validation_errors']

@pytest.mark.asyncio
async def test_validate_order_data_invalid_items(registry):
    """Test validation with invalid items"""
    task = registry.get_task('ValidateOrderData')
    result = await task.implementation(
        order_id='ORD-123',
        customer_id='CUST-789',
        items=[],  # Empty items
        payment_method='credit_card'
    )

    assert result['is_valid'] is False
    assert 'items' in result['validation_errors']

# CheckInventory tests
@pytest.mark.asyncio
async def test_check_inventory_all_in_stock(registry, mock_postgres):
    """Test inventory check when all items in stock"""
    mock_postgres.pg_query.return_value = [
        {'product_id': 'PROD-1', 'stock': 10},
        {'product_id': 'PROD-2', 'stock': 5}
    ]

    task = registry.get_task('CheckInventory')
    result = await task.implementation(
        items=[
            {'product_id': 'PROD-1', 'quantity': 2},
            {'product_id': 'PROD-2', 'quantity': 1}
        ]
    )

    assert result['in_stock'] is True
    assert result['unavailable_items'] == []

@pytest.mark.asyncio
async def test_check_inventory_insufficient_stock(registry, mock_postgres):
    """Test inventory check when items out of stock"""
    mock_postgres.pg_query.return_value = [
        {'product_id': 'PROD-1', 'stock': 1},  # Need 2, only 1 available
        {'product_id': 'PROD-2', 'stock': 5}
    ]

    task = registry.get_task('CheckInventory')
    result = await task.implementation(
        items=[
            {'product_id': 'PROD-1', 'quantity': 2},
            {'product_id': 'PROD-2', 'quantity': 1}
        ]
    )

    assert result['in_stock'] is False
    assert 'PROD-1' in result['unavailable_items']

# CalculateTotal tests
@pytest.mark.asyncio
async def test_calculate_total(registry, mock_postgres):
    """Test total calculation"""
    mock_postgres.pg_query.return_value = [
        {'product_id': 'PROD-1', 'price': 29.99},
        {'product_id': 'PROD-2', 'price': 49.99}
    ]

    task = registry.get_task('CalculateTotal')
    result = await task.implementation(
        items=[
            {'product_id': 'PROD-1', 'quantity': 2},
            {'product_id': 'PROD-2', 'quantity': 1}
        ]
    )

    expected_total = (29.99 * 2) + (49.99 * 1)
    assert result['total_amount'] == pytest.approx(expected_total)
    assert len(result['item_prices']) == 2

# ProcessPayment tests
@pytest.mark.asyncio
async def test_process_payment_success(registry):
    """Test successful payment processing"""
    with patch('flow.process_stripe_payment') as mock_stripe:
        mock_stripe.return_value = {
            'payment_id': 'PAY-123',
            'status': 'succeeded',
            'transaction_time': '2025-10-12T10:00:00Z'
        }

        task = registry.get_task('ProcessPayment')
        result = await task.implementation(
            customer_id='CUST-789',
            amount=109.97,
            payment_method='credit_card',
            order_id='ORD-12345'
        )

        assert result['payment_status'] == 'succeeded'
        assert result['payment_id'] == 'PAY-123'

@pytest.mark.asyncio
async def test_process_payment_failure(registry):
    """Test payment processing failure"""
    with patch('flow.process_stripe_payment') as mock_stripe:
        mock_stripe.side_effect = Exception("Card declined")

        task = registry.get_task('ProcessPayment')

        with pytest.raises(Exception, match="Card declined"):
            await task.implementation(
                customer_id='CUST-789',
                amount=109.97,
                payment_method='credit_card',
                order_id='ORD-12345'
            )

# UpdateInventory tests
@pytest.mark.asyncio
async def test_update_inventory(registry, mock_postgres):
    """Test inventory update after purchase"""
    mock_postgres.pg_execute.return_value = {'rows_affected': 2}

    task = registry.get_task('UpdateInventory')
    result = await task.implementation(
        items=[
            {'product_id': 'PROD-1', 'quantity': 2},
            {'product_id': 'PROD-2', 'quantity': 1}
        ],
        order_id='ORD-12345'
    )

    assert result['updated_products'] == 2
    assert 'update_time' in result

# SendConfirmationEmail tests
@pytest.mark.asyncio
async def test_send_confirmation_email(registry):
    """Test confirmation email sending"""
    with patch('flow.send_via_sendgrid') as mock_email:
        mock_email.return_value = {
            'email_sent': True,
            'email_id': 'EMAIL-123'
        }

        task = registry.get_task('SendConfirmationEmail')
        result = await task.implementation(
            customer_id='CUST-789',
            order_id='ORD-12345',
            items=[{'product_id': 'PROD-1', 'quantity': 2}],
            total_amount=59.98,
            payment_id='PAY-123'
        )

        assert result['email_sent'] is True
        assert result['email_id'] == 'EMAIL-123'

# Integration test
@pytest.mark.asyncio
async def test_complete_order_flow(registry, sample_order, mock_postgres):
    """Test complete happy path flow"""
    # Mock all external dependencies
    mock_postgres.pg_query.side_effect = [
        # CheckInventory
        [
            {'product_id': 'PROD-1', 'stock': 10},
            {'product_id': 'PROD-2', 'stock': 5}
        ],
        # CalculateTotal (fetch prices)
        [
            {'product_id': 'PROD-1', 'price': 29.99},
            {'product_id': 'PROD-2', 'price': 49.99}
        ]
    ]

    mock_postgres.pg_execute.return_value = {'rows_affected': 2}

    with patch('flow.process_stripe_payment') as mock_stripe, \
         patch('flow.send_via_sendgrid') as mock_email:

        mock_stripe.return_value = {
            'payment_id': 'PAY-123',
            'status': 'succeeded',
            'transaction_time': '2025-10-12T10:00:00Z'
        }

        mock_email.return_value = {
            'email_sent': True,
            'email_id': 'EMAIL-123'
        }

        # Execute all tasks in order
        # (this would normally be done by FlowExecutor)
        # ... test continues ...
```

### Step 3: Run Tests (They Should Fail)

```bash
# Already in /flows/order-system/order-processing/
pytest tests/test_tasks.py -v

# Expected: All tests fail with NotImplementedError
# because tasks are still stubs
```

**Key Benefit**: Test Developer creates comprehensive tests covering happy paths, error scenarios, and edge cases. Tests guide implementation.

---

## Phase 6: Implementation with Task Implementer

Now we implement the tasks to make tests pass. The **Task Implementer agent** specializes in writing production-quality task implementations.

### Step 1: Invoke the Task Implementer Agent

```
Use the task-implementer agent to implement all tasks in flow.py.
Use connection injection for PostgreSQL (inventory, orders),
Stripe for payments, and SendGrid for emails.
```

### Step 2: Implement Helper Functions

The Task Implementer adds helper functions at the top of `flow.py`:

```python
import os
from datetime import datetime
from typing import Dict, Any, List
import httpx
from flowlang import TaskRegistry

# Configuration
STRIPE_API_KEY = os.getenv('STRIPE_API_KEY')
SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY')

async def process_stripe_payment(
    customer_id: str,
    amount: float,
    payment_method: str,
    order_id: str
) -> Dict[str, Any]:
    """Process payment via Stripe API"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            'https://api.stripe.com/v1/payment_intents',
            headers={'Authorization': f'Bearer {STRIPE_API_KEY}'},
            data={
                'amount': int(amount * 100),  # Convert to cents
                'currency': 'usd',
                'customer': customer_id,
                'payment_method': payment_method,
                'metadata': {'order_id': order_id}
            }
        )
        response.raise_for_status()
        data = response.json()
        return {
            'payment_id': data['id'],
            'status': data['status'],
            'transaction_time': datetime.utcnow().isoformat()
        }

async def send_via_sendgrid(
    to_email: str,
    subject: str,
    body: str
) -> Dict[str, Any]:
    """Send email via SendGrid API"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            'https://api.sendgrid.com/v3/mail/send',
            headers={'Authorization': f'Bearer {SENDGRID_API_KEY}'},
            json={
                'personalizations': [{'to': [{'email': to_email}]}],
                'from': {'email': 'orders@example.com'},
                'subject': subject,
                'content': [{'type': 'text/html', 'value': body}]
            }
        )
        response.raise_for_status()
        return {
            'email_sent': True,
            'email_id': response.headers.get('X-Message-Id')
        }
```

### Step 3: Implement Tasks with Connection Injection

```python
def create_task_registry():
    """Create and configure task registry"""
    registry = TaskRegistry()

    @registry.register('ValidateOrderData', description='Validate order data completeness and format')
    async def validate_order_data(
        order_id: str,
        customer_id: str,
        items: List[Dict],
        payment_method: str
    ):
        """Validate that order contains all required data"""
        errors = []

        # Check required fields
        if not order_id:
            errors.append("Missing order_id")
        if not customer_id:
            errors.append("Missing customer_id")
        if not items or len(items) == 0:
            errors.append("Missing or empty items")
        if not payment_method:
            errors.append("Missing payment_method")

        # Validate items structure
        for i, item in enumerate(items):
            if 'product_id' not in item:
                errors.append(f"Item {i}: missing product_id")
            if 'quantity' not in item or item['quantity'] <= 0:
                errors.append(f"Item {i}: invalid quantity")

        # Validate payment method
        valid_methods = ['credit_card', 'debit_card', 'paypal']
        if payment_method not in valid_methods:
            errors.append(f"Invalid payment_method: {payment_method}")

        is_valid = len(errors) == 0
        return {
            'is_valid': is_valid,
            'validation_errors': '; '.join(errors) if errors else None
        }

    @registry.register('CheckInventory', description='Check if all items are in stock')
    async def check_inventory(items: List[Dict], postgres=None):
        """Check inventory availability for order items"""
        # Get connection via injection
        conn = postgres or await get_connection('postgres')

        # Extract product IDs
        product_ids = [item['product_id'] for item in items]

        # Query current stock levels
        query = """
            SELECT product_id, stock_quantity
            FROM products
            WHERE product_id = ANY($1)
        """
        stock_data = await conn.pg_query(query, product_ids)

        # Build stock map
        stock_map = {row['product_id']: row['stock_quantity'] for row in stock_data}

        # Check each item
        unavailable = []
        for item in items:
            product_id = item['product_id']
            required_qty = item['quantity']
            available_qty = stock_map.get(product_id, 0)

            if available_qty < required_qty:
                unavailable.append({
                    'product_id': product_id,
                    'required': required_qty,
                    'available': available_qty
                })

        in_stock = len(unavailable) == 0
        return {
            'in_stock': in_stock,
            'unavailable_items': unavailable
        }

    @registry.register('CalculateTotal', description='Calculate order total amount')
    async def calculate_total(items: List[Dict], postgres=None):
        """Calculate total order amount from items"""
        conn = postgres or await get_connection('postgres')

        # Fetch product prices
        product_ids = [item['product_id'] for item in items]
        query = """
            SELECT product_id, price
            FROM products
            WHERE product_id = ANY($1)
        """
        price_data = await conn.pg_query(query, product_ids)
        price_map = {row['product_id']: row['price'] for row in price_data}

        # Calculate total
        total = 0.0
        item_prices = []

        for item in items:
            product_id = item['product_id']
            quantity = item['quantity']
            price = price_map.get(product_id, 0.0)
            subtotal = price * quantity

            total += subtotal
            item_prices.append({
                'product_id': product_id,
                'quantity': quantity,
                'price': price,
                'subtotal': subtotal
            })

        return {
            'total_amount': round(total, 2),
            'item_prices': item_prices
        }

    @registry.register('ProcessPayment', description='Process payment via payment gateway')
    async def process_payment(
        customer_id: str,
        amount: float,
        payment_method: str,
        order_id: str
    ):
        """Process payment through Stripe"""
        result = await process_stripe_payment(
            customer_id=customer_id,
            amount=amount,
            payment_method=payment_method,
            order_id=order_id
        )
        return {
            'payment_id': result['payment_id'],
            'payment_status': result['status'],
            'transaction_time': result['transaction_time']
        }

    @registry.register('UpdateInventory', description='Decrement inventory after purchase')
    async def update_inventory(items: List[Dict], order_id: str, postgres=None):
        """Update inventory by decrementing stock quantities"""
        conn = postgres or await get_connection('postgres')

        # Update each product's stock
        updated_products = 0
        for item in items:
            query = """
                UPDATE products
                SET stock_quantity = stock_quantity - $1,
                    last_updated = NOW()
                WHERE product_id = $2
            """
            result = await conn.pg_execute(
                query,
                item['quantity'],
                item['product_id']
            )
            if result.get('rows_affected', 0) > 0:
                updated_products += 1

        return {
            'updated_products': updated_products,
            'update_time': datetime.utcnow().isoformat()
        }

    @registry.register('SendConfirmationEmail', description='Send order confirmation email')
    async def send_confirmation_email(
        customer_id: str,
        order_id: str,
        items: List[Dict],
        total_amount: float,
        payment_id: str,
        postgres=None
    ):
        """Send confirmation email to customer"""
        conn = postgres or await get_connection('postgres')

        # Fetch customer email
        query = "SELECT email, name FROM customers WHERE customer_id = $1"
        customer_data = await conn.pg_query(query, customer_id)

        if not customer_data:
            raise ValueError(f"Customer {customer_id} not found")

        customer_email = customer_data[0]['email']
        customer_name = customer_data[0]['name']

        # Generate email content
        subject = f"Order Confirmation - {order_id}"
        body = f"""
        <html>
        <body>
            <h1>Order Confirmed!</h1>
            <p>Hi {customer_name},</p>
            <p>Your order <strong>{order_id}</strong> has been confirmed.</p>
            <h3>Order Details:</h3>
            <ul>
                {''.join([f"<li>{item['quantity']}x {item['product_id']}</li>" for item in items])}
            </ul>
            <p><strong>Total:</strong> ${total_amount:.2f}</p>
            <p><strong>Payment ID:</strong> {payment_id}</p>
            <p>Thank you for your order!</p>
        </body>
        </html>
        """

        # Send via SendGrid
        result = await send_via_sendgrid(customer_email, subject, body)
        return result

    @registry.register('LogOrderCompletion', description='Log order completion for audit')
    async def log_order_completion(
        order_id: str,
        customer_id: str,
        payment_id: str,
        total_amount: float,
        completion_time: str,
        postgres=None
    ):
        """Log completed order to database"""
        conn = postgres or await get_connection('postgres')

        query = """
            INSERT INTO order_logs (
                order_id, customer_id, payment_id,
                total_amount, completion_time, logged_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING log_id
        """
        result = await conn.pg_query(
            query,
            order_id, customer_id, payment_id,
            total_amount, completion_time
        )

        return {'log_id': result[0]['log_id']}

    @registry.register('NotifyInsufficientInventory', description='Notify customer of stock issues')
    async def notify_insufficient_inventory(
        customer_id: str,
        unavailable_items: List[Dict],
        postgres=None
    ):
        """Send notification about unavailable items"""
        conn = postgres or await get_connection('postgres')

        # Fetch customer email
        query = "SELECT email FROM customers WHERE customer_id = $1"
        customer_data = await conn.pg_query(query, customer_id)
        customer_email = customer_data[0]['email']

        # Send notification
        subject = "Items Unavailable"
        body = f"""
        <p>Unfortunately, some items in your order are currently unavailable:</p>
        <ul>
            {''.join([f"<li>{item['product_id']}: Need {item['required']}, Available {item['available']}</li>" for item in unavailable_items])}
        </ul>
        """

        await send_via_sendgrid(customer_email, subject, body)
        return {'notified': True}

    @registry.register('NotifyPaymentFailure', description='Notify customer of payment failure')
    async def notify_payment_failure(customer_id: str, order_id: str, postgres=None):
        """Send notification about payment failure"""
        conn = postgres or await get_connection('postgres')

        query = "SELECT email FROM customers WHERE customer_id = $1"
        customer_data = await conn.pg_query(query, customer_id)
        customer_email = customer_data[0]['email']

        subject = "Payment Failed"
        body = f"<p>Payment for order {order_id} could not be processed. Please try again.</p>"

        await send_via_sendgrid(customer_email, subject, body)
        return {'notified': True}

    @registry.register('LogError', description='Log error details')
    async def log_error(
        error_type: str,
        error_message: str,
        order_id: str,
        postgres=None
    ):
        """Log error to database for debugging"""
        conn = postgres or await get_connection('postgres')

        query = """
            INSERT INTO error_logs (error_type, error_message, order_id, logged_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING error_id
        """
        result = await conn.pg_query(query, error_type, error_message, order_id)
        return {'error_id': result[0]['error_id']}

    @registry.register('RefundPayment', description='Refund payment on cancellation')
    async def refund_payment(payment_id: str, amount: float):
        """Refund payment via Stripe"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                'https://api.stripe.com/v1/refunds',
                headers={'Authorization': f'Bearer {STRIPE_API_KEY}'},
                data={
                    'payment_intent': payment_id,
                    'amount': int(amount * 100)
                }
            )
            response.raise_for_status()
            data = response.json()
            return {
                'refund_id': data['id'],
                'status': data['status']
            }

    @registry.register('RestoreInventory', description='Restore inventory on cancellation')
    async def restore_inventory(items: List[Dict], order_id: str, postgres=None):
        """Restore inventory by incrementing stock"""
        conn = postgres or await get_connection('postgres')

        for item in items:
            query = """
                UPDATE products
                SET stock_quantity = stock_quantity + $1
                WHERE product_id = $2
            """
            await conn.pg_execute(query, item['quantity'], item['product_id'])

        return {'restored': True}

    return registry
```

### Step 4: Run Tests Again

```bash
pytest tests/test_tasks.py -v

# Expected: All tests pass! ✅
```

### Step 5: Check Implementation Progress

```bash
curl http://localhost:8000/health

# Response:
{
  "status": "ready",
  "flow_name": "OrderProcessing",
  "implementation_progress": "13/13",  # 100% complete! ✅
  "unimplemented_tasks": []
}
```

**Key Benefit**: Task Implementer creates production-quality implementations with proper error handling, connection injection, and type hints. All tests pass.

---

## Phase 7: Development and Testing

Now test the complete flow in development mode.

### Step 1: Use Watch Mode for Live Testing

**Working Directory**: `/flows/order-system/order-processing/`

Create `test_inputs.json` in the current directory:

```json
{
  "order_id": "ORD-TEST-001",
  "customer_id": "CUST-123",
  "items": [
    {"product_id": "PROD-1", "quantity": 2},
    {"product_id": "PROD-2", "quantity": 1}
  ],
  "payment_method": "credit_card"
}
```

Start watch mode:

```bash
python -m flowlang watch flow.yaml --tasks-file flow.py --test-inputs test_inputs.json
```

**What Happens**:
- FlowLang watches for changes to flow.yaml or flow.py
- Auto-executes flow with test inputs
- Shows results in terminal with color coding
- Displays execution time and output diff

### Step 2: Test with Hot Reload

Start server with hot reload:

```bash
./tools/start_server.sh --reload
```

Make a change to flow.py (e.g., update email template), save, and see:

```
🔄 Detected change in flow.py
🔄 Reloading task implementations...
✅ Successfully reloaded task implementations
   Reload time: 0.187s
```

No server restart needed!

### Step 3: Test via API

```bash
curl -X POST http://localhost:8000/flows/OrderProcessing/execute \
  -H "Content-Type: application/json" \
  -d @test_inputs.json

# Response:
{
  "status": "success",
  "outputs": {
    "status": "completed",
    "order_id": "ORD-TEST-001",
    "payment_id": "PAY-abc123",
    "total_amount": 109.97,
    "log_id": "LOG-xyz789"
  },
  "execution_time": 2.8
}
```

### Step 4: Test Cancellation

```bash
# Start long-running order
curl -X POST http://localhost:8000/flows/OrderProcessing/execute \
  -H "Content-Type: application/json" \
  -d @test_inputs.json

# Get execution ID from response
EXEC_ID="exec-123"

# Cancel it
curl -X POST http://localhost:8000/flows/OrderProcessing/executions/$EXEC_ID/cancel

# Response shows cancellation handlers ran:
{
  "status": "cancelled",
  "cancellation_handlers_executed": [
    "RefundPayment",
    "RestoreInventory"
  ]
}
```

**Key Benefit**: Watch mode and hot reload enable rapid iteration. Test early and often.

---

## Phase 8: Deployment with Flow Orchestrator

Ready for production! The **Flow Orchestrator agent** handles deployment.

### Step 1: Invoke the Flow Orchestrator Agent

**Working Directory**: `/flows/order-system/order-processing/`

```
Use the flow-orchestrator agent to prepare the current flow for
production deployment. Configure environment, create Docker setup,
and provide deployment guide.
```

### Step 2: Environment Configuration

The Flow Orchestrator creates `.env.example`:

```bash
# Database
DATABASE_HOST=postgres.example.com
DATABASE_NAME=orders_db
DATABASE_USER=orders_user
DATABASE_PASSWORD=<secret>

# Payment Gateway
STRIPE_API_KEY=sk_live_<secret>

# Email Service
SENDGRID_API_KEY=SG.<secret>
```

### Step 3: Docker Configuration

The Flow Orchestrator creates `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY flow.yaml flow.py api.py ./

# Expose port
EXPOSE 8000

# Run with multiple workers
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

And `docker-compose.yml`:

```yaml
version: '3.8'

services:
  order-api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_HOST=${DATABASE_HOST}
      - DATABASE_NAME=${DATABASE_NAME}
      - DATABASE_USER=${DATABASE_USER}
      - DATABASE_PASSWORD=${DATABASE_PASSWORD}
      - STRIPE_API_KEY=${STRIPE_API_KEY}
      - SENDGRID_API_KEY=${SENDGRID_API_KEY}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: orders_db
      POSTGRES_USER: orders_user
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

### Step 4: Deploy

```bash
# Build and start
docker-compose up -d

# Check health
curl http://localhost:8000/health

# View logs
docker-compose logs -f order-api
```

### Step 5: Production Monitoring

The Flow Orchestrator provides monitoring guidance:

```bash
# Health endpoint
curl http://localhost:8000/health

# Implementation status
curl http://localhost:8000/flows/OrderProcessing/tasks

# Metrics (if configured)
curl http://localhost:8000/metrics
```

**Key Benefit**: Flow Orchestrator handles all deployment concerns. You get production-ready configuration.

---

## Best Practices Summary

### Using Agents Effectively

1. **Business Analyst** - Always start here for unclear requirements
   - Asks the right questions
   - Documents in business terms
   - No technical jargon

2. **Business Process Designer** - Use for flow design
   - Translates requirements to YAML
   - Applies control flow patterns
   - Plans error handling

3. **YAML Flow Expert** - Use for optimization
   - Validates syntax
   - Improves performance
   - Applies best practices

4. **Flow Orchestrator** - Use for project management
   - Sets up projects
   - Runs scaffolder
   - Handles deployment

5. **Test Developer** - Use before implementation
   - Creates comprehensive tests
   - Provides fixtures and mocks
   - Guides implementation

6. **Task Implementer** - Use for coding
   - Implements production-quality code
   - Uses connection injection
   - Adds error handling

### Agent Coordination

**Sequential Workflow** (Recommended):
```
Project → Requirements → Design → Validate → Generate → Test → Implement → Deploy
  Setup
   ↓           ↓           ↓         ↓          ↓         ↓         ↓          ↓
 Flow      Business    Business    YAML      Flow     Test    Task      Flow
Orchestr   Analyst    Process    Flow     Orchestr  Devel   Implem   Orchestr
 ator                 Designer   Expert    ator      oper    enter     ator
```

**Key Insight**: Flow Orchestrator appears THREE times (setup, generate, deploy), bookending the workflow.

**Iterative Workflow**:
- Design with Business Process Designer
- Validate with YAML Flow Expert
- Refine based on feedback
- Repeat until optimal

### Development Workflow

1. **Set up project structure** - Use Flow Orchestrator (Phase 0)
2. **Gather requirements** - Use Business Analyst (save in project root)
3. **Design in YAML** - Use Business Process Designer (create flow directory first)
4. **Validate before coding** - Use YAML Flow Expert (in place)
5. **Generate code** - Use Flow Orchestrator (scaffolder)
6. **Write tests first** - Use Test Developer (TDD)
7. **Implement incrementally** - Use Task Implementer
8. **Use watch mode** - Rapid iteration
9. **Deploy confidently** - Use Flow Orchestrator (Docker)

### Project Organization

**Use project-based structure** for related flows:

```
/flows/order-system/
├── project.yaml            # Shared config (connections, tags, metadata)
├── REQUIREMENTS.md         # Project-wide requirements
├── order-processing/       # Main order flow
│   ├── flow.yaml
│   ├── flow.py
│   ├── api.py
│   ├── tests/
│   └── tools/
├── order-cancellation/     # Cancellation flow (future)
│   ├── flow.yaml
│   └── flow.py
└── order-refund/           # Refund flow (future)
    ├── flow.yaml
    └── flow.py
```

**Benefits of project-first organization**:
- Shared connections configured once in `project.yaml`
- Requirements document at project root applies to all flows
- Clear hierarchy: project → flows → implementations
- Easy to add related flows later
- Multi-flow server serves all flows in project

---

## Next Steps

### Enhance Your Flow

1. **Add more flows** to the project:
   - Order cancellation flow
   - Refund processing flow
   - Inventory replenishment flow

2. **Add observability**:
   - Metrics collection
   - Distributed tracing
   - Error alerting

3. **Optimize performance**:
   - Cache product prices
   - Batch inventory updates
   - Async notifications

### Learn More

- **Agent Documentation**: `.claude/agents/README.md`
- **FlowLang Docs**: `/docs` directory
- **Connection Plugins**: `/docs/connections.md`
- **Database Integration**: `/docs/tutorial-database-connections.md`

### Get Help from Agents

- **Requirements unclear?** → Business Analyst
- **Design questions?** → Business Process Designer
- **YAML issues?** → YAML Flow Expert
- **Need tests?** → Test Developer
- **Stuck on implementation?** → Task Implementer
- **Deployment help?** → Flow Orchestrator

---

## Conclusion

You've built a complete order processing system using FlowLang's agent suite! You learned:

✅ **How to invoke specific agents** for different tasks
✅ **Agent coordination** (Flow Orchestrator → Business Analyst → Business Process Designer → YAML Flow Expert → Flow Orchestrator → Test Developer → Task Implementer → Flow Orchestrator)
✅ **Project-first workflow** - Set up structure before creating artifacts
✅ **Project setup in `/flows`** using CLI tools
✅ **Test-driven development** with agent guidance
✅ **Production deployment** with Docker

**Key Takeaways**:
1. **Start with structure**: Create project FIRST, then create artifacts within it
2. **Agent guidance**: Each agent is an expert in their domain and works seamlessly with others
3. **Clear workflow**: Requirements → Design → Validate → Generate → Test → Implement → Deploy
4. **Working directory matters**: Stay in the right directory and save files in proper locations
5. **Project organization**: Use project-based structure for related flows with shared configuration

## Quick Reference Card

| Need | Agent | Invoke With |
|------|-------|-------------|
| Gather requirements | Business Analyst | "Use the business-analyst to help me understand requirements" |
| Design flow | Business Process Designer | "Ask the business-process-designer to create flow.yaml" |
| Validate YAML | YAML Flow Expert | "Use the yaml-flow-expert to validate and optimize" |
| Create tests | Test Developer | "Have the test-developer create comprehensive tests" |
| Implement tasks | Task Implementer | "Use the task-implementer to implement these tasks" |
| Deploy project | Flow Orchestrator | "Use the flow-orchestrator to deploy to production" |

**Pro Tip**: For complex projects, start with "Use the flow-orchestrator to coordinate this project" and let it call other agents as needed!

Now go build amazing workflows with agent guidance! 🚀
