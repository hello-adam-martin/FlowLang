# FlowLang

A workflow orchestration language that helps you design workflows in YAML and deploy them as REST APIs with automatic code generation.

## What is FlowLang?

FlowLang lets you design workflows in simple YAML, then automatically generates complete, production-ready projects with:
- Task implementation stubs
- Unit tests
- REST API server
- Helper scripts
- Complete documentation

You implement tasks one at a time—like TDD for workflows—and always know exactly what's done vs pending. Every flow is immediately deployable as a REST API.

## Key Features

- **Design-first approach**: Write workflows in clean, readable YAML
- **TDD-style development**: Auto-generate task stubs with tests
- **Built-in progress tracking**: Always know what's implemented (3/15, 10/15, etc.)
- **REST API included**: FastAPI server auto-generated for every flow
- **Smart merge**: Update flows without losing implementations
- **Complete project structure**: Get tests, docs, and helper scripts automatically

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/hello-adam-martin/FlowLang.git
cd FlowLang

# Create virtual environment
python -m venv myenv
source myenv/bin/activate  # On Windows: myenv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install FlowLang in development mode
pip install -e .
```

### Create Your First Flow

1. **Define your workflow in YAML** (e.g., `my_flow.yaml`):

```yaml
flow: HelloWorld
description: A simple greeting workflow

inputs:
  - name: user_name
    type: string
    required: true

steps:
  - task: ValidateUser
    id: validate
    inputs:
      name: ${inputs.user_name}
    outputs:
      - is_valid

  - task: Greet
    id: greet_step
    if: ${validate.is_valid}
    inputs:
      name: ${inputs.user_name}
    outputs:
      - greeting

outputs:
  - name: message
    value: ${greet_step.greeting}
```

2. **Generate complete project structure**:

```bash
python -m flowlang.scaffolder scaffold my_flow.yaml -o ./my_project
```

This creates:
```
my_project/
├── flow.yaml           # Your flow definition
├── flow.py             # Task stubs to implement
├── api.py              # FastAPI server
├── README.md           # Complete documentation
├── tools/
│   ├── generate.sh     # Smart regeneration script
│   └── start_server.sh # Server launcher
└── tests/
    └── test_tasks.py   # Unit tests
```

3. **Implement your tasks** in `flow.py`:

```python
@registry.register('ValidateUser')
async def validate_user(name):
    is_valid = len(name) > 0
    return {'is_valid': is_valid}

@registry.register('Greet')
async def greet(name):
    greeting = f"Hello, {name}! Welcome to FlowLang."
    return {'greeting': greeting}
```

4. **Start the REST API server**:

```bash
cd my_project
./tools/start_server.sh
```

5. **Test your flow**:

```bash
curl -X POST http://localhost:8000/flows/HelloWorld/execute \
  -H "Content-Type: application/json" \
  -d '{"inputs": {"user_name": "Alice"}}'
```

Visit http://localhost:8000/docs for interactive API documentation.

## Core Features

### Flow Constructs

FlowLang supports:

- **Sequential execution**: Steps run one after another
- **Parallel execution**: Run multiple steps concurrently
- **Conditionals**: `if/then/else` logic
- **Loops**: `for_each` over collections
- **Error handling**: Retries and fallback logic
- **Variable resolution**: `${inputs.var}`, `${step.output}`

### Smart Scaffolder

The scaffolder is intelligent:

- **First time**: Creates complete project structure
- **Updates**: Preserves your implementations, adds new tasks
- **Smart merge**: Never overwrites working code
- **Progress tracking**: Shows 5/15 tasks implemented, 10 pending

### REST API Server

Every flow gets a production-ready REST API:

- **Auto-generated endpoints**: Execute flows, check status, list tasks
- **OpenAPI/Swagger docs**: Interactive API documentation
- **Type validation**: Pydantic models from flow definition
- **Error handling**: Proper HTTP status codes and error messages

### Multi-Flow Support

Serve multiple flows from a single API server:

- **Single endpoint**: One server process for all your workflows
- **Auto-discovery**: Automatically detects flows in subdirectories
- **Aggregate health**: Monitor readiness of all flows at once
- **Per-flow isolation**: Each flow has its own executor and task registry

**Directory structure**:
```
flows/
├── user_auth/
│   ├── flow.yaml
│   └── flow.py
├── todo_manager/
│   ├── flow.yaml
│   └── flow.py
└── notifications/
    ├── flow.yaml
    └── flow.py
```

**Start multi-flow server**:
```bash
# Option 1: Using convenience script
./start_multi_server.sh

# Option 2: Direct Python command
python -m flowlang.server --multi flows

# With custom port
./start_multi_server.sh --port 8080

