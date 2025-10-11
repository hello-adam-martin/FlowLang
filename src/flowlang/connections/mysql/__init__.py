"""
MySQL Connection Plugin

Provides MySQL database connectivity for FlowLang flows.

Usage in flow.yaml:
    connections:
      db:
        type: mysql
        host: ${env.MYSQL_HOST}
        port: 3306
        user: ${env.MYSQL_USER}
        password: ${env.MYSQL_PASSWORD}
        database: ${env.MYSQL_DATABASE}
        pool_size: 10

    steps:
      - mysql_query:
          id: fetch_users
          connection: db
          query: "SELECT * FROM users WHERE active = %s"
          params: [true]
          outputs:
            - rows

For more examples, run:
    flowlang connection example mysql
"""
from .provider import MySQLPlugin
from .. import plugin_registry

# Auto-register plugin
plugin_registry.register(MySQLPlugin())

# Exports
__all__ = ['MySQLPlugin']
