# Creating Connection Plugins

This guide shows you how to create custom connection plugins for FlowLang, enabling integration with any external service or database.

## Plugin Architecture

Connection plugins are self-contained modules that provide:

1. **Connection lifecycle management** - connect, disconnect, pooling
2. **Built-in task types** - zero-boilerplate operations in YAML
3. **Scaffolding commands** - generate configs, helpers, and examples
4. **Dependency management** - declare and check required packages
5. **Configuration validation** - JSON schema for connection configs

## Quick Start

### 1. Plugin Structure

Create a plugin directory under `src/flowlang/connections/`:

```
src/flowlang/connections/myservice/
├── __init__.py          # Export plugin and auto-register
├── provider.py          # Plugin implementation (MyServicePlugin)
└── requirements.txt     # Optional: plugin dependencies
```

### 2. Implement Plugin Class

Create `provider.py`:

```python
"""
MyService Connection Plugin

Provides MyService API connectivity for FlowLang flows.

Dependencies: myservice-client>=1.0.0
"""
from typing import Any, Dict, List, Callable, Tuple, Optional
from ..base import ConnectionPlugin


class MyServicePlugin(ConnectionPlugin):
    """
    MyService API connection plugin.

    Features:
    - API client with authentication
    - Built-in tasks: myservice_get, myservice_create
    - Rate limiting and retry logic
    - Scaffolding commands for quick setup
    """

    # Plugin metadata (required)
    name = "myservice"
    description = "MyService API connection"
    version = "1.0.0"

    def __init__(self):
        """Initialize plugin"""
        super().__init__()
        self._client = None

    def get_config_schema(self) -> Dict[str, Any]:
        """
        Return JSON schema for configuration.

        This schema is used to:
        - Validate connection configs in flow YAML
        - Generate documentation
        - Provide IDE autocompletion
        """
        return {
            "type": "object",
            "required": ["api_key"],
            "properties": {
                "api_key": {
                    "type": "string",
                    "description": "API key for authentication"
                },
                "base_url": {
                    "type": "string",
                    "default": "https://api.myservice.com",
                    "description": "API base URL"
                },
                "timeout": {
                    "type": "number",
                    "default": 30.0,
                    "minimum": 1.0,
                    "description": "Request timeout in seconds"
                }
            }
        }

    def validate_config(self, config: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Validate connection configuration.

        This is called before connect() to catch errors early.
        Override for custom validation logic.
        """
        if 'api_key' not in config:
            return False, "Missing required field: api_key"

        if not config['api_key'].startswith('sk_'):
            return False, "Invalid API key format"

        return True, None

    async def connect(self, config: Dict[str, Any]) -> Any:
        """
        Establish connection using configuration.

        This is called once per flow execution.
        - Create client
        - Validate connectivity
        - Store config for later use
        - Set up any necessary state

        Returns:
            Connection object (client, pool, etc.)

        Raises:
            ConnectionError: If connection fails
        """
        try:
            from myservice import AsyncClient
        except ImportError:
            raise ImportError(
                "MyService plugin requires 'myservice-client' package. "
                "Install with: pip install myservice-client>=1.0.0"
            )

        self._config = config

        try:
            self._client = AsyncClient(
                api_key=config['api_key'],
                base_url=config.get('base_url', 'https://api.myservice.com'),
                timeout=config.get('timeout', 30.0)
            )

            # Test connection
            await self._client.ping()

            return self._client

        except Exception as e:
            raise ConnectionError(f"Failed to connect to MyService: {e}") from e

    async def disconnect(self):
        """
        Close connection and clean up resources.

        This is called after flow execution completes (success or failure).
        - Close all open connections
        - Release resources
        - Clean up any temporary state
        """
        if self._client:
            await self._client.close()
            self._client = None

    async def get_connection(self) -> Any:
        """
        Get an active connection.

        This is called for each task that uses this connection.
        For pooled connections, acquire from pool.
        For single connections, return the connection object.
        """
        if not self._client:
            raise ConnectionError("MyService client not initialized")

        return self._client

    async def release_connection(self, connection: Any):
        """
        Release connection back to pool.

        This is called after a task completes.
        For pooled connections, return to pool.
        For single connections, this may be a no-op.
        """
        # No pooling needed for this example
        pass

    def get_builtin_tasks(self) -> Dict[str, Callable]:
        """
        Return dictionary of built-in task implementations.

        Built-in tasks are registered automatically when plugin is loaded.
        They provide zero-boilerplate operations directly in YAML.

        Task names should be prefixed with plugin name (e.g., 'myservice_get').
        """
        return {
            'myservice_get': self._task_get,
            'myservice_create': self._task_create,
        }

    async def _task_get(
        self,
        resource_id: str,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Get resource by ID.

        Args:
            resource_id: Resource identifier
            connection: Service client (injected)

        Returns:
            Dict with 'data' key containing resource data

        Example YAML:
            - myservice_get:
                id: fetch_item
                connection: api
                resource_id: "${inputs.item_id}"
                outputs:
                  - data
        """
        try:
            data = await connection.get(f'/resources/{resource_id}')
            return {'data': data}

        except Exception as e:
            raise FlowExecutionError(
                f"MyService GET failed: {e}"
            ) from e

    async def _task_create(
        self,
        resource_type: str,
        payload: Dict[str, Any],
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Create new resource.

        Args:
            resource_type: Type of resource to create
            payload: Resource data
            connection: Service client (injected)

        Returns:
            Dict with 'resource_id' and 'data'

        Example YAML:
            - myservice_create:
                id: create_item
                connection: api
                resource_type: "item"
                payload:
                  name: "${inputs.name}"
                  description: "${inputs.description}"
                outputs:
                  - resource_id
                  - data
        """
        try:
            response = await connection.post(
                f'/{resource_type}s',
                json=payload
            )

            return {
                'resource_id': response['id'],
                'data': response
            }

        except Exception as e:
            raise FlowExecutionError(
                f"MyService CREATE failed: {e}"
            ) from e

    def get_dependencies(self) -> List[str]:
        """
        Return list of pip packages required by this plugin.

        These are optional dependencies that must be installed separately.
        FlowLang core doesn't include all service clients by default.
        """
        return ["myservice-client>=1.0.0", "httpx>=0.24.0"]

    def scaffold_connection_config(self, name: str = "api", **kwargs) -> str:
        """
        Generate YAML connection configuration snippet.

        This is used by CLI command: flowlang connection scaffold <plugin>

        Args:
            name: Connection name to use in YAML
            **kwargs: Additional options (plugin-specific)

        Returns:
            YAML string with connection config
        """
        timeout = kwargs.get('timeout', 30.0)

        return f"""
  {name}:
    type: myservice
    api_key: ${{env.MYSERVICE_API_KEY}}
    base_url: https://api.myservice.com
    timeout: {timeout}
"""

    def scaffold_example_flow(self, output_dir: str, connection_name: str = "api", **kwargs):
        """
        Generate example flow YAML demonstrating this connection type.

        This is used by CLI command: flowlang connection example <plugin>

        Args:
            output_dir: Directory to write example flow
            connection_name: Name of connection in YAML
            **kwargs: Additional options (plugin-specific)
        """
        import os

        example = f'''flow: MyServiceExample
description: Example flow using MyService connection

connections:
  {connection_name}:
    type: myservice
    api_key: ${{env.MYSERVICE_API_KEY}}
    base_url: https://api.myservice.com
    timeout: 30.0

inputs:
  - name: item_name
    type: string
    required: true

steps:
  # Built-in myservice_create task
  - myservice_create:
      id: create_item
      connection: {connection_name}
      resource_type: "item"
      payload:
        name: "${{inputs.item_name}}"
        active: true
      outputs:
        - resource_id
        - data

  # Built-in myservice_get task
  - myservice_get:
      id: fetch_item
      connection: {connection_name}
      resource_id: "${{create_item.resource_id}}"
      outputs:
        - data

outputs:
  - name: item_id
    value: ${{create_item.resource_id}}

  - name: item_data
    value: ${{fetch_item.data}}
'''

        os.makedirs(output_dir, exist_ok=True)
        example_path = os.path.join(output_dir, 'myservice_example.yaml')

        with open(example_path, 'w') as f:
            f.write(example)

        print(f"Generated: {example_path}")


# Import FlowExecutionError for built-in tasks
try:
    from ...exceptions import FlowExecutionError, ConnectionError
except ImportError:
    # Fallback for when exceptions aren't available yet
    class FlowExecutionError(Exception):
        pass

    class ConnectionError(Exception):
        pass
```

