"""
Base classes for FlowLang connection plugins.

This module provides the foundation for the plugin-based connection system,
allowing third-party developers to create their own connection providers.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Callable, Tuple


class ConnectionPlugin(ABC):
    """
    Base class for connection plugins.

    Connection plugins provide:
    1. Connection lifecycle management (connect, disconnect, pooling)
    2. Built-in task types specific to the connection (e.g., db_query)
    3. Scaffolding commands to generate code and configs
    4. Dependency management
    5. Configuration validation

    Example plugin structure:
        src/flowlang/connections/postgres/
        ├── __init__.py          # Export plugin and auto-register
        ├── provider.py          # PostgresPlugin(ConnectionPlugin)
        ├── tasks.py             # Built-in task implementations
        ├── scaffold.py          # Scaffolding commands
        └── requirements.txt     # Plugin dependencies

    Third-party plugins can be distributed as pip packages and discovered
    via setuptools entry points.
    """

    # Plugin metadata (must be overridden)
    name: str = "base"
    description: str = ""
    version: str = "1.0.0"

    def __init__(self):
        """Initialize the plugin"""
        self._connection = None
        self._config = None

    # Configuration

    @abstractmethod
    def get_config_schema(self) -> Dict[str, Any]:
        """
        Return JSON schema for connection configuration.

        This schema is used to:
        - Validate connection configs in flow YAML
        - Generate documentation
        - Provide IDE autocompletion

        Returns:
            JSON schema dictionary

        Example:
            {
                "type": "object",
                "required": ["url"],
                "properties": {
                    "url": {"type": "string", "description": "Connection URL"},
                    "pool_size": {"type": "integer", "default": 10},
                    "timeout": {"type": "integer", "default": 30}
                }
            }
        """
        pass

    def validate_config(self, config: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Validate connection configuration.

        This is called before connect() to catch configuration errors early.
        Plugins can override this for custom validation logic.

        Args:
            config: Connection configuration dictionary

        Returns:
            Tuple of (is_valid, error_message)

        Example:
            def validate_config(self, config):
                if 'url' not in config:
                    return False, "Missing required field: url"
                if not config['url'].startswith('postgres://'):
                    return False, "Invalid PostgreSQL URL"
                return True, None
        """
        # Default: no validation (assume schema validation is sufficient)
        return True, None

    # Connection lifecycle

    @abstractmethod
    async def connect(self, config: Dict[str, Any]) -> Any:
        """
        Establish connection using the provided configuration.

        This is called once per flow execution. Plugins should:
        - Create connection pool if applicable
        - Validate connectivity
        - Store config for later use
        - Set up any necessary state

        Args:
            config: Connection configuration (already validated)

        Returns:
            Connection object or pool

        Raises:
            ConnectionError: If connection fails

        Example:
            async def connect(self, config):
                self._config = config
                self._pool = await asyncpg.create_pool(
                    config['url'],
                    min_size=1,
                    max_size=config.get('pool_size', 10)
                )
                return self._pool
        """
        pass

    @abstractmethod
    async def disconnect(self):
        """
        Close connection and clean up resources.

        This is called after flow execution completes (success or failure).
        Plugins should:
        - Close all open connections
        - Release resources
        - Clean up any temporary state

        Example:
            async def disconnect(self):
                if self._pool:
                    await self._pool.close()
                    self._pool = None
        """
        pass

    @abstractmethod
    async def get_connection(self) -> Any:
        """
        Get an active connection from the pool.

        This is called for each task that uses this connection.
        For pooled connections, this should acquire from pool.
        For single connections, return the connection object.

        Returns:
            Connection object ready for use

        Example:
            async def get_connection(self):
                return await self._pool.acquire()
        """
        pass

    async def release_connection(self, connection: Any):
        """
        Release a connection back to the pool.

        This is called after a task completes using the connection.
        For pooled connections, return to pool.
        For single connections, this may be a no-op.

        Args:
            connection: The connection to release

        Example:
            async def release_connection(self, connection):
                await self._pool.release(connection)
        """
        # Default: no-op (for simple connections)
        pass

    # Built-in tasks

    def get_builtin_tasks(self) -> Dict[str, Callable]:
        """
        Return dictionary of built-in task implementations.

        Built-in tasks are registered automatically when the plugin is loaded.
        They provide zero-boilerplate database operations directly in YAML.

        Task names should be prefixed with plugin name (e.g., 'pg_query').

        Returns:
            Dict mapping task names to async functions

        Example:
            def get_builtin_tasks(self):
                return {
                    'pg_query': self._task_query,
                    'pg_execute': self._task_execute,
                    'pg_transaction': self._task_transaction,
                }

            async def _task_query(self, query: str, params: dict = None, connection=None):
                async with connection.transaction():
                    result = await connection.fetch(query, **params)
                    return {'rows': [dict(r) for r in result]}
        """
        return {}

    # Scaffolding

    def scaffold_connection_config(self, name: str = "conn", **kwargs) -> str:
        """
        Generate YAML connection configuration snippet.

        This is used by CLI command: flowlang connection scaffold <plugin>

        Args:
            name: Connection name to use in YAML
            **kwargs: Additional options (plugin-specific)

        Returns:
            YAML string with connection config

        Example:
            def scaffold_connection_config(self, name="db", **kwargs):
                return f'''
  {name}:
    type: postgres
    url: ${{env.DATABASE_URL}}
    pool_size: {kwargs.get('pool_size', 10)}
    timeout: {kwargs.get('timeout', 30)}
'''
        """
        return f"""
  {name}:
    type: {self.name}
    # Add configuration here
"""

    def scaffold_task_helpers(self, output_dir: str, connection_name: str = "conn", **kwargs):
        """
        Generate helper functions file for common patterns.

        This is used by CLI command: flowlang connection helpers <plugin>

        Creates a Python file with utility functions that use this connection type.

        Args:
            output_dir: Directory to write helper file
            connection_name: Name of connection in flow YAML
            **kwargs: Additional options (plugin-specific)

        Example:
            def scaffold_task_helpers(self, output_dir, connection_name="db", **kwargs):
                code = '''
"""Helper functions for database operations"""

async def fetch_by_id(table: str, id_value, connection):
    query = f"SELECT * FROM {table} WHERE id = $1"
    return await connection.fetchrow(query, id_value)
'''
                with open(f"{output_dir}/db_helpers.py", "w") as f:
                    f.write(code)
        """
        # Default: no helpers
        pass

    def scaffold_example_flow(self, output_dir: str, connection_name: str = "conn", **kwargs):
        """
        Generate example flow YAML demonstrating this connection type.

        This is used by CLI command: flowlang connection example <plugin>

        Creates a complete flow.yaml showing best practices.

        Args:
            output_dir: Directory to write example flow
            connection_name: Name of connection in YAML
            **kwargs: Additional options (plugin-specific)

        Example:
            def scaffold_example_flow(self, output_dir, connection_name="db", **kwargs):
                yaml_content = f'''
flow: DatabaseExample

connections:
  {connection_name}:
    type: postgres
    url: ${{env.DATABASE_URL}}

steps:
  - pg_query:
      id: fetch
      connection: {connection_name}
      query: "SELECT * FROM users LIMIT 10"
'''
                with open(f"{output_dir}/example_flow.yaml", "w") as f:
                    f.write(yaml_content)
        """
        # Default: minimal example
        pass

    # Dependencies

    def get_dependencies(self) -> List[str]:
        """
        Return list of pip packages required by this plugin.

        These are optional dependencies that must be installed separately.
        FlowLang core doesn't include all database drivers by default.

        Returns:
            List of pip package specifications

        Example:
            def get_dependencies(self):
                return ["asyncpg>=0.29.0", "psycopg[binary]>=3.0"]
        """
        return []

    def check_dependencies(self) -> Tuple[bool, List[str]]:
        """
        Check if required dependencies are installed.

        Returns:
            Tuple of (all_installed, missing_packages)

        Example:
            >>> plugin.check_dependencies()
            (False, ["asyncpg"])
        """
        import importlib.util

        missing = []
        for dep in self.get_dependencies():
            # Extract package name from specification
            package_name = dep.split('>=')[0].split('[')[0].strip()

            spec = importlib.util.find_spec(package_name)
            if spec is None:
                missing.append(dep)

        return len(missing) == 0, missing

    # Metadata

    def get_info(self) -> Dict[str, Any]:
        """
        Get plugin metadata.

        Returns:
            Dictionary with plugin information
        """
        deps_installed, missing = self.check_dependencies()

        return {
            'name': self.name,
            'description': self.description,
            'version': self.version,
            'dependencies': self.get_dependencies(),
            'dependencies_installed': deps_installed,
            'missing_dependencies': missing,
            'builtin_tasks': list(self.get_builtin_tasks().keys()),
            'config_schema': self.get_config_schema(),
        }

    def __repr__(self):
        return f"ConnectionPlugin(name={self.name}, version={self.version})"
