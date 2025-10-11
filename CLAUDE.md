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
│   ├── templates.py       # TemplateManager - template system
│   ├── hot_reload.py      # Hot reload - file watching and live reload
│   ├── watch.py           # Watch mode - live testing CLI
│   └── exceptions.py      # Custom exceptions
├── templates/             # Pre-built flow templates
│   └── APIIntegration/    # REST API integration template
│       ├── flow.yaml      # Template flow with {{VARIABLES}}
│       ├── flow.py        # Template tasks with {{VARIABLES}}
│       └── README.md      # Template documentation
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
   - Provides endpoints:
     - `/` - API overview with endpoints, flow status, and readiness
     - `/health` - Health check with implementation status
     - `/flows` - List all flows
     - `/flows/{name}` - Get flow information
     - `/flows/{name}/execute` - Execute flow
     - `/flows/{name}/execute/stream` - Execute with Server-Sent Events streaming
     - `/flows/{name}/tasks` - List tasks and implementation status
     - `/flows/{name}/visualize` - Get Mermaid diagram
   - Includes OpenAPI/Swagger documentation at `/docs` and `/redoc`

5. **FlowScaffolder** (src/flowlang/scaffolder.py)
   - Generates complete project structure from flow YAML
   - Creates flow.py (task stubs), api.py, tests/, tools/, README.md
   - Smart merge preserves implemented tasks during updates
   - Supports scaffold (new project) and update (existing project) modes
   - Tracks implementation progress automatically

6. **Hot Reload** (src/flowlang/hot_reload.py)
   - FileWatcher: Monitors flow.py and flow.yaml for changes
   - ReloadManager: Manages selective reload without server restart
   - Debouncing: 0.5 second delay to avoid duplicate events
   - Rollback: Keeps previous working version in case of errors
   - State Preservation: Server stays running during reload
   - Module reloading: Uses `importlib.reload()` for Python modules

7. **Watch Mode** (src/flowlang/watch.py)
   - Live testing CLI command: `python -m flowlang watch`
   - Auto-executes flow on file changes
   - Test input loading from JSON file
   - Color-coded terminal output (success/error)
   - Performance metrics and diff comparison
   - Continuous monitoring for development workflow

8. **Exceptions** (src/flowlang/exceptions.py)
   - `FlowLangError` - Base exception
   - `TaskNotFoundError` - Task not registered
   - `NotImplementedTaskError` - Task is a stub
   - `FlowExecutionError` - Runtime execution errors
   - `FlowValidationError` - Invalid flow definitions
   - `FlowTerminationException` - Intentional flow termination via exit step (control flow, not an error)
   - `ReloadError` - Hot reload failure

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
- **Conditionals**:
  - Binary: `if:` condition, `then:` steps, `else:` steps
  - Quantified: `if:` with `any:`, `all:`, or `none:` for complex multi-condition logic
  - Multi-way: `switch:` expression, `cases:` with `when:` and `do:`, `default:` fallback
- **Loops**: `for_each:` items, `as:` item_var, `do:` steps
- **Early termination**: `exit` step to terminate flow execution explicitly
  - Simple form: `- exit`
  - With reason: `- exit: {reason: "message"}`
  - With outputs: `- exit: {reason: "message", outputs: {key: value}}`
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

#### Multi-Flow Server

Start a server that serves multiple flows:

```bash
# From project root - serves all flows in flows/ directory
./scripts/start_multi_server.sh

# With hot reload enabled
./scripts/start_multi_server.sh --reload

# With custom port
./scripts/start_multi_server.sh --port 8080 --reload

# Or use Python directly
python -m flowlang.server --multi flows --reload
```

Multi-flow server features:
- Automatically discovers all flow projects in subdirectories
- Each flow gets its own executor and task registry
- Hot reload watches all flows simultaneously
- Aggregate health endpoint shows status of all flows
- Per-flow endpoints: `/flows/{flow_name}/execute`

### Using Hot Reload

#### Option 1: Server with Hot Reload

Start the FlowLang API server with hot reload enabled for rapid development:

```python
from flowlang.server import FlowServer

# Create server with hot reload
server = FlowServer(
    project_dir='./my_project',
    enable_hot_reload=True  # Enable hot reload
)

server.run(host='0.0.0.0', port=8000)
```

Or use the generated api.py (hot reload enabled by default):

```bash
cd flows/my_project
uvicorn api:app --host 0.0.0.0 --port 8000
```

When hot reload is enabled:
- Changes to `flow.py` automatically reload task implementations
- Changes to `flow.yaml` automatically reload flow definitions
- No server restart required
- Failed reloads automatically rollback to previous working version
- Server logs show reload status and errors

#### Option 2: Watch Mode for Live Testing

Use watch mode for interactive development with instant feedback:

