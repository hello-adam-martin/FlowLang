"""
SQLite Connection Plugin

Provides SQLite database connectivity for FlowLang flows.

Usage in flow.yaml:
    connections:
      db:
        type: sqlite
        database: ${env.DATABASE_PATH}

    steps:
      - sqlite_query:
          id: fetch_users
          connection: db
          query: "SELECT * FROM users WHERE active = ?"
          params: [true]
          outputs:
            - rows

For more examples, run:
    flowlang connection example sqlite
"""
from .provider import SQLitePlugin
from .. import plugin_registry

# Auto-register plugin
plugin_registry.register(SQLitePlugin())

# Exports
__all__ = ['SQLitePlugin']
