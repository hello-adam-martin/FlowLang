"""
Connection Manager - Handles connection lifecycle for flow execution.

The ConnectionManager is responsible for:
1. Initializing connections from flow YAML config
2. Managing connection lifecycle (connect/disconnect)
3. Providing connections to tasks
4. Cleaning up connections after flow execution
"""
import os
import re
from typing import Any, Dict, Optional

from .base import ConnectionPlugin
from . import plugin_registry
from ..exceptions import ConnectionError, ConnectionNotFoundError, ConnectionConfigError


class ConnectionManager:
    """
    Manages connections for a flow execution.

    Each flow execution gets its own ConnectionManager instance, which:
    - Parses connection configs from YAML
    - Initializes connection plugins
    - Provides connections to tasks
    - Cleans up connections after execution

    Usage:
        manager = ConnectionManager(connections_config)
        await manager.initialize()
        try:
            conn = await manager.get_connection('db')
            # Use connection...
        finally:
            await manager.cleanup()
    """

    def __init__(self, connections_config: Optional[Dict[str, Dict]] = None):
        """
        Initialize connection manager.

        Args:
            connections_config: Dictionary from flow YAML connections section.
                               Format: {connection_name: {type: plugin_name, ...}}

        Example:
            connections_config = {
                'primary_db': {
                    'type': 'postgres',
                    'url': '${env.DATABASE_URL}',
                    'pool_size': 10
                },
                'cache': {
                    'type': 'redis',
                    'url': '${env.REDIS_URL}'
                }
            }
        """
        self.connections_config = connections_config or {}
        self._active_connections: Dict[str, ConnectionPlugin] = {}
        self._initialized = False

    async def initialize(self):
        """
        Initialize all connections defined in config.

        This should be called before flow execution starts.
        It will:
        1. Resolve environment variables in configs
        2. Load appropriate plugins
        3. Validate configs
        4. Establish connections

        Raises:
            ConnectionConfigError: If config is invalid
            ConnectionNotFoundError: If plugin not found
            ConnectionError: If connection fails
        """
        if self._initialized:
            return

        for conn_name, conn_config in self.connections_config.items():
            # Validate config has 'type' field
            if 'type' not in conn_config:
                raise ConnectionConfigError(
                    f"Connection '{conn_name}' missing required field 'type'"
                )

            plugin_type = conn_config['type']

            # Get plugin from registry
            plugin = plugin_registry.get(plugin_type)
            if plugin is None:
                available = plugin_registry.list_plugins()
                raise ConnectionNotFoundError(
                    f"Unknown connection type '{plugin_type}' for connection '{conn_name}'. "
                    f"Available types: {', '.join(available)}"
                )

            # Check if plugin dependencies are installed
            deps_installed, missing = plugin.check_dependencies()
            if not deps_installed:
                raise ConnectionError(
                    f"Connection plugin '{plugin_type}' requires packages: {', '.join(missing)}. "
                    f"Install with: pip install {' '.join(missing)}"
                )

            # Resolve environment variables in config
            resolved_config = self._resolve_env_vars(conn_config)

            # Validate config
            is_valid, error_msg = plugin.validate_config(resolved_config)
            if not is_valid:
                raise ConnectionConfigError(
                    f"Invalid config for connection '{conn_name}': {error_msg}"
                )

            # Connect
            try:
                await plugin.connect(resolved_config)
                self._active_connections[conn_name] = plugin
            except Exception as e:
                raise ConnectionError(
                    f"Failed to connect '{conn_name}' ({plugin_type}): {e}"
                ) from e

        self._initialized = True

    def _resolve_env_vars(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Resolve ${env.VAR_NAME} references in config.

        Args:
            config: Configuration dictionary possibly containing ${env.VAR}

        Returns:
            Config with environment variables resolved

        Example:
            config = {'url': '${env.DATABASE_URL}', 'port': 5432}
            resolved = self._resolve_env_vars(config)
            # resolved = {'url': 'postgres://...', 'port': 5432}
        """
        resolved = {}

        for key, value in config.items():
            if isinstance(value, str):
                resolved[key] = self._resolve_env_string(value)
            elif isinstance(value, dict):
                resolved[key] = self._resolve_env_vars(value)
            elif isinstance(value, list):
                resolved[key] = [
                    self._resolve_env_string(item) if isinstance(item, str) else item
                    for item in value
                ]
            else:
                resolved[key] = value

        return resolved

    def _resolve_env_string(self, text: str) -> str:
        """
        Resolve ${env.VAR_NAME} in a string.

        Args:
            text: String possibly containing ${env.VAR}

        Returns:
            String with environment variables replaced

        Raises:
            ConnectionConfigError: If environment variable not found

        Example:
            >>> os.environ['DB_URL'] = 'postgres://localhost/db'
            >>> self._resolve_env_string('${env.DB_URL}/schema')
            'postgres://localhost/db/schema'
        """
        # Pattern to match ${env.VAR_NAME}
        pattern = r'\$\{env\.([^}]+)\}'

        def replace_env(match):
            var_name = match.group(1)
            value = os.environ.get(var_name)

            if value is None:
                raise ConnectionConfigError(
                    f"Environment variable '{var_name}' not found"
                )

            return value

        return re.sub(pattern, replace_env, text)

    async def get_connection(self, name: str) -> Any:
        """
        Get an active connection by name.

        This is called by tasks that need a connection.
        Returns a connection object ready for use.

        Args:
            name: Connection name from flow YAML

        Returns:
            Connection object (type depends on plugin)

        Raises:
            ConnectionNotFoundError: If connection name not defined

        Example:
            conn = await manager.get_connection('primary_db')
            # conn is asyncpg.Pool or similar
        """
        if not self._initialized:
            raise ConnectionError(
                "ConnectionManager not initialized. Call initialize() first."
            )

        if name not in self._active_connections:
            available = list(self._active_connections.keys())
            raise ConnectionNotFoundError(
                f"Connection '{name}' not found. "
                f"Available connections: {', '.join(available)}"
            )

        plugin = self._active_connections[name]
        return await plugin.get_connection()

    async def release_connection(self, name: str, connection: Any):
        """
        Release a connection back to the pool.

        This should be called after a task finishes using a connection.

        Args:
            name: Connection name
            connection: The connection object to release
        """
        if name in self._active_connections:
            plugin = self._active_connections[name]
            await plugin.release_connection(connection)

    def get_plugin(self, name: str) -> Optional[ConnectionPlugin]:
        """
        Get the plugin instance for a connection.

        Useful for accessing plugin-specific methods or metadata.

        Args:
            name: Connection name

        Returns:
            ConnectionPlugin instance or None
        """
        return self._active_connections.get(name)

    async def cleanup(self):
        """
        Clean up all connections.

        This should be called after flow execution completes (success or failure).
        Disconnects all active connections and releases resources.
        """
        for name, plugin in self._active_connections.items():
            try:
                await plugin.disconnect()
            except Exception as e:
                # Log error but continue cleanup
                import warnings
                warnings.warn(
                    f"Error disconnecting '{name}': {e}",
                    stacklevel=2
                )

        self._active_connections.clear()
        self._initialized = False

    def is_initialized(self) -> bool:
        """Check if manager has been initialized"""
        return self._initialized

    def list_connections(self) -> list[str]:
        """Get list of active connection names"""
        return list(self._active_connections.keys())

    def __repr__(self):
        return f"ConnectionManager(connections={list(self._active_connections.keys())})"
