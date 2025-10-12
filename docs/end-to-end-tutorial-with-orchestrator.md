# FlowLang End-to-End Tutorial: Building with the Flow Orchestrator

This tutorial demonstrates building a complete FlowLang project using the **Flow Orchestrator agent** to coordinate the entire development lifecycle. The Orchestrator agent acts as your project manager, coordinating other specialized agents and ensuring a smooth workflow from requirements to deployment.

## What You'll Learn

- **How to use the Flow Orchestrator** as a single entry point for complex projects
- **Agent coordination** - Let the Orchestrator call other agents as needed
- **Automated project management** - Less manual orchestration, more building
- **End-to-end workflow** - From idea to production with guided assistance
- **Best practices** for agent-driven development with centralized coordination

## Why Use the Flow Orchestrator?

The Flow Orchestrator agent provides:

✅ **Single Entry Point**: One agent coordinates everything
✅ **Automated Coordination**: Knows when to invoke other agents
✅ **Best Practices Built-In**: Applies FlowLang conventions automatically
✅ **Lifecycle Management**: Handles setup, development, and deployment
✅ **Error Prevention**: Catches issues before they become problems

## Prerequisites

- Python 3.8+ installed
- FlowLang installed (`pip install -e .` from repository root)
- Claude Code CLI or Claude.ai access
- Basic understanding of YAML and Python
- Code editor of your choice

## Tutorial Overview

We'll build an **order processing system** with the Flow Orchestrator coordinating the entire process:
- Validate order data (items, quantities, customer info)
- Check inventory availability
- Process payment via payment gateway
- Update inventory after purchase
- Send confirmation email
- Handle errors with retry logic
- Support cancellation with refunds

**Estimated Time**: 45-60 minutes (faster than manual coordination!)

---

## Phase 0: Project Setup with Flow Orchestrator

Instead of manually running CLI commands, let the Flow Orchestrator set up the project structure.

### Step 1: Invoke Flow Orchestrator for Project Setup

In Claude Code, use this command:

```
Use the flow-orchestrator to create a new FlowLang project called "order-system"
in the flows/ directory. Set it up as an order processing system that will need
database and payment API connections.
```

### What the Orchestrator Does

The Flow Orchestrator will:

1. **Detect the flows/ directory** automatically
2. **Run the CLI command** with appropriate parameters
3. **Configure connections** interactively or suggest configurations
4. **Set up project structure** correctly
5. **Provide next steps** guidance

**Example Orchestrator Actions**:

```bash
# Orchestrator runs:
python -m flowlang project init order-system \
  --name "Order Processing System" \
  --description "Customer order processing workflows"

# Creates:
/flows/order-system/
└── project.yaml
```

### Step 2: Review Generated Configuration

The Orchestrator ensures proper setup:

```yaml
project: Order Processing System
description: Customer order processing workflows
version: 1.0.0
settings:
  shared_connections:
    postgres:
      type: postgres
      url: ${DATABASE_URL}
      pool_size: 10
    stripe:
      type: rest_api
      base_url: https://api.stripe.com/v1
      auth:
        type: api_key
        header: Authorization
        value: ${STRIPE_API_KEY}
  tags: []
  contact: {}
flows: []
```

**Key Benefit**: The Orchestrator handles project setup automatically, ensuring correct directory structure and configuration.

---

## Phase 1: Requirements & Design with Orchestrator

Now we'll use the Orchestrator to coordinate requirements gathering and flow design.

### Step 1: Single Orchestrator Command

Instead of invoking multiple agents separately, use one command:

```
Use the flow-orchestrator to gather requirements and design a flow for an
order processing system. The system should:
- Validate orders
- Check inventory
- Process payments
- Send confirmations
- Handle errors gracefully

Save everything in the order-system project we just created.
```

### What the Orchestrator Does

The Flow Orchestrator will:

1. **Invoke Business Analyst** internally to gather requirements
2. **Save REQUIREMENTS.md** in `/flows/order-system/`
3. **Invoke Business Process Designer** to create flow.yaml
4. **Create flow directory** (`order-processing/`)
5. **Invoke YAML Flow Expert** to validate the design
6. **Provide comprehensive report** of what was created

**Behind the Scenes**:

```
Flow Orchestrator
  ↓
  ├─→ Business Analyst
  │    └─→ Saves: /flows/order-system/REQUIREMENTS.md
  │
  ├─→ Business Process Designer
  │    └─→ Creates: /flows/order-system/order-processing/
  │         └─→ Saves: flow.yaml
  │
  └─→ YAML Flow Expert
       └─→ Validates and optimizes flow.yaml
```

