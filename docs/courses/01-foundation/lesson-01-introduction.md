# Lesson 1: Introduction to LocalServe

**Duration**: 30 minutes

## Welcome!

Welcome to the LocalServe course series! Over the next 9 courses, you'll build a complete service marketplace platform - a real business powered entirely by FlowLang.

Think TaskRabbit, Thumbtack, or Uber for local services. Customers post jobs (house cleaning, plumbing, tutoring), service providers bid on them, and the platform coordinates everything: booking, payments, reviews, and more.

## What is LocalServe?

**LocalServe** is a two-sided marketplace platform that connects:
- **Customers**: People who need services (homeowners, renters, businesses)
- **Service Providers**: Professionals offering services (cleaners, plumbers, tutors, handymen)

### The Business Model

LocalServe makes money by:
1. Taking a **platform fee** (10-20% of each transaction)
2. Optional **premium provider subscriptions** (better visibility, more leads)
3. Optional **value-added services** (insurance, background checks, professional photography)

### Why Build This?

This project teaches you:
- How to build a complete, revenue-generating business
- Real-world workflow orchestration patterns
- Two-sided marketplace dynamics
- Production-ready code you can actually deploy

By the end of the 9-course series, you'll have a **portfolio-worthy project** and deep understanding of workflow orchestration.

## LocalServe Architecture

### The Complete System (All 9 Courses)

```
┌─────────────────────────────────────────────────────────────┐
│                      LocalServe Platform                     │
└─────────────────────────────────────────────────────────────┘

Course 1: Foundation
┌──────────────────────────────────────────────┐
│  User & Provider Management                  │
│  - User registration                         │
│  - Provider applications                     │
│  - Profile management                        │
└──────────────────────────────────────────────┘

Course 2: Job Posting & Discovery
┌──────────────────────────────────────────────┐
│  Job Marketplace                             │
│  - Job posting                               │
│  - Search & filtering                        │
│  - Provider matching                         │
└──────────────────────────────────────────────┘

Course 3: Booking & Scheduling
┌──────────────────────────────────────────────┐
│  Appointment System                          │
│  - Provider accepts job                      │
│  - Scheduling & calendar                     │
│  - Reminders & notifications                 │
└──────────────────────────────────────────────┘

Course 4: Payment & Escrow
┌──────────────────────────────────────────────┐
│  Financial System                            │
│  - Payment capture                           │
│  - Escrow (hold until job complete)         │
│  - Platform fee calculation                  │
└──────────────────────────────────────────────┘

Course 5: Job Execution
┌──────────────────────────────────────────────┐
│  Job Lifecycle                               │
│  - Check-in / check-out                      │
│  - Real-time status updates                  │
│  - Customer notifications                    │
└──────────────────────────────────────────────┘

Course 6: Review & Reputation
┌──────────────────────────────────────────────┐
│  Trust System                                │
│  - Post-job reviews                          │
│  - Rating aggregation                        │
│  - Provider rankings                         │
└──────────────────────────────────────────────┘

Course 7: Provider Payouts
┌──────────────────────────────────────────────┐
│  Disbursement System                         │
│  - Batch payout processing                   │
│  - Tax document generation                   │
│  - Payment method management                 │
└──────────────────────────────────────────────┘

Course 8: Trust & Safety
┌──────────────────────────────────────────────┐
│  Safety & Compliance                         │
│  - Background checks                         │
│  - Fraud detection                           │
│  - Dispute resolution                        │
└──────────────────────────────────────────────┘

Course 9: Complete Integration
┌──────────────────────────────────────────────┐
│  Full Platform Orchestration                 │
│  - End-to-end workflows                      │
│  - Performance optimization                  │
│  - Production deployment                     │
└──────────────────────────────────────────────┘
```

### Course 1 Focus: The Foundation

In this course, we're building the **user and provider management system**. This is the foundation everything else builds on.

#### What We'll Build