### 3. Auto-register Plugin

Create `__init__.py`:

```python
"""
MyService Connection Plugin

Provides MyService API connectivity for FlowLang flows.

Usage in flow.yaml:
    connections:
      api:
        type: myservice
        api_key: ${env.MYSERVICE_API_KEY}

    steps:
      - myservice_get:
          id: fetch_item
          connection: api
          resource_id: "${inputs.item_id}"
          outputs:
            - data

For more examples, run:
    flowlang connection example myservice
"""
from .provider import MyServicePlugin
from .. import plugin_registry

# Auto-register plugin
plugin_registry.register(MyServicePlugin())

# Exports
__all__ = ['MyServicePlugin']
```

## Plugin API Reference

### Required Methods

#### `get_config_schema() -> Dict[str, Any]`

Return JSON schema for connection configuration.

**Example:**
```python
def get_config_schema(self) -> Dict[str, Any]:
    return {
        "type": "object",
        "required": ["api_key"],
        "properties": {
            "api_key": {"type": "string", "description": "API key"},
            "timeout": {"type": "number", "default": 30.0}
        }
    }
```

#### `async connect(config: Dict[str, Any]) -> Any`

Establish connection using configuration.

**Returns:** Connection object (client, pool, database, etc.)

**Raises:** `ConnectionError` if connection fails