### Step 2: Review Generated Artifacts

**Working Directory**: `/flows/order-system/`

The Orchestrator creates:

```
/flows/order-system/
├── project.yaml
├── REQUIREMENTS.md              # ← Business requirements
└── order-processing/            # ← Flow directory
    └── flow.yaml                # ← Flow definition
```

**REQUIREMENTS.md** (generated by Business Analyst via Orchestrator):

```markdown
# Order Processing System Requirements

## Business Objective
Process customer orders efficiently with proper validation,
inventory management, and payment processing.

## Business Rules
1. Orders must include: customer_id, items, payment_method
2. All items must be in stock before processing
3. Payment is processed immediately after inventory check
4. Inventory is decremented only after successful payment
5. Confirmation email sent after inventory update
6. Failed payments trigger notification to customer
7. Order cancellation requires payment refund

## Process Steps
1. Validate order data
2. Check inventory for all items
3. Calculate total price
4. Process payment
5. Update inventory
6. Send confirmation email
7. Log order completion

## Error Scenarios
- Invalid order data → reject immediately
- Insufficient inventory → notify customer
- Payment failure → retry 3 times, then notify
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

**flow.yaml** (generated by Business Process Designer via Orchestrator):

The Orchestrator coordinates the creation of a complete flow.yaml with:
- Proper input validation
- Inventory checks
- Payment processing
- Error handling
- Parallel execution where appropriate
- Cancellation handlers

See the [main tutorial](./end-to-end-tutorial.md) for the complete flow.yaml content (lines 466-649).

**Key Benefit**: One Orchestrator command replaces multiple manual agent invocations. Requirements and design are created in proper locations automatically.

---

## Phase 2: Code Generation with Orchestrator

The Orchestrator manages scaffolding and project structure.

### Step 1: Invoke Orchestrator for Scaffolding

```
Use the flow-orchestrator to generate all code scaffolding for the
order-processing flow in /flows/order-system/order-processing/.
```

### What the Orchestrator Does

The Flow Orchestrator will:

1. **Navigate to the correct directory**
2. **Run the scaffolder** with appropriate options
3. **Generate all project files**:
   - `flow.py` (task stubs)
   - `api.py` (FastAPI server with hot reload)
   - `tests/test_tasks.py` (test stubs)
   - `tools/start_server.sh` (server launcher)
   - `tools/generate.sh` (update helper)
   - `README.md` (documentation)
4. **Verify generation** succeeded
5. **Show implementation status** (e.g., "0/13 tasks implemented")

**Behind the Scenes**:

```bash
# Orchestrator runs:
cd /flows/order-system/order-processing
python -m flowlang scaffolder scaffold flow.yaml -o .

# Verifies:
ls -la flow.py api.py tests/ tools/
python flow.py  # Check registry status
```

### Step 2: Review Generated Structure

**Working Directory**: `/flows/order-system/order-processing/`

```
order-processing/
├── flow.yaml                # Flow definition (Phase 1)
├── flow.py                  # ← Task stubs
├── api.py                   # ← FastAPI server
├── README.md                # ← Documentation
├── tests/                   # ← Test directory
│   └── test_tasks.py        #    Test stubs
└── tools/                   # ← Helper scripts
    ├── start_server.sh      #    Server launcher
    └── generate.sh          #    Update helper
```

**Key Benefit**: The Orchestrator handles scaffolding automatically, ensures correct directory context, and verifies generation succeeded.

---

## Phase 3: Test & Implementation with Orchestrator

The Orchestrator coordinates test creation and implementation.

### Step 1: Invoke Orchestrator for TDD Workflow

```
Use the flow-orchestrator to set up a TDD workflow for implementing
the order-processing tasks. Create comprehensive tests first, then
guide implementation with watch mode.
```

### What the Orchestrator Does

The Flow Orchestrator will:

1. **Invoke Test Developer** to create comprehensive tests
2. **Create test_inputs.json** with sample data
3. **Start watch mode** for live testing
4. **Provide implementation guidance** for each task
5. **Invoke Task Implementer** to implement tasks one by one
6. **Run tests after each implementation**
7. **Track progress** (e.g., "3/13 tasks complete")

**Behind the Scenes**:

```
Flow Orchestrator
  ↓
  ├─→ Test Developer
  │    └─→ Updates: tests/test_tasks.py
  │         Creates: test_inputs.json
  │
  ├─→ Starts watch mode
  │    └─→ Monitors: flow.py, flow.yaml
  │
  └─→ Task Implementer (iterative)
       └─→ Implements each task
            └─→ Watch mode auto-tests
                 └─→ Shows pass/fail
