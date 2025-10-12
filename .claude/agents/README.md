# FlowLang Expert Agent Suite

A collection of specialized Claude agents to assist with FlowLang workflow development, from business requirements to production deployment.

## Overview

The FlowLang agent suite provides six expert agents, each specializing in a specific aspect of flow development:

1. **Business Analyst** - Gathers requirements and clarifies business needs
2. **Business Process Designer** - Translates requirements into flow.yaml
3. **YAML Flow Expert** - Validates and optimizes flow definitions
4. **Test Developer** - Creates comprehensive test suites
5. **Task Implementer** - Implements task functions in Python
6. **Flow Orchestrator** - Coordinates end-to-end project lifecycle

## Quick Start

### How to Use Agents

When working with Claude Code, you can invoke specific agents by referencing them in your requests:

```
"Use the business-analyst to understand my requirements"

"Use the business-process-designer agent to design a flow for order processing"

"Ask the yaml-flow-expert to validate and optimize my flow.yaml"

"Have the test-developer create tests for all my tasks"

"Use task-implementer to implement the ProcessPayment task"

"Let the flow-orchestrator help me deploy this to production"
```

## Agent Details

### 1. Business Analyst

**File**: `business-analyst.md`

**Purpose**: Gather and clarify business requirements before technical design

**When to Use**:
- User has vague or high-level requirements
- Need to understand business context
- Unclear about process steps or decision logic
- Want to document business rules
- Need to identify stakeholders and integrations

**Example Request**:
```
I want to automate our order processing, but I'm not sure exactly what needs to happen.
Use the business-analyst to help me figure out the requirements.
```

**Deliverables**:
- Complete requirements document
- Business process map
- Stakeholder identification
- Business rules documentation
- Data requirements
- Success criteria
- Ready for technical design

