# FlowLang End-to-End Tutorial: Using the /orchestrate Command

This tutorial demonstrates building a complete FlowLang project using the **`/orchestrate` slash command**. This command provides a guided, phase-by-phase workflow that coordinates specialized agents to take you from initial idea to production-ready flow.

## What You'll Learn

- **How to use the `/orchestrate` command** for streamlined project development
- **Phase-by-phase workflow** with clear progress tracking
- **When to use interactive vs direct mode**
- **How the orchestrator coordinates specialized agents**
- **Best practices** for agent-driven development

## Why Use /orchestrate?

The `/orchestrate` command provides:

✅ **Structured Workflow**: Guided phases from requirements to deployment
✅ **Clear Progress Tracking**: Visual status indicators (✅ complete, 🔄 in progress, ⏸️ waiting)
✅ **Agent Coordination**: Automatically invokes specialized agents at the right time
✅ **User Control**: You decide when to proceed to the next phase
✅ **Best Practices Built-In**: Applies FlowLang conventions automatically

## Prerequisites

- Python 3.8+ installed
- FlowLang installed (`pip install -e .` from repository root)
- Claude Code CLI or Claude.ai access
- Basic understanding of YAML and Python

## Command Syntax

The `/orchestrate` command has two modes:

### Interactive Mode (Recommended)

```
/orchestrate
```

This will prompt you for:
1. Project name
2. Flow name
3. Description

**Best for**: First-time users or when you're still defining requirements

### Direct Mode

```
/orchestrate <project-name> <flow-name> <description>
```

Example:
```
/orchestrate order-system order-processing "Process customer orders with payment and inventory"
```

**Best for**: Experienced users who know exactly what they want to build

## Tutorial Overview

We'll build an **order processing system** using the `/orchestrate` command:
- Validate order data (items, quantities, customer info)
- Check inventory availability
- Process payment via payment gateway
- Update inventory after purchase
- Send confirmation email
- Handle errors with retry logic

**Estimated Time**: 30-45 minutes with `/orchestrate` guidance

---

## Phase 0: Project Initialization

### Step 1: Run /orchestrate Command

In Claude Code, run:

```
/orchestrate order-system order-processing "Process customer orders with validation, inventory checks, and payment"
```

### What Happens

The orchestrator:
1. **Checks** if project exists in `flows/order-system/`
2. **Creates project** if needed with `flowlang project init`
3. **Shows Phase 0 status**:
   ```
   📍 Phase 0: Project Initialization
   Status: ✅ complete

   Project created: flows/order-system/project.yaml

   📍 Phase 1: Requirements Gathering
   Status: ⏸️ waiting

   Type 'continue' to proceed to Phase 1.
   ```

### Output

```
flows/order-system/
└── project.yaml
```

**Key Point**: The orchestrator waits for you to type `continue` before proceeding. This gives you control over the pace.

---

## Phase 1: Requirements Gathering

### Step 1: Type 'continue'

When you're ready:

```
continue
```

### What Happens

The orchestrator:
1. **Displays**: "🔄 Phase 1: Requirements Gathering - Invoking business-analyst agent"
2. **Invokes** the business-analyst agent with your project details
3. **Shows questions** from the business-analyst one at a time
4. **Waits for your answers**
5. **Creates** `REQUIREMENTS.md` in the flow directory

### Sample Interaction

```
📍 Phase 1: Requirements Gathering
Status: 🔄 in progress

Invoking business-analyst agent...

[Business Analyst Agent]
I need to understand your order processing requirements:

Q1: What information should an order include?
```

You respond:
```
Orders should include: customer_id, items (with product_id and quantity),
payment_method, and shipping_address.
```

The orchestrator continues asking questions until it has enough information to create comprehensive requirements.

### Output

```
flows/order-system/order-processing/
└── REQUIREMENTS.md
```

**REQUIREMENTS.md** (example):
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

## Process Steps
1. Validate order data
2. Check inventory for all items
3. Calculate total price
4. Process payment
5. Update inventory
6. Send confirmation email
7. Log order completion

## Success Criteria
- Orders processed in < 5 seconds
- Payment success rate > 99%
- Zero inventory discrepancies
```

### Next Phase

After requirements are complete:
```
✅ Phase 1 Complete: REQUIREMENTS.md created