```
┌─────────────────────────────────────────────────────────────┐
│                    User Management Flows                     │
└─────────────────────────────────────────────────────────────┘

1. User Registration Flow
   Input: email, password, name
   ↓
   Validate input → Hash password → Create user record
   ↓
   Send verification email → Return user ID

2. Email Verification Flow
   Input: user_id, verification_token
   ↓
   Validate token → Mark email verified → Return success

3. Provider Application Flow
   Input: user_id, services, certifications, documents
   ↓
   Validate application → Upload documents → Create application
   ↓
   Notify admins → Return application_id

4. Provider Approval Flow (Admin)
   Input: application_id, decision (approve/reject), notes
   ↓
   Load application → Check decision
   ├─ If approved: Create provider profile → Send welcome email
   └─ If rejected: Update status → Send rejection email

5. Profile Management Flows
   - Get profile (user or provider)
   - Update profile
   - List providers (search/filter)
```

#### Database Schema

```sql
-- Users table (customers and providers are both users)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Provider profiles (approved providers only)
CREATE TABLE providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) UNIQUE,
    business_name VARCHAR(255),
    bio TEXT,
    services JSONB,  -- ["cleaning", "plumbing", "electrical"]
    hourly_rate DECIMAL(10, 2),
    service_area JSONB,  -- {"city": "San Francisco", "radius_miles": 25}
    rating DECIMAL(3, 2) DEFAULT 0.0,
    total_jobs INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',  -- active, inactive, suspended
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Provider applications (pending review)
CREATE TABLE provider_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    services JSONB,
    certifications JSONB,
    document_urls JSONB,  -- uploaded documents
    status VARCHAR(50) DEFAULT 'pending',  -- pending, approved, rejected
    admin_notes TEXT,
    reviewed_at TIMESTAMP,
    reviewed_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

## What is FlowLang?

Before we dive into code, let's understand FlowLang's core concepts.

### The Core Idea

**FlowLang** lets you describe workflows in YAML and automatically generate the scaffolding code. You focus on **what should happen** (the flow), not **how to orchestrate it** (the plumbing).

### Key Concepts

#### 1. Flow
A **flow** is a complete workflow - a sequence of steps that accomplish a goal.

```yaml
flow: UserRegistration
description: Register a new user account

inputs:
  - name: email
    type: string
    required: true
  - name: password
    type: string
    required: true
  - name: full_name
    type: string
    required: true

steps:
  # Steps go here

outputs:
  - name: user_id
    value: ${create_user.user_id}
  - name: success
    value: true
```

#### 2. Task
A **task** is a unit of work - a Python function that does one thing.

```python
from flowlang import TaskRegistry

registry = TaskRegistry()

@registry.register('ValidateEmail')
async def validate_email(email: str):
    """Validate email format"""
    if '@' not in email or '.' not in email.split('@')[1]:
        raise ValueError("Invalid email format")
    return {'valid': True}
```

#### 3. Step
A **step** is a task invocation in a flow - it calls a task with specific inputs.

```yaml
steps:
  - task: ValidateEmail
    id: validate
    inputs:
      email: ${inputs.email}
    outputs:
      - valid
```

#### 4. Context
The **context** is the runtime state - all inputs and outputs available during execution.

```yaml
# Available in context:
${inputs.email}          # Flow inputs
${validate.valid}        # Output from 'validate' step
${create_user.user_id}   # Output from 'create_user' step
```

#### 5. Subflow
A **subflow** is a reusable flow that can be called from other flows.

```yaml
steps:
  - subflow: SendEmail
    id: send_welcome
    inputs:
      to: ${inputs.email}
      template: "welcome"
```

### FlowLang's Workflow

```
1. Design Flow (YAML)
   ↓
2. Generate Scaffolding
   ↓
3. Implement Tasks (Python)
   ↓
4. Test
   ↓
5. Deploy as REST API
```

## Setting Up Your Environment

### 1. Install FlowLang

```bash
pip install flowlang
```

### 2. Verify Installation

```bash
flowlang version
flowlang doctor
```

### 3. Set Up PostgreSQL

**Option A: Using Docker**
```bash
docker run --name localserve-db \
  -e POSTGRES_PASSWORD=localserve_dev \
  -e POSTGRES_DB=localserve \
  -p 5432:5432 \
  -d postgres:15
