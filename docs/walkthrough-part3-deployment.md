# Flow Deployment Walkthrough Part 3: Deployment and Operations

## Taking the Order Fulfillment System to Production

**Time**: 45 minutes
**Difficulty**: Intermediate to Advanced
**Focus**: Running, testing, deploying, and operating FlowLang workflows in production

**Prerequisites**:
- Complete [Part 1: The YAML Definition](./walkthrough-part1-yaml.md)
- Complete [Part 2: The Python Implementation](./walkthrough-part2-implementation.md)

---

## Table of Contents

1. [Introduction: From Code to Production](#1-introduction-from-code-to-production)
2. [Setting Up the Project](#2-setting-up-the-project)
3. [Running Locally](#3-running-locally)
4. [Using the REST API](#4-using-the-rest-api)
5. [Integration Testing](#5-integration-testing)
6. [Watch Mode for Development](#6-watch-mode-for-development)
7. [Production Deployment](#7-production-deployment)
8. [Monitoring and Observability](#8-monitoring-and-observability)
9. [Troubleshooting](#9-troubleshooting)
10. [Advanced Patterns](#10-advanced-patterns)
11. [Real-World Scenarios](#11-real-world-scenarios)
12. [Conclusion](#12-conclusion)

---

## 1. Introduction: From Code to Production

In Parts 1 and 2, we designed and implemented a complete Order Fulfillment system. Now we'll take it from development to production.

### What You'll Learn

- How to scaffold a complete FlowLang project
- Running and testing flows locally
- Calling flows via REST API
- Deploying to production environments
- Monitoring and debugging production flows
- Handling real-world operational challenges

### The Journey

```
Development → Local Testing → Integration Tests → Staging → Production → Operations
```

Each stage has its own considerations, tools, and best practices.

---

## 2. Setting Up the Project

### Using the FlowLang Scaffolder

FlowLang provides a scaffolder that generates a complete project structure from your YAML flow definition.

**Step 1: Create the flow directory**

```bash
mkdir -p flows/order_fulfillment
cd flows/order_fulfillment
```

**Step 2: Copy your flow definition**

```bash
# Copy the flow.yaml we created in Part 1
cp /path/to/order_fulfillment.yaml flow.yaml
```

**Step 3: Scaffold the project**

```bash
# From the project root
python -m flowlang.scaffolder scaffold flows/order_fulfillment/flow.yaml \
    -o flows/order_fulfillment
```

This generates:

```
flows/order_fulfillment/
├── flow.yaml              # Flow definition (from Part 1)
├── flow.py                # Task implementation stubs
├── api.py                 # FastAPI server
├── requirements.txt       # Python dependencies
├── README.md              # Project documentation
├── tools/
│   ├── start_server.sh    # Convenient server launcher
│   └── generate.sh        # Smart scaffold/update script
└── tests/
    └── test_tasks.py      # Unit test templates
```

**Step 4: Implement the tasks**

Replace the stub implementations in `flow.py` with the actual task implementations from Part 2:

```bash
# Copy your implementations from Part 2
cp /path/to/order_fulfillment_walkthrough.py flows/order_fulfillment/flow.py
```

**Step 5: Install dependencies**

```bash
cd flows/order_fulfillment

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Project Structure Explanation

**flow.yaml**: The flow definition (WHAT to do)
- Inputs, steps, outputs, error handlers
- Reference: Part 1 of this walkthrough

**flow.py**: Task implementations (HOW to do it)
- Python functions with `@registry.register` decorators
- Reference: Part 2 of this walkthrough

**api.py**: FastAPI server configuration
- Auto-generated REST API endpoints
- OpenAPI/Swagger documentation
- Hot reload support (enabled by default)

**tools/start_server.sh**: Helper script
- Activates virtual environment
- Starts uvicorn server
- Handles hot reload flag

**tests/test_tasks.py**: Test templates
- Unit test stubs for each task
- Ready to fill in with actual test cases

---

## 3. Running Locally

### Starting the Server

**Option 1: Using the helper script** (recommended)

```bash
cd flows/order_fulfillment
./tools/start_server.sh
```

Output:
```
🚀 Starting FlowLang server...
📁 Project: /path/to/flows/order_fulfillment
🔥 Hot reload: enabled
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**Option 2: Using uvicorn directly**

```bash
cd flows/order_fulfillment
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

**Option 3: Using Python directly**

```bash
python api.py
```

### Verifying the Server

**1. Check the root endpoint**

```bash
curl http://localhost:8000/
```

Expected response:
```json
{
  "message": "FlowLang API Server",
  "flows": ["OrderFulfillment"],
  "version": "1.0.0",
  "endpoints": {
    "flows": "/flows",
    "execute": "/flows/{name}/execute",
    "stream": "/flows/{name}/execute/stream",
    "health": "/health",
    "docs": "/docs"
  },
  "flow_status": {
    "OrderFulfillment": {
      "tasks_total": 20,
      "tasks_implemented": 20,
      "implementation_progress": "100%",
      "ready": true
    }
  }
}
```

**2. Check the health endpoint**

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "flows": {
    "OrderFulfillment": {
      "status": "ready",
      "implementation_status": {
        "progress": "20/20",
        "implementation_complete": true,
        "tasks_implemented": 20,
        "tasks_pending": 0
      }
    }
  }
}
```

**3. Open the interactive docs**

Navigate to http://localhost:8000/docs in your browser to see the auto-generated Swagger UI.

Features:
- Interactive API documentation
- Try out endpoints directly
- See request/response schemas
- Explore flow structure

---

## 4. Using the REST API

### Executing a Flow

**Basic Execution**

```bash
curl -X POST http://localhost:8000/flows/OrderFulfillment/execute \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "customer_id": "CUST-12345",
      "items": [
        {"product_id": "PROD-001", "quantity": 2},
        {"product_id": "PROD-002", "quantity": 1}
      ],
      "payment_method": "credit_card",
      "payment_details": {
        "token": "tok_visa_4242",
        "idempotency_key": "order-2024-001"
      },
      "shipping_address": {
        "street": "123 Main St",
        "city": "San Francisco",
        "state": "CA",
        "postal_code": "94102",
        "country": "US"
      },
      "order_type": "standard"
    }
  }'
```

**Success Response**:
```json
{
  "success": true,
  "outputs": {
    "success": true,
    "order_id": "ORD-2024-001",
    "transaction_id": "TXN-CUST-12345-1234567890",
    "confirmation_code": "ORD-67890",
    "final_price": 89.98,
    "discount_applied": 8.99,
    "estimated_delivery": "5-7 business days",
    "message": "Order processed successfully"
  },
  "execution_time_ms": 1247
}
```

### Streaming Execution

For long-running flows, use Server-Sent Events (SSE) to get real-time progress:

```bash
curl -X POST http://localhost:8000/flows/OrderFulfillment/execute/stream \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": { ... }
  }'
```

**Stream Output**:
```
data: {"event": "step_start", "step": "FetchCustomer", "timestamp": "2024-01-15T10:30:00Z"}

data: {"event": "step_complete", "step": "FetchCustomer", "outputs": {...}, "duration_ms": 123}

data: {"event": "step_start", "step": "ValidateCustomer", "timestamp": "2024-01-15T10:30:00Z"}

data: {"event": "step_complete", "step": "ValidateCustomer", "outputs": {...}, "duration_ms": 45}

...

data: {"event": "flow_complete", "success": true, "outputs": {...}, "total_duration_ms": 1247}
```

### Querying Flow Information

**List all flows**:
```bash
curl http://localhost:8000/flows
```

**Get flow details**:
```bash
curl http://localhost:8000/flows/OrderFulfillment
```

Response:
```json
{
  "name": "OrderFulfillment",
  "description": "Complete order fulfillment system",
  "inputs": [
    {"name": "customer_id", "type": "string", "required": true},
    {"name": "items", "type": "array", "required": true},
    ...
  ],
  "outputs": [
    {"name": "success", "description": "Whether order was successfully processed"},
    {"name": "order_id", "description": "The order identifier"},
    ...
  ],
  "tasks": 20,
  "implementation_complete": true
}
```

**Get task status**:
```bash
curl http://localhost:8000/flows/OrderFulfillment/tasks
```

**Visualize flow** (Mermaid diagram):
```bash
curl http://localhost:8000/flows/OrderFulfillment/visualize
```

---

## 5. Integration Testing

### Writing Complete Flow Tests

Create `tests/test_flow_integration.py`:

```python
"""
Integration tests for complete Order Fulfillment flow.

Tests the entire flow end-to-end with realistic data.
"""

import pytest
from flowlang import FlowExecutor
from flow import create_task_registry

@pytest.fixture
def executor():
    """Create flow executor for testing"""
    registry = create_task_registry()
    return FlowExecutor(registry)

@pytest.fixture
def flow_yaml():
    """Load flow definition"""
    with open('flow.yaml', 'r') as f:
        return f.read()


class TestSuccessfulOrders:
    """Test successful order scenarios"""

    @pytest.mark.asyncio
    async def test_standard_order_success(self, executor, flow_yaml):
        """Test complete standard order flow"""
        result = await executor.execute_flow(
            flow_yaml,
            inputs={
                'customer_id': 'CUST-001',
                'items': [
                    {'product_id': 'PROD-100', 'quantity': 2},
                    {'product_id': 'PROD-200', 'quantity': 1}
                ],
                'payment_method': 'credit_card',
                'payment_details': {'token': 'tok_test_123'},
                'shipping_address': {
                    'street': '123 Test St',
                    'city': 'Testville',
                    'state': 'CA',
                    'postal_code': '12345',
                    'country': 'US'
                },
                'order_type': 'standard'
            }
        )

        # Verify successful execution
        assert result['success'] is True

        # Verify required outputs present
        assert 'transaction_id' in result['outputs']
        assert 'confirmation_code' in result['outputs']
        assert 'final_price' in result['outputs']

        # Verify final price calculated
        assert result['outputs']['final_price'] > 0

    @pytest.mark.asyncio
    async def test_express_order_with_premium_member(self, executor, flow_yaml):
        """Test express order for premium member"""
        result = await executor.execute_flow(
            flow_yaml,
            inputs={
                'customer_id': 'CUST-PREMIUM-001',
                'items': [
                    {'product_id': 'PROD-100', 'quantity': 1}
                ],
                'payment_method': 'credit_card',
                'payment_details': {'token': 'tok_test_456'},
                'shipping_address': {
                    'street': '456 Premium Ave',
                    'city': 'Luxurytown',
                    'state': 'NY',
                    'postal_code': '10001',
                    'country': 'US'
                },
                'order_type': 'express'
            }
        )

        assert result['success'] is True

        # Express orders should have higher shipping cost
        outputs = result['outputs']
        assert 'shipping_cost' in outputs
        # Based on our implementation, express shipping is $19.99
        assert outputs.get('shipping_cost') == 19.99


class TestValidationFailures:
    """Test validation failure scenarios"""

    @pytest.mark.asyncio
    async def test_invalid_customer_exits_early(self, executor, flow_yaml):
        """Test that invalid customer causes early exit"""
        # Mock customer with inactive status
        result = await executor.execute_flow(
            flow_yaml,
            inputs={
                'customer_id': 'CUST-INACTIVE',
                'items': [{'product_id': 'PROD-100', 'quantity': 1}],
                'payment_method': 'credit_card',
                'payment_details': {'token': 'tok_test'},
                'shipping_address': {
                    'street': '123 Test St',
                    'city': 'Test',
                    'state': 'CA',
                    'postal_code': '12345',
                    'country': 'US'
                },
                'order_type': 'standard'
            }
        )

        # Should exit early with failure
        assert result['success'] is False
        assert 'validation' in result['outputs'].get('error', '').lower()

    @pytest.mark.asyncio
    async def test_out_of_stock_items(self, executor, flow_yaml):
        """Test handling of out-of-stock items"""
        # Would need to mock inventory system to return out-of-stock
        # For now, test that flow handles unavailable items
        pass


class TestPaymentScenarios:
    """Test payment processing scenarios"""

    @pytest.mark.asyncio
    async def test_payment_retry_on_transient_error(self, executor, flow_yaml):
        """Test that payment retries on network errors"""
        # Would mock payment gateway to simulate retry scenario
        pass

    @pytest.mark.asyncio
    async def test_payment_cleanup_on_failure(self, executor, flow_yaml):
        """Test that resources are cleaned up when payment fails"""
        # Would verify inventory reservation is released
        pass


class TestPerformance:
    """Test performance characteristics"""

    @pytest.mark.asyncio
    async def test_parallel_execution_faster_than_sequential(self, executor, flow_yaml):
        """Verify parallel execution improves performance"""
        import time

        start = time.time()
        result = await executor.execute_flow(flow_yaml, inputs={...})
        duration = time.time() - start

        # Parallel execution should complete in < 1 second
        # (if sequential, would take ~1.5s based on our sleep durations)
        assert duration < 1.0
        assert result['success'] is True

    @pytest.mark.asyncio
    async def test_large_order_performance(self, executor, flow_yaml):
        """Test performance with many items"""
        items = [
            {'product_id': f'PROD-{i:03d}', 'quantity': 1}
            for i in range(50)  # 50 items
        ]

        import time
        start = time.time()

        result = await executor.execute_flow(
            flow_yaml,
            inputs={
                'customer_id': 'CUST-BULK',
                'items': items,
                'payment_method': 'credit_card',
                'payment_details': {'token': 'tok_bulk'},
                'shipping_address': {...},
                'order_type': 'bulk'
            }
        )

        duration = time.time() - start

        assert result['success'] is True
        # Should complete in reasonable time even with 50 items
        assert duration < 5.0  # Adjust based on actual performance
```

### Running Integration Tests

```bash
# Run all tests
pytest tests/test_flow_integration.py -v

# Run specific test class
pytest tests/test_flow_integration.py::TestSuccessfulOrders -v

# Run with coverage
pytest tests/ --cov=flow --cov-report=html

# Run with detailed output
pytest tests/ -v -s
```

### Testing Error Scenarios

Create `tests/test_error_scenarios.py`:

```python
"""Test error handling and edge cases"""

import pytest
from flowlang import FlowExecutor
from flowlang.exceptions import FlowExecutionError


class TestErrorHandling:
    """Test various error scenarios"""

    @pytest.mark.asyncio
    async def test_missing_required_input(self, executor, flow_yaml):
        """Test that missing required input is caught"""
        with pytest.raises(FlowExecutionError):
            await executor.execute_flow(
                flow_yaml,
                inputs={
                    'customer_id': 'CUST-001'
                    # Missing required inputs: items, payment_method, etc.
                }
            )

    @pytest.mark.asyncio
    async def test_invalid_order_type(self, executor, flow_yaml):
        """Test that invalid order type triggers default case"""
        result = await executor.execute_flow(
            flow_yaml,
            inputs={
                'customer_id': 'CUST-001',
                'items': [{'product_id': 'PROD-100', 'quantity': 1}],
                'payment_method': 'credit_card',
                'payment_details': {'token': 'tok_test'},
                'shipping_address': {...},
                'order_type': 'INVALID_TYPE'  # Not standard/express/bulk
            }
        )

        # Should exit with error
        assert result['success'] is False
        assert 'invalid order type' in result['outputs'].get('error', '').lower()
```

---

## 6. Watch Mode for Development

Watch mode automatically executes your flow whenever you make changes to `flow.yaml` or `flow.py`. Perfect for rapid development!

### Starting Watch Mode

```bash
cd flows/order_fulfillment
python -m flowlang watch
```

Or with test inputs:

```bash
python -m flowlang watch --test-inputs test_inputs.json
```

### Creating Test Inputs

Create `test_inputs.json`:

```json
{
  "customer_id": "CUST-DEV-001",
  "items": [
    {"product_id": "PROD-100", "quantity": 2},
    {"product_id": "PROD-200", "quantity": 1}
  ],
  "payment_method": "credit_card",
  "payment_details": {
    "token": "tok_dev_test",
    "idempotency_key": "dev-test-001"
  },
  "shipping_address": {
    "street": "123 Dev St",
    "city": "Devville",
    "state": "CA",
    "postal_code": "94102",
    "country": "US"
  },
  "order_type": "standard"
}
```

### Watch Mode Output

```
🔍 FlowLang Watch Mode
📁 Project: /path/to/flows/order_fulfillment
📝 Watching: flow.yaml, flow.py
🔄 Auto-execute on changes

──────────────────────────────────────────
✅ Execution Successful (1.247s)

Outputs:
  success: true
  order_id: ORD-2024-001
  transaction_id: TXN-CUST-DEV-001-1234567890
  confirmation_code: ORD-67890
  final_price: 89.98
  discount_applied: 8.99

Changed: final_price (was: 95.00, now: 89.98)
──────────────────────────────────────────

Watching for changes... (Press Ctrl+C to exit)
```

### Development Workflow with Watch Mode

1. **Start watch mode** with test inputs
2. **Edit task implementation** in `flow.py`
3. **Save file** → Flow executes automatically
4. **See results instantly** in terminal
5. **Iterate quickly** on implementation

Example development session:

```bash
# Terminal 1: Watch mode
python -m flowlang watch --test-inputs test_inputs.json

# Terminal 2: Edit code
vim flow.py
# Make changes to ApplyStandardPricing task
# Save file

# Terminal 1 automatically shows:
✅ Execution Successful (0.523s)
Changed: discount_applied (was: 8.99, now: 13.50)
```

---

## 7. Production Deployment

### Preparing for Production

**Checklist before deployment**:

- [ ] All tasks implemented (no stubs)
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Error scenarios tested
- [ ] Environment variables configured
- [ ] Secrets managed securely
- [ ] Logging configured
- [ ] Monitoring enabled
- [ ] Health checks working
- [ ] Performance tested under load
- [ ] Documentation complete

### Environment Configuration

Create `.env` file (don't commit this!):

```bash
# Database
DB_HOST=production-db.example.com
DB_NAME=orders
DB_USER=app_user
DB_PASSWORD=secure_password_here
DB_POOL_MIN=10
DB_POOL_MAX=50

# Payment Gateway
PAYMENT_GATEWAY_URL=https://api.stripe.com
PAYMENT_API_KEY=sk_live_xxxxxxxxxxxx

# Email Service
EMAIL_API_KEY=sendgrid_key_here
EMAIL_FROM=orders@example.com

# Monitoring
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
LOG_LEVEL=INFO

# Server
HOST=0.0.0.0
PORT=8000
WORKERS=4
```

Update `flow.py` to use environment variables:

```python
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Production configuration"""
    DB_HOST = os.environ.get('DB_HOST')
    DB_PASSWORD = os.environ.get('DB_PASSWORD')
    PAYMENT_API_KEY = os.environ.get('PAYMENT_API_KEY')
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')

# Use in tasks
@registry.register('ProcessPayment')
async def process_payment(...):
    api_key = Config.PAYMENT_API_KEY
    # Use api_key for payment gateway
```

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY flow.yaml .
COPY flow.py .
COPY api.py .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Run server
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  flowlang:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DB_HOST=${DB_HOST}
      - DB_PASSWORD=${DB_PASSWORD}
      - PAYMENT_API_KEY=${PAYMENT_API_KEY}
      - LOG_LEVEL=INFO
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

**Build and run**:

```bash
# Build image
docker build -t order-fulfillment:latest .

# Run container
docker run -d \
  --name order-fulfillment \
  -p 8000:8000 \
  --env-file .env \
  order-fulfillment:latest

# Or use docker-compose
docker-compose up -d

# Check logs
docker logs -f order-fulfillment

# Check health
curl http://localhost:8000/health
```

### Kubernetes Deployment

Create `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-fulfillment
  labels:
    app: order-fulfillment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: order-fulfillment
  template:
    metadata:
      labels:
        app: order-fulfillment
    spec:
      containers:
      - name: flowlang
        image: your-registry/order-fulfillment:latest
        ports:
        - containerPort: 8000
        env:
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: host
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
        - name: PAYMENT_API_KEY
          valueFrom:
            secretKeyRef:
              name: payment-credentials
              key: api-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: order-fulfillment-service
spec:
  selector:
    app: order-fulfillment
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8000
  type: LoadBalancer
```

**Deploy to Kubernetes**:

```bash
# Create secrets
kubectl create secret generic db-credentials \
  --from-literal=host=prod-db.example.com \
  --from-literal=password=secure_password

kubectl create secret generic payment-credentials \
  --from-literal=api-key=sk_live_xxxx

# Deploy application
kubectl apply -f k8s/deployment.yaml

# Check status
kubectl get pods
kubectl get services

# View logs
kubectl logs -f deployment/order-fulfillment

# Scale up
kubectl scale deployment order-fulfillment --replicas=5
```

---

## 8. Monitoring and Observability

### Logging Best Practices

Configure structured logging in `flow.py`:

```python
import logging
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    """Format logs as JSON for easy parsing"""
    def format(self, record):
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
        }

        # Add extra fields
        if hasattr(record, 'customer_id'):
            log_data['customer_id'] = record.customer_id
        if hasattr(record, 'order_id'):
            log_data['order_id'] = record.order_id

        return json.dumps(log_data)

# Configure logging
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())

logger = logging.getLogger(__name__)
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Use structured logging in tasks
@registry.register('ProcessPayment')
async def process_payment(customer_id: str, amount: float, ...):
    logger.info(
        "Processing payment",
        extra={
            'customer_id': customer_id,
            'amount': amount,
            'event': 'payment_start'
        }
    )

    # ... process payment ...

    logger.info(
        "Payment successful",
        extra={
            'customer_id': customer_id,
            'amount': amount,
            'transaction_id': transaction_id,
            'event': 'payment_success'
        }
    )
```

### Metrics and Monitoring

Integrate Prometheus metrics:

```python
from prometheus_client import Counter, Histogram, Gauge
import time

# Define metrics
flow_executions_total = Counter(
    'flow_executions_total',
    'Total number of flow executions',
    ['flow_name', 'status']
)

flow_execution_duration = Histogram(
    'flow_execution_duration_seconds',
    'Flow execution duration in seconds',
    ['flow_name']
)

active_flows = Gauge(
    'active_flows',
    'Number of currently executing flows',
    ['flow_name']
)

# Instrument your flow
async def execute_flow_with_metrics(flow_name, inputs):
    active_flows.labels(flow_name=flow_name).inc()
    start_time = time.time()

    try:
        result = await executor.execute_flow(flow_yaml, inputs)
        status = 'success' if result['success'] else 'failure'
        return result
    except Exception as e:
        status = 'error'
        raise
    finally:
        duration = time.time() - start_time
        flow_execution_duration.labels(flow_name=flow_name).observe(duration)
        flow_executions_total.labels(flow_name=flow_name, status=status).inc()
        active_flows.labels(flow_name=flow_name).dec()
```

Add metrics endpoint to `api.py`:

```python
from prometheus_client import make_asgi_app

# Mount Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)
```

### Error Tracking with Sentry

```python
import sentry_sdk
from sentry_sdk.integrations.asyncio import AsyncioIntegration

# Initialize Sentry
sentry_sdk.init(
    dsn=Config.SENTRY_DSN,
    environment='production',
    integrations=[AsyncioIntegration()],
    traces_sample_rate=0.1,  # 10% of transactions
)

# Use in tasks
@registry.register('ProcessPayment')
async def process_payment(...):
    try:
        # ... payment logic ...
        return result
    except Exception as e:
        # Sentry automatically captures exceptions
        sentry_sdk.capture_exception(e)
        sentry_sdk.set_context("payment", {
            "customer_id": customer_id,
            "amount": amount,
            "payment_method": payment_method
        })
        raise
```

### Distributed Tracing

Use OpenTelemetry for tracing:

```python
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

# Configure tracing
trace.set_tracer_provider(TracerProvider())
tracer = trace.get_tracer(__name__)
otlp_exporter = OTLPSpanExporter(endpoint="http://jaeger:4317")
span_processor = BatchSpanProcessor(otlp_exporter)
trace.get_tracer_provider().add_span_processor(span_processor)

# Instrument tasks
@registry.register('ProcessPayment')
async def process_payment(customer_id: str, amount: float, ...):
    with tracer.start_as_current_span("process_payment") as span:
        span.set_attribute("customer.id", customer_id)
        span.set_attribute("payment.amount", amount)

        # ... payment logic ...

        span.set_attribute("transaction.id", transaction_id)
        span.set_attribute("payment.status", "success")

        return result
```

---

## 9. Troubleshooting

### Common Issues and Solutions

**Issue 1: "Task not implemented" error**

```
Error: NotImplementedTaskError: Task 'ProcessPayment' is not implemented
```

**Solution**:
- Check that task is decorated with `@registry.register('TaskName')`
- Verify task name matches YAML exactly (case-sensitive)
- Ensure `create_task_registry()` returns the registry

**Issue 2: "Variable not found" error**

```
Error: FlowExecutionError: Variable ${customer.profile} not found
```

**Solution**:
- Check that previous step (`FetchCustomer`) completed successfully
- Verify step `id` matches variable reference
- Ensure output name (`profile`) is in step's `outputs` list
- Check for typos in variable path

**Issue 3: "Flow execution timeout"**

```
Error: TimeoutError: Flow execution exceeded timeout
```

**Solution**:
- Check for infinite loops in flow
- Look for tasks hanging on I/O operations
- Increase timeout in executor configuration
- Use streaming execution for long-running flows

**Issue 4: "Connection pool exhausted"**

```
Error: PoolError: Could not acquire connection from pool
```

**Solution**:
- Increase database connection pool size
- Check for connection leaks (ensure `async with` is used)
- Monitor active connections
- Consider implementing connection retry logic

**Issue 5: Hot reload not working**

```
[Changes made to flow.py not reflected]
```

**Solution**:
- Check that `enable_hot_reload=True` in FlowServer
- Ensure file watcher has permissions to watch files
- Try restarting server with `--reload` flag
- Check logs for reload errors

### Debugging Techniques

**1. Enable debug logging**:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

**2. Add debug prints in tasks**:

```python
@registry.register('ProcessPayment')
async def process_payment(...):
    print(f"DEBUG: customer_id={customer_id}, amount={amount}")
    logger.debug(f"Payment details: {payment_details}")
    # ... rest of task
```

**3. Use interactive debugger**:

```python
@registry.register('ProcessPayment')
async def process_payment(...):
    import pdb; pdb.set_trace()  # Debugger stops here
    # ... rest of task
```

**4. Check flow context**:

```python
@registry.register('SomeTask')
async def some_task(context):
    # Inspect context
    print(f"Inputs: {context.inputs}")
    print(f"Step outputs: {context.step_outputs}")
    print(f"Current step: {context.current_step}")
```

**5. Validate flow definition**:

```bash
python -c "
from flowlang import FlowExecutor
from flow import create_task_registry
import yaml

with open('flow.yaml') as f:
    flow_yaml = f.read()

registry = create_task_registry()
executor = FlowExecutor(registry)

# This will validate the flow
try:
    executor._validate_flow(yaml.safe_load(flow_yaml))
    print('✅ Flow is valid')
except Exception as e:
    print(f'❌ Flow validation error: {e}')
"
```

---

## 10. Advanced Patterns

### Multi-Flow Server

Serve multiple flows from one server:

```bash
# Project structure
flows/
├── order_fulfillment/
│   ├── flow.yaml
│   └── flow.py
├── inventory_management/
│   ├── flow.yaml
│   └── flow.py
└── customer_service/
    ├── flow.yaml
    └── flow.py

# Start multi-flow server
python -m flowlang.server --multi flows --reload
```

Each flow gets its own endpoints:
- `/flows/order_fulfillment/execute`
- `/flows/inventory_management/execute`
- `/flows/customer_service/execute`

### Subflow Pattern

Break complex flows into reusable subflows:

**Main flow** (`order_fulfillment.yaml`):
```yaml
steps:
  - subflow: validate_customer
    inputs:
      customer_id: ${inputs.customer_id}
    outputs:
      - is_valid
      - validation_errors

  - subflow: process_payment
    inputs:
      amount: ${pricing.final_price}
      customer_id: ${inputs.customer_id}
    outputs:
      - transaction_id
```

**Subflow** (`validate_customer.yaml`):
```yaml
flow: validate_customer
inputs:
  - name: customer_id
    type: string
    required: true

steps:
  - task: FetchCustomer
    id: customer
  - task: ValidateCustomer
    id: validation

outputs:
  - name: is_valid
    value: ${validation.is_valid}
  - name: validation_errors
    value: ${validation.validation_errors}
```

### Versioning Strategy

Support multiple API versions:

```
flows/
└── order_fulfillment/
    ├── v1/
    │   ├── flow.yaml
    │   └── flow.py
    ├── v2/
    │   ├── flow.yaml
    │   └── flow.py
    └── latest -> v2/
```

API routing:
- `/v1/flows/order_fulfillment/execute` → v1 implementation
- `/v2/flows/order_fulfillment/execute` → v2 implementation
- `/flows/order_fulfillment/execute` → latest version

### Blue-Green Deployment

Zero-downtime deployments:

```bash
# Deploy new version alongside old
kubectl apply -f k8s/deployment-green.yaml

# Verify green deployment healthy
kubectl get pods -l version=green

# Switch traffic to green
kubectl patch service order-fulfillment \
  -p '{"spec":{"selector":{"version":"green"}}}'

# Monitor for issues
# If problems, rollback:
kubectl patch service order-fulfillment \
  -p '{"spec":{"selector":{"version":"blue"}}}'

# If successful, remove blue deployment
kubectl delete -f k8s/deployment-blue.yaml
```

---

## 11. Real-World Scenarios

### Handling Cancellations

Client requests cancellation mid-flight:

```python
# Client side (cancel button clicked)
import requests

response = requests.post(
    'http://localhost:8000/flows/OrderFulfillment/cancel',
    json={'execution_id': 'exec-12345'}
)
```

Server handles gracefully:

```python
# In api.py
@app.post("/flows/{flow_name}/cancel")
async def cancel_flow(flow_name: str, execution_id: str):
    """Cancel a running flow execution"""
    executor = get_executor(flow_name)

    # Signal cancellation
    await executor.cancel_execution(execution_id)

    return {
        "message": "Flow cancellation requested",
        "execution_id": execution_id,
        "cleanup_handlers": "running"
    }
```

Cleanup handlers in `flow.yaml` automatically run:

```yaml
on_cancel:
  - task: ReleaseAllInventoryReservations
  - task: RefundPayment
  - task: NotifyCustomerCancelled
```

### Idempotency

Ensure operations can be safely retried:

```python
@registry.register('ProcessPayment')
async def process_payment(
    customer_id: str,
    amount: float,
    payment_details: Dict[str, Any]
):
    """Idempotent payment processing"""

    # Use idempotency key from request
    idempotency_key = payment_details.get('idempotency_key')
    if not idempotency_key:
        raise ValueError("idempotency_key required for payment")

    # Check if already processed
    existing = await get_payment_by_idempotency_key(idempotency_key)
    if existing:
        logger.info(f"Payment already processed: {idempotency_key}")
        return existing  # Return cached result

    # Process new payment
    result = await payment_gateway.charge(
        amount=amount,
        customer=customer_id,
        idempotency_key=idempotency_key
    )

    # Cache result
    await cache_payment_result(idempotency_key, result)

    return result
```

Client usage:

```python
import uuid

# Generate idempotency key once
idempotency_key = str(uuid.uuid4())

# Can safely retry with same key
for attempt in range(3):
    try:
        response = requests.post(
            'http://localhost:8000/flows/OrderFulfillment/execute',
            json={
                'inputs': {
                    'customer_id': 'CUST-001',
                    'payment_details': {
                        'idempotency_key': idempotency_key,  # Same key
                        'token': 'tok_123'
                    },
                    # ... other inputs
                }
            }
        )
        break  # Success
    except requests.RequestException as e:
        if attempt == 2:
            raise
        time.sleep(1)  # Retry after delay
```

### Rate Limiting

Protect your API from abuse:

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Configure rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply to endpoints
@app.post("/flows/{flow_name}/execute")
@limiter.limit("10/minute")  # 10 requests per minute
async def execute_flow(request: Request, flow_name: str, ...):
    # ... execution logic
    pass

# Different limits for different flows
@app.post("/flows/order_fulfillment/execute")
@limiter.limit("100/hour")  # More generous for critical flows
async def execute_order_flow(...):
    pass
```

### Circuit Breaker

Prevent cascading failures:

```python
from pybreaker import CircuitBreaker

# Configure circuit breaker for payment gateway
payment_breaker = CircuitBreaker(
    fail_max=5,           # Open after 5 failures
    timeout_duration=60   # Try again after 60 seconds
)

@registry.register('ProcessPayment')
async def process_payment(...):
    """Payment with circuit breaker"""

    @payment_breaker
    async def call_payment_gateway():
        return await payment_gateway.charge(...)

    try:
        result = await call_payment_gateway()
        return result
    except CircuitBreakerError:
        # Circuit is open - fail fast
        logger.error("Payment gateway circuit breaker open")
        return {
            'payment_status': 'failed',
            'error': 'Payment service temporarily unavailable'
        }
```

### Graceful Degradation

Handle partial system failures:

```python
@registry.register('SendOrderConfirmation')
async def send_order_confirmation(...):
    """Send email with fallback to SMS"""

    try:
        # Try primary method (email)
        result = await email_service.send(...)
        return {'email_sent': True, 'method': 'email'}
    except EmailServiceError as e:
        logger.warning(f"Email service failed: {e}, trying SMS fallback")

        try:
            # Fallback to SMS
            result = await sms_service.send(...)
            return {'email_sent': False, 'sms_sent': True, 'method': 'sms'}
        except SMSServiceError:
            # Both failed - log and continue (don't block order)
            logger.error("All notification methods failed")
            return {'email_sent': False, 'sms_sent': False, 'method': 'none'}
```

The flow continues even if notification fails, because it's not critical to order completion.

---

## 12. Conclusion

### What You've Learned

You now know how to:

✅ **Set up** FlowLang projects with scaffolding
✅ **Run** flows locally for development
✅ **Test** flows with unit and integration tests
✅ **Deploy** flows to production (Docker, Kubernetes)
✅ **Monitor** flow execution with logging and metrics
✅ **Debug** issues in development and production
✅ **Scale** flows for high-traffic scenarios
✅ **Handle** real-world operational challenges

### The Complete Journey

**Part 1: YAML Design**
- Learned to think in workflows
- Designed the Order Fulfillment flow
- Used all FlowLang features (conditionals, loops, parallel, error handling)

**Part 2: Python Implementation**
- Implemented 20 production-ready tasks
- Applied best practices (async, error handling, testing)
- Built integrations with external systems

**Part 3: Deployment & Operations** (this part)
- Deployed the flow to production
- Monitored and debugged in real-world scenarios
- Handled operational challenges

### Production Readiness Checklist

Before going live, verify:

**Code Quality**:
- [ ] All tasks implemented (no stubs)
- [ ] Code reviewed and tested
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] Error scenarios tested
- [ ] Performance benchmarks met

**Configuration**:
- [ ] Environment variables configured
- [ ] Secrets stored securely (not in code)
- [ ] Database connections pooled
- [ ] Timeouts configured appropriately
- [ ] Resource limits set (memory, CPU)

**Monitoring**:
- [ ] Structured logging enabled
- [ ] Metrics exported (Prometheus)
- [ ] Error tracking configured (Sentry)
- [ ] Distributed tracing enabled (OpenTelemetry)
- [ ] Alerts configured for critical failures

**Operations**:
- [ ] Health checks working
- [ ] Documentation complete
- [ ] Runbook written for common issues
- [ ] On-call rotation established
- [ ] Backup and disaster recovery plan
- [ ] Load testing completed
- [ ] Scaling strategy defined

**Security**:
- [ ] Authentication enabled
- [ ] Rate limiting configured
- [ ] Input validation thorough
- [ ] SQL injection prevented
- [ ] HTTPS enabled
- [ ] Secrets rotated regularly

### Next Steps

**1. Build your own flow**
- Identify a workflow in your organization
- Design the YAML (Part 1 principles)
- Implement tasks (Part 2 patterns)
- Deploy to production (Part 3 practices)

**2. Explore advanced features**
- Subflows for reusable components
- Multi-flow servers for microservices
- Event-driven triggers
- Approval gates for human-in-the-loop

**3. Contribute back**
- Share your flow templates
- Report issues and improvements
- Help others in the community

**4. Scale up**
- Kubernetes horizontal autoscaling
- Multi-region deployment
- High availability setup
- Performance optimization

### Resources

**Documentation**:
- FlowLang docs: https://docs.flowlang.dev
- API reference: https://api-docs.flowlang.dev
- Community forum: https://community.flowlang.dev

**Example Projects**:
- Order Fulfillment (this walkthrough)
- Data Pipeline workflows
- Customer Onboarding flows
- Report Generation systems

**Tools**:
- FlowLang CLI: Project management and scaffolding
- Watch mode: Rapid development iteration
- VS Code extension: Syntax highlighting and validation

### Final Thoughts

FlowLang enables you to:

- **Design** workflows declaratively (YAML)
- **Implement** tasks incrementally (Python)
- **Deploy** with confidence (production-ready)
- **Operate** reliably (monitoring and debugging)

By separating WHAT (workflow) from HOW (implementation), you get:

- **Clarity**: Workflow is self-documenting
- **Flexibility**: Change logic without changing code
- **Testability**: Test components independently
- **Maintainability**: Easy to understand and modify
- **Scalability**: Deploy anywhere, scale as needed

**You're ready to build production workflows with FlowLang!** 🚀

---

**Previous**: [Part 2: The Python Implementation](./walkthrough-part2-implementation.md)

**Related**: [Hello World Tutorial](./hello-world-tutorial.md) | [Control Flow Patterns](./control-flow-patterns.md)