```bash
# From a flow project directory
cd flows/my_project

# Watch with default settings
python -m flowlang watch

# Watch with custom files
python -m flowlang watch flow.yaml --tasks-file flow.py

# Watch with test inputs from JSON
python -m flowlang watch --test-inputs test_inputs.json
```

Watch mode features:
- Auto-executes flow when flow.yaml or flow.py changes
- Shows execution results in terminal with color-coded output
- Displays performance metrics (execution time)
- Compares outputs between runs (shows if changed)
- Loads test inputs from JSON file
- Perfect for TDD-style development

Example test_inputs.json:
```json
{
  "user_id": "123",
  "action": "create"
}
```

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
   - OpenAPI/Swagger docs at `/docs` and `/redoc`
   - Comprehensive endpoints:
     - API overview (/) with flow status and readiness
     - Health checks (/health) with implementation progress
     - Flow execution (/flows/{name}/execute)
     - Streaming execution (/flows/{name}/execute/stream) with Server-Sent Events
     - Task status tracking (/flows/{name}/tasks)
     - Flow visualization (/flows/{name}/visualize)
   - Single-flow and multi-flow server modes

3. **Helper Scripts** ✅: Auto-generated tools for every project
   - `tools/start_server.sh`: Convenient server launcher
   - `tools/generate.sh`: Smart scaffold/update wrapper
   - Both scripts handle virtual environment activation

4. **Hot Reload** ✅: Live development without server restarts
   - See `src/flowlang/hot_reload.py`
   - Watches flow.py and flow.yaml for changes
   - Selective reload of tasks and flow definitions
   - Automatic rollback on errors
   - Debounced file watching (0.5s delay)
   - Enabled by default in generated api.py files
   - Performance metrics and reload statistics
   - **Works in both single-flow and multi-flow modes**
   - Multi-flow: Each flow gets its own ReloadManager and FileWatcher

5. **Watch Mode** ✅: Interactive live testing CLI
   - See `src/flowlang/watch.py`
   - Command: `python -m flowlang watch [flow.yaml] [options]`
   - Auto-executes flow on file changes
   - Test input loading from JSON file
   - Color-coded terminal output
   - Performance metrics and output diff comparison
   - Perfect for TDD workflow

6. **Flow Templates** ✅: Pre-built production-ready flow templates
   - See `src/flowlang/templates.py` and `scripts/create_flow_from_template.sh`
   - Commands:
     - `python -m flowlang template list` - List available templates
     - `python -m flowlang template vars <name>` - Show required variables
     - `python -m flowlang template create <name> <output> --var KEY=value` - Create from template
   - **Interactive Script** (Recommended):
     - `./scripts/create_flow_from_template.sh` - Interactive mode (default)
     - Prompts for template name, flow name, and all template variables
     - Provides sensible defaults for all variables
     - Automatically runs scaffolder to generate complete project
     - Preserves template implementations via smart merge
     - Results in 100% implemented, production-ready flow
   - Variable substitution system (`{{VAR_NAME}}` placeholders)
   - Processes all files recursively (YAML, Python, Markdown, etc.)
   - Smart handling of binary files (copied as-is)
   - Template structure:
     - `templates/TemplateName/flow.yaml` - Flow definition with variables
     - `templates/TemplateName/flow.py` - Task implementations with variables (scaffolder-compatible format)
     - `templates/TemplateName/README.md` - Documentation
   - Built-in templates:
     - **APIIntegration**: REST API client with auth, retry logic, error handling (10 tasks, 100% implemented)
       - Variables: FLOW_NAME, FLOW_DESCRIPTION, API_BASE_URL, API_KEY_ENV_VAR, AUTH_HEADER_NAME, AUTH_HEADER_PREFIX
       - Features: validation, auth, retry with exponential backoff, smart error handling
       - Template uses `create_task_registry()` format compatible with scaffolder
   - Extensible: Add new templates by creating template directory with `{{VARIABLE}}` placeholders
   - Template tasks must use scaffolder-compatible format (decorators inside `create_task_registry()` function)

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
- Conditional evaluation supports:
  - Basic comparisons (==, !=, <, >, <=, >=)
  - Quantified conditions (`any`, `all`, `none`) for complex multi-condition logic
  - Nested quantifiers (e.g., `all` with nested `any`)
- Switch/case supports single values or lists of values for matching
- Switch cases are evaluated in order; first match wins (like switch in most languages)
- Loop variables are temporarily added to `context.inputs` during iteration
- Exit step uses `FlowTerminationException` for control flow - it's caught and returns success with termination info
- Exit step is an escape hatch; structural nesting (see docs/control-flow-patterns.md) is the recommended pattern

## Git Workflow

- **Main Branch**: `main`
- Virtual environment (`myenv/`) is gitignored
- Use conventional commits when possible
- Test examples before committing new features
