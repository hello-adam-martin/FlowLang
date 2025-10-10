# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FlowLang is a Python-based workflow orchestration language that allows users to describe task flows in YAML format. The goal is to provide a design-first, TDD-style approach to building workflows that can be deployed as REST APIs and integrated with any application.

**Core Philosophy**: Design workflows in YAML (what), implement tasks incrementally (how), track progress automatically (status).

## Development Environment

- **Python Version**: 3.12+ (3.8+ supported)
- **Virtual Environment**: `myenv/`
- **Package Management**: pip with requirements.txt

### Setup Commands

```bash
# Activate virtual environment
source myenv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install in development mode
pip install -e .

# Run example flow project
cd flows/todo_project
./tools/start_server.sh

# Run tests for a flow project
cd flows/todo_project
pytest tests/test_tasks.py -v
```

## Project Structure

```
FlowLang/
├── src/flowlang/          # Core library code
│   ├── __init__.py        # Package exports
│   ├── executor.py        # FlowExecutor - main execution engine
│   ├── context.py         # FlowContext - manages execution state
│   ├── registry.py        # TaskRegistry - task registration & management
│   ├── server.py          # FlowServer - REST API server
│   ├── scaffolder.py      # FlowScaffolder - code generation
│   ├── scaffolder_merge.py # Smart merge for preserving implementations
│   └── exceptions.py      # Custom exceptions
├── flows/                 # Flow project directories
│   └── todo_project/      # Example TodoManager flow project
│       ├── flow.yaml      # Flow definition
│       ├── flow.py        # Task implementations
│       ├── api.py         # FastAPI app export
│       ├── README.md      # Project documentation
│       ├── tools/         # Helper scripts
│       │   ├── generate.sh     # Smart scaffold/update
│       │   └── start_server.sh # Server launcher
│       └── tests/         # Unit tests
│           └── test_tasks.py
└── myenv/                # Python virtual environment (not in git)
```

## Architecture

### Core Components

1. **FlowExecutor** (src/flowlang/executor.py)
   - Main execution engine
   - Parses YAML flow definitions
   - Orchestrates step execution (sequential, parallel, conditional, loops)
   - Handles error recovery and retries
   - Manages subflow execution

2. **TaskRegistry** (src/flowlang/registry.py)
   - Registers task implementations
   - Tracks implementation status (implemented vs stubs)
   - Provides progress tracking (e.g., "15/30 tasks implemented")
   - Supports both sync and async task functions

3. **FlowContext** (src/flowlang/context.py)
   - Manages execution state
   - Stores inputs and step outputs
   - Resolves variable references: `${inputs.var}`, `${step_id.output}`
   - Handles nested field access: `${step.output.nested.field}`

4. **FlowServer** (src/flowlang/server.py)
   - FastAPI-based REST API server
   - Auto-loads flow.yaml and flow.py from project directory
   - Dynamically generates Pydantic models for request/response validation
   - Provides endpoints: /, /health, /flows, /flows/{name}/execute, /flows/{name}/tasks
   - Includes OpenAPI/Swagger documentation at /docs

5. **FlowScaffolder** (src/flowlang/scaffolder.py)
   - Generates complete project structure from flow YAML
   - Creates flow.py (task stubs), api.py, tests/, tools/, README.md
   - Smart merge preserves implemented tasks during updates
   - Supports scaffold (new project) and update (existing project) modes
   - Tracks implementation progress automatically

6. **Exceptions** (src/flowlang/exceptions.py)
   - `FlowLangError` - Base exception
   - `TaskNotFoundError` - Task not registered
   - `NotImplementedTaskError` - Task is a stub
   - `FlowExecutionError` - Runtime execution errors
   - `FlowValidationError` - Invalid flow definitions

### Flow Definition Format

Flows are defined in YAML with the following structure:

```yaml
flow: FlowName
description: Optional description

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

### Supported Flow Constructs

- **Sequential steps**: Execute one after another
- **Parallel execution**: `parallel: [step1, step2, ...]`
- **Conditionals**: `if:` condition, `then:` steps, `else:` steps
- **Loops**: `for_each:` items, `as:` item_var, `do:` steps
- **Error handling**: `retry:` config, `on_error:` handler steps
- **Dependencies**: `depends_on:` [step_ids]
- **Subflows**: `subflow:` flow_name (planned feature)

### Variable Resolution

The FlowContext resolves variables using the pattern `${path}`:

- `${inputs.var_name}` - Flow input variables
- `${step_id.output}` - Output from a step
- `${step_id.output.field}` - Nested field access
- String interpolation: `"Hello ${inputs.name}!"`

## Development Workflow

### Adding New Features

1. **For new flow constructs** (e.g., new step types):
   - Add parsing logic in `FlowExecutor._execute_step()`
   - Implement execution method (e.g., `_execute_new_type()`)
   - Update flow validation in `_validate_flow()`
   - Add examples in `flows/`

2. **For task registry enhancements**:
   - Modify `TaskRegistry` class in `src/flowlang/registry.py`
   - Ensure backward compatibility with existing task registrations

3. **For variable resolution improvements**:
   - Update `FlowContext._resolve_variable_path()` or `_resolve_string()`
   - Add tests for new resolution patterns

4. **For scaffolder improvements**:
   - Modify generation methods in `FlowScaffolder` class
   - Update templates for generated files (flow.py, api.py, tests, README)
   - Test both scaffold and update modes with smart merge
   - Ensure backward compatibility with existing projects

5. **For server enhancements**:
   - Modify `FlowServer` class in `src/flowlang/server.py`
   - Update endpoint handlers or add new endpoints
   - Update Pydantic model generation if needed
   - Test with example projects in flows/

### Testing Strategy

When adding tests:
- Unit tests for individual components (Context, Registry, Executor methods)
- Integration tests for complete flow execution
- Use pytest with pytest-asyncio for async tests
- Test scaffolder by generating new projects and verifying structure
- Test server by running flow projects and calling API endpoints
- Generated projects include test files in tests/ subdirectory

## Common Tasks

### Creating a New Task

```python
from flowlang import TaskRegistry