📍 Phase 2: Flow Design
Status: ⏸️ waiting

Type 'continue' to proceed to Phase 2.
```

---

## Phase 2: Flow Design

### Step 1: Type 'continue'

```
continue
```

### What Happens

The orchestrator:
1. **Invokes** business-process-designer agent to create `flow.yaml`
2. **Invokes** yaml-flow-expert agent to validate and optimize
3. **Shows** the designed flow structure
4. **Creates** finalized `flow.yaml`

### Sample Output

```
📍 Phase 2: Flow Design
Status: 🔄 in progress

Invoking business-process-designer agent...

[Business Process Designer Agent]
Designing flow based on requirements...

Creating flow with:
- 7 main tasks
- Error handling for payment failures
- Conditional logic for inventory checks
- Parallel execution where possible

Invoking yaml-flow-expert agent for validation...

[YAML Flow Expert Agent]
Validating flow.yaml...
✅ All steps valid
✅ Variable references correct
✅ No circular dependencies
✅ Error handlers properly configured

✅ Phase 2 Complete: flow.yaml validated and finalized
```

### Output

```
flows/order-system/order-processing/
├── REQUIREMENTS.md
└── flow.yaml              # ← Flow definition
```

**flow.yaml** (simplified example):
```yaml
flow: OrderProcessing
description: Process customer orders with validation and payment

inputs:
  - name: order_id
    type: string
  - name: customer_id
    type: string
  - name: items
    type: array
  - name: payment_method
    type: string

steps:
  - task: ValidateOrderData
    id: validate
    inputs:
      order_id: ${inputs.order_id}
      customer_id: ${inputs.customer_id}
      items: ${inputs.items}
    outputs:
      - is_valid
      - validation_errors

  # ... more steps ...

outputs:
  - name: order_id
    value: ${inputs.order_id}
  - name: status
    value: ${process_payment.status}
```

---

## Phase 3: Scaffolding

### Step 1: Type 'continue'

```
continue
```

### What Happens

The orchestrator:
1. **Runs** the FlowLang scaffolder on `flow.yaml`
2. **Generates** complete project structure
3. **Verifies** all files created successfully
4. **Shows** implementation status (e.g., "0/7 tasks implemented")

### Sample Output

```
📍 Phase 3: Scaffolding
Status: 🔄 in progress

Generating project structure from flow.yaml...

Running: python -m flowlang.scaffolder auto flows/order-system/order-processing/flow.yaml

✅ Generated files:
  - flow.py (7 task stubs)
  - api.py (FastAPI server)
  - tests/test_tasks.py (test stubs)
  - tools/start_server.sh
  - tools/generate.sh
  - README.md

Implementation Status: 0/7 tasks implemented (0%)

✅ Phase 3 Complete: Project structure ready
```

### Output

```
flows/order-system/order-processing/
├── flow.yaml
├── flow.py                  # ← Task stubs
├── api.py                   # ← FastAPI server
├── README.md                # ← Basic documentation
├── tests/
│   └── test_tasks.py        # ← Test stubs
└── tools/
    ├── start_server.sh      # ← Server launcher
    └── generate.sh          # ← Update helper
```

---

## Phase 3.5: Documentation Generation

### Step 1: Type 'continue'

```
continue
```

### What Happens

The orchestrator:
1. **Invokes** business-process-designer agent in documentation mode
2. **Reads** all scaffolded files
3. **Generates** comprehensive documentation
4. **Creates** multiple doc files referencing actual code

### Sample Output

```
📍 Phase 3.5: Documentation Generation
Status: 🔄 in progress

Creating comprehensive project documentation...

[Business Process Designer Agent]
Reading scaffolded files...
- flow.yaml ✓
- flow.py ✓
- api.py ✓
- tests/test_tasks.py ✓

Generating documentation suite...
✅ README.md (comprehensive version)
✅ IMPLEMENTATION_GUIDE.md
✅ FLOW_DIAGRAM.md
✅ SUMMARY.md
✅ INDEX.md