**Key Characteristics**:
- NO technical knowledge (doesn't know FlowLang, YAML, or coding)
- Asks probing questions to clarify requirements
- Documents in business terms, not technical terms
- Output feeds directly to Business Process Designer

---

### 2. Business Process Designer

**File**: `business-process-designer.md`

**Purpose**: Transform business requirements into well-designed flow.yaml definitions

**When to Use**:
- Starting a new workflow project
- Analyzing business processes
- Designing complex orchestration logic
- Choosing appropriate control flow patterns
- Planning error handling and cancellation

**Example Request**:
```
I need to create an order fulfillment workflow that:
- Validates customer and inventory
- Processes payment with retry
- Updates inventory
- Sends notifications in parallel
- Handles cancellation by refunding

Use the business-process-designer to create the flow.yaml
```

**Deliverables**:
- Complete flow.yaml with all steps
- Clear input/output definitions
- Error handling strategy
- Cancellation handlers
- Control flow patterns (parallel, conditionals, loops)

---

### 3. YAML Flow Expert

**File**: `yaml-flow-expert.md`

**Purpose**: Validate, optimize, and refine flow definitions

**When to Use**:
- Validating flow.yaml syntax
- Optimizing for performance (parallelization)
- Refactoring control flow (guard clauses)
- Ensuring best practices
- Generating flow visualizations

**Example Request**:
```
I have this flow.yaml with nested conditionals and sequential steps.
Use the yaml-flow-expert to optimize it for performance and clarity.
```

**Deliverables**:
- Validated flow.yaml (syntax check)
- Performance optimizations
- Control flow improvements
- Best practices applied
- Mermaid visualization diagram

---

### 4. Test Developer

**File**: `test-developer.md`

**Purpose**: Create comprehensive, maintainable test suites

**When to Use**:
- Creating initial test suite
- Adding tests for new tasks
- Mocking database/API connections
- Setting up fixtures and test data
- Testing error scenarios

**Example Request**:
```
Use the test-developer to create comprehensive tests for my
OrderProcessing flow with PostgreSQL and Redis connections.
```

**Deliverables**:
- tests/test_tasks.py with all tests
- Fixtures for test data
- Connection mocks
- Unit tests for all tasks
- Integration test for complete flow
- Parameterized tests for edge cases

---

### 5. Task Implementer

**File**: `task-implementer.md`

**Purpose**: Implement task functions in flow.py

**When to Use**:
- Converting task stubs to working code
- Using connection injection patterns
- Implementing error handling
- Working with database/cache/API connections
- Tracking implementation progress

**Example Request**:
```
I have 10 tasks in my flow.py that are stubs. Use the task-implementer
to implement the ProcessPayment, ValidateOrder, and CalculateTotal tasks.
```

**Deliverables**:
- Implemented task functions (no NotImplementedTaskError)
- Connection injection usage
- Error handling
- Type hints and documentation
- Updated implementation status
- Working tests

---

### 6. Flow Orchestrator

**File**: `flow-orchestrator.md`

**Purpose**: Coordinate end-to-end project lifecycle

**When to Use**:
- Setting up new projects
- Running scaffolder (generate/update)
- Configuring development environment
- Starting servers and watch mode
- Deploying to production
- Troubleshooting issues

**Example Request**:
```
Use the flow-orchestrator to set up a new project, configure hot reload,
and prepare it for production deployment with Docker.
```

**Deliverables**:
- Complete project structure
- Scaffolded files (flow.py, api.py, tests/, tools/)
- Environment configuration (.env)
- Development workflow setup
- Production deployment guide
- Docker configuration

---

## Typical Workflow

### End-to-End Flow Development

```
1. Requirements Gathering
   └─> Business Analyst
       └─> Creates requirements document

2. Flow Design
   └─> Business Process Designer
       └─> Creates flow.yaml from requirements

3. Flow Validation
   └─> YAML Flow Expert
       └─> Validates and optimizes flow.yaml

4. Project Setup
   └─> Flow Orchestrator
       └─> Runs scaffolder, creates project structure

5. Test Creation
   └─> Test Developer
       └─> Creates tests/test_tasks.py

6. Task Implementation
   └─> Task Implementer
       └─> Implements tasks in flow.py
       └─> All tests passing

7. Deployment
   └─> Flow Orchestrator
       └─> Deploys to production
```

## Example Usage Patterns

### Pattern 1: New Project from Scratch

```
User: "I need a workflow to sync data from Airtable to PostgreSQL every hour"

Response: "Let me coordinate this project:

1. Using business-process-designer: I'll design the flow with:
   - Airtable data fetch
   - Data transformation
   - PostgreSQL upsert
   - Error handling

2. Using yaml-flow-expert: I'll validate and optimize the flow

3. Using flow-orchestrator: I'll set up the project and scaffold

4. Using task-implementer: I'll implement the sync logic

5. Using test-developer: I'll create comprehensive tests

Let's start with the design..."
```

### Pattern 2: Optimize Existing Flow

```
User: "My flow.yaml has performance issues and nested conditionals"

Response: "I'll use the yaml-flow-expert to analyze your flow:

1. Identifying parallelization opportunities
2. Refactoring nested conditionals to guard clauses
3. Adding caching where appropriate
4. Optimizing database queries

Here's the optimized version..."
```

### Pattern 3: Complete Implementation

```
User: "I have flow.yaml designed. Help me implement everything."

Response: "I'll coordinate the full implementation:

1. Using flow-orchestrator: Running scaffolder to generate project
2. Using test-developer: Creating test suite
3. Using task-implementer: Implementing all 15 tasks
4. Using flow-orchestrator: Setting up hot reload and deployment

Let's start..."
```

## Agent Coordination

The agents work together seamlessly:

- **Business Analyst** creates requirements document
  → **Business Process Designer** designs flow.yaml from requirements
  → **YAML Flow Expert** validates and optimizes it
  → **Flow Orchestrator** scaffolds the project
  → **Task Implementer** implements tasks
  → **Test Developer** verifies with tests
  → **Flow Orchestrator** deploys to production

Each agent has deep knowledge of FlowLang:
- Flow constructs (parallel, conditional, loops, switch)
- Connection plugins (PostgreSQL, MySQL, MongoDB, Redis, SQLite, Airtable)
- Built-in tasks for zero-boilerplate operations
- Error handling and retry patterns
- Cancellation and cleanup handlers
- Hot reload and watch mode
- Testing patterns and fixtures

## Best Practices

### 1. Use the Right Agent for the Job

- **Requirements gathering** → Business Analyst
- **Design questions** → Business Process Designer
- **YAML issues** → YAML Flow Expert
- **Testing needs** → Test Developer
- **Implementation** → Task Implementer
- **Project setup/deployment** → Flow Orchestrator

### 2. Follow the Workflow

Work sequentially through the phases:
Requirements → Design → Validate → Scaffold → Test → Implement → Deploy

### 3. Iterate with Agents

- Gather requirements with Business Analyst
- Design with Business Process Designer
- Validate with YAML Flow Expert
- Refine based on feedback
- Implement with Task Implementer
- Test with Test Developer

### 4. Let Flow Orchestrator Coordinate

For complex projects, let Flow Orchestrator manage the workflow and call other agents as needed.

## Agent Knowledge Base

All agents have deep knowledge of:

### FlowLang Core
- Flow definition format (flow.yaml)
- Control flow constructs (if/switch/loops/parallel)
- Variable resolution (${inputs.x}, ${step.output})
- Error handling (retry, on_error)
- Cancellation (on_cancel, cleanup handlers)

### Connection Plugins
- **PostgreSQL**: pg_query, pg_execute, pg_transaction
- **MySQL**: mysql_query, mysql_execute, mysql_transaction
- **MongoDB**: mongo_find, mongo_insert, mongo_update, mongo_aggregate
- **Redis**: redis_get, redis_set, redis_incr, redis_hset
- **SQLite**: sqlite_query, sqlite_execute, sqlite_transaction
- **Airtable**: airtable_list, airtable_create, airtable_find, metadata discovery

### Development Tools
- Scaffolder (scaffold, update, auto)
- Watch mode for live testing
- Hot reload for development
- pytest and pytest-asyncio
- FastAPI server
- Client SDKs (Python, TypeScript)

### Patterns & Best Practices
- Guard clause design (avoid nesting)
- Cache-aside pattern
- Upsert patterns
- Parallel post-processing
- Rate limiting
- Connection injection
- Smart merge (preserves implementations)

## Getting Help

### For Requirements Questions
Ask the **Business Analyst**:
- "Help me understand what I need"
- "What questions should I answer before building this?"
- "Document the business rules for this process"

### For Design Questions
Ask the **Business Process Designer**:
- "How should I structure this workflow?"
- "What control flow pattern should I use?"
- "How do I handle this error scenario?"

### For YAML Issues
Ask the **YAML Flow Expert**:
- "Is my flow.yaml valid?"
- "How can I optimize this for performance?"
- "Can you refactor these nested conditionals?"

### For Testing
Ask the **Test Developer**:
- "Create tests for my tasks"
- "How do I mock a PostgreSQL connection?"
- "Add edge case tests"

### For Implementation
Ask the **Task Implementer**:
- "Implement the ProcessPayment task"
- "How do I use connection injection?"
- "Add error handling to this task"

### For Project Management
Ask the **Flow Orchestrator**:
- "Set up a new project"
- "Deploy this to production"
- "Configure hot reload"
- "Troubleshoot this issue"

## File Structure Reference

```
.claude/agents/
├── README.md                      # This file
├── business-analyst.md            # Requirements gathering expert
├── business-process-designer.md   # Flow design expert
├── yaml-flow-expert.md            # YAML validation expert
├── test-developer.md              # Testing expert
├── task-implementer.md            # Implementation expert
└── flow-orchestrator.md           # Project coordination expert
```

## Version

These agents are designed for FlowLang v1.0+ and are kept in sync with the project's capabilities as documented in `/CLAUDE.md`.

## Contributing

When adding new FlowLang features, update the relevant agent files to include:
- New patterns and examples
- Updated best practices
- New connection plugins or built-in tasks
- Changed CLI commands or workflows

---

## Quick Reference Card

| Need | Agent | Command Example |
|------|-------|----------------|
| Gather requirements | Business Analyst | "Help me understand what I need to build" |
| Design flow | Business Process Designer | "Design a flow for order processing" |
| Validate YAML | YAML Flow Expert | "Validate and optimize my flow.yaml" |
| Create tests | Test Developer | "Create tests for all tasks" |
| Implement tasks | Task Implementer | "Implement the ProcessPayment task" |
| Deploy project | Flow Orchestrator | "Set up and deploy to production" |

**Pro Tip**: For complex projects, start with Flow Orchestrator to coordinate the entire process!
