"""
Order Fulfillment System - Task Implementation Walkthrough

This file demonstrates best practices for implementing FlowLang tasks with
extensive comments explaining design decisions, patterns, and real-world
considerations.

This implementation accompanies:
- docs/walkthrough-part1-yaml.md (YAML design thinking)
- docs/walkthrough-part2-implementation.md (Python implementation guide)
- flows/order_fulfillment.yaml (flow definition)

Key Learning Topics:
1. Task registry pattern with decorators
2. Async task implementation
3. Input/output contracts matching YAML
4. Error handling (retryable vs non-retryable)
5. Integration patterns (DB, external APIs)
6. Context usage for cleanup handlers
7. Testing strategies
8. Production readiness
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List
from flowlang import TaskRegistry

# =============================================================================
# LOGGING CONFIGURATION
# =============================================================================
# In production, configure logging appropriately (JSON format, log levels, etc.)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# =============================================================================
# TASK REGISTRY SETUP
# =============================================================================
# This is the entry point - FlowExecutor calls this to get all tasks

def create_task_registry() -> TaskRegistry:
    """
    Create and configure the task registry.

    This function is called by FlowExecutor when loading flow.py.
    All tasks must be registered here using the @registry.register decorator.

    Returns:
        TaskRegistry: Configured registry with all tasks registered
    """
    registry = TaskRegistry()

    # Tasks are registered via decorators below
    # The registry is returned at the end of this file

    return registry


# Create the registry instance
registry = TaskRegistry()


# =============================================================================
# PHASE 1: CUSTOMER VALIDATION TASKS
# =============================================================================

@registry.register('FetchCustomer',
                  description='Retrieve customer profile and account details')
async def fetch_customer(customer_id: str) -> Dict[str, Any]:
    """
    Fetch customer data from database or CRM.

    Design Notes:
    - Parameter name 'customer_id' matches YAML: inputs.customer_id: ${inputs.customer_id}
    - Returns dict with keys matching YAML outputs: profile, membership_status, account_type
    - Async to allow non-blocking I/O (database, API calls)

    Production Considerations:
    - Use connection pooling for database queries
    - Cache customer data if frequently accessed
    - Handle customer not found gracefully
    - Log access for audit trail

    Args:
        customer_id: Unique customer identifier

    Returns:
        Dictionary with customer profile, membership status, and account type
    """
    logger.info(f"Fetching customer data for: {customer_id}")

    # Simulate async database query
    await asyncio.sleep(0.1)

    # In production, this would be a real database query:
    # async with db_pool.acquire() as conn:
    #     customer = await conn.fetchrow(
    #         "SELECT * FROM customers WHERE id = $1",
    #         customer_id
    #     )

    # Mock customer data for demonstration
    return {
        'profile': {
            'customer_id': customer_id,
            'name': 'Jane Doe',
            'email': 'jane@example.com',
            'status': 'active',
            'email_verified': True,
            'phone': '+1-555-0100',
            'banned': False
        },
        'membership_status': 'gold',  # standard, silver, gold, platinum, premium
        'account_type': 'individual'  # individual, business
    }


@registry.register('ValidateCustomer',
                  description='Check if customer is eligible for orders')
async def validate_customer(
    profile: Dict[str, Any],
    membership_status: str
) -> Dict[str, Any]:
    """
    Validate customer eligibility for placing orders.

    Design Notes:
    - Receives outputs from FetchCustomer task
    - Returns is_valid boolean and validation_errors list
    - Collects ALL errors (doesn't exit on first failure)
    - This allows user to see all problems at once

    Validation Rules:
    - Account must be active
    - Account must not be banned
    - Email must be verified
    - Phone must be present

    Args:
        profile: Customer profile dict from FetchCustomer
        membership_status: Membership tier (standard, gold, etc.)

    Returns:
        Dictionary with is_valid boolean and validation_errors list
    """
    logger.info(f"Validating customer: {profile.get('customer_id')}")

    errors = []

    # Check account status
    if profile.get('status') != 'active':
        errors.append("Account must be active")

    # Check if banned
    if profile.get('banned', False):
        errors.append("Account is banned from placing orders")

    # Check email verification
    if not profile.get('email_verified', False):
        errors.append("Email address must be verified")

    # Check phone number exists
    if not profile.get('phone'):
        errors.append("Phone number required for order updates")

    # Log validation result
    if errors:
        logger.warning(f"Customer validation failed: {errors}")
    else:
        logger.info("Customer validation passed")

    return {
        'is_valid': len(errors) == 0,
        'validation_errors': errors
    }


# =============================================================================
# PHASE 2: ORDER TYPE VALIDATION TASKS
# =============================================================================

@registry.register('GetCustomerStatistics',
                  description='Retrieve customer account statistics')
async def get_customer_statistics(customer_id: str) -> Dict[str, Any]:
    """
    Get customer account age, lifetime value, and order history.

    Design Notes:
    - Used for determining express order eligibility
    - Calculates derived metrics from historical data
    - Could be cached with TTL for performance

    Metrics:
    - account_age_years: How long customer has had account
    - lifetime_value: Total spent across all orders
    - order_count: Number of completed orders

    Args:
        customer_id: Customer identifier

    Returns:
        Dictionary with account statistics
    """
    logger.info(f"Fetching statistics for customer: {customer_id}")

    # Simulate async database query
    await asyncio.sleep(0.1)

    # In production:
    # - Query order history from database
    # - Calculate lifetime_value from sum of order totals
    # - Calculate account_age from registration date

    return {
        'account_age_years': 3,      # Customer for 3 years
        'lifetime_value': 7500.00,   # $7,500 total spent
        'order_count': 42            # 42 completed orders
    }


@registry.register('LogExpressOrderApproved',
                  description='Log that customer qualified for express order')
async def log_express_order_approved(
    customer_id: str,
    reason: str
) -> Dict[str, Any]:
    """
    Log express order approval for analytics.

    Design Notes:
    - Simple logging task with no complex logic
    - Could write to analytics database or event stream
    - Returns empty dict (no outputs needed)

    Args:
        customer_id: Customer identifier
        reason: Why customer qualified for express

    Returns:
        Empty dictionary (no outputs defined in YAML)
    """
    logger.info(f"Express order approved for {customer_id}: {reason}")

    # In production:
    # - Write to analytics database
    # - Send event to event stream (Kafka, etc.)
    # - Update customer profile with preference data

    return {}


# =============================================================================
# PHASE 3: INVENTORY VALIDATION TASKS
# =============================================================================

@registry.register('ValidateLineItem',
                  description='Check if item is available in requested quantity')
async def validate_line_item(
    product_id: str,
    quantity: int
) -> Dict[str, Any]:
    """
    Validate a single line item for availability and pricing.

    Design Notes:
    - Called in a loop (for_each) from YAML
    - Each item is validated independently
    - Returns availability, pricing, and validation status
    - In parallel, these checks can be very fast

    Production Considerations:
    - Query inventory system (database or microservice)
    - Handle product not found
    - Check for minimum/maximum order quantities
    - Get current pricing (may change frequently)

    Args:
        product_id: Product identifier
        quantity: Requested quantity

    Returns:
        Dictionary with available_quantity, unit_price, and valid flag
    """
    logger.info(f"Validating item {product_id}, quantity: {quantity}")

    # Simulate async inventory check
    await asyncio.sleep(0.05)

    # In production:
    # inventory_service = get_inventory_service()
    # availability = await inventory_service.check_availability(product_id)
    # pricing = await pricing_service.get_price(product_id)

    # Mock data - product has 100 units available at $29.99
    available_quantity = 100
    unit_price = 29.99

    # Item is valid if we have enough inventory
    is_valid = quantity <= available_quantity

    if not is_valid:
        logger.warning(
            f"Insufficient inventory for {product_id}: "
            f"requested {quantity}, available {available_quantity}"
        )

    return {
        'available_quantity': available_quantity,
        'unit_price': unit_price,
        'valid': is_valid
    }


@registry.register('AggregateItemValidation',
                  description='Check if all items are available')
async def aggregate_item_validation(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Aggregate validation results from all line items.

    Design Notes:
    - In production, would collect results from ValidateLineItem loop
    - For this walkthrough, we simulate aggregation
    - Returns overall validity and list of unavailable items

    Real Implementation:
    - Would receive step outputs from for_each loop
    - Iterate through results to find failures
    - Build list of unavailable items with details

    Args:
        items: List of items from input

    Returns:
        Dictionary with all_valid boolean and unavailable_items list
    """
    logger.info(f"Aggregating validation for {len(items)} items")

    # In production, would check actual validation results from previous steps
    # For walkthrough, assume all items are valid
    all_valid = True
    unavailable_items = []

    # Example of what real aggregation would look like:
    # for item in items:
    #     validation = context.get_output(f"validate_{item['product_id']}")
    #     if not validation['valid']:
    #         all_valid = False
    #         unavailable_items.append({
    #             'product_id': item['product_id'],
    #             'requested': item['quantity'],
    #             'available': validation['available_quantity']
    #         })

    return {
        'all_valid': all_valid,
        'unavailable_items': unavailable_items
    }


# =============================================================================
# PHASE 4: PRICING CALCULATION TASKS
# =============================================================================

@registry.register('CalculateSubtotal',
                  description='Calculate pre-tax, pre-discount subtotal')
async def calculate_subtotal(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate order subtotal from line items.

    Design Notes:
    - Sums up quantity * price for all items
    - Does not apply discounts or shipping (done in pricing tasks)
    - Could validate against maximum order size

    Args:
        items: List of order items (product_id, quantity)

    Returns:
        Dictionary with subtotal_amount
    """
    logger.info(f"Calculating subtotal for {len(items)} items")

    # In production, would get actual prices from ValidateLineItem outputs
    # For walkthrough, use mock price
    mock_unit_price = 29.99

    subtotal = sum(item['quantity'] * mock_unit_price for item in items)

    logger.info(f"Calculated subtotal: ${subtotal:.2f}")

    return {
        'subtotal_amount': round(subtotal, 2)
    }


@registry.register('ApplyStandardPricing',
                  description='Apply standard pricing with member discounts')
async def apply_standard_pricing(
    subtotal: float,
    customer_tier: str
) -> Dict[str, Any]:
    """
    Calculate final price for standard orders.

    Design Notes:
    - Applies tier-based discounts
    - Adds shipping cost (free over $50)
    - Returns breakdown for transparency

    Business Rules:
    - Standard: 0% discount
    - Silver: 5% discount
    - Gold: 10% discount
    - Platinum: 15% discount
    - Premium: 20% discount
    - Free shipping on orders $50+

    Args:
        subtotal: Pre-discount subtotal
        customer_tier: Membership level

    Returns:
        Dictionary with final_price, discount_applied, shipping_cost
    """
    logger.info(f"Applying standard pricing for {customer_tier} member")

    # Discount rates by membership tier
    discount_rates = {
        'standard': 0.00,
        'silver': 0.05,
        'gold': 0.10,
        'platinum': 0.15,
        'premium': 0.20
    }

    discount_rate = discount_rates.get(customer_tier.lower(), 0.00)
    discount_amount = subtotal * discount_rate

    # Shipping: free over $50, otherwise $7.99
    shipping_cost = 0.00 if subtotal >= 50 else 7.99

    final_price = subtotal - discount_amount + shipping_cost

    logger.info(
        f"Pricing breakdown - Subtotal: ${subtotal:.2f}, "
        f"Discount: ${discount_amount:.2f}, "
        f"Shipping: ${shipping_cost:.2f}, "
        f"Final: ${final_price:.2f}"
    )

    return {
        'final_price': round(final_price, 2),
        'discount_applied': round(discount_amount, 2),
        'shipping_cost': round(shipping_cost, 2)
    }


@registry.register('ApplyExpressPricing',
                  description='Apply express pricing with expedited shipping')
async def apply_express_pricing(
    subtotal: float,
    customer_tier: str
) -> Dict[str, Any]:
    """
    Calculate final price for express orders.

    Design Notes:
    - Same discount structure as standard
    - Higher shipping cost for expedited delivery
    - Could apply express handling fee

    Business Rules:
    - Same tier discounts as standard
    - Express shipping: $19.99 (always charged)

    Args:
        subtotal: Pre-discount subtotal
        customer_tier: Membership level

    Returns:
        Dictionary with final_price, discount_applied, shipping_cost
    """
    logger.info(f"Applying express pricing for {customer_tier} member")

    # Same discount rates as standard
    discount_rates = {
        'standard': 0.00,
        'silver': 0.05,
        'gold': 0.10,
        'platinum': 0.15,
        'premium': 0.20
    }

    discount_rate = discount_rates.get(customer_tier.lower(), 0.00)
    discount_amount = subtotal * discount_rate

    # Express shipping is always $19.99
    shipping_cost = 19.99

    final_price = subtotal - discount_amount + shipping_cost

    logger.info(
        f"Express pricing - Subtotal: ${subtotal:.2f}, "
        f"Discount: ${discount_amount:.2f}, "
        f"Shipping: ${shipping_cost:.2f}, "
        f"Final: ${final_price:.2f}"
    )

    return {
        'final_price': round(final_price, 2),
        'discount_applied': round(discount_amount, 2),
        'shipping_cost': round(shipping_cost, 2)
    }


@registry.register('ApplyBulkPricing',
                  description='Apply bulk order pricing with volume discounts')
async def apply_bulk_pricing(
    subtotal: float,
    item_count: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Calculate final price for bulk orders.

    Design Notes:
    - Volume-based discount (higher for more items)
    - Flat shipping rate for bulk orders
    - Ignores membership tier (volume discount is better)

    Business Rules:
    - 10+ items: 15% discount
    - 25+ items: 20% discount
    - 50+ items: 25% discount
    - 100+ items: 30% discount
    - Bulk shipping: $49.99 (flat rate)

    Args:
        subtotal: Pre-discount subtotal
        item_count: List of items (to count total items)

    Returns:
        Dictionary with final_price, discount_applied, shipping_cost
    """
    total_items = sum(item['quantity'] for item in item_count)
    logger.info(f"Applying bulk pricing for {total_items} items")

    # Volume discount tiers
    if total_items >= 100:
        discount_rate = 0.30
    elif total_items >= 50:
        discount_rate = 0.25
    elif total_items >= 25:
        discount_rate = 0.20
    elif total_items >= 10:
        discount_rate = 0.15
    else:
        discount_rate = 0.00  # Minimum 10 items for bulk

    discount_amount = subtotal * discount_rate

    # Bulk shipping flat rate
    shipping_cost = 49.99

    final_price = subtotal - discount_amount + shipping_cost

    logger.info(
        f"Bulk pricing - Items: {total_items}, "
        f"Subtotal: ${subtotal:.2f}, "
        f"Discount: ${discount_amount:.2f} ({discount_rate*100}%), "
        f"Shipping: ${shipping_cost:.2f}, "
        f"Final: ${final_price:.2f}"
    )

    return {
        'final_price': round(final_price, 2),
        'discount_applied': round(discount_amount, 2),
        'shipping_cost': round(shipping_cost, 2)
    }


# =============================================================================
# PHASE 5: INVENTORY RESERVATION TASKS
# =============================================================================

@registry.register('ReserveInventory',
                  description='Hold inventory for this order')
async def reserve_inventory(
    product_id: str,
    quantity: int,
    context  # Auto-injected by FlowLang
) -> Dict[str, Any]:
    """
    Reserve inventory with automatic cleanup on cancellation.

    Design Notes:
    - Creates temporary hold on inventory
    - Registers cleanup handler for cancellation
    - Reservation expires after timeout
    - Context parameter is auto-injected by FlowLang

    Cleanup Pattern:
    - If flow is cancelled, cleanup handler releases reservation
    - If flow completes normally, reservation is committed
    - This prevents inventory from being held indefinitely

    Production Considerations:
    - Store reservation in Redis with TTL
    - Use distributed lock to prevent race conditions
    - Log reservation for audit trail

    Args:
        product_id: Product to reserve
        quantity: How many units to reserve
        context: FlowContext (auto-injected, provides cleanup registration)

    Returns:
        Dictionary with reservation_id and expires_at timestamp
    """
    logger.info(f"Reserving {quantity} units of {product_id}")

    # Generate unique reservation ID
    reservation_id = f"RES-{product_id}-{int(datetime.utcnow().timestamp())}"

    # Reservation expires in 15 minutes
    expires_at = datetime.utcnow() + timedelta(minutes=15)

    # Simulate async reservation
    await asyncio.sleep(0.05)

    # In production:
    # inventory_service = get_inventory_service()
    # await inventory_service.reserve(
    #     product_id=product_id,
    #     quantity=quantity,
    #     reservation_id=reservation_id,
    #     ttl_seconds=900  # 15 minutes
    # )

    # Register cleanup handler for cancellation
    # This runs if the flow is cancelled before completing
    async def cleanup_reservation():
        logger.info(f"Releasing reservation {reservation_id} due to cancellation")
        # In production:
        # await inventory_service.release_reservation(reservation_id)

    context.add_cleanup_handler(cleanup_reservation)

    logger.info(f"Reserved {quantity} units with ID {reservation_id}")

    return {
        'reservation_id': reservation_id,
        'expires_at': expires_at.isoformat() + 'Z'
    }


# =============================================================================
# PHASE 6: PAYMENT PROCESSING TASKS
# =============================================================================

@registry.register('ProcessPayment',
                  description='Process payment via gateway with retry logic')
async def process_payment(
    customer_id: str,
    amount: float,
    payment_method: str,
    payment_details: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Process payment through payment gateway.

    Design Notes:
    - Integrates with external payment service (Stripe, PayPal, etc.)
    - Returns transaction ID for refunds
    - YAML defines retry logic (3 attempts, exponential backoff)
    - Raises exceptions for retryable errors

    Error Handling:
    - Network errors: Raise exception (will retry)
    - Gateway timeout: Raise exception (will retry)
    - Card declined: Return failure (no retry)
    - Invalid card: Return failure (no retry)

    Production Considerations:
    - Use idempotency key to prevent duplicate charges
    - Store transaction ID immediately
    - Implement webhook handler for async confirmations
    - Handle 3D Secure / SCA flows

    Args:
        customer_id: Customer identifier
        amount: Amount to charge
        payment_method: Payment method type
        payment_details: Method-specific details (token, etc.)

    Returns:
        Dictionary with transaction_id, payment_status, confirmation_code

    Raises:
        Exception: On retryable errors (network, timeout)
    """
    logger.info(f"Processing ${amount:.2f} payment for customer {customer_id}")

    # Simulate async payment gateway call
    await asyncio.sleep(0.2)

    # In production:
    # payment_gateway = get_payment_gateway()
    # try:
    #     response = await payment_gateway.charge(
    #         amount=int(amount * 100),  # Convert to cents
    #         currency='usd',
    #         customer=customer_id,
    #         source=payment_details.get('token'),
    #         idempotency_key=payment_details.get('idempotency_key'),
    #         metadata={
    #             'order_type': 'order_fulfillment',
    #             'customer_id': customer_id
    #         }
    #     )
    #
    #     if response.status == 'succeeded':
    #         transaction_id = response.id
    #         return {
    #             'transaction_id': transaction_id,
    #             'payment_status': 'success',
    #             'confirmation_code': f"ORD-{transaction_id[-8:]}"
    #         }
    #     elif response.status == 'failed':
    #         # Card declined - don't retry
    #         return {
    #             'transaction_id': None,
    #             'payment_status': 'failed',
    #             'confirmation_code': None
    #         }
    #     else:
    #         # Pending or unknown - retry
    #         raise Exception("Payment gateway returned unexpected status")
    #
    # except NetworkError as e:
    #     # Transient error - will retry
    #     logger.warning(f"Payment network error (will retry): {e}")
    #     raise
    # except TimeoutError as e:
    #     # Transient error - will retry
    #     logger.warning(f"Payment timeout (will retry): {e}")
    #     raise

    # Mock successful payment
    transaction_id = f"TXN-{customer_id}-{int(datetime.utcnow().timestamp())}"

    logger.info(f"Payment successful: {transaction_id}")

    return {
        'transaction_id': transaction_id,
        'payment_status': 'success',
        'confirmation_code': f"ORD-{transaction_id[-8:]}"
    }


@registry.register('ReleaseInventoryReservation',
                  description='Release inventory holds on payment failure')
async def release_inventory_reservation(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Release all inventory reservations after payment failure.

    Design Notes:
    - Called from on_error handler in YAML
    - Releases all items in the order
    - Should be idempotent (safe to call multiple times)

    Args:
        items: List of items to release

    Returns:
        Dictionary with released count
    """
    logger.info(f"Releasing inventory for {len(items)} items")

    # Simulate async release
    await asyncio.sleep(0.1)

    # In production:
    # inventory_service = get_inventory_service()
    # for item in items:
    #     reservation_id = f"RES-{item['product_id']}-..."  # Get from context
    #     await inventory_service.release_reservation(reservation_id)

    logger.info(f"Released inventory for {len(items)} items")

    return {
        'released_count': len(items)
    }


@registry.register('SendPaymentFailureEmail',
                  description='Notify customer of payment failure')
async def send_payment_failure_email(
    customer_id: str,
    amount: float
) -> Dict[str, Any]:
    """
    Send email notification about payment failure.

    Design Notes:
    - Called from on_error handler
    - Should not raise exceptions (best effort)
    - Include helpful information for customer

    Args:
        customer_id: Customer identifier
        amount: Failed payment amount

    Returns:
        Dictionary with email_sent status
    """
    logger.info(f"Sending payment failure email to {customer_id}")

    # Simulate async email send
    await asyncio.sleep(0.1)

    # In production:
    # email_service = get_email_service()
    # await email_service.send(
    #     to=customer_email,
    #     template='payment_failure',
    #     variables={
    #         'amount': amount,
    #         'customer_id': customer_id
    #     }
    # )

    return {
        'email_sent': True
    }


# =============================================================================
# PHASE 7: ORDER FINALIZATION TASKS (Parallel)
# =============================================================================

@registry.register('CommitInventoryReservation',
                  description='Finalize inventory allocation')
async def commit_inventory_reservation(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Commit all inventory reservations permanently.

    Design Notes:
    - Called in parallel after successful payment
    - Converts temporary reservations to permanent allocations
    - Should be idempotent

    Args:
        items: List of items to commit

    Returns:
        Dictionary with committed status
    """
    logger.info(f"Committing inventory for {len(items)} items")

    # Simulate async commit
    await asyncio.sleep(0.15)

    # In production:
    # inventory_service = get_inventory_service()
    # for item in items:
    #     reservation_id = ...  # Get from context
    #     await inventory_service.commit_reservation(reservation_id)

    logger.info("Inventory committed successfully")

    return {
        'committed': True
    }


@registry.register('SendOrderConfirmation',
                  description='Send confirmation email to customer')
async def send_order_confirmation(
    customer_id: str,
    order_summary: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Send order confirmation email with details.

    Design Notes:
    - Runs in parallel with other finalization tasks
    - Includes order details, tracking info, estimated delivery
    - Should not block order completion if email fails

    Args:
        customer_id: Customer identifier
        order_summary: Order details for email template

    Returns:
        Dictionary with email_sent status
    """
    logger.info(f"Sending order confirmation to {customer_id}")

    # Simulate async email send
    await asyncio.sleep(0.1)

    # In production:
    # email_service = get_email_service()
    # await email_service.send(
    #     to=customer_email,
    #     template='order_confirmation',
    #     variables=order_summary
    # )

    logger.info(f"Confirmation email sent: {order_summary.get('confirmation_code')}")

    return {
        'email_sent': True
    }


@registry.register('NotifyWarehouse',
                  description='Alert warehouse for picking and packing')
async def notify_warehouse(
    items: List[Dict[str, Any]],
    shipping_address: Dict[str, Any],
    order_type: str
) -> Dict[str, Any]:
    """
    Notify warehouse system to begin order fulfillment.

    Design Notes:
    - Runs in parallel after payment
    - Includes priority flag for express orders
    - Returns notification ID for tracking

    Args:
        items: Items to fulfill
        shipping_address: Delivery address
        order_type: standard, express, or bulk

    Returns:
        Dictionary with notification_id
    """
    logger.info(f"Notifying warehouse for {order_type} order")

    # Simulate async notification
    await asyncio.sleep(0.12)

    # In production:
    # warehouse_service = get_warehouse_service()
    # notification = await warehouse_service.create_pick_ticket(
    #     items=items,
    #     shipping_address=shipping_address,
    #     priority='high' if order_type == 'express' else 'normal'
    # )

    notification_id = f"WH-{int(datetime.utcnow().timestamp())}"

    logger.info(f"Warehouse notified: {notification_id}")

    return {
        'notification_id': notification_id
    }


@registry.register('UpdateCRM',
                  description='Update customer relationship management system')
async def update_crm(
    customer_id: str,
    order_value: float,
    order_type: str
) -> Dict[str, Any]:
    """
    Update CRM with order information for customer insights.

    Design Notes:
    - Runs in parallel with other finalization
    - Updates customer lifetime value, order count, etc.
    - Failure should not block order completion

    Args:
        customer_id: Customer identifier
        order_value: Total order value
        order_type: Order type for analytics

    Returns:
        Dictionary with crm_updated status
    """
    logger.info(f"Updating CRM for customer {customer_id}")

    # Simulate async CRM update
    await asyncio.sleep(0.08)

    # In production:
    # crm_service = get_crm_service()
    # await crm_service.record_purchase(
    #     customer_id=customer_id,
    #     amount=order_value,
    #     order_type=order_type
    # )

    logger.info("CRM updated successfully")

    return {
        'crm_updated': True
    }


# =============================================================================
# CANCELLATION HANDLER TASKS
# =============================================================================

@registry.register('ReleaseAllInventoryReservations',
                  description='Release any held inventory on cancellation')
async def release_all_inventory_reservations(
    items: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Release all inventory reservations when flow is cancelled.

    Design Notes:
    - Called from on_cancel handler in YAML
    - Should handle partial state (some items may not be reserved)
    - Must be idempotent (safe to call multiple times)

    Args:
        items: List of items to release

    Returns:
        Dictionary with release status
    """
    logger.info(f"Cancellation: Releasing inventory for {len(items)} items")

    # Simulate async release
    await asyncio.sleep(0.1)

    # In production:
    # inventory_service = get_inventory_service()
    # for item in items:
    #     try:
    #         await inventory_service.release_all_for_order(order_id)
    #     except NotFoundError:
    #         # Reservation may not exist yet - that's ok
    #         pass

    return {
        'released': True
    }


@registry.register('RefundPayment',
                  description='Refund payment if it was processed')
async def refund_payment(transaction_id: str) -> Dict[str, Any]:
    """
    Refund payment if order is cancelled after payment.

    Design Notes:
    - Called from on_cancel handler
    - Transaction may not exist (if cancelled before payment)
    - Must handle this gracefully

    Args:
        transaction_id: Payment transaction to refund (may be None)

    Returns:
        Dictionary with refund status
    """
    if not transaction_id:
        logger.info("No transaction to refund (cancelled before payment)")
        return {
            'refunded': False,
            'reason': 'no_transaction'
        }

    logger.info(f"Cancellation: Refunding transaction {transaction_id}")

    # Simulate async refund
    await asyncio.sleep(0.2)

    # In production:
    # payment_gateway = get_payment_gateway()
    # refund = await payment_gateway.refund(
    #     transaction_id=transaction_id,
    #     amount=None,  # Full refund
    #     reason='order_cancelled'
    # )

    logger.info(f"Refund processed for {transaction_id}")

    return {
        'refunded': True,
        'refund_id': f"REF-{transaction_id}"
    }


@registry.register('NotifyCustomerCancelled',
                  description='Inform customer order was cancelled')
async def notify_customer_cancelled(customer_id: str) -> Dict[str, Any]:
    """
    Send cancellation notification to customer.

    Design Notes:
    - Called from on_cancel handler
    - Should explain cancellation and next steps
    - Include refund timeline if payment was processed

    Args:
        customer_id: Customer identifier

    Returns:
        Dictionary with notification status
    """
    logger.info(f"Cancellation: Notifying customer {customer_id}")

    # Simulate async email/SMS
    await asyncio.sleep(0.1)

    # In production:
    # notification_service = get_notification_service()
    # await notification_service.send(
    #     customer_id=customer_id,
    #     template='order_cancelled',
    #     channels=['email', 'sms']
    # )

    return {
        'notified': True
    }


# =============================================================================
# REGISTRY EXPORT
# =============================================================================
# This makes the registry available to FlowExecutor

# All tasks have been registered via decorators above.
# When this file is imported, FlowExecutor will call create_task_registry()
# to get the configured registry with all tasks.

# No additional code needed here - the registry is ready to use!