# With auto-reload
./start_multi_server.sh --reload
```

**API endpoints remain the same**:
- `/flows` - List all flows
- `/flows/{flow_name}/execute` - Execute specific flow
- `/health` - Shows aggregate status for all flows

## Project Structure

```
FlowLang/
├── src/flowlang/           # Core library
│   ├── executor.py         # Flow execution engine
│   ├── registry.py         # Task registration
│   ├── context.py          # Execution context
│   ├── server.py           # REST API server
│   ├── scaffolder.py       # Code generator
│   └── exceptions.py       # Custom exceptions
├── flows/                  # Example flow projects
│   └── todo_project/       # TodoManager example
├── CLAUDE.md               # Development guide
└── README.md               # This file
```

## Example: TodoManager Flow

Check out `flows/todo_project/` for a complete example with:
- User validation
- CRUD operations
- Conditional logic
- Error handling
- Full REST API

Start it with:
```bash
cd flows/todo_project
./tools/start_server.sh
```

## Development Workflow

### Creating a Flow

1. Design your workflow in YAML
2. Run scaffolder to generate project
3. Implement tasks one by one
4. Run tests as you go
5. Update implementation status
6. Start the API server

### Updating a Flow

When you change your flow definition:

```bash
cd my_project
./tools/generate.sh
```

This intelligently:
- Preserves all implemented tasks
- Adds new tasks as stubs
- Updates tests
- Regenerates documentation

## API Usage

### Execute a Flow

```bash
curl -X POST http://localhost:8000/flows/HelloWorld/execute \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "user_name": "Alice"
    }
  }'
```

### Response

```json
{
  "success": true,
  "outputs": {
    "message": "Hello, Alice! Welcome to FlowLang."
  },
  "execution_time_ms": 12.5,
  "flow": "HelloWorld"
}
```

### Check Health and Readiness

**Single flow mode**:
```bash
curl http://localhost:8000/health
```

Returns:
```json
{
  "status": "healthy",
  "flow": "HelloWorld",
  "tasks_implemented": 2,
  "tasks_total": 2,
  "tasks_pending": 0,
  "implementation_complete": true,
  "ready": true,
  "pending_task_names": []
}
```

**Multi-flow mode**:
```bash
curl http://localhost:8000/health
```

Returns aggregate status:
```json
{
  "status": "healthy",
  "server_type": "multi-flow",
  "flows_count": 2,
  "all_flows_ready": false,
  "aggregate_tasks": {
    "total": 7,
    "implemented": 5,
    "pending": 2,
    "progress": "5/7"
  },
  "flows": [
    {
      "name": "UserAuth",
      "ready": true,
      "tasks_implemented": 3,
      "tasks_total": 3,
      "tasks_pending": 0,
      "progress": "3/3",
      "pending_task_names": []
    },
    {
      "name": "TodoManager",
      "ready": false,
      "tasks_implemented": 2,
      "tasks_total": 4,
      "tasks_pending": 2,
      "progress": "2/4",
      "pending_task_names": ["DeleteTodo", "UpdateTodo"]
    }
  ]
}
```

**Note**: `ready` is `true` only when ALL tasks are implemented. The API returns HTTP 503 if you try to execute a flow with unimplemented tasks. In multi-flow mode, `all_flows_ready` is true only when ALL flows are ready.

### Check Task Status

```bash
curl http://localhost:8000/flows/HelloWorld/tasks
```

Returns implementation progress and task list.

## Advanced Features

### Variable Resolution

```yaml
steps:
  - task: GetUser
    id: user_step
    outputs:
      - user_data

  - task: SendEmail
    inputs:
      email: ${user_step.user_data.email}
      name: ${user_step.user_data.name}
```

### Parallel Execution

```yaml
steps:
  - parallel:
      - task: FetchUserData
        id: user
      - task: FetchOrders
        id: orders
      - task: FetchPreferences
        id: prefs
```

### Error Handling

```yaml
steps:
  - task: RiskyOperation
    retry:
      max_attempts: 3
      delay_seconds: 1
    on_error:
      - task: LogError
      - task: SendAlert
```

## Testing

Run tests for a flow project:

```bash
cd my_project
pytest tests/test_tasks.py -v
```

Check implementation progress:

```bash
python flow.py
```

## Contributing

Contributions are welcome! This project is in active development.

## Documentation

For detailed development guidelines, see [CLAUDE.md](./CLAUDE.md).

## Project Status

✅ **Implemented**:
- Core flow executor with async support
- YAML-based flow definitions
- Sequential, parallel, conditional, and loop execution
- Variable resolution and context management
- Task registry with progress tracking
- Smart scaffolder with merge capabilities
- REST API server with FastAPI (single and multi-flow modes)
- Auto-generated project structure
- Complete documentation generation
- Multi-flow support with auto-discovery

🚧 **In Progress**:
- Client SDKs (Python, TypeScript)
- Advanced error handling patterns
- Flow composition and subflows

🎯 **Planned**:
- Web UI for flow design
- Monitoring and observability
- Event-driven triggers
- Cloud deployment templates

## License

MIT License
