# FlowLang Python Client SDK

Type-safe Python client for calling FlowLang flows via REST API.

## Installation

The client SDK is included with FlowLang and requires `httpx`:

```bash
pip install flowlang
# httpx is automatically included in requirements.txt
```

## Quick Start

### Async Usage (Recommended)

```python
from flowlang import FlowLangClient

async with FlowLangClient("http://localhost:8000") as client:
    result = await client.execute_flow("HelloWorld", {"user_name": "Alice"})
    print(result.outputs["message"])
```

### Sync Usage

```python
from flowlang import FlowLangClient

with FlowLangClient("http://localhost:8000") as client:
    result = client.execute_flow_sync("HelloWorld", {"user_name": "Alice"})
    print(result.outputs["message"])
```

## Core Features

### 1. Flow Execution

#### Async Execution

```python
async with FlowLangClient("http://localhost:8000") as client:
    result = await client.execute_flow(
        flow_name="MyFlow",
        inputs={"key": "value"}
    )

    if result.success:
        print(f"Outputs: {result.outputs}")
        print(f"Execution time: {result.execution_time_ms}ms")
```

#### Sync Execution

```python
with FlowLangClient("http://localhost:8000") as client:
    result = client.execute_flow_sync(
        flow_name="MyFlow",
        inputs={"key": "value"}
    )
    print(result.outputs)
```

### 2. Streaming Execution

Execute flows and receive real-time events using Server-Sent Events (SSE):

```python
def handle_event(event_type: str, data: dict):
    if event_type == 'step_started':
        print(f"Starting: {data['step_id']}")
    elif event_type == 'step_completed':
        print(f"Completed: {data['step_id']}")

async with FlowLangClient("http://localhost:8000") as client:
    result = await client.execute_flow_stream(
        flow_name="MyFlow",
        inputs={"key": "value"},
        on_event=handle_event
    )
```

**Event Types:**
- `flow_started`: Flow execution started
- `step_started`: Task step started
- `step_completed`: Task step completed successfully
- `step_failed`: Task step failed
- `flow_completed`: Flow completed successfully
- `flow_failed`: Flow failed with error

### 3. List Flows

```python
async with FlowLangClient("http://localhost:8000") as client:
    # List all flows
    flows = await client.list_flows()
    for flow in flows:
        print(f"{flow.name}: {flow.description}")
```

### 4. Get Flow Information

```python
async with FlowLangClient("http://localhost:8000") as client:
    flow_info = await client.get_flow_info("MyFlow")
    print(f"Inputs: {[inp['name'] for inp in flow_info.inputs]}")
    print(f"Outputs: {[out['name'] for out in flow_info.outputs]}")
```

### 5. Health Check

```python
async with FlowLangClient("http://localhost:8000") as client:
    health = await client.health_check()
    print(f"Status: {health['status']}")
    print(f"Ready: {health['ready']}")
    print(f"Tasks: {health['tasks_implemented']}/{health['tasks_total']}")
```

## Configuration

### Client Options

```python
client = FlowLangClient(
    base_url="http://localhost:8000",
    timeout=30.0,              # Request timeout in seconds
    retry_attempts=3,          # Number of retry attempts
    retry_delay=1.0,           # Initial retry delay in seconds
    retry_backoff=2.0,         # Retry delay multiplier
    headers={"X-API-Key": "secret"}  # Custom headers
)
```

### Retry Behavior

The client automatically retries on:
- Network errors (connection failures, timeouts)
- Server errors (5xx status codes)
- Rate limiting (429 status codes)

It does NOT retry on:
- Client errors (4xx status codes except 429)

Retry delays use exponential backoff:
- Attempt 1: `retry_delay` seconds
- Attempt 2: `retry_delay * retry_backoff` seconds
- Attempt 3: `retry_delay * retry_backoff^2` seconds
- etc.

## Error Handling

### Exception Hierarchy

```
FlowLangError (base exception)
├── FlowExecutionError: Flow execution failed
├── FlowNotReadyError: Flow has unimplemented tasks
└── FlowNotFoundError: Flow doesn't exist
```

### Handling Errors

```python
from flowlang import (
    FlowLangClient,
    FlowExecutionError,
    FlowNotReadyError,
    FlowNotFoundError
)

async with FlowLangClient("http://localhost:8000") as client:
    try:
        result = await client.execute_flow("MyFlow", inputs)
        print(result.outputs)

    except FlowNotFoundError as e:
        print(f"Flow not found: {e}")

    except FlowNotReadyError as e:
        print(f"Flow not ready: {e.progress}")
        print(f"Pending tasks: {e.pending_tasks}")

    except FlowExecutionError as e:
        print(f"Execution failed: {e}")
        print(f"Details: {e.error_details}")

    except Exception as e:
        print(f"Unexpected error: {e}")
```

## Response Objects

### FlowExecutionResult

```python
result = await client.execute_flow("MyFlow", inputs)

result.success            # bool: Whether execution succeeded
result.outputs            # dict: Flow outputs (if success)
result.error              # str: Error message (if failed)
result.error_details      # str: Detailed error info (if failed)
result.execution_time_ms  # float: Execution time in milliseconds
result.flow               # str: Flow name
```

### FlowInfo

