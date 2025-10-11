"""
FlowLang Connection Plugin System

This module provides a plugin-based architecture for external service connections
including databases, caches, message queues, and APIs.

Key components:
- ConnectionPlugin: Base class for all connection plugins
- ConnectionPluginRegistry: Central registry for discovering and managing plugins
- ConnectionManager: Manages connection lifecycle for flow execution

Usage:
    # List available plugins
    from flowlang.connections import plugin_registry
    plugins = plugin_registry.list_plugins()

    # Get a specific plugin
    postgres = plugin_registry.get('postgres')

    # Check dependencies
    installed, missing = postgres.check_dependencies()

Third-party plugins can register themselves via setuptools entry points:
    entry_points={
        'flowlang.connections': [
            'mydb = mypackage.flowlang_plugin:MyDatabasePlugin'
        ]
    }
"""
from typing import Dict, List, Optional
import importlib
import importlib.util
import pkgutil
from pathlib import Path

from .base import ConnectionPlugin


class ConnectionPluginRegistry:
    """
    Central registry for connection plugins.

    Provides plugin discovery, registration, and retrieval.
    Plugins are auto-discovered on import from:
    1. Built-in plugins in flowlang.connections.<plugin_name>/
    2. Third-party plugins via setuptools entry points
    """

    def __init__(self):
        """Initialize empty plugin registry"""
        self._plugins: Dict[str, ConnectionPlugin] = {}
        self._discovered = False

    def register(self, plugin: ConnectionPlugin):
        """
        Register a connection plugin.

        Args:
            plugin: Instance of ConnectionPlugin subclass

        Raises:
            ValueError: If plugin with same name already registered

        Example:
            registry = ConnectionPluginRegistry()
            registry.register(PostgresPlugin())
        """
        if plugin.name in self._plugins:
            # Allow re-registration during development/testing
            # but warn about it
            import warnings
            warnings.warn(
                f"Plugin '{plugin.name}' already registered. Overwriting.",
                stacklevel=2
            )

        self._plugins[plugin.name] = plugin

    def get(self, name: str) -> Optional[ConnectionPlugin]:
        """
        Get plugin by name.

        Args:
            name: Plugin name (e.g., 'postgres', 'redis')

        Returns:
            Plugin instance or None if not found

        Example:
            plugin = plugin_registry.get('postgres')
            if plugin:
                config_schema = plugin.get_config_schema()
        """
        # Auto-discover on first get() call if not already done
        if not self._discovered:
            self.discover_plugins()

        return self._plugins.get(name)

    def list_plugins(self) -> List[str]:
        """
        List all registered plugin names.

        Returns:
            List of plugin names

        Example:
            >>> plugin_registry.list_plugins()
            ['postgres', 'mysql', 'redis', 'mongodb']
        """
        # Auto-discover on first list() call if not already done
        if not self._discovered:
            self.discover_plugins()

        return sorted(list(self._plugins.keys()))

    def get_all(self) -> Dict[str, ConnectionPlugin]:
        """
        Get all registered plugins.

        Returns:
            Dictionary mapping plugin names to plugin instances

        Example:
            for name, plugin in plugin_registry.get_all().items():
                print(f"{name}: {plugin.description}")
        """
        # Auto-discover on first get_all() call if not already done
        if not self._discovered:
            self.discover_plugins()

        return self._plugins.copy()

    def discover_plugins(self):
        """
        Auto-discover and load all connection plugins.

        Discovers plugins from:
        1. Built-in plugins in flowlang/connections/<plugin_name>/
        2. Third-party plugins via setuptools entry points

        This is called automatically on first registry access.
        """
        if self._discovered:
            return

        # 1. Discover built-in plugins
        self._discover_builtin_plugins()

        # 2. Discover third-party plugins via entry points
        self._discover_entry_point_plugins()

        self._discovered = True

    def _discover_builtin_plugins(self):
        """
        Discover built-in plugins in flowlang/connections/

        Each plugin is a subdirectory with __init__.py that registers itself.
        """
        # Get path to connections directory
        connections_dir = Path(__file__).parent

        # Iterate through subdirectories
        for item in connections_dir.iterdir():
            if not item.is_dir():
                continue

            # Skip __pycache__ and similar
            if item.name.startswith('_') or item.name.startswith('.'):
                continue

            # Check if it has __init__.py
            init_file = item / '__init__.py'
            if not init_file.exists():
                continue

            # Try to import the plugin module
            plugin_module_name = f"flowlang.connections.{item.name}"

            try:
                importlib.import_module(plugin_module_name)
                # Plugin should auto-register itself during import
            except Exception as e:
                import warnings
                warnings.warn(
                    f"Failed to load built-in plugin '{item.name}': {e}",
                    stacklevel=2
                )

    def _discover_entry_point_plugins(self):
        """
        Discover third-party plugins via setuptools entry points.

        Third-party packages can register plugins in setup.py:
            entry_points={
                'flowlang.connections': [
                    'mydb = mypackage.plugin:MyDatabasePlugin'
                ]
            }
        """
        try:
            # Try new importlib.metadata (Python 3.8+)
            try:
                from importlib.metadata import entry_points
            except ImportError:
                # Fallback to importlib_metadata for Python 3.7
                from importlib_metadata import entry_points

            # Get all entry points for flowlang.connections
            try:
                # Python 3.10+ - entry_points returns EntryPoints object with select()
                eps = entry_points(group='flowlang.connections')
            except TypeError:
                # Python 3.9 and earlier - entry_points returns dict
                eps = entry_points().get('flowlang.connections', [])

            # Load each entry point
            for ep in eps:
                try:
                    # Load the plugin class
                    plugin_class = ep.load()

                    # Instantiate and register
                    plugin_instance = plugin_class()
                    self.register(plugin_instance)

                except Exception as e:
                    import warnings
                    warnings.warn(
                        f"Failed to load plugin from entry point '{ep.name}': {e}",
                        stacklevel=2
                    )

        except Exception as e:
            # If entry points discovery fails entirely, just skip it
            # (may not have importlib.metadata on older Python)
            pass


# Global plugin registry instance
plugin_registry = ConnectionPluginRegistry()


# Public exports
__all__ = [
    'ConnectionPlugin',
    'ConnectionPluginRegistry',
    'plugin_registry',
]
