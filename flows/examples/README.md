# FlowLang Examples Project

A collection of example flows demonstrating FlowLang features, patterns, and best practices.

## Overview

This project contains five example flows, each showcasing different FlowLang capabilities:

### 1. Hello World (`hello_world/`)
**Purpose**: Introduction to basic FlowLang concepts

**Features Demonstrated**:
- Simple flow structure with inputs and outputs
- Conditional execution (`if/then/else`)
- Task orchestration
- Variable resolution (`${inputs.x}`, `${step.output}`)

**Use Case**: A simple greeting workflow that validates user input and generates personalized greetings.

**Complexity**: ⭐ Beginner

---

### 2. Exit Example (`exit_example/`)
**Purpose**: Demonstrates early termination patterns

**Features Demonstrated**:
- Early exit with `exit` step
- Guard clauses for cleaner flow control
- Multiple exit points with different outputs
- Validation-based flow routing

**Use Case**: User permission checking that exits early for premium users.

**Complexity**: ⭐⭐ Intermediate

---

### 3. Early Termination Patterns (`early_termination/`)
**Purpose**: Comprehensive guide to termination strategies

**Features Demonstrated**:
- Multiple early exit patterns
- Guard clause design
- Switch-case for multi-way branching
- Complex conditional logic
- Error handling with early termination

**Use Case**: Complex transaction processing with validation, security checks, and multi-stage approval.

**Complexity**: ⭐⭐⭐ Advanced

---

### 4. Loan Approval (`loan_approval/`)
**Purpose**: Real-world business process automation

**Features Demonstrated**:
- Switch-case for multi-way decisions
- Parallel execution (notifications + logging)
- Data aggregation from multiple sources
- Complex business rules
- Error handling and rejection flows

**Use Case**: Automated loan approval system with credit checks, risk assessment, and decision making.

**Complexity**: ⭐⭐⭐ Advanced

---

### 5. Order Fulfillment (`order_fulfillment/`)
**Purpose**: E-commerce workflow orchestration

**Features Demonstrated**:
- Loop-based validation (`for_each`)
- Complex conditional branching
- Parallel processing (notifications + CRM updates)
- Inventory management
- Payment processing
- Multi-step business process

**Use Case**: Complete order fulfillment workflow from validation to confirmation.

**Complexity**: ⭐⭐⭐ Advanced

---

## Getting Started

### Prerequisites

```bash
# Install FlowLang
cd /Users/adam/Projects/FlowLang
pip install -e .

# Or from PyPI
pip install flowlang
```

### Running Individual Flows

Each flow is a complete, scaffolded project with:
- `flow.yaml` - Flow definition
- `flow.py` - Task implementations (stubs)
- `api.py` - FastAPI server
- `tests/` - Unit tests
- `tools/` - Helper scripts
- `README.md` - Flow-specific documentation

To run a specific flow:

```bash
cd hello_world/
./tools/start_server.sh

# Or with hot reload for development
./tools/start_server.sh --reload
```

Then access:
- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

### Running All Flows (Multi-Flow Server)

Start a server that serves all example flows:

```bash
# From this directory (flows/examples/)
cd /Users/adam/Projects/FlowLang/flows/examples
python -m flowlang project serve . --port 8000 --reload
```

This creates a unified API for all flows:
- `GET /projects` - List projects
- `GET /projects/FlowLang Examples` - Project info
- `GET /flows` - List all flows
- `POST /flows/HelloWorld/execute` - Execute hello_world flow
- `POST /flows/ExitExample/execute` - Execute exit_example flow
- And so on...

### Testing Flows

Each flow has a test suite:

```bash
cd hello_world/
pytest tests/test_tasks.py -v
```

### Watch Mode (Live Testing)

Develop with instant feedback:

```bash
cd hello_world/
python -m flowlang watch flow.yaml --tasks-file flow.py
```

Changes to `flow.yaml` or `flow.py` trigger automatic execution.

---

## Implementation Status

All flows are **scaffolded** with:
- ✅ Complete flow.yaml definitions
- ✅ Task stub generation
- ✅ Test stubs
- ✅ API server setup
- ✅ Development tools

**Tasks are stubs by default** (raise `NotImplementedError`). This is intentional - the examples demonstrate:
1. **Flow design** (YAML structure)
2. **Task orchestration** (how tasks connect)
3. **Project structure** (files and organization)

To make flows executable, implement the tasks in each `flow.py` file.

---

## Learning Path

**Recommended order for learning**:

1. **Start with Hello World** - Basic concepts
2. **Exit Example** - Early termination patterns
3. **Early Termination** - Advanced termination strategies
4. **Loan Approval** - Business process automation
5. **Order Fulfillment** - Complex orchestration

---

## Key Concepts Demonstrated

### Control Flow Patterns

| Pattern | Example Flows |
|---------|--------------|
| Sequential steps | All |
| Conditional (if/then/else) | Hello World, Exit Example |
| Switch-case | Early Termination, Loan Approval |
| Loops (for_each) | Order Fulfillment |
| Parallel execution | Loan Approval, Order Fulfillment |
| Early exit | Exit Example, Early Termination |

### Design Patterns

| Pattern | Example Flows |
|---------|--------------|
| Guard clauses | Early Termination, Exit Example |
| Data validation | All |
| Error handling | Early Termination, Loan Approval |
| Multi-stage processing | Early Termination, Order Fulfillment |
| Conditional routing | Loan Approval |

### Best Practices

- **Design-first**: YAML before implementation
- **Clear naming**: Descriptive task and step IDs
- **Early exits**: Guard clauses prevent deep nesting
- **Error handling**: Explicit error paths
- **Documentation**: Each flow has clear descriptions

---

## Project Structure

```
examples/
├── project.yaml              # Project configuration
├── README.md                 # This file
├── hello_world/              # Simple greeting flow
│   ├── flow.yaml
│   ├── flow.py
│   ├── api.py
│   ├── tests/
│   └── tools/
├── exit_example/             # Early termination demo
│   ├── flow.yaml
│   ├── flow.py
│   ├── api.py
│   ├── tests/
│   └── tools/
├── early_termination/        # Advanced termination patterns
│   ├── flow.yaml
│   ├── flow.py
│   ├── api.py
│   ├── tests/
│   └── tools/
├── loan_approval/            # Business process example
│   ├── flow.yaml
│   ├── flow.py
│   ├── api.py
│   ├── tests/
│   └── tools/
└── order_fulfillment/        # E-commerce workflow
    ├── flow.yaml
    ├── flow.py
    ├── api.py
    ├── tests/
    └── tools/
```

---

## Resources

- **FlowLang Documentation**: `/docs`
- **End-to-End Tutorial**: `/docs/end-to-end-tutorial.md`
- **Control Flow Patterns**: `/docs/control-flow-patterns.md`
- **Database Integration**: `/docs/tutorial-database-connections.md`
- **Agent Suite**: `.claude/agents/README.md`

---

## Contributing

These examples are part of the FlowLang project. To add new examples:

1. Create a new flow directory in `examples/`
2. Design your `flow.yaml`
3. Run scaffolder: `python -m flowlang scaffolder scaffold flow.yaml -o .`
4. Add flow name to `project.yaml` flows list
5. Update this README with flow description

---

## Support

- **GitHub**: https://github.com/anthropics/flowlang
- **Issues**: Report bugs or suggest improvements
- **Discussions**: Ask questions and share flows

---

**Happy Flow Building!** 🚀
