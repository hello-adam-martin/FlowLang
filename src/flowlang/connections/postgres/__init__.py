"""
PostgreSQL Connection Plugin

Provides PostgreSQL database connectivity for FlowLang flows.

Usage in flow.yaml:
    connections:
      db:
        type: postgres
        url: ${env.DATABASE_URL}
        pool_size: 10

    steps:
      - pg_query:
          id: fetch_users
          connection: db
          query: "SELECT * FROM users WHERE active = true"
          outputs:
            - rows

For more examples, run:
    flowlang connection example postgres
"""
from .provider import PostgresPlugin
from .. import plugin_registry

# Auto-register plugin
plugin_registry.register(PostgresPlugin())

# Exports
__all__ = ['PostgresPlugin']