✅ Phase 3.5 Complete: Documentation generated
```

### Output

```
flows/order-system/order-processing/
├── flow.yaml
├── flow.py
├── api.py
├── README.md                    # ← Comprehensive
├── IMPLEMENTATION_GUIDE.md      # ← Developer guide
├── FLOW_DIAGRAM.md              # ← Visual diagrams
├── SUMMARY.md                   # ← Executive overview
├── INDEX.md                     # ← Navigation
├── tests/
│   └── test_tasks.py
└── tools/
    ├── start_server.sh
    └── generate.sh
```

---

## Phase 4: Task Implementation

### Step 1: Type 'continue'

```
continue
```

### What Happens

The orchestrator:
1. **Invokes** task-implementer agent to implement all tasks
2. **Shows** progress as each task is implemented
3. **Invokes** test-developer agent to write comprehensive tests
4. **Verifies** all implementations complete

### Sample Output

```
📍 Phase 4: Task Implementation
Status: 🔄 in progress

Invoking task-implementer agent...

[Task Implementer Agent]
Implementing tasks...

✅ ValidateOrderData (1/7)
✅ CheckInventory (2/7)
✅ CalculateTotal (3/7)
✅ ProcessPayment (4/7)
✅ UpdateInventory (5/7)
✅ SendConfirmationEmail (6/7)
✅ LogOrderComplete (7/7)

Implementation Status: 7/7 tasks implemented (100%)

Invoking test-developer agent...

[Test Developer Agent]
Writing comprehensive tests...
✅ 15 test cases created
✅ Mock data prepared
✅ Error scenarios covered

✅ Phase 4 Complete: All tasks implemented and tested
```

---

## Phase 5: Integration & Testing

### Step 1: Type 'continue'

```
continue
```

### What Happens

The orchestrator:
1. **Runs** the test suite
2. **Reports** test results
3. **Identifies** any failures
4. **Verifies** flow is working

### Sample Output

```
📍 Phase 5: Integration & Testing
Status: 🔄 in progress

Running test suite...

pytest tests/ -v

===== test session starts =====
collected 15 items

tests/test_tasks.py::test_validate_order_data_valid PASSED
tests/test_tasks.py::test_validate_order_data_invalid PASSED
tests/test_tasks.py::test_check_inventory_available PASSED
tests/test_tasks.py::test_check_inventory_insufficient PASSED
... (11 more tests)

===== 15 passed in 2.3s =====

✅ All tests passing

✅ Phase 5 Complete: Flow verified and working
```

---

## Phase 6: Deployment

### Step 1: Type 'continue'

```
continue
```

### What Happens

The orchestrator:
1. **Shows** how to start the server
2. **Provides** API testing commands
3. **Guides** production deployment

### Sample Output

```
📍 Phase 6: Deployment
Status: 🔄 in progress

Your flow is ready for deployment!

To start the server:
  cd flows/order-system/order-processing
  ./tools/start_server.sh --reload

To test the API:
  curl http://localhost:8000/docs

To execute the flow:
  curl -X POST http://localhost:8000/flows/OrderProcessing/execute \
    -H "Content-Type: application/json" \
    -d '{
      "inputs": {
        "order_id": "ORD-001",
        "customer_id": "CUST-123",
        "items": [{"product_id": "PROD-1", "quantity": 2}],
        "payment_method": "credit_card"
      }
    }'

✅ Phase 6 Complete: Ready for production
```

---

## Complete Workflow Summary

Here's what the full `/orchestrate` session looks like:

```
User: /orchestrate order-system order-processing "Process customer orders"

Claude:
📍 Phase 0: Project Initialization
Status: ✅ complete
Type 'continue' to proceed to Phase 1.

User: continue

Claude:
📍 Phase 1: Requirements Gathering
Status: 🔄 in progress
[Business Analyst asks questions...]
✅ Phase 1 Complete
Type 'continue' to proceed to Phase 2.

User: continue

Claude:
📍 Phase 2: Flow Design
Status: 🔄 in progress
[Business Process Designer creates flow.yaml...]
[YAML Flow Expert validates...]
✅ Phase 2 Complete
Type 'continue' to proceed to Phase 3.

User: continue

