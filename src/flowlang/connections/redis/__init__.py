"""
Redis Connection Plugin

Provides Redis key-value store connectivity for FlowLang flows.

Usage in flow.yaml:
    connections:
      cache:
        type: redis
        url: ${env.REDIS_URL}
        max_connections: 50

    steps:
      - redis_get:
          id: get_cache
          connection: cache
          key: "user:${inputs.user_id}"
          outputs:
            - value

For more examples, run:
    flowlang connection example redis
"""
from .provider import RedisPlugin
from .. import plugin_registry

# Auto-register plugin
plugin_registry.register(RedisPlugin())

# Exports
__all__ = ['RedisPlugin']
