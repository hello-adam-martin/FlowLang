# Flow Design Walkthrough Part 1: The YAML Definition

## Building an Order Fulfillment System from Scratch

**Time**: 45 minutes
**Difficulty**: Intermediate
**Focus**: Learning to think in workflows and design robust flow definitions

---

## Table of Contents

1. [Introduction: Thinking in Workflows](#1-introduction-thinking-in-workflows)
2. [The Business Problem](#2-the-business-problem)
3. [Breaking Down the Process](#3-breaking-down-the-process)
4. [Defining Inputs](#4-defining-inputs)
5. [Step 1: Sequential Data Gathering](#5-step-1-sequential-data-gathering)
6. [Step 2: Validation & Early Exit](#6-step-2-validation--early-exit)
7. [Step 3: Complex Conditionals](#7-step-3-complex-conditionals)
8. [Step 4: Multi-Way Branching](#8-step-4-multi-way-branching)
9. [Step 5: Loop Processing](#9-step-5-loop-processing)
10. [Step 6: Parallel Operations](#10-step-6-parallel-operations)
11. [Step 7: Error Handling](#11-step-7-error-handling)
12. [Step 8: Cleanup Handlers](#12-step-8-cleanup-handlers)
13. [Defining Outputs](#13-defining-outputs)
14. [The Complete Flow](#14-the-complete-flow)
15. [Design Principles Summary](#15-design-principles-summary)

---

## 1. Introduction: Thinking in Workflows

Before writing any YAML, we need to shift our mindset from **procedural programming** to **workflow orchestration**.

### Procedural vs Workflow Thinking

**Procedural (traditional code):**
```python
def process_order(order_data):
    # Everything mixed together
    customer = fetch_customer(order_data['customer_id'])
    if not customer:
        send_error_email()
        return error

    inventory = check_inventory(order_data['items'])
    if not inventory:
        notify_warehouse()
        return error

    # ... hundreds more lines
```

**Workflow (FlowLang):**
```yaml
steps:
  - task: FetchCustomer      # WHAT to do
  - task: CheckInventory     # Not HOW to do it
  - task: ProcessPayment
```

### Key Workflow Principles

1. **Declarative over Imperative**: Describe WHAT, not HOW
2. **Composability**: Small, focused tasks that combine
3. **Visibility**: The flow YAML shows the entire process at a glance
4. **Testability**: Each task can be tested independently
5. **Maintainability**: Change implementation without changing flow logic

Let's apply these principles to build a real-world order fulfillment system.

---

## 2. The Business Problem

**Scenario**: You're building an e-commerce order fulfillment system that needs to:

1. **Validate** customer and order data
2. **Check** inventory availability
3. **Calculate** pricing with discounts and tax
4. **Process** payment
5. **Update** inventory
6. **Send** notifications
7. **Handle** different order types (standard, express, bulk)
8. **Deal with** errors gracefully
9. **Allow** order cancellation

### Business Rules

- **Standard orders**: 5-7 day shipping, standard pricing
- **Express orders**: 1-2 day shipping, 20% premium, requires premium membership
- **Bulk orders**: 10+ items, 15% discount, requires business account
- **Validation**: Customer must be active, items must be in stock
- **Payment**: Multiple payment methods, with retry logic
- **Cancellation**: Must release inventory and refund payment

---

## 3. Breaking Down the Process

Before writing YAML, let's map out the complete process:

```
Order Received
    ↓
1. Fetch customer data
2. Fetch product catalog
3. Validate customer status ← Early exit if invalid
4. Validate inventory ← Early exit if unavailable
5. Calculate base pricing
6. Determine order type (switch/case)
    ├─ Standard → Apply standard rules
    ├─ Express → Check membership, apply premium
    └─ Bulk → Check business account, apply discount
7. Process line items (loop)
    └─ For each item: validate, calculate, reserve
8. Process payment (with retry)
9. Execute in parallel:
    ├─ Update inventory
    ├─ Send customer email
    ├─ Notify warehouse
    └─ Update CRM
10. Record transaction
    ↓
Order Complete
```

**Decision Points**:
- Validation failures → Early exit with error
- Order type → Switch/case branching
- Line items → Loop with iteration
- Post-payment tasks → Parallel execution
- Payment failure → Retry with backoff

---

## 4. Defining Inputs

Inputs are the data your flow needs to execute. Think carefully about:
- What data do we absolutely need?
- What should be required vs optional?
- What types keep us type-safe?

### Input Design Process

**Question 1**: *What identifies this order?*
```yaml
inputs:
  - name: order_id
    type: string
    required: true
    description: Unique identifier for this order
```

**Question 2**: *Who is the customer?*
```yaml
  - name: customer_id
    type: string
    required: true
    description: Customer identifier
```

**Question 3**: *What are they ordering?*
```yaml
  - name: items
    type: array
    required: true
    description: |
      List of items to order. Each item should have:
      - product_id (string): Product identifier
      - quantity (number): Number of items
      - variant_id (string, optional): Product variant
```

**Why array?** We need to process multiple items, and FlowLang can loop over arrays.

**Question 4**: *How are they paying?*
```yaml
  - name: payment_method
    type: string
    required: true
    description: Payment method (credit_card, paypal, bank_transfer)

  - name: payment_details
    type: object
    required: true
    description: Payment-specific details (card token, PayPal ID, etc.)
```

**Why object?** Payment details vary by method, so we use a flexible object type.

**Question 5**: *Where should we ship?*
```yaml
  - name: shipping_address
    type: object
    required: true
    description: |
      Shipping address with fields:
      - street, city, state, postal_code, country
```

**Question 6**: *What type of order?*
```yaml
  - name: order_type
    type: string
    required: true
    description: Order type (standard, express, bulk)
```

**Question 7**: *Any special instructions?*
```yaml
  - name: special_instructions
    type: string
    required: false
    description: Optional delivery or gift wrapping instructions
```

**Notice**: This is optional (`required: false`) because it's not critical for processing.

### Complete Inputs Section

```yaml
flow: OrderFulfillment
description: Intelligent order processing and fulfillment system

inputs:
  - name: order_id
    type: string
    required: true
    description: Unique identifier for this order

  - name: customer_id
    type: string
    required: true
    description: Customer identifier

  - name: items
    type: array
    required: true
    description: |
      List of items to order. Each item should have:
      - product_id (string)
      - quantity (number)
      - variant_id (string, optional)

  - name: payment_method
    type: string
    required: true
    description: Payment method (credit_card, paypal, bank_transfer)

  - name: payment_details
    type: object
    required: true
    description: Payment-specific details

  - name: shipping_address
    type: object
    required: true
    description: Shipping address

  - name: order_type
    type: string
    required: true
    description: Order type (standard, express, bulk)

  - name: special_instructions
    type: string
    required: false
    description: Optional delivery instructions
```

---

## 5. Step 1: Sequential Data Gathering

Now we start building our steps. First, we need to gather data.

### Why Sequential?

These tasks **must** run in order because they don't depend on each other, but we need all of them before making decisions.

```yaml
steps:
  # Step 1: Fetch customer profile
  - task: FetchCustomer
    id: customer
    inputs:
      customer_id: ${inputs.customer_id}
    outputs:
      - profile
      - membership_status
      - account_type
      - lifetime_value
```

**Design Decisions**:
- **id: customer** - We'll reference this as `${customer.profile}` later
- **outputs** - List what this task returns (documented here, implemented in Python)
- **inputs** - Use `${inputs.customer_id}` to access flow input

```yaml
  # Step 2: Fetch product catalog
  - task: FetchProductCatalog
    id: catalog
    inputs:
      product_ids: ${inputs.items}  # Pass the array
    outputs:
      - products
      - prices
      - stock_levels
```

**Why separate tasks?** We could fetch customer and products in one task, but:
- ✅ **Testability**: Each task tests one thing
- ✅ **Reusability**: FetchCustomer can be used in other flows
- ✅ **Clarity**: The flow shows "first get customer, then get products"

---

## 6. Step 2: Validation & Early Exit

After gathering data, we validate. If validation fails, we want to **stop immediately** - no point checking inventory if the customer is banned!

### The Exit Pattern

```yaml
  # Step 3: Validate customer status
  - task: ValidateCustomer
    id: customer_validation
    inputs:
      profile: ${customer.profile}
      membership_status: ${customer.membership_status}
    outputs:
      - is_valid
      - validation_errors

  # Exit early if customer invalid
  - if: ${customer_validation.is_valid} == false
    then:
      - exit:
          reason: "Customer validation failed"
          outputs:
            success: false
            error: ${customer_validation.validation_errors}
            order_id: ${inputs.order_id}
```

**Why exit instead of else?**

**Bad Pattern** (nested everything):
```yaml
- if: ${customer_validation.is_valid} == true
  then:
    - if: ${inventory_check.available} == true
      then:
        - if: ${payment.success} == true
          then:
            # Finally do the work... 3 levels deep!
```

**Good Pattern** (guard clauses):
```yaml
- if: ${customer_validation.is_valid} == false
  then:
    - exit  # Stop here

- if: ${inventory_check.available} == false
  then:
    - exit  # Stop here

# If we're here, everything is valid - no nesting!
- task: ProcessOrder
```

### Multiple Guard Clauses

```yaml
  # Step 4: Check inventory availability
  - task: CheckInventory
    id: inventory
    inputs:
      items: ${inputs.items}
      stock_levels: ${catalog.stock_levels}
    outputs:
      - available
      - unavailable_items
      - reserved_inventory_ids

  # Exit if inventory unavailable
  - if: ${inventory.available} == false
    then:
      - task: NotifyCustomerOutOfStock
        inputs:
          customer_id: ${inputs.customer_id}
          unavailable_items: ${inventory.unavailable_items}

      - exit:
          reason: "Items out of stock"
          outputs:
            success: false
            error: "Some items are unavailable"
            unavailable_items: ${inventory.unavailable_items}
```

**Key Lesson**: Use exit for **guard clauses** - check conditions and bail early if they fail.

---

## 7. Step 3: Complex Conditionals

Now we need to validate the order type is allowed for this customer.

### Using Quantified Conditions (any/all/none)

**Question**: "Can this customer place an express order?"

**Rule**: Express orders require:
- Premium membership OR
- Lifetime value > $5000 OR
- Account age > 2 years

**Implementation**:

```yaml
  # Step 5: Validate order type permissions
  - task: GetCustomerStats
    id: stats
    inputs:
      customer_id: ${inputs.customer_id}
    outputs:
      - account_age_years
      - order_history_count

  # Check if customer can use express shipping
  - if: ${inputs.order_type} == "express"
    then:
      # Use ANY - at least one condition must be true
      - if:
          any:
            - ${customer.membership_status} == "premium"
            - ${customer.lifetime_value} > 5000
            - ${stats.account_age_years} >= 2
        then:
          - task: LogExpressOrderApproved
        else:
          - exit:
              reason: "Express orders require premium membership"
              outputs:
                success: false
                error: "Upgrade to premium for express shipping"
```

### When to Use any/all/none

**ANY** - "At least one condition must be true"
```yaml
if:
  any:
    - ${user.is_admin} == true
    - ${user.is_moderator} == true
    - ${resource.owner} == ${user.id}
```
*Use for*: Permission checks, qualification rules

**ALL** - "Every condition must be true"
```yaml
if:
  all:
    - ${age} >= 18
    - ${country} == "US"
    - ${consent_given} == true
```
*Use for*: Requirements that must all be met

**NONE** - "No conditions can be true" (none are allowed)
```yaml
if:
  none:
    - ${user.banned} == true
    - ${user.suspended} == true
    - ${account.frozen} == true
```
*Use for*: Disqualification checks

### Nested Quantifiers

**Rule**: "Bulk orders require business account AND (10+ items OR value > $1000)"

```yaml
  - if: ${inputs.order_type} == "bulk"
    then:
      - if:
          all:  # Both conditions must be true
            - ${customer.account_type} == "business"
            - any:  # At least one of these
                - ${inputs.items.length} >= 10
                - ${order_total} > 1000
        then:
          - task: ApproveBulkOrder
        else:
          - exit:
              reason: "Bulk orders require business account and 10+ items or $1000+"
```

---

## 8. Step 4: Multi-Way Branching

We have three order types with different logic. We could use nested if/else, but switch/case is cleaner.

### Switch/Case Pattern

```yaml
  # Step 6: Calculate pricing based on order type
  - task: CalculateBasePrice
    id: base_price
    inputs:
      items: ${inputs.items}
      prices: ${catalog.prices}
    outputs:
      - subtotal
      - item_count

  # Branch based on order type
  - switch: ${inputs.order_type}
    cases:
      # Case 1: Standard order
      - when: "standard"
        do:
          - task: ApplyStandardPricing
            id: pricing
            inputs:
              subtotal: ${base_price.subtotal}
              customer_tier: ${customer.membership_status}
            outputs:
              - final_price
              - discount_applied
              - shipping_cost

          - task: CalculateStandardDelivery
            id: delivery
            inputs:
              shipping_address: ${inputs.shipping_address}
            outputs:
              - estimated_delivery_days
              - carrier

      # Case 2: Express order
      - when: "express"
        do:
          - task: ApplyExpressPricing
            id: pricing
            inputs:
              subtotal: ${base_price.subtotal}
              express_premium: 1.20  # 20% markup
            outputs:
              - final_price
              - discount_applied
              - shipping_cost

          - task: CalculateExpressDelivery
            id: delivery
            inputs:
              shipping_address: ${inputs.shipping_address}
              priority: "high"
            outputs:
              - estimated_delivery_days
              - carrier
              - tracking_priority

      # Case 3: Bulk order
      - when: "bulk"
        do:
          - task: ApplyBulkPricing
            id: pricing
            inputs:
              subtotal: ${base_price.subtotal}
              bulk_discount: 0.15  # 15% discount
              item_count: ${base_price.item_count}
            outputs:
              - final_price
              - discount_applied
              - shipping_cost

          - task: ScheduleBulkDelivery
            id: delivery
            inputs:
              shipping_address: ${inputs.shipping_address}
              item_count: ${base_price.item_count}
              requires_freight: true
            outputs:
              - estimated_delivery_days
              - carrier
              - freight_required

      # Default case: Unknown order type
      - default:
          - exit:
              reason: "Invalid order type"
              outputs:
                success: false
                error: "Order type must be standard, express, or bulk"
```

### Why Switch Over If/Else?

**With If/Else** (harder to read):
```yaml
- if: ${inputs.order_type} == "standard"
  then: ...
  else:
    - if: ${inputs.order_type} == "express"
      then: ...
      else:
        - if: ${inputs.order_type} == "bulk"
          then: ...
```

**With Switch** (clear intent):
```yaml
- switch: ${inputs.order_type}
  cases:
    - when: "standard"
      do: ...
    - when: "express"
      do: ...
    - when: "bulk"
      do: ...
```

**Use switch/case when**:
- Branching on a single value
- You have 3+ possible values
- Cases are mutually exclusive
- You want exhaustive handling (with default)

---

## 9. Step 5: Loop Processing

Now we need to process each line item individually. This is where loops shine.

### For_Each Pattern

```yaml
  # Step 7: Process each line item
  - for_each: ${inputs.items}
    as: item
    do:
      # Validate this specific item
      - task: ValidateLineItem
        id: validate_${item.product_id}
        inputs:
          product_id: ${item.product_id}
          quantity: ${item.quantity}
          catalog: ${catalog.products}
        outputs:
          - is_valid
          - validation_message

      # If item invalid, log and continue
      - if: ${validate_${item.product_id}.is_valid} == false
        then:
          - task: LogInvalidLineItem
            inputs:
              order_id: ${inputs.order_id}
              product_id: ${item.product_id}
              reason: ${validate_${item.product_id}.validation_message}

      # Reserve inventory for this item
      - task: ReserveInventory
        id: reserve_${item.product_id}
        inputs:
          product_id: ${item.product_id}
          quantity: ${item.quantity}
          reservation_ids: ${inventory.reserved_inventory_ids}
        outputs:
          - reservation_id
          - expires_at

      # Calculate line item total
      - task: CalculateLineItemPrice
        id: line_price_${item.product_id}
        inputs:
          product_id: ${item.product_id}
          quantity: ${item.quantity}
          base_price: ${catalog.prices}
          discount: ${pricing.discount_applied}
        outputs:
          - line_total
          - unit_price
```

### Loop Design Considerations

**Dynamic IDs**: Notice `id: validate_${item.product_id}`
- Generates unique IDs: `validate_PROD123`, `validate_PROD456`
- Allows referencing specific items later
- Use when you need to track individual iterations

**Error Handling in Loops**: We log invalid items but continue
- Validates all items rather than stopping at first failure
- Collects all errors for user feedback
- Alternative: Use `break_on_error: true` to stop immediately

**Accessing Loop Variables**: Use `${item.field}` syntax
- `${item}` - The current item object
- `${item.product_id}` - A field on that object
- `${item.quantity}` - Another field

---

## 10. Step 6: Parallel Operations

After payment succeeds, we need to update multiple systems. These are **independent** - they can happen at the same time!

### Identifying Parallelizable Tasks

**Question for each task**: "Does this task depend on the results of another task?"

After payment:
- ✅ Update inventory - NO dependencies
- ✅ Send customer email - NO dependencies
- ✅ Notify warehouse - NO dependencies
- ✅ Update CRM - NO dependencies

**All can run in parallel!**

### Parallel Execution

```yaml
  # Step 8: Process payment
  - task: ProcessPayment
    id: payment
    inputs:
      customer_id: ${inputs.customer_id}
      amount: ${pricing.final_price}
      payment_method: ${inputs.payment_method}
      payment_details: ${inputs.payment_details}
    outputs:
      - transaction_id
      - payment_status
      - confirmation_code

  # Exit if payment failed
  - if: ${payment.payment_status} != "success"
    then:
      - exit:
          reason: "Payment failed"
          outputs:
            success: false
            error: "Payment could not be processed"

  # Step 9: Execute post-payment tasks in PARALLEL
  - parallel:
      # Update inventory system
      - task: CommitInventoryReservation
        id: inventory_commit
        inputs:
          reservation_ids: ${inventory.reserved_inventory_ids}
          order_id: ${inputs.order_id}
        outputs:
          - commit_id
          - updated_stock_levels

      # Send customer confirmation
      - task: SendOrderConfirmation
        id: customer_email
        inputs:
          customer_id: ${inputs.customer_id}
          order_id: ${inputs.order_id}
          confirmation_code: ${payment.confirmation_code}
          estimated_delivery: ${delivery.estimated_delivery_days}
        outputs:
          - email_sent
          - email_id

      # Notify warehouse for fulfillment
      - task: NotifyWarehouse
        id: warehouse_notification
        inputs:
          order_id: ${inputs.order_id}
          items: ${inputs.items}
          shipping_address: ${inputs.shipping_address}
          priority: ${inputs.order_type}
        outputs:
          - fulfillment_id
          - warehouse_location

      # Update CRM system
      - task: UpdateCRM
        id: crm_update
        inputs:
          customer_id: ${inputs.customer_id}
          order_id: ${inputs.order_id}
          order_value: ${pricing.final_price}
          order_type: ${inputs.order_type}
        outputs:
          - crm_record_id
```

### Performance Benefits

**Sequential** (slow):
```
Update Inventory (500ms)
  ↓
Send Email (300ms)
  ↓
Notify Warehouse (400ms)
  ↓
Update CRM (250ms)
  ↓
Total: 1,450ms
```

**Parallel** (fast):
```
Update Inventory (500ms) ─┐
Send Email (300ms) ────────┼─→ All complete
Notify Warehouse (400ms) ──┤   when slowest
Update CRM (250ms) ────────┘   finishes

Total: 500ms (fastest task determines duration)
```

### When to Use Parallel

✅ **Use parallel when:**
- Tasks don't depend on each other's outputs
- Tasks are I/O bound (API calls, database queries)
- Order doesn't matter
- Failure of one shouldn't stop others

❌ **Don't use parallel when:**
- Task B needs Task A's results
- Tasks modify shared state
- Execution order matters
- You need sequential error handling

---

## 11. Step 7: Error Handling

Some operations can fail temporarily (network issues, rate limits). We want to retry automatically.

### Retry Strategy

```yaml
  # Step 8: Process payment (with retry logic)
  - task: ProcessPayment
    id: payment
    inputs:
      customer_id: ${inputs.customer_id}
      amount: ${pricing.final_price}
      payment_method: ${inputs.payment_method}
      payment_details: ${inputs.payment_details}
    outputs:
      - transaction_id
      - payment_status
      - confirmation_code
    retry:
      max_attempts: 3
      delay_seconds: 2
      backoff_multiplier: 2  # 2s, 4s, 8s delays
    on_error:
      # Log payment failure
      - task: LogPaymentFailure
        inputs:
          order_id: ${inputs.order_id}
          customer_id: ${inputs.customer_id}
          error: ${payment.error}

      # Release reserved inventory
      - task: ReleaseInventoryReservation
        inputs:
          reservation_ids: ${inventory.reserved_inventory_ids}

      # Notify customer
      - task: SendPaymentFailureEmail
        inputs:
          customer_id: ${inputs.customer_id}
          order_id: ${inputs.order_id}
```

### Retry Design Considerations

**Exponential Backoff**: Delays increase exponentially
- Attempt 1: Wait 2 seconds
- Attempt 2: Wait 4 seconds (2 × 2)
- Attempt 3: Wait 8 seconds (4 × 2)

**Why?** Gives downstream systems time to recover.

**on_error Handler**: Runs after all retries exhausted
- Clean up resources (release inventory)
- Notify stakeholders (customer, support)
- Log for debugging
- Don't exit - let flow handle the error response

### When to Retry

✅ **Retry for**:
- Network errors
- Temporary server errors (503, 429)
- Database connection issues
- Rate limit errors

❌ **Don't retry for**:
- Invalid input (400 errors)
- Authentication failures (401)
- Not found errors (404)
- Business logic failures

---

## 12. Step 8: Cleanup Handlers

What if the customer cancels the order while it's processing? We need to clean up!

### on_cancel Pattern

```yaml
# At flow level (top of YAML)
flow: OrderFulfillment
description: Intelligent order processing and fulfillment system

on_cancel:
  # Run these tasks if flow is cancelled
  - task: ReleaseAllInventoryReservations
    inputs:
      order_id: ${inputs.order_id}

  - task: RefundPayment
    inputs:
      transaction_id: ${payment.transaction_id}
      amount: ${pricing.final_price}

  - task: NotifyCustomerCancelled
    inputs:
      customer_id: ${inputs.customer_id}
      order_id: ${inputs.order_id}

  - task: LogOrderCancellation
    inputs:
      order_id: ${inputs.order_id}
      cancelled_at_step: ${context.current_step}
```

### When Cancellation Happens

```
Flow Running → API receives cancel request → Flow stops → on_cancel runs
```

**Important**: Cleanup tasks run in order, even if flow was in middle of processing.

### Cancellation in Tasks

Tasks can also check if flow was cancelled:

```yaml
  # In your flow steps
  - task: LongRunningInventoryUpdate
    id: inventory_update
    inputs:
      items: ${inputs.items}
      order_id: ${inputs.order_id}
```

The Python implementation can check `context.is_cancelled()` periodically.

---

## 13. Defining Outputs

Outputs are what the flow returns to the caller. Think about what's useful:

```yaml
outputs:
  # Success indicator
  - name: success
    value: true
    description: Whether order was successfully processed

  # Order identification
  - name: order_id
    value: ${inputs.order_id}
    description: The order identifier

  # Payment confirmation
  - name: transaction_id
    value: ${payment.transaction_id}
    description: Payment transaction ID

  - name: confirmation_code
    value: ${payment.confirmation_code}
    description: Order confirmation code for customer

  # Delivery information
  - name: estimated_delivery_days
    value: ${delivery.estimated_delivery_days}
    description: Estimated days until delivery

  - name: tracking_number
    value: ${warehouse_notification.fulfillment_id}
    description: Shipment tracking number

  # Financial details
  - name: final_price
    value: ${pricing.final_price}
    description: Total amount charged

  - name: discount_applied
    value: ${pricing.discount_applied}
    description: Total discount amount

  # Fulfillment details
  - name: warehouse_location
    value: ${warehouse_notification.warehouse_location}
    description: Warehouse handling this order
```

### Output Design Principles

1. **Return what callers need**: Think API consumers
2. **Include identifiers**: For tracking and support
3. **Provide confirmation data**: For customer communication
4. **Document everything**: Descriptions become API docs

---

## 14. The Complete Flow

Here's the complete flow definition we built:

```yaml
flow: OrderFulfillment
description: Intelligent order processing and fulfillment system

inputs:
  - name: order_id
    type: string
    required: true
  - name: customer_id
    type: string
    required: true
  - name: items
    type: array
    required: true
  - name: payment_method
    type: string
    required: true
  - name: payment_details
    type: object
    required: true
  - name: shipping_address
    type: object
    required: true
  - name: order_type
    type: string
    required: true
  - name: special_instructions
    type: string
    required: false

on_cancel:
  - task: ReleaseAllInventoryReservations
    inputs:
      order_id: ${inputs.order_id}
  - task: RefundPayment
    inputs:
      transaction_id: ${payment.transaction_id}
  - task: NotifyCustomerCancelled
    inputs:
      customer_id: ${inputs.customer_id}

steps:
  # 1. Data Gathering (Sequential)
  - task: FetchCustomer
    id: customer
    inputs:
      customer_id: ${inputs.customer_id}
    outputs:
      - profile
      - membership_status
      - account_type
      - lifetime_value

  - task: FetchProductCatalog
    id: catalog
    inputs:
      product_ids: ${inputs.items}
    outputs:
      - products
      - prices
      - stock_levels

  # 2. Validation (Guard Clauses with Exit)
  - task: ValidateCustomer
    id: customer_validation
    inputs:
      profile: ${customer.profile}
    outputs:
      - is_valid
      - validation_errors

  - if: ${customer_validation.is_valid} == false
    then:
      - exit:
          reason: "Customer validation failed"
          outputs:
            success: false
            error: ${customer_validation.validation_errors}

  - task: CheckInventory
    id: inventory
    inputs:
      items: ${inputs.items}
      stock_levels: ${catalog.stock_levels}
    outputs:
      - available
      - unavailable_items
      - reserved_inventory_ids

  - if: ${inventory.available} == false
    then:
      - exit:
          reason: "Items out of stock"
          outputs:
            success: false
            unavailable_items: ${inventory.unavailable_items}

  # 3. Complex Validation (Quantified Conditions)
  - task: GetCustomerStats
    id: stats
    inputs:
      customer_id: ${inputs.customer_id}
    outputs:
      - account_age_years

  - if: ${inputs.order_type} == "express"
    then:
      - if:
          any:
            - ${customer.membership_status} == "premium"
            - ${customer.lifetime_value} > 5000
            - ${stats.account_age_years} >= 2
        then:
          - task: LogExpressOrderApproved
        else:
          - exit:
              reason: "Express requires premium membership"

  # 4. Multi-Way Branching (Switch/Case)
  - task: CalculateBasePrice
    id: base_price
    inputs:
      items: ${inputs.items}
      prices: ${catalog.prices}
    outputs:
      - subtotal
      - item_count

  - switch: ${inputs.order_type}
    cases:
      - when: "standard"
        do:
          - task: ApplyStandardPricing
            id: pricing
            outputs:
              - final_price
              - discount_applied
              - shipping_cost
      - when: "express"
        do:
          - task: ApplyExpressPricing
            id: pricing
            outputs:
              - final_price
              - discount_applied
              - shipping_cost
      - when: "bulk"
        do:
          - task: ApplyBulkPricing
            id: pricing
            outputs:
              - final_price
              - discount_applied
              - shipping_cost

  # 5. Loop Processing
  - for_each: ${inputs.items}
    as: item
    do:
      - task: ValidateLineItem
        id: validate_${item.product_id}
        inputs:
          product_id: ${item.product_id}
          quantity: ${item.quantity}
        outputs:
          - is_valid

      - task: ReserveInventory
        id: reserve_${item.product_id}
        inputs:
          product_id: ${item.product_id}
          quantity: ${item.quantity}
        outputs:
          - reservation_id

  # 6. Payment (with Retry and Error Handling)
  - task: ProcessPayment
    id: payment
    inputs:
      amount: ${pricing.final_price}
      payment_method: ${inputs.payment_method}
    outputs:
      - transaction_id
      - confirmation_code
    retry:
      max_attempts: 3
      delay_seconds: 2
      backoff_multiplier: 2
    on_error:
      - task: ReleaseInventoryReservation
        inputs:
          reservation_ids: ${inventory.reserved_inventory_ids}

  # 7. Parallel Post-Payment Processing
  - parallel:
      - task: CommitInventoryReservation
        id: inventory_commit
        outputs:
          - commit_id
      - task: SendOrderConfirmation
        id: customer_email
        outputs:
          - email_sent
      - task: NotifyWarehouse
        id: warehouse_notification
        outputs:
          - fulfillment_id
      - task: UpdateCRM
        id: crm_update

outputs:
  - name: success
    value: true
  - name: order_id
    value: ${inputs.order_id}
  - name: transaction_id
    value: ${payment.transaction_id}
  - name: confirmation_code
    value: ${payment.confirmation_code}
```

---

## 15. Design Principles Summary

### What We Learned

**1. Start with the Business Process**
- Map out the steps on paper first
- Identify decision points
- Find parallel opportunities

**2. Design Inputs Thoughtfully**
- Required vs optional
- Appropriate types
- Clear descriptions

**3. Use Guard Clauses**
- Exit early on failures
- Avoid deep nesting
- Makes flow linear and readable

**4. Choose the Right Conditional**
- Simple comparisons: `if/then/else`
- Multiple conditions: `any/all/none`
- Multi-way branching: `switch/case`

**5. Identify Parallelism**
- Look for independent operations
- Especially after I/O operations
- Can dramatically improve performance

**6. Handle Errors Gracefully**
- Retry transient failures
- Use exponential backoff
- Clean up on error

**7. Plan for Cancellation**
- Define cleanup tasks
- Release resources
- Notify stakeholders

**8. Design Outputs for Consumers**
- Return what callers need
- Include tracking identifiers
- Document everything

### Next Steps

In **Part 2**, we'll implement all these tasks in Python, learning:
- Best practices for task implementation
- Testing strategies
- Error handling patterns
- Performance optimization
- Production readiness

**Continue to**: [Part 2: The Python Implementation](./walkthrough-part2-implementation.md)