Claude:
📍 Phase 3: Scaffolding
Status: 🔄 in progress
[Scaffolder generates project structure...]
✅ Phase 3 Complete
Type 'continue' to proceed to Phase 3.5.

User: continue

Claude:
📍 Phase 3.5: Documentation Generation
Status: 🔄 in progress
[Business Process Designer creates docs...]
✅ Phase 3.5 Complete
Type 'continue' to proceed to Phase 4.

User: continue

Claude:
📍 Phase 4: Task Implementation
Status: 🔄 in progress
[Task Implementer implements all tasks...]
[Test Developer creates tests...]
✅ Phase 4 Complete
Type 'continue' to proceed to Phase 5.

User: continue

Claude:
📍 Phase 5: Integration & Testing
Status: 🔄 in progress
[Runs pytest...]
✅ All tests passing
✅ Phase 5 Complete
Type 'continue' to proceed to Phase 6.

User: continue

Claude:
📍 Phase 6: Deployment
Status: 🔄 in progress
[Shows deployment commands...]
✅ Phase 6 Complete: Ready for production

🎉 Project Complete!
```

---

## Understanding the Orchestrator Phases

### Phase 0: Project Initialization
**What it does**: Sets up the project directory and `project.yaml`
**Agent**: None (orchestrator uses Bash tool)
**Output**: `project.yaml`

### Phase 1: Requirements Gathering
**What it does**: Gathers business requirements through questions
**Agent**: business-analyst
**Output**: `REQUIREMENTS.md`

### Phase 2: Flow Design
**What it does**: Designs flow.yaml and validates it
**Agents**: business-process-designer, yaml-flow-expert
**Output**: `flow.yaml`

### Phase 3: Scaffolding
**What it does**: Generates complete project structure
**Agent**: None (orchestrator uses Bash tool)
**Output**: `flow.py`, `api.py`, `tests/`, `tools/`, `README.md`

### Phase 3.5: Documentation Generation
**What it does**: Creates comprehensive documentation
**Agent**: business-process-designer (Mode 2)
**Output**: `README.md`, `IMPLEMENTATION_GUIDE.md`, `FLOW_DIAGRAM.md`, `SUMMARY.md`, `INDEX.md`

### Phase 4: Task Implementation
**What it does**: Implements all tasks and creates tests
**Agents**: task-implementer, test-developer
**Output**: Fully implemented `flow.py`, comprehensive `tests/test_tasks.py`

### Phase 5: Integration & Testing
**What it does**: Runs tests and verifies everything works
**Agent**: None (orchestrator uses Bash tool)
**Output**: Test results

### Phase 6: Deployment
**What it does**: Guides production deployment
**Agent**: None (orchestrator provides guidance)
**Output**: Deployment instructions

---

## Best Practices

### 1. Use Interactive Mode for New Projects

When building something new, use:
```
/orchestrate
```

This lets you think through requirements as you answer the business-analyst's questions.

### 2. Use Direct Mode When Requirements Are Clear

When you know exactly what you want:
```
/orchestrate my-project my-flow "Clear description of what the flow should do"
```

### 3. Let Each Phase Complete

Don't rush through phases. The orchestrator structures the workflow for a reason:
- **Requirements** informs **Design**
- **Design** informs **Scaffolding**
- **Scaffolding** informs **Implementation**
- **Implementation** enables **Testing**

### 4. Review Outputs Between Phases

After each phase completes, review what was created:
- Check `REQUIREMENTS.md` matches your needs
- Verify `flow.yaml` has the right steps
- Review generated code structure

### 5. Trust the Agent Coordination

The orchestrator knows when to invoke:
- **business-analyst**: For requirements
- **business-process-designer**: For flow design and documentation
- **yaml-flow-expert**: For validation
- **task-implementer**: For code
- **test-developer**: For tests

You don't need to manually invoke these agents.

---

## Comparison: /orchestrate vs Manual Workflow

### Manual Workflow (Without /orchestrate)

```
1. User creates project manually
2. User invokes business-analyst
3. User saves REQUIREMENTS.md
4. User invokes business-process-designer
5. User creates flow directory
6. User saves flow.yaml
7. User invokes yaml-flow-expert
8. User runs scaffolder
9. User invokes task-implementer
10. User invokes test-developer
11. User runs tests
12. User starts server
```

**Total steps**: 12+ manual actions
**Coordination**: User manages everything
**Time**: ~60-90 minutes

### With /orchestrate

```
1. User runs: /orchestrate project-name flow-name "description"
2. User types: continue (6 times)
```

**Total steps**: 7 simple commands
**Coordination**: Automatic
**Time**: ~30-45 minutes

**Time saved**: 40-50%
**Complexity reduced**: 80% fewer manual steps

---

## Advanced Usage

### Resume After Interruption

If your session is interrupted, you can resume by checking which phase was last completed and continuing from there. The orchestrator tracks progress through the files it creates.

### Skip Phases (Advanced)

If you already have certain files (e.g., `REQUIREMENTS.md`), the orchestrator will detect them and skip or adjust phases accordingly.

### Multiple Flows in One Project

To add a second flow to an existing project:

```
/orchestrate order-system refund-processing "Handle order refunds and inventory restoration"
```

The orchestrator will:
- Detect existing project
- Skip Phase 0
- Create new flow directory: `order-system/refund-processing/`
- Go through phases 1-6 for the new flow

---

## Troubleshooting

### Issue: Orchestrator Doesn't Respond to 'continue'

**Solution**: Make sure you type exactly `continue` (lowercase, no extra text)

### Issue: Requirements Phase Asks Too Many Questions

**Solution**: Provide more detail in your initial description:
```
/orchestrate order-system order-processing "Process orders with: customer validation, inventory checks from PostgreSQL, payment via Stripe API, confirmation emails via SendGrid"
```

### Issue: Flow Design Doesn't Match My Needs

**Solution**: After Phase 2 completes, you can manually edit `flow.yaml` before typing `continue` for Phase 3

### Issue: Tests Failing in Phase 5

**Solution**: Review test output, fix issues in `flow.py`, then ask the orchestrator to re-run Phase 5

---

## Next Steps

After completing this tutorial, you can:

### Enhance Your Flow

```
/orchestrate order-system inventory-alerts "Monitor inventory levels and send low-stock alerts"
```

### Learn More About Agents

See `.claude/agents/` directory for detailed agent descriptions:
- `business-analyst.md`
- `business-process-designer.md`
- `task-implementer.md`
- `test-developer.md`
- `yaml-flow-expert.md`
- `flow-orchestrator.md`

### Customize the Orchestrator

The orchestrator behavior is defined in `.claude/commands/orchestrate.md`. You can customize:
- Phase structure
- Agent prompts
- Progress indicators
- Output formats

### Deploy to Production

Follow the deployment guidance from Phase 6 to get your flow running in production with Docker, Kubernetes, or your preferred platform.

---

## Conclusion

You've learned how to use the **`/orchestrate` command** to build complete FlowLang projects with guided, phase-by-phase coordination. Key takeaways:

✅ **Simple command** - Just `/orchestrate` to start
✅ **Clear phases** - Each phase has a specific purpose
✅ **User control** - You decide when to proceed
✅ **Agent coordination** - Specialized agents invoked automatically
✅ **Best practices** - FlowLang conventions applied throughout
✅ **Faster development** - 40-50% time savings

## Quick Reference

| Mode | Command | Best For |
|------|---------|----------|
| Interactive | `/orchestrate` | New projects, exploring ideas |
| Direct | `/orchestrate <project> <flow> "description"` | Clear requirements, fast iteration |

| Phase | Purpose | Output |
|-------|---------|--------|
| 0 | Project setup | `project.yaml` |
| 1 | Requirements | `REQUIREMENTS.md` |
| 2 | Flow design | `flow.yaml` |
| 3 | Scaffolding | `flow.py`, `api.py`, `tests/`, `tools/` |
| 3.5 | Documentation | `README.md`, guides, diagrams |
| 4 | Implementation | Implemented tasks + tests |
| 5 | Testing | Test results |
| 6 | Deployment | Deployment guidance |

**Pro Tip**: The more detail you provide in your initial description, the fewer questions the business-analyst will need to ask!

Now go build amazing workflows with orchestrated guidance! 🚀