**Example:**
```python
async def connect(self, config: Dict[str, Any]) -> Any:
    self._client = await create_client(config['api_key'])
    return self._client
```

#### `async disconnect()`

Close connection and clean up resources.

**Example:**
```python
async def disconnect(self):
    if self._client:
        await self._client.close()
        self._client = None
```

#### `async get_connection() -> Any`

Get an active connection for task execution.

**Returns:** Connection object ready for use

**Example:**
```python
async def get_connection(self) -> Any:
    return self._client
```

### Optional Methods

#### `validate_config(config: Dict[str, Any]) -> Tuple[bool, Optional[str]]`

Validate connection configuration before connect().

**Returns:** Tuple of (is_valid, error_message)

**Example:**
```python
def validate_config(self, config: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    if 'api_key' not in config:
        return False, "Missing required field: api_key"
    return True, None
```

#### `async release_connection(connection: Any)`

Release connection back to pool (if applicable).

**Example:**
```python
async def release_connection(self, connection: Any):
    await self._pool.release(connection)
```

#### `get_builtin_tasks() -> Dict[str, Callable]`

Return dictionary of built-in task implementations.

**Returns:** Dict mapping task names to async functions

**Example:**
```python
def get_builtin_tasks(self) -> Dict[str, Callable]:
    return {
        'myservice_get': self._task_get,
        'myservice_create': self._task_create,
    }
```

#### `get_dependencies() -> List[str]`

Return list of required pip packages.

**Example:**
```python
def get_dependencies(self) -> List[str]:
    return ["myservice-client>=1.0.0", "httpx>=0.24.0"]
```

#### `scaffold_connection_config(name: str, **kwargs) -> str`

Generate YAML connection config snippet.

**Example:**
```python
def scaffold_connection_config(self, name: str = "api", **kwargs) -> str:
    return f"""
  {name}:
    type: myservice
    api_key: ${{env.MYSERVICE_API_KEY}}
"""
```

#### `scaffold_example_flow(output_dir: str, connection_name: str, **kwargs)`

Generate example flow YAML file.

**Example:**
```python
def scaffold_example_flow(self, output_dir: str, connection_name: str = "api", **kwargs):
    import os
    example = f'''flow: MyServiceExample
connections:
  {connection_name}:
    type: myservice
    api_key: ${{env.MYSERVICE_API_KEY}}
'''
    os.makedirs(output_dir, exist_ok=True)
    with open(f"{output_dir}/example.yaml", "w") as f:
        f.write(example)
```

## Built-in Tasks

Built-in tasks provide zero-boilerplate operations in YAML.

### Task Function Signature

```python
async def _task_operation(
    self,
    param1: type,
    param2: type,
    connection=None  # Connection is injected automatically
) -> Dict[str, Any]:
    """
    Task description.

    Args:
        param1: Parameter description
        param2: Parameter description
        connection: Connection object (injected)

    Returns:
        Dict with output values

    Example YAML:
        - myservice_operation:
            id: do_something
            connection: api
            param1: "value"
            param2: 123
            outputs:
              - result
    """
    # Implementation
    result = await connection.do_something(param1, param2)
    return {'result': result}
```

