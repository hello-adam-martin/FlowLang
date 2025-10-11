"""
MongoDB Connection Plugin

Provides MongoDB NoSQL database connectivity for FlowLang flows.

Usage in flow.yaml:
    connections:
      db:
        type: mongodb
        url: ${env.MONGODB_URL}
        database: ${env.MONGODB_DATABASE}
        max_pool_size: 100

    steps:
      - mongo_find:
          id: fetch_users
          connection: db
          collection: users
          filter: {active: true}
          outputs:
            - documents

For more examples, run:
    flowlang connection example mongodb
"""
from .provider import MongoDBPlugin
from .. import plugin_registry

# Auto-register plugin
plugin_registry.register(MongoDBPlugin())

# Exports
__all__ = ['MongoDBPlugin']
