# Flow Implementation Walkthrough Part 2: The Python Code

## Implementing the Order Fulfillment System

**Time**: 45 minutes
**Difficulty**: Intermediate to Advanced
**Focus**: Best practices for task implementation, testing, and production readiness

**Prerequisites**: Complete [Part 1: The YAML Definition](./walkthrough-part1-yaml.md)

---

## Table of Contents

1. [Introduction: From Design to Code](#1-introduction-from-design-to-code)
2. [Setting Up the Task Registry](#2-setting-up-the-task-registry)
3. [Task Design Principles](#3-task-design-principles)
4. [Implementing Validation Tasks](#4-implementing-validation-tasks)
5. [Implementing Calculation Tasks](#5-implementing-calculation-tasks)
6. [Implementing Integration Tasks](#6-implementing-integration-tasks)
7. [Working with Flow Context](#7-working-with-flow-context)
8. [Error Handling in Tasks](#8-error-handling-in-tasks)
9. [Testing Strategies](#9-testing-strategies)
10. [Running and Debugging](#10-running-and-debugging)
11. [Performance Optimization](#11-performance-optimization)
12. [Production Readiness](#12-production-readiness)

---

## 1. Introduction: From Design to Code

In Part 1, we designed a comprehensive order fulfillment flow. Now we'll implement the actual task logic in Python.

### The Separation of Concerns

**YAML** (Part 1) defined:
- ✅ WHAT tasks to execute
- ✅ WHEN to execute them
- ✅ HOW they connect

**Python** (Part 2) defines:
- ✅ HOW each task works internally
- ✅ Business logic implementation
- ✅ External system integration

This separation means:
- **Change flow logic** → Edit YAML only
- **Change implementation** → Edit Python only
- **Test tasks** → Test Python independently
- **Reuse tasks** → Use same Python in multiple flows

### What We'll Build

We'll implement these task categories:

1. **Data Fetching**: FetchCustomer, FetchProductCatalog
2. **Validation**: ValidateCustomer, CheckInventory, ValidateLineItem
3. **Calculation**: CalculateBasePrice, ApplyPricing variants
4. **Processing**: ProcessPayment, ReserveInventory
5. **Integration**: NotifyWarehouse, SendOrderConfirmation, UpdateCRM
6. **Logging**: LogExpressOrderApproved, LogPaymentFailure

---

## 2. Setting Up the Task Registry

Every FlowLang project starts with a task registry. This is where you register all task implementations.

### The Basic Structure

```python
"""
Order Fulfillment Flow - Task Implementations

This module contains all task implementations for the OrderFulfillment flow.
Each task is registered with the @registry.register decorator.
"""

from flowlang import TaskRegistry
from typing import Dict, Any, List
import asyncio
import logging
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_task_registry() -> TaskRegistry:
    """
    Create and configure the task registry for this flow.

    This function is called by the FlowExecutor to get all registered tasks.
    All task implementations are registered here using decorators.

    Returns:
        TaskRegistry: Configured registry with all tasks
    """
    registry = TaskRegistry()

    # Tasks will be registered here via decorators
    # The decorator @registry.register('TaskName') handles registration

    return registry
```

### Understanding the Registry Pattern

**Why a function?**
```python
def create_task_registry() -> TaskRegistry:
    registry = TaskRegistry()
    # Register tasks
    return registry
```

This pattern:
- ✅ Creates a fresh registry each time
- ✅ Avoids global state issues
- ✅ Makes testing easier (each test gets clean registry)
- ✅ Allows multiple flows in one process

---

## 3. Task Design Principles

Before writing any task, understand these principles:

### Principle 1: Tasks Are Async

**All tasks must be async functions**:

```python
# ✅ Correct
@registry.register('FetchCustomer')
async def fetch_customer(customer_id: str):
    # Async implementation
    return {'profile': {...}}

# ❌ Wrong
@registry.register('FetchCustomer')
def fetch_customer(customer_id: str):  # Not async!
    return {'profile': {...}}
```

**Why async?**
- FlowLang's executor is fully async
- Enables parallel execution
- Better for I/O operations (API calls, databases)
- Non-blocking during waits

### Principle 2: Inputs Match YAML

Your function parameters must match the task's `inputs` in YAML:

**YAML**:
```yaml
- task: FetchCustomer
  id: customer
  inputs:
    customer_id: ${inputs.customer_id}
```

**Python**:
```python
@registry.register('FetchCustomer')
async def fetch_customer(customer_id: str):  # Parameter matches YAML input
    #                     ^^^^^^^^^^^ Must match!
```

### Principle 3: Return a Dictionary

**Always return a dict** with keys matching the `outputs` in YAML:

**YAML**:
```yaml
outputs:
  - profile
  - membership_status
  - account_type
```

**Python**:
```python
return {
    'profile': {...},           # Matches output
    'membership_status': 'premium',  # Matches output
    'account_type': 'business'       # Matches output
}
```

### Principle 4: Type Hints Are Your Friend

```python
# ✅ Good - Clear types
@registry.register('FetchCustomer')
async def fetch_customer(customer_id: str) -> Dict[str, Any]:
    ...

# ✅ Better - Specific types
@registry.register('CheckInventory')
async def check_inventory(
    items: List[Dict[str, Any]],
    stock_levels: Dict[str, int]
) -> Dict[str, Any]:
    ...
```

Benefits:
- IDE autocomplete
- Early error detection
- Self-documenting code
- Easier to test

### Principle 5: Keep Tasks Focused

**Good** - One responsibility:
```python
@registry.register('ValidateCustomer')
async def validate_customer(profile: Dict) -> Dict:
    """Validate customer is eligible to place orders"""
    # Only validation logic
```

**Bad** - Multiple responsibilities:
```python
@registry.register('ValidateAndProcessCustomer')
async def validate_and_process_customer(profile: Dict) -> Dict:
    """Validate customer AND update database AND send email AND..."""
    # Too much in one task!
```

**Why?**
- Easier to test
- More reusable
- Clearer flow logic
- Better error isolation

---

## 4. Implementing Validation Tasks

Let's start with validation tasks - they check business rules and return pass/fail results.

### Task 1: ValidateCustomer

```python
    @registry.register('ValidateCustomer',
                      description='Validate customer is eligible to place orders')
    async def validate_customer(
        profile: Dict[str, Any],
        membership_status: str
    ) -> Dict[str, Any]:
        """
        Validate customer eligibility for placing orders.

        Business Rules:
        - Customer account must be active
        - Customer must not be banned
        - Profile must be complete (required fields)

        Args:
            profile: Customer profile data with fields:
                - id, email, name, status, created_at, etc.
            membership_status: Current membership tier

        Returns:
            dict with:
                - is_valid (bool): True if customer passes validation
                - validation_errors (list): List of error messages if invalid

        Example:
            >>> result = await validate_customer(
            ...     profile={'status': 'active', 'email': 'user@example.com'},
            ...     membership_status='standard'
            ... )
            >>> result['is_valid']
            True
        """
        errors = []

        # Rule 1: Account must be active
        if profile.get('status') != 'active':
            errors.append(f"Account status is {profile.get('status')}, must be active")

        # Rule 2: Must not be banned
        if profile.get('banned', False):
            errors.append("Customer account is banned")

        # Rule 3: Email must be verified
        if not profile.get('email_verified', False):
            errors.append("Email address not verified")

        # Rule 4: Required profile fields
        required_fields = ['email', 'name', 'phone']
        for field in required_fields:
            if not profile.get(field):
                errors.append(f"Missing required field: {field}")

        # Log validation result
        if errors:
            logger.warning(f"Customer validation failed for {profile.get('id')}: {errors}")
        else:
            logger.info(f"Customer {profile.get('id')} validated successfully")

        return {
            'is_valid': len(errors) == 0,
            'validation_errors': errors
        }
```

**Key Design Decisions**:

1. **Collect all errors**: Don't return on first error - give user complete feedback
2. **Explicit checks**: Each rule is clear and documented
3. **Logging**: Log failures for debugging and monitoring
4. **Defensive access**: Use `.get()` with defaults to handle missing fields gracefully

### Task 2: CheckInventory

```python
    @registry.register('CheckInventory',
                      description='Verify product availability and reserve inventory')
    async def check_inventory(
        items: List[Dict[str, Any]],
        stock_levels: Dict[str, int]
    ) -> Dict[str, Any]:
        """
        Check if all requested items are in stock.

        This task:
        1. Verifies each item is in stock
        2. Reserves inventory if available
        3. Returns list of unavailable items if any

        Args:
            items: List of order items, each with:
                - product_id (str)
                - quantity (int)
                - variant_id (str, optional)
            stock_levels: Current stock by product_id

        Returns:
            dict with:
                - available (bool): True if all items in stock
                - unavailable_items (list): Products that are out of stock
                - reserved_inventory_ids (list): IDs of reserved inventory
        """
        unavailable_items = []
        reserved_ids = []

        for item in items:
            product_id = item['product_id']
            quantity = item['quantity']
            current_stock = stock_levels.get(product_id, 0)

            if current_stock < quantity:
                # Not enough stock
                unavailable_items.append({
                    'product_id': product_id,
                    'requested': quantity,
                    'available': current_stock
                })
                logger.warning(
                    f"Insufficient stock for {product_id}: "
                    f"requested {quantity}, have {current_stock}"
                )
            else:
                # Reserve inventory (in real system, would call inventory service)
                reservation_id = f"RES-{product_id}-{datetime.utcnow().timestamp()}"
                reserved_ids.append(reservation_id)
                logger.info(f"Reserved {quantity} units of {product_id}: {reservation_id}")

        return {
            'available': len(unavailable_items) == 0,
            'unavailable_items': unavailable_items,
            'reserved_inventory_ids': reserved_ids
        }
```

**Key Patterns**:

1. **Iterate and collect**: Process all items, collect results
2. **Graceful degradation**: Use `.get()` with defaults
3. **Generate IDs**: Create reservation IDs (in real system, from database/service)
4. **Detailed logging**: Log both success and failure cases

### Task 3: ValidateLineItem

```python
    @registry.register('ValidateLineItem',
                      description='Validate individual line item data')
    async def validate_line_item(
        product_id: str,
        quantity: int,
        catalog: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Validate a single line item.

        Checks:
        - Product exists in catalog
        - Quantity is positive
        - Quantity doesn't exceed maximum order quantity

        Args:
            product_id: Product identifier
            quantity: Number of items
            catalog: Product catalog data

        Returns:
            dict with:
                - is_valid (bool)
                - validation_message (str)
        """
        # Check product exists
        if product_id not in catalog:
            return {
                'is_valid': False,
                'validation_message': f"Product {product_id} not found in catalog"
            }

        product = catalog[product_id]

        # Check quantity is positive
        if quantity <= 0:
            return {
                'is_valid': False,
                'validation_message': "Quantity must be greater than 0"
            }

        # Check maximum order quantity
        max_quantity = product.get('max_order_quantity', 999)
        if quantity > max_quantity:
            return {
                'is_valid': False,
                'validation_message': f"Quantity {quantity} exceeds maximum {max_quantity}"
            }

        return {
            'is_valid': True,
            'validation_message': "Line item valid"
        }
```

**Design Notes**:

- **Early returns**: Return immediately on first failure (no need to check further)
- **Clear messages**: Validation messages help users fix issues
- **Defaults**: Use `.get()` with sensible defaults (999 max quantity)

---

## 5. Implementing Calculation Tasks

Calculation tasks perform business logic computations.

### Task 1: CalculateBasePrice

```python
    @registry.register('CalculateBasePrice',
                      description='Calculate base price before discounts')
    async def calculate_base_price(
        items: List[Dict[str, Any]],
        prices: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Calculate subtotal for all items.

        Args:
            items: Order items with product_id and quantity
            prices: Product prices by product_id

        Returns:
            dict with:
                - subtotal (float): Total before tax/shipping/discounts
                - item_count (int): Total number of items
        """
        subtotal = 0.0
        item_count = 0

        for item in items:
            product_id = item['product_id']
            quantity = item['quantity']
            unit_price = prices.get(product_id, 0.0)

            line_total = unit_price * quantity
            subtotal += line_total
            item_count += quantity

            logger.debug(
                f"Line item: {product_id} x {quantity} @ ${unit_price} = ${line_total}"
            )

        logger.info(f"Base price calculated: ${subtotal:.2f} for {item_count} items")

        return {
            'subtotal': round(subtotal, 2),  # Round to 2 decimal places
            'item_count': item_count
        }
```

### Task 2: ApplyStandardPricing

```python
    @registry.register('ApplyStandardPricing',
                      description='Apply standard pricing with member discounts')
    async def apply_standard_pricing(
        subtotal: float,
        customer_tier: str
    ) -> Dict[str, Any]:
        """
        Calculate final price with member discounts and standard shipping.

        Discount Tiers:
        - standard: No discount
        - silver: 5% off
        - gold: 10% off
        - platinum: 15% off

        Args:
            subtotal: Base price before discounts
            customer_tier: Customer membership tier

        Returns:
            dict with:
                - final_price (float): Total after discount and shipping
                - discount_applied (float): Discount amount
                - shipping_cost (float): Shipping charge
        """
        # Discount rates by tier
        discount_rates = {
            'standard': 0.00,
            'silver': 0.05,
            'gold': 0.10,
            'platinum': 0.15
        }

        discount_rate = discount_rates.get(customer_tier.lower(), 0.00)
        discount_amount = subtotal * discount_rate
        price_after_discount = subtotal - discount_amount

        # Standard shipping calculation
        if price_after_discount >= 50:
            shipping_cost = 0.00  # Free shipping over $50
        else:
            shipping_cost = 7.99

        final_price = price_after_discount + shipping_cost

        logger.info(
            f"Standard pricing: ${subtotal:.2f} - ${discount_amount:.2f} "
            f"+ ${shipping_cost:.2f} = ${final_price:.2f}"
        )

        return {
            'final_price': round(final_price, 2),
            'discount_applied': round(discount_amount, 2),
            'shipping_cost': round(shipping_cost, 2)
        }
```

### Task 3: ApplyExpressPricing

```python
    @registry.register('ApplyExpressPricing',
                      description='Apply express pricing with premium markup')
    async def apply_express_pricing(
        subtotal: float,
        express_premium: float = 1.20
    ) -> Dict[str, Any]:
        """
        Calculate express order pricing.

        Express orders have:
        - 20% premium on base price (or custom premium)
        - Higher shipping cost for expedited delivery
        - No discounts (premium tier already has benefits)

        Args:
            subtotal: Base price
            express_premium: Premium multiplier (default 1.20 for 20%)

        Returns:
            dict with:
                - final_price (float)
                - discount_applied (float): Always 0 for express
                - shipping_cost (float)
        """
        # Apply express premium
        price_with_premium = subtotal * express_premium
        premium_amount = price_with_premium - subtotal

        # Express shipping is more expensive
        shipping_cost = 19.99

        final_price = price_with_premium + shipping_cost

        logger.info(
            f"Express pricing: ${subtotal:.2f} + ${premium_amount:.2f} premium "
            f"+ ${shipping_cost:.2f} shipping = ${final_price:.2f}"
        )

        return {
            'final_price': round(final_price, 2),
            'discount_applied': 0.00,  # No discounts for express
            'shipping_cost': round(shipping_cost, 2)
        }
```

**Calculation Patterns**:

1. **Clear formulas**: Each calculation step is explicit
2. **Rounding**: Always round currency to 2 decimals
3. **Logging**: Log the calculation details for debugging
4. **Default values**: Function parameters with defaults (express_premium=1.20)
5. **Business logic**: Rules (free shipping > $50) clearly expressed

---

## 6. Implementing Integration Tasks

Integration tasks interact with external systems (databases, APIs, services).

### Task 1: FetchCustomer

```python
    @registry.register('FetchCustomer',
                      description='Fetch customer profile from database')
    async def fetch_customer(customer_id: str) -> Dict[str, Any]:
        """
        Fetch customer data from database/API.

        In production, this would query your customer database or call a
        customer service API. For this example, we'll simulate the response.

        Args:
            customer_id: Customer identifier

        Returns:
            dict with:
                - profile (dict): Full customer profile
                - membership_status (str): Membership tier
                - account_type (str): Account type
                - lifetime_value (float): Total customer spending
        """
        # Simulate database query delay
        await asyncio.sleep(0.1)

        # In production, replace with actual database query:
        # async with db_pool.acquire() as conn:
        #     customer = await conn.fetchrow(
        #         "SELECT * FROM customers WHERE id = $1", customer_id
        #     )

        # Simulated response
        customer_data = {
            'profile': {
                'id': customer_id,
                'email': f'customer{customer_id}@example.com',
                'name': 'John Doe',
                'phone': '+1-555-0100',
                'status': 'active',
                'email_verified': True,
                'banned': False,
                'created_at': '2022-01-15T10:30:00Z'
            },
            'membership_status': 'gold',
            'account_type': 'personal',
            'lifetime_value': 2500.00
        }

        logger.info(f"Fetched customer {customer_id}: {customer_data['membership_status']} member")

        return customer_data
```

**Integration Patterns**:

1. **Async I/O**: Use `await` for database/API calls
2. **Simulate in dev**: Mock responses for development/testing
3. **Error handling**: Will add in next section
4. **Structured response**: Return well-structured data

### Task 2: ProcessPayment

```python
    @registry.register('ProcessPayment',
                      description='Process payment via payment gateway')
    async def process_payment(
        customer_id: str,
        amount: float,
        payment_method: str,
        payment_details: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process payment through payment gateway.

        This is a critical task that should:
        - Use idempotency keys to prevent double-charging
        - Handle various payment methods
        - Return detailed transaction info
        - Be retryable (YAML configures retry logic)

        Args:
            customer_id: Customer identifier
            amount: Amount to charge
            payment_method: Payment type (credit_card, paypal, etc.)
            payment_details: Payment-specific details

        Returns:
            dict with:
                - transaction_id (str): Payment processor transaction ID
                - payment_status (str): 'success' or 'failed'
                - confirmation_code (str): Customer-facing confirmation code
                - error (str, optional): Error message if failed

        Raises:
            Can raise exceptions for retry logic to catch
        """
        logger.info(f"Processing ${amount:.2f} payment for customer {customer_id}")

        # Simulate payment gateway call
        await asyncio.sleep(0.2)

        # In production, call payment gateway:
        # if payment_method == 'credit_card':
        #     response = await stripe.charge.create(
        #         amount=int(amount * 100),  # Cents
        #         currency='usd',
        #         customer=customer_id,
        #         source=payment_details['token'],
        #         idempotency_key=payment_details['idempotency_key']
        #     )
        # elif payment_method == 'paypal':
        #     response = await paypal_client.execute_payment(...)

        # Simulate successful payment
        transaction_id = f"TXN-{customer_id}-{int(datetime.utcnow().timestamp())}"
        confirmation_code = f"ORD-{transaction_id[-8:]}"

        logger.info(f"Payment successful: {transaction_id}")

        return {
            'transaction_id': transaction_id,
            'payment_status': 'success',
            'confirmation_code': confirmation_code
        }
```

### Task 3: SendOrderConfirmation

```python
    @registry.register('SendOrderConfirmation',
                      description='Send order confirmation email to customer')
    async def send_order_confirmation(
        customer_id: str,
        order_id: str,
        confirmation_code: str,
        estimated_delivery_days: int
    ) -> Dict[str, Any]:
        """
        Send order confirmation email.

        Args:
            customer_id: Customer identifier
            order_id: Order identifier
            confirmation_code: Confirmation code to include
            estimated_delivery_days: Delivery estimate

        Returns:
            dict with:
                - email_sent (bool): Whether email was sent successfully
                - email_id (str): Email service message ID
        """
        logger.info(f"Sending order confirmation to customer {customer_id}")

        # Simulate email service delay
        await asyncio.sleep(0.1)

        # In production, use email service:
        # await email_service.send(
        #     to=customer_email,
        #     subject=f"Order Confirmation - {confirmation_code}",
        #     template='order_confirmation',
        #     data={
        #         'order_id': order_id,
        #         'confirmation_code': confirmation_code,
        #         'estimated_delivery': estimated_delivery_days
        #     }
        # )

        email_id = f"EMAIL-{order_id}-{int(datetime.utcnow().timestamp())}"

        logger.info(f"Order confirmation sent: {email_id}")

        return {
            'email_sent': True,
            'email_id': email_id
        }
```

**Integration Best Practices**:

1. **Use async**: All I/O should be async
2. **Idempotency**: Critical for payment operations
3. **Detailed logging**: Log all external calls
4. **Return identifiers**: Transaction IDs, message IDs, etc.
5. **Comment production code**: Show what real implementation looks like

---

## 7. Working with Flow Context

Some tasks need access to the flow's execution context.

### Accessing Context

```python
    @registry.register('CheckCancellation',
                      description='Check if flow has been cancelled')
    async def check_cancellation(context) -> Dict[str, Any]:
        """
        Example task that checks cancellation status.

        To access context, add it as a parameter. FlowLang auto-injects it.

        Args:
            context: Flow execution context (auto-injected)

        Returns:
            dict with:
                - is_cancelled (bool)
        """
        # Check if flow was cancelled
        is_cancelled = context.is_cancelled()

        if is_cancelled:
            logger.warning("Flow cancellation detected")

        return {
            'is_cancelled': is_cancelled
        }
```

### Adding Cleanup Handlers

```python
    @registry.register('ReserveInventory',
                      description='Reserve inventory with cleanup handler')
    async def reserve_inventory(
        product_id: str,
        quantity: int,
        context  # Context auto-injected
    ) -> Dict[str, Any]:
        """
        Reserve inventory and register cleanup handler.

        If flow is cancelled, the cleanup handler will automatically
        release the reservation.

        Args:
            product_id: Product to reserve
            quantity: Number of items
            context: Flow context (auto-injected)

        Returns:
            dict with:
                - reservation_id (str)
                - expires_at (str): ISO timestamp
        """
        reservation_id = f"RES-{product_id}-{int(datetime.utcnow().timestamp())}"

        logger.info(f"Reserved {quantity} x {product_id}: {reservation_id}")

        # Register cleanup handler for cancellation
        async def cleanup():
            logger.info(f"Cleanup: Releasing reservation {reservation_id}")
            # In production: call inventory service to release
            # await inventory_service.release_reservation(reservation_id)

        context.add_cleanup_handler(cleanup)

        return {
            'reservation_id': reservation_id,
            'expires_at': (datetime.utcnow().isoformat() + 'Z')
        }
```

**Context Usage**:

- **Auto-injection**: Just add `context` parameter
- **Cleanup handlers**: Use for resource cleanup on cancellation
- **Cancellation checks**: Long-running tasks should check `context.is_cancelled()`
- **LIFO order**: Cleanup handlers run in reverse order (last added, first executed)

---

## 8. Error Handling in Tasks

Proper error handling is crucial for production systems.

### Retryable vs Non-Retryable Errors

```python
from flowlang.exceptions import FlowExecutionError

class RetryablePaymentError(Exception):
    """Payment error that can be retried (network issues, timeouts)"""
    pass

class NonRetryablePaymentError(Exception):
    """Payment error that should not be retried (invalid card, insufficient funds)"""
    pass


@registry.register('ProcessPaymentWithErrorHandling')
async def process_payment_with_errors(
    customer_id: str,
    amount: float,
    payment_method: str,
    payment_details: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Process payment with proper error classification.

    Raises:
        RetryablePaymentError: For transient failures (retry will be attempted)
        NonRetryablePaymentError: For permanent failures (no retry)
    """
    try:
        # Simulate calling payment gateway
        logger.info(f"Processing payment: ${amount:.2f}")

        # In production, catch specific gateway errors:
        # try:
        #     result = await payment_gateway.charge(...)
        # except gateway.NetworkError as e:
        #     # Transient - retry
        #     raise RetryablePaymentError(f"Network error: {e}")
        # except gateway.CardDeclinedError as e:
        #     # Permanent - don't retry
        #     raise NonRetryablePaymentError(f"Card declined: {e}")

        # Simulate success
        return {
            'transaction_id': f"TXN-{customer_id}",
            'payment_status': 'success'
        }

    except RetryablePaymentError as e:
        logger.warning(f"Retryable payment error: {e}")
        raise  # Let retry logic handle it

    except NonRetryablePaymentError as e:
        logger.error(f"Non-retryable payment error: {e}")
        # Return failure instead of raising (prevents retries)
        return {
            'transaction_id': None,
            'payment_status': 'failed',
            'error': str(e)
        }

    except Exception as e:
        logger.error(f"Unexpected payment error: {e}", exc_info=True)
        # Treat unknown errors as non-retryable
        return {
            'transaction_id': None,
            'payment_status': 'failed',
            'error': 'Payment processing error'
        }
```

### Validation Errors

```python
@registry.register('ValidateWithDetailedErrors')
async def validate_with_errors(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validation that collects and returns detailed errors.

    Don't raise exceptions for validation failures - return error details
    so the flow can handle them gracefully.
    """
    errors = []

    try:
        # Validate each field
        if not data.get('email'):
            errors.append({
                'field': 'email',
                'error': 'Email is required',
                'code': 'MISSING_EMAIL'
            })

        if not data.get('age') or data['age'] < 18:
            errors.append({
                'field': 'age',
                'error': 'Must be 18 or older',
                'code': 'INVALID_AGE'
            })

        # Return structured validation result
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'validated_data': data if not errors else None
        }

    except Exception as e:
        # Only raise for unexpected errors, not validation failures
        logger.error(f"Validation error: {e}", exc_info=True)
        raise FlowExecutionError(f"Validation failed: {e}")
```

**Error Handling Principles**:

1. **Classify errors**: Retryable vs non-retryable
2. **Validation returns**: Don't raise for validation failures
3. **Log appropriately**: Warning for retryable, error for permanent
4. **Structured errors**: Return error codes and details
5. **Let retry work**: Raise retryable errors, return non-retryable failures

---

## 9. Testing Strategies

Testing is critical for reliable workflows.

### Unit Testing Individual Tasks

```python
# tests/test_tasks.py
import pytest
from flow import create_task_registry

@pytest.fixture
def registry():
    """Create a fresh task registry for each test."""
    return create_task_registry()


class TestValidateCustomer:
    """Unit tests for ValidateCustomer task"""

    @pytest.mark.asyncio
    async def test_valid_customer(self, registry):
        """Test validation passes for valid customer"""
        task = registry.get_task('ValidateCustomer')

        result = await task(
            profile={
                'id': 'CUST123',
                'email': 'test@example.com',
                'name': 'John Doe',
                'phone': '+1-555-0100',
                'status': 'active',
                'email_verified': True,
                'banned': False
            },
            membership_status='gold'
        )

        assert result['is_valid'] is True
        assert result['validation_errors'] == []

    @pytest.mark.asyncio
    async def test_inactive_customer(self, registry):
        """Test validation fails for inactive customer"""
        task = registry.get_task('ValidateCustomer')

        result = await task(
            profile={
                'id': 'CUST123',
                'email': 'test@example.com',
                'name': 'John Doe',
                'status': 'inactive',  # Not active
                'email_verified': True
            },
            membership_status='standard'
        )

        assert result['is_valid'] is False
        assert len(result['validation_errors']) > 0
        assert any('status' in error.lower() for error in result['validation_errors'])

    @pytest.mark.asyncio
    async def test_missing_required_fields(self, registry):
        """Test validation fails for missing fields"""
        task = registry.get_task('ValidateCustomer')

        result = await task(
            profile={
                'id': 'CUST123',
                'status': 'active',
                # Missing email, name, phone
            },
            membership_status='standard'
        )

        assert result['is_valid'] is False
        assert len(result['validation_errors']) >= 3  # At least 3 missing fields


class TestCalculateBasePrice:
    """Unit tests for CalculateBasePrice task"""

    @pytest.mark.asyncio
    async def test_simple_calculation(self, registry):
        """Test basic price calculation"""
        task = registry.get_task('CalculateBasePrice')

        result = await task(
            items=[
                {'product_id': 'PROD1', 'quantity': 2},
                {'product_id': 'PROD2', 'quantity': 1}
            ],
            prices={
                'PROD1': 10.00,
                'PROD2': 25.00
            }
        )

        assert result['subtotal'] == 45.00  # (2 * 10) + (1 * 25)
        assert result['item_count'] == 3

    @pytest.mark.asyncio
    async def test_empty_order(self, registry):
        """Test calculation with no items"""
        task = registry.get_task('CalculateBasePrice')

        result = await task(items=[], prices={})

        assert result['subtotal'] == 0.00
        assert result['item_count'] == 0

    @pytest.mark.asyncio
    async def test_rounding(self, registry):
        """Test price rounding to 2 decimals"""
        task = registry.get_task('CalculateBasePrice')

        result = await task(
            items=[{'product_id': 'PROD1', 'quantity': 3}],
            prices={'PROD1': 9.99}
        )

        assert result['subtotal'] == 29.97  # 3 * 9.99
        # Verify it's properly rounded
        assert isinstance(result['subtotal'], float)
```

### Integration Testing Complete Flows

```python
# tests/test_flow_integration.py
import pytest
from flowlang import FlowExecutor
from flow import create_task_registry

@pytest.fixture
def executor():
    """Create flow executor with registry"""
    registry = create_task_registry()
    return FlowExecutor(registry)


@pytest.mark.asyncio
async def test_successful_standard_order(executor):
    """Test complete flow execution for standard order"""
    with open('flow.yaml', 'r') as f:
        flow_yaml = f.read()

    result = await executor.execute_flow(
        flow_yaml,
        inputs={
            'order_id': 'ORD001',
            'customer_id': 'CUST123',
            'items': [
                {'product_id': 'PROD1', 'quantity': 2},
                {'product_id': 'PROD2', 'quantity': 1}
            ],
            'payment_method': 'credit_card',
            'payment_details': {'token': 'tok_123'},
            'shipping_address': {
                'street': '123 Main St',
                'city': 'Anytown',
                'state': 'CA',
                'postal_code': '12345'
            },
            'order_type': 'standard'
        }
    )

    # Verify successful execution
    assert result['success'] is True

    # Verify outputs exist
    assert 'transaction_id' in result['outputs']
    assert 'confirmation_code' in result['outputs']
    assert result['outputs']['success'] is True


@pytest.mark.asyncio
async def test_invalid_customer_exits_early(executor):
    """Test flow exits early for invalid customer"""
    # ... similar test for early exit scenarios
```

### Mocking External Services

```python
# tests/test_with_mocks.py
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_payment_with_mock(registry):
    """Test payment task with mocked gateway"""

    # Mock the payment gateway call
    with patch('flow.payment_gateway.charge', new_callable=AsyncMock) as mock_charge:
        mock_charge.return_value = {
            'id': 'ch_mock_123',
            'status': 'succeeded'
        }

        task = registry.get_task('ProcessPayment')
        result = await task(
            customer_id='CUST123',
            amount=100.00,
            payment_method='credit_card',
            payment_details={'token': 'tok_123'}
        )

        # Verify mock was called
        mock_charge.assert_called_once()

        # Verify result
        assert result['payment_status'] == 'success'
```

**Testing Strategies**:

1. **Unit test tasks**: Test each task in isolation
2. **Integration test flows**: Test complete flow execution
3. **Mock external calls**: Use mocks for APIs/databases in tests
4. **Test error cases**: Test validation failures, error handling
5. **Test edge cases**: Empty data, boundary conditions
6. **Use fixtures**: Share setup code across tests

---

## 10. Running and Debugging

### Checking Implementation Status

```python
# At the bottom of flow.py
if __name__ == '__main__':
    """Check implementation status when run directly"""
    registry = create_task_registry()
    status = registry.get_implementation_status()

    print(f"\n{'='*60}")
    print(f"Task Implementation Status")
    print(f"{'='*60}\n")

    if status['implementation_complete']:
        print("✅ All tasks implemented")
    else:
        print(f"⚠️  Implementation Progress: {status['progress']}")
        print(f"\nImplemented: {status['tasks_implemented']}")
        print(f"Pending: {status['tasks_pending']}\n")

        if status['unimplemented_tasks']:
            print("Unimplemented tasks:")
            for task_name in status['unimplemented_tasks']:
                print(f"  - {task_name}")
```

Run it:
```bash
python flow.py
```

### Debugging Flow Execution

Add detailed logging:

```python
import logging

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,  # Show all logs
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('flow_execution.log'),
        logging.StreamHandler()
    ]
)
```

### Using Watch Mode

For rapid development:

```bash
cd flows/order_fulfillment
python -m flowlang watch --test-inputs test_inputs.json
```

Edit tasks, see results instantly!

---

## 11. Performance Optimization

### 1. Use Connection Pools

```python
# At module level
from asyncpg import create_pool

# Global connection pool
db_pool = None

async def init_db_pool():
    """Initialize database connection pool"""
    global db_pool
    db_pool = await create_pool(
        host='localhost',
        database='orders',
        user='app',
        password='secret',
        min_size=10,
        max_size=20
    )

# In tasks
@registry.register('FetchCustomerOptimized')
async def fetch_customer_optimized(customer_id: str):
    """Fetch customer using connection pool"""
    async with db_pool.acquire() as conn:
        customer = await conn.fetchrow(
            "SELECT * FROM customers WHERE id = $1",
            customer_id
        )
    return customer
```

### 2. Batch Operations

```python
@registry.register('FetchMultipleProducts')
async def fetch_multiple_products(product_ids: List[str]):
    """Fetch multiple products in one query"""
    # ✅ Good - Single query
    async with db_pool.acquire() as conn:
        products = await conn.fetch(
            "SELECT * FROM products WHERE id = ANY($1)",
            product_ids
        )

    # ❌ Bad - Multiple queries
    # for product_id in product_ids:
    #     product = await conn.fetchrow("SELECT * FROM products WHERE id = $1", product_id)
```

### 3. Cache Frequently Accessed Data

```python
from functools import lru_cache
from datetime import datetime, timedelta

# Simple in-memory cache
_catalog_cache = None
_cache_time = None

@registry.register('FetchProductCatalogCached')
async def fetch_catalog_cached():
    """Fetch catalog with 5-minute cache"""
    global _catalog_cache, _cache_time

    now = datetime.utcnow()

    # Check cache
    if _catalog_cache and _cache_time and (now - _cache_time) < timedelta(minutes=5):
        logger.info("Returning cached catalog")
        return _catalog_cache

    # Fetch fresh data
    logger.info("Fetching fresh catalog")
    catalog = await fetch_catalog_from_db()

    # Update cache
    _catalog_cache = catalog
    _cache_time = now

    return catalog
```

---

## 12. Production Readiness

### Production Checklist

Before deploying to production:

**Configuration**:
- [ ] Environment variables for all secrets
- [ ] Database connection pooling configured
- [ ] Proper logging levels (INFO in prod, DEBUG in dev)
- [ ] Error tracking service integrated (Sentry, etc.)

**Error Handling**:
- [ ] All tasks have try/except blocks
- [ ] Retryable errors are classified correctly
- [ ] Non-retryable errors return gracefully
- [ ] Cleanup handlers registered for resources

**Testing**:
- [ ] Unit tests for all tasks (>80% coverage)
- [ ] Integration tests for complete flow
- [ ] Error scenarios tested
- [ ] Load testing completed

**Monitoring**:
- [ ] Logging configured properly
- [ ] Metrics exported (execution time, success rate)
- [ ] Alerts configured for failures
- [ ] Health check endpoint working

**Documentation**:
- [ ] Task docstrings complete
- [ ] API documentation generated
- [ ] Runbook for common issues
- [ ] Deployment guide written

### Example Production Configuration

```python
# config.py
import os

class Config:
    """Production configuration"""

    # Database
    DB_HOST = os.environ.get('DB_HOST', 'localhost')
    DB_NAME = os.environ.get('DB_NAME', 'orders')
    DB_USER = os.environ.get('DB_USER')
    DB_PASSWORD = os.environ.get('DB_PASSWORD')

    # Payment Gateway
    PAYMENT_GATEWAY_URL = os.environ.get('PAYMENT_GATEWAY_URL')
    PAYMENT_API_KEY = os.environ.get('PAYMENT_API_KEY')

    # Email Service
    EMAIL_API_KEY = os.environ.get('EMAIL_API_KEY')
    EMAIL_FROM = os.environ.get('EMAIL_FROM', 'orders@example.com')

    # Monitoring
    SENTRY_DSN = os.environ.get('SENTRY_DSN')

    # Logging
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')


# Use in tasks
from config import Config

@registry.register('ProcessPaymentProduction')
async def process_payment_prod(amount: float, ...):
    """Production payment processing"""
    gateway_url = Config.PAYMENT_GATEWAY_URL
    api_key = Config.PAYMENT_API_KEY

    # Use configuration
    response = await payment_client.charge(
        url=gateway_url,
        headers={'Authorization': f'Bearer {api_key}'},
        amount=amount
    )
```

---

## Conclusion

You've learned how to implement production-ready FlowLang tasks!

### Key Takeaways

1. **Task Design**: Keep tasks focused, async, well-typed
2. **Error Handling**: Classify errors, handle gracefully, log appropriately
3. **Testing**: Unit test tasks, integration test flows, mock external services
4. **Performance**: Use connection pools, batch operations, cache wisely
5. **Production**: Configure properly, monitor closely, document thoroughly

### Complete Example

The complete implementation is available in:
- `flows/order_fulfillment_walkthrough.py` - Fully commented implementation
- `flows/order_fulfillment.yaml` - The flow definition from Part 1

### Next Steps

1. **Deploy to production**: Continue to [Part 3: Deployment and Operations](./walkthrough-part3-deployment.md)
2. **Implement your own flow**: Apply these patterns to your use case
3. **Explore templates**: Check out built-in templates for more examples
4. **Build something real**: Create production workflows with FlowLang

---

**Continue to**: [Part 3: Deployment and Operations](./walkthrough-part3-deployment.md)

**Previous**: [Part 1: The YAML Definition](./walkthrough-part1-yaml.md)