```

### Step 2: Orchestrator-Guided Implementation

The Orchestrator provides a structured implementation plan:

```
✓ Tests created (15 test cases)
✓ Watch mode running
✓ Test inputs ready

Implementation Plan:
1. ValidateOrderData (foundational) → ⏰ ~5 min
2. LogError (used by error handlers) → ⏰ ~3 min
3. CheckInventory (database access) → ⏰ ~8 min
4. CalculateTotal (business logic) → ⏰ ~6 min
5. ProcessPayment (API integration) → ⏰ ~10 min
6. UpdateInventory (database update) → ⏰ ~7 min
7. SendConfirmationEmail (notification) → ⏰ ~8 min
... (continues for all tasks)

Starting with task 1/13: ValidateOrderData
Let me implement this task...
```

### Step 3: Progress Tracking

The Orchestrator shows progress throughout:

```
Task 1/13: ValidateOrderData
  ✅ Implemented
  ✅ Tests passing (3/3)
  ⏱️  Took 4 minutes

Task 2/13: LogError
  ✅ Implemented
  ✅ Tests passing (2/2)
  ⏱️  Took 2 minutes

Task 3/13: CheckInventory
  ✅ Implemented
  ✅ Tests passing (4/4)
  ⏱️  Took 7 minutes

Overall Progress: 3/13 (23%) - Estimated 35 minutes remaining
```

**Key Benefit**: The Orchestrator provides structured guidance, tracks progress, and ensures tests pass before moving to the next task.

---

## Phase 4: Integration Testing with Orchestrator

The Orchestrator manages integration testing and verification.

### Step 1: Invoke Orchestrator for Integration Testing

```
Use the flow-orchestrator to run integration tests and verify the
order-processing flow works end-to-end. Start the server with hot
reload and test via API.
```

### What the Orchestrator Does

The Flow Orchestrator will:

1. **Verify all tasks implemented** (13/13)
2. **Run full test suite** (`pytest tests/ -v`)
3. **Start server with hot reload**
4. **Test health endpoint**
5. **Execute flow via API** with test inputs
6. **Test error scenarios**
7. **Test cancellation flow**
8. **Provide integration report**

**Behind the Scenes**:

```bash
# Orchestrator runs:
pytest tests/test_tasks.py -v

# Starts server:
./tools/start_server.sh --reload

# Tests API:
curl http://localhost:8000/health
curl -X POST http://localhost:8000/flows/OrderProcessing/execute \
  -H "Content-Type: application/json" \
  -d @test_inputs.json

# Tests cancellation:
curl -X POST http://localhost:8000/flows/OrderProcessing/executions/{id}/cancel
```

### Step 2: Integration Report

The Orchestrator provides a comprehensive report:

```
✅ Integration Testing Complete

Unit Tests:
  ✅ 15/15 tests passing
  ⏱️  Total time: 2.3s
  📊 Coverage: 94%

API Tests:
  ✅ Health endpoint: 200 OK
  ✅ Flow execution: 200 OK (3.2s)
  ✅ Error handling: Proper error responses
  ✅ Cancellation: Refund + inventory restore ✓

Implementation Status:
  ✅ 13/13 tasks implemented (100%)
  ✅ All outputs present
  ✅ Error handlers working
  ✅ Cancellation handlers working

Flow Ready for Production ✓
```

**Key Benefit**: The Orchestrator handles all testing coordination, provides comprehensive verification, and confirms production readiness.

---

## Phase 5: Production Deployment with Orchestrator

The Orchestrator handles production deployment setup.

### Step 1: Invoke Orchestrator for Deployment

```
Use the flow-orchestrator to prepare the order-processing flow for
production deployment. Create Docker configuration, environment
setup, and deployment documentation.
```

### What the Orchestrator Does

The Flow Orchestrator will:

1. **Create .env.example** with all required variables
2. **Generate Dockerfile** optimized for production
3. **Generate docker-compose.yml** with all services
4. **Create deployment documentation**
5. **Provide deployment commands**
6. **Set up health checks**
7. **Configure monitoring**

### Step 2: Review Generated Deployment Files

**Working Directory**: `/flows/order-system/order-processing/`

The Orchestrator creates:

```
order-processing/
├── .env.example              # ← Environment template
├── Dockerfile                # ← Production image
├── docker-compose.yml        # ← Multi-service setup
├── DEPLOYMENT.md             # ← Deployment guide
└── k8s/                      # ← Kubernetes configs (optional)
    ├── deployment.yaml
    └── service.yaml