```

**Option B: Local PostgreSQL**
```bash
createdb localserve
```

### 4. Set Environment Variables

Create a `.env` file:
```bash
DATABASE_URL=postgresql://postgres:localserve_dev@localhost:5432/localserve
SECRET_KEY=your-secret-key-change-in-production
```

### 5. Create Database Schema

We'll provide the SQL schema file in the project. For now, just verify PostgreSQL is running:

```bash
psql -h localhost -U postgres -d localserve -c "SELECT version();"
```

## Your First FlowLang Flow

Let's create a simple "Hello World" flow to get familiar with FlowLang.

### Step 1: Create Project Directory

```bash
mkdir hello-localserve
cd hello-localserve
```

### Step 2: Create flow.yaml

```yaml
flow: HelloLocalServe
description: A simple greeting flow

inputs:
  - name: user_name
    type: string
    required: true

steps:
  - task: GenerateGreeting
    id: greet
    inputs:
      name: ${inputs.user_name}
    outputs:
      - message

outputs:
  - name: greeting
    value: ${greet.message}
```

### Step 3: Generate Scaffolding

```bash
flowlang init .
```

This creates:
- `flow.py` - Task implementations (stubs)
- `api.py` - REST API server
- `tests/` - Test files
- `tools/` - Helper scripts

### Step 4: Implement the Task

Edit `flow.py`:

```python
from flowlang import TaskRegistry

def create_task_registry():
    registry = TaskRegistry()

    @registry.register('GenerateGreeting', description='Generate a greeting message')
    async def generate_greeting(name: str):
        """Generate a personalized greeting"""
        return {
            'message': f'Hello {name}! Welcome to LocalServe!'
        }

    return registry
```

### Step 5: Test It

```bash
# Run via API server
python -m flowlang.server --project . --port 8000

# In another terminal, test it:
curl -X POST http://localhost:8000/flows/HelloLocalServe/execute \
  -H "Content-Type: application/json" \
  -d '{"inputs": {"user_name": "Alice"}}'
```

Expected response:
```json
{
  "success": true,
  "outputs": {
    "greeting": "Hello Alice! Welcome to LocalServe!"
  }
}
```

Congratulations! You just created and ran your first FlowLang flow.

## Understanding the Flow Lifecycle

When you execute a flow, here's what happens:

```
1. HTTP Request
   POST /flows/HelloLocalServe/execute
   Body: {"inputs": {"user_name": "Alice"}}
   ↓
2. FlowLang Server receives request
   ↓
3. Validate inputs against flow definition
   ↓
4. Create FlowContext
   context.inputs = {"user_name": "Alice"}
   ↓
5. Execute steps sequentially
   Step 1: Call GenerateGreeting task
     Input: name = "Alice"
     Output: message = "Hello Alice! Welcome to LocalServe!"
   ↓
6. Resolve output expressions
   greeting = ${greet.message} = "Hello Alice! Welcome to LocalServe!"
   ↓
7. Return response
   {"success": true, "outputs": {"greeting": "..."}}
```

## Key Takeaways

1. **FlowLang separates WHAT from HOW**
   - YAML defines WHAT should happen
   - Python implements HOW it happens

2. **Design-first approach**
   - Design flows before writing code
   - Generate scaffolding automatically
   - Implement incrementally

3. **Everything is a task**
   - Validation is a task
   - Database query is a task
   - Sending email is a task
   - Keep tasks focused and testable

4. **Flows are composable**
   - Small flows combine to create large systems
   - Reusable subflows reduce duplication
   - Clear dependencies and data flow

5. **Built for REST APIs**
   - Every flow is automatically a REST endpoint
   - Input validation built-in
   - OpenAPI docs generated automatically

## Next Steps

Now that you understand the basics, let's build the real user registration system!

**Continue to**: [Lesson 2: User Registration Flow](./lesson-02-user-registration.md)

---

## Quick Reference

### Flow YAML Structure
```yaml
flow: FlowName
description: What this flow does
inputs:
  - name: input_name
    type: string
    required: true
steps:
  - task: TaskName
    id: step_id
    inputs:
      param: ${inputs.input_name}
    outputs:
      - output_name
outputs:
  - name: result
    value: ${step_id.output_name}
```

### Task Implementation
```python
@registry.register('TaskName', description='What it does')
async def task_name(param: str):
    # Implementation
    return {'output_name': 'value'}
```

### Variable References
```yaml
${inputs.field}           # Flow input
${step_id.output}         # Step output
${step.output.nested}     # Nested field access
```

### CLI Commands
```bash
flowlang init .                    # Initialize project
flowlang doctor                    # Check environment
python -m flowlang.server --project . --port 8000  # Start server
```