```python
flow_info = await client.get_flow_info("MyFlow")

flow_info.name           # str: Flow name
flow_info.description    # str: Flow description
flow_info.inputs         # list: Input schema
flow_info.outputs        # list: Output schema
```

## Best Practices

### 1. Use Context Managers

Always use context managers for automatic cleanup:

```python
# ✅ Good - Automatic cleanup
async with FlowLangClient(url) as client:
    result = await client.execute_flow("MyFlow", inputs)

# ❌ Bad - Manual cleanup required
client = FlowLangClient(url)
result = await client.execute_flow("MyFlow", inputs)
client.close()  # Easy to forget!
```

### 2. Handle All Error Cases

```python
try:
    result = await client.execute_flow("MyFlow", inputs)
except FlowNotReadyError:
    # Flow has unimplemented tasks
    pass
except FlowExecutionError:
    # Flow execution failed
    pass
except FlowNotFoundError:
    # Flow doesn't exist
    pass
```

### 3. Use Streaming for Long-Running Flows

For flows that take a long time, use streaming to get real-time progress:

```python
result = await client.execute_flow_stream(
    "LongRunningFlow",
    inputs,
    on_event=lambda evt, data: print(f"{evt}: {data}")
)
```

### 4. Configure Retries Appropriately

For production deployments, tune retry settings based on your needs:

```python
# High reliability - more retries
client = FlowLangClient(
    url,
    retry_attempts=5,
    retry_delay=2.0,
    retry_backoff=2.0
)

# Fast failure - fewer retries
client = FlowLangClient(
    url,
    retry_attempts=1,
    retry_delay=0.5
)
```

### 5. Check Health Before Critical Operations

```python
health = await client.health_check()
if not health.get('ready'):
    print(f"Warning: {health['tasks_pending']} tasks not implemented")
```

## Integration Examples

### With FastAPI

```python
from fastapi import FastAPI, HTTPException
from flowlang import FlowLangClient, FlowExecutionError

app = FastAPI()
flow_client = FlowLangClient("http://localhost:8000")

@app.post("/api/process")
async def process(data: dict):
    try:
        result = await flow_client.execute_flow("ProcessData", data)
        return result.outputs
    except FlowExecutionError as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.on_event("shutdown")
async def shutdown():
    await flow_client.close_async()
```

### With Django

```python
from flowlang import FlowLangClient
from django.http import JsonResponse
from django.views.decorators.http import require_POST
import asyncio

flow_client = FlowLangClient("http://localhost:8000")

@require_POST
def process_view(request):
    data = json.loads(request.body)

    # Run async flow in sync Django view
    result = flow_client.execute_flow_sync("ProcessData", data)

    return JsonResponse(result.outputs)
```

### With Jupyter Notebooks

```python
# Cell 1: Setup
from flowlang import FlowLangClient
client = FlowLangClient("http://localhost:8000")

# Cell 2: Execute flow
result = await client.execute_flow("MyFlow", {"key": "value"})
result.outputs

# Cell 3: Cleanup (when done)
await client.close_async()
```

## Advanced Usage

### Custom Headers (Authentication)

```python
client = FlowLangClient(
    "http://api.example.com",
    headers={
        "Authorization": "Bearer YOUR_TOKEN",
        "X-API-Key": "YOUR_API_KEY"
    }
)
```

### Long Timeouts for Heavy Flows

```python
client = FlowLangClient(
    url,
    timeout=300.0  # 5 minute timeout
)
```

### Multiple Flows in Parallel

```python
async with FlowLangClient("http://localhost:8000") as client:
    results = await asyncio.gather(
        client.execute_flow("Flow1", inputs1),
        client.execute_flow("Flow2", inputs2),
        client.execute_flow("Flow3", inputs3)
    )
```

## Testing

### Mocking the Client

```python
from unittest.mock import AsyncMock, patch
from flowlang import FlowExecutionResult

@patch('flowlang.FlowLangClient')
async def test_my_function(mock_client):
    # Setup mock
    mock_client.return_value.__aenter__.return_value.execute_flow = AsyncMock(
        return_value=FlowExecutionResult(
            success=True,
            outputs={"result": "mocked"}
        )
    )

    # Test your code
    result = await my_function()
    assert result == {"result": "mocked"}
```

## Troubleshooting

### Connection Refused

```
FlowLangError: Request failed after 3 attempts: Connection refused
```

**Solution**: Make sure the FlowLang server is running:
```bash
cd flows/my_project
./tools/start_server.sh
```

### Flow Not Ready

```
FlowNotReadyError: Flow not ready for execution
```

**Solution**: Some tasks are not yet implemented. Check which tasks are pending:
```python
try:
    result = await client.execute_flow("MyFlow", inputs)
except FlowNotReadyError as e:
    print(f"Pending tasks: {e.pending_tasks}")
```

### Timeout Errors

```
FlowLangError: Request timeout
```

**Solution**: Increase the timeout for long-running flows:
```python
client = FlowLangClient(url, timeout=120.0)  # 2 minutes
```

## API Reference

See the complete API reference in the [client.py](../src/flowlang/client.py) module docstrings.

## Examples

See [examples/client_usage.py](../examples/client_usage.py) for comprehensive usage examples.

## Contributing

For questions or issues with the client SDK, please open an issue on GitHub.