```

**.env.example**:
```bash
# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/orders_db

# Payment Gateway
STRIPE_API_KEY=sk_live_xxxxxxxxxxxx

# Email Service
SENDGRID_API_KEY=SG.xxxxxxxxxxxx

# Application
LOG_LEVEL=INFO
WORKERS=4
```

**Dockerfile**:
```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY flow.yaml flow.py api.py ./

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Run with multiple workers
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  order-api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - STRIPE_API_KEY=${STRIPE_API_KEY}
      - SENDGRID_API_KEY=${SENDGRID_API_KEY}
    depends_on:
      postgres:
        condition: service_healthy
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
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U orders_user"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### Step 3: Deployment Commands

The Orchestrator provides step-by-step deployment instructions:

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env with production values

# 2. Build and deploy
docker-compose up -d

# 3. Verify deployment
curl http://localhost:8000/health

# 4. Run database migrations (if any)
docker-compose exec order-api python migrate.py

# 5. Monitor logs
docker-compose logs -f order-api

# 6. Test production API
curl -X POST http://localhost:8000/flows/OrderProcessing/execute \
  -H "Content-Type: application/json" \
  -d '{"order_id": "ORD-001", ...}'
```

### Step 4: Production Monitoring

The Orchestrator sets up monitoring:

```bash
# Health monitoring
curl http://localhost:8000/health

# Metrics (if configured)
curl http://localhost:8000/metrics

# Task status
curl http://localhost:8000/flows/OrderProcessing/tasks