registry = TaskRegistry()

@registry.register('TaskName', description='What this task does')
async def task_name(param1: str, param2: int):
    # Implementation
    return {'result': 'value'}
```

### Running a Flow

#### Option 1: Direct Execution (Programmatic)

```python
from flowlang import FlowExecutor, TaskRegistry

registry = TaskRegistry()
# ... register tasks ...

executor = FlowExecutor(registry)
result = await executor.execute_flow(flow_yaml, inputs={'key': 'value'})
```

#### Option 2: REST API Server (Recommended)

```python
from flowlang.server import FlowServer

# Create server from a project directory
server = FlowServer(project_dir='./my_project')

# Run the server
server.run(host='0.0.0.0', port=8000)
```

Or use the generated helper scripts in a flow project:

```bash
# From a flow project directory
cd flows/todo_project
./tools/start_server.sh

# Or with auto-reload for development
./tools/start_server.sh --reload
```

Then execute flows via HTTP:

```bash
curl -X POST http://localhost:8000/flows/MyFlow/execute \
  -H "Content-Type: application/json" \
  -d '{"inputs": {"key": "value"}}'
```

Access interactive API docs at http://localhost:8000/docs

### Checking Implementation Progress

```python
status = registry.get_implementation_status()
print(f"Progress: {status['progress']}")  # e.g., "15/30"
print(f"Unimplemented: {status['unimplemented_tasks']}")
```

## Implemented Features

1. **Flow Scaffolder** ✅: Auto-generate complete project structure from flow YAML
   - Scaffold new projects: `python -m flowlang.scaffolder scaffold flow.yaml -o ./project`
   - Update existing projects: `python -m flowlang.scaffolder update flow.yaml -o ./project`
   - Generates: flow.py, api.py, tests/, tools/, README.md
   - Smart merge preserves implemented tasks during updates
   - Progress tracking built-in

2. **REST API Server** ✅: FastAPI-based server to expose flows as APIs
   - See `src/flowlang/server.py`
   - Auto-generated in every project as `api.py`
   - Dynamic Pydantic models from flow definition
   - OpenAPI/Swagger docs at `/docs`
   - Health checks, flow execution, task status endpoints

3. **Helper Scripts** ✅: Auto-generated tools for every project
   - `tools/start_server.sh`: Convenient server launcher
   - `tools/generate.sh`: Smart scaffold/update wrapper
   - Both scripts handle virtual environment activation

## Planned Features (Not Yet Implemented)

The following features are part of the FlowLang vision but not yet implemented:

1. **Client SDKs**: Python and TypeScript client libraries for calling flows
2. **Subflow Loader**: Load and execute referenced subflows from other files
3. **Timeout Support**: Task-level timeout enforcement
4. **Approval Gates**: Human-in-the-loop workflow steps (pause/resume)
5. **Event Triggers**: Webhook-based flow initiation
6. **Web UI**: Visual flow designer and monitoring dashboard
7. **Authentication**: API key and OAuth support for REST API
8. **Rate Limiting**: Request throttling for production deployments

## Design Principles

1. **Design-first**: Write YAML flows before implementation
2. **TDD-style**: Generate stubs, implement incrementally
3. **Clear progress**: Always know what's implemented vs pending
4. **Type safety**: Optional but encouraged for task parameters
5. **Async by default**: All execution is async for better performance
6. **Error tolerance**: Retries, fallbacks, and error handlers built-in

## Notes for Future Development

- The executor is fully async - all task functions should be async
- Variable resolution is recursive - works on nested dicts and lists
- Parallel execution uses `asyncio.gather()` - true concurrency
- Error handlers receive error context in `context.metadata['last_error']`
- Conditional evaluation supports basic comparisons (==, !=, <, >, <=, >=)
- Loop variables are temporarily added to `context.inputs` during iteration

## Git Workflow

- **Main Branch**: `main`
- Virtual environment (`myenv/`) is gitignored
- Use conventional commits when possible
- Test examples before committing new features