### Error Handling

Always wrap operations in try/except and raise `FlowExecutionError`:

```python
try:
    result = await connection.operation()
    return {'result': result}
except Exception as e:
    raise FlowExecutionError(
        f"Operation failed: {e}"
    ) from e
```

## Testing Your Plugin

### 1. Test Plugin Registration

```bash
python -m flowlang connection list
```

Should show your plugin in the list.

### 2. Test Plugin Info

```bash
python -m flowlang connection info myservice
```

Should display plugin metadata, dependencies, and config schema.

### 3. Test Dependency Checking

```bash
python -m flowlang connection deps myservice --check
```

Should show which dependencies are installed/missing.

### 4. Test Scaffolding

```bash
python -m flowlang connection scaffold myservice --name api
python -m flowlang connection example myservice
```

Should generate config snippet and example flow.

### 5. Test in Flow

Create a test flow:

```yaml
flow: TestMyService

connections:
  api:
    type: myservice
    api_key: ${env.MYSERVICE_API_KEY}

inputs:
  - name: test_id
    type: string
    required: true

steps:
  - myservice_get:
      id: fetch
      connection: api
      resource_id: ${inputs.test_id}
      outputs:
        - data

outputs:
  - name: result
    value: ${fetch.data}
```

## Third-Party Plugin Distribution

### 1. Package Structure

Create a standalone package:

```
flowlang-myservice/
├── setup.py
├── README.md
├── LICENSE
└── flowlang_myservice/
    ├── __init__.py
    └── provider.py
```

### 2. Setup Entry Point

In `setup.py`:

```python
from setuptools import setup, find_packages

setup(
    name='flowlang-myservice',
    version='1.0.0',
    description='MyService connection plugin for FlowLang',
    author='Your Name',
    packages=find_packages(),
    install_requires=[
        'flowlang>=0.1.0',
        'myservice-client>=1.0.0',
    ],
    entry_points={
        'flowlang.connections': [
            'myservice = flowlang_myservice:MyServicePlugin',
        ],
    },
    classifiers=[
        'Development Status :: 4 - Beta',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
        'Programming Language :: Python :: 3.12',
    ],
)
```

### 3. Publish to PyPI

```bash
# Build package
python setup.py sdist bdist_wheel

# Upload to PyPI
twine upload dist/*
```

### 4. Install Plugin

Users can install your plugin:

```bash
pip install flowlang-myservice
```

Plugin will be auto-discovered via entry points.

## Best Practices

### 1. Use Type Hints

```python
async def connect(self, config: Dict[str, Any]) -> Any:
    ...
```

### 2. Provide Comprehensive Docstrings

Include docstrings with:
- Description of what the method does
- Args with types and descriptions
- Returns with type and description
- Example YAML usage for built-in tasks

### 3. Validate Early

Validate configuration in `validate_config()` before attempting connection.

### 4. Handle Errors Gracefully

Always catch exceptions and provide helpful error messages:

```python
try:
    result = await operation()
except SpecificError as e:
    raise FlowExecutionError(f"Operation failed: {e}") from e
```

### 5. Support Environment Variables

Use `${env.VAR}` pattern in config examples:

```yaml
api_key: ${env.MYSERVICE_API_KEY}
```

### 6. Implement Connection Pooling

For high-throughput services, implement connection pooling:

```python
async def connect(self, config: Dict[str, Any]) -> Any:
    self._pool = await create_pool(
        max_size=config.get('pool_size', 10)
    )
    return self._pool

async def get_connection(self) -> Any:
    return await self._pool.acquire()

async def release_connection(self, connection: Any):
    await self._pool.release(connection)
```

### 7. Test with Real Services

Always test your plugin with the real service in development before release.

### 8. Document Rate Limits

If the service has rate limits, document them and implement retry logic:

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10)
)
async def _task_operation(self, ...):
    ...
```

## Examples

See built-in plugins for reference implementations:
- **PostgreSQL**: `src/flowlang/connections/postgres/`
- **Redis**: `src/flowlang/connections/redis/`
- **MongoDB**: `src/flowlang/connections/mongodb/`
- **MySQL**: `src/flowlang/connections/mysql/`
- **SQLite**: `src/flowlang/connections/sqlite/`

## Next Steps

- See [Database Integration Guide](./database-integration.md) for usage examples
- See [connections.md](./connections.md) for all available integrations
- Join the community to share your plugin