# Flow visualization
curl http://localhost:8000/flows/OrderProcessing/visualize
```

**Key Benefit**: The Orchestrator handles all deployment configuration, ensuring production-ready setup with health checks, monitoring, and documentation.

---

## Comparison: With vs Without Orchestrator

### Traditional Multi-Agent Approach

```
User → Business Analyst
User → Save REQUIREMENTS.md manually
User → Business Process Designer
User → Create flow directory manually
User → Save flow.yaml manually
User → YAML Flow Expert
User → Run scaffolder manually
User → Test Developer
User → Task Implementer (task 1)
User → Task Implementer (task 2)
... (repeat 13 times)
User → Run tests manually
User → Start server manually
User → Test API manually
User → Create deployment files manually
```

**Total Commands**: ~25+ manual steps
**Time**: ~75 minutes
**Coordination**: Manual

### With Flow Orchestrator

```
User → Flow Orchestrator: "Set up project"
User → Flow Orchestrator: "Gather requirements and design flow"
User → Flow Orchestrator: "Generate scaffolding"
User → Flow Orchestrator: "Implement with TDD"
User → Flow Orchestrator: "Run integration tests"
User → Flow Orchestrator: "Prepare for deployment"
```

**Total Commands**: 6 orchestrated commands
**Time**: ~45 minutes
**Coordination**: Automatic

**Time Saved**: ~30 minutes (40% faster)
**Complexity Reduced**: 75% fewer manual steps

---

## Advanced Orchestrator Usage

### Single Command for Entire Project

For maximum efficiency, you can use one comprehensive command:

```
Use the flow-orchestrator to create a complete order processing system
from scratch. Set up the project in flows/order-system, gather requirements,
design the flow, generate all code, implement tasks with TDD, run integration
tests, and prepare for production deployment. The system should validate
orders, check inventory, process payments via Stripe, and send confirmation
emails.
```

The Flow Orchestrator will:
1. Execute all phases sequentially
2. Coordinate all necessary agents
3. Handle all file operations
4. Run all validations
5. Provide a complete project ready for deployment

**This is the ultimate "autopilot" mode** - one command, complete project.

### Iterative Development with Orchestrator

For iterative development:

```
Use the flow-orchestrator to add a refund processing flow to the existing
order-system project. It should integrate with the existing order-processing
flow and share the same connections.
```

The Orchestrator will:
1. Analyze existing project structure
2. Create new flow directory
3. Design refund flow
4. Integrate with existing flows
5. Update project.yaml
6. Generate code
7. Create tests
8. Verify integration

---

## Best Practices with Flow Orchestrator

### 1. Start with High-Level Commands

**Good**:
```
Use the flow-orchestrator to create an order processing system with
payment integration and inventory management.
```

**Too Specific** (limits Orchestrator's coordination):
```
Create a ValidateOrder task that checks if order_id is not empty.
```

### 2. Let the Orchestrator Coordinate Agents

The Orchestrator knows when to invoke:
- Business Analyst (requirements)
- Business Process Designer (flow design)
- YAML Flow Expert (validation)
- Test Developer (tests)
- Task Implementer (implementation)

**Don't** invoke specialized agents directly unless you need specific expertise.

### 3. Provide Context About Integrations

**Good**:
```
Use the flow-orchestrator to build an order system that integrates with:
- PostgreSQL for inventory
- Stripe for payments
- SendGrid for emails
```

This helps the Orchestrator:
- Configure correct connections
- Generate proper task implementations
- Set up environment variables
- Create deployment configs

### 4. Use Orchestrator for Phase Transitions

Invoke the Orchestrator when moving between phases:
- ✅ Setup → Requirements
- ✅ Requirements → Design
- ✅ Design → Implementation
- ✅ Implementation → Testing
- ✅ Testing → Deployment

### 5. Trust the Orchestrator's Judgment

The Orchestrator applies FlowLang best practices automatically:
- Proper directory structure
- Correct file locations
- Smart defaults
- Production-ready configurations

---

## Troubleshooting with Orchestrator

### Issue: Project Structure Wrong

**Instead of manually fixing**, ask the Orchestrator:

```
Use the flow-orchestrator to verify and fix the project structure
for order-system. Ensure all files are in the correct locations.
```

### Issue: Tests Failing

**Instead of debugging alone**, ask the Orchestrator:

```
Use the flow-orchestrator to diagnose why tests are failing for the
CheckInventory task and fix any issues.
```

### Issue: Deployment Problems

**Instead of manual debugging**, ask the Orchestrator:

```
Use the flow-orchestrator to troubleshoot the Docker deployment.
The container is failing health checks.
```

---

## Next Steps

### Enhance Your Flow

Work with the Orchestrator to:

```
Use the flow-orchestrator to add these features to order-system:
1. Order cancellation flow with refund processing
2. Inventory replenishment alerts
3. Customer notification preferences
4. Order history API
```

### Learn Advanced Patterns

```
Use the flow-orchestrator to show me advanced patterns for:
- Multi-flow coordination
- Shared task libraries
- Connection pooling optimization
- Error recovery strategies
```

### Deploy to Production

```
Use the flow-orchestrator to deploy order-system to:
- AWS ECS with load balancing
- Include monitoring with CloudWatch
- Set up auto-scaling policies
```

---

## Conclusion

You've built a complete order processing system using the **Flow Orchestrator agent** as your project manager! You learned:

✅ **Single entry point** - One agent coordinates everything
✅ **Automated coordination** - Orchestrator calls other agents as needed
✅ **Faster development** - 40% time savings vs manual coordination
✅ **Best practices built-in** - Orchestrator applies FlowLang conventions
✅ **End-to-end management** - From setup to deployment

**Key Takeaways**:

1. **Use the Orchestrator for coordination** - Let it manage other agents
2. **Provide high-level commands** - Describe what you want, not how
3. **Trust the automation** - Orchestrator applies best practices
4. **Iterate efficiently** - Orchestrator handles phase transitions smoothly
5. **Deploy confidently** - Production configs generated automatically

## Quick Reference: Flow Orchestrator Commands

| Need | Orchestrator Command |
|------|---------------------|
| New project | "Use the flow-orchestrator to create a new project called [name]" |
| Requirements & design | "Use the flow-orchestrator to gather requirements and design flow for [system]" |
| Code generation | "Use the flow-orchestrator to generate scaffolding for [flow]" |
| Implementation | "Use the flow-orchestrator to implement tasks with TDD for [flow]" |
| Testing | "Use the flow-orchestrator to run integration tests for [flow]" |
| Deployment | "Use the flow-orchestrator to prepare [flow] for production deployment" |
| Troubleshooting | "Use the flow-orchestrator to diagnose and fix [issue]" |
| Feature addition | "Use the flow-orchestrator to add [feature] to [project]" |

**Pro Tip**: For complex projects, use one comprehensive command and let the Orchestrator handle everything from start to finish!

Now go build amazing workflows with orchestrated guidance! 🚀
