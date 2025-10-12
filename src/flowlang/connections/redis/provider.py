"""
Redis Connection Plugin

Provides Redis key-value store connectivity with connection pooling,
built-in cache operations, and scaffolding commands.

Dependencies: redis>=5.0.0
"""
from typing import Any, Dict, List, Callable, Tuple, Optional
from ..base import ConnectionPlugin


class RedisPlugin(ConnectionPlugin):
    """
    Redis key-value store connection plugin.

    Features:
    - Connection pooling with redis-py
    - Built-in tasks: redis_get, redis_set, redis_delete, redis_exists, redis_expire
    - Support for strings, hashes, lists, sets, sorted sets
    - TTL and expiration support
    - Scaffolding commands for quick setup

    Example flow.yaml:
        connections:
          cache:
            type: redis
            url: ${env.REDIS_URL}
            max_connections: 50
            decode_responses: true

        steps:
          - redis_get:
              id: get_user
              connection: cache
              key: "user:${inputs.user_id}"
              outputs:
                - value
    """

    name = "redis"
    description = "Redis key-value store connection with redis-py"
    version = "1.0.0"
    category = "caching"

    def __init__(self):
        """Initialize Redis plugin"""
        super().__init__()
        self._pool = None
        self._client = None

    def get_config_schema(self) -> Dict[str, Any]:
        """Return JSON schema for Redis configuration"""
        return {
            "type": "object",
            "required": ["url"],
            "properties": {
                "url": {
                    "type": "string",
                    "description": "Redis connection URL (redis://[[username]:[password]]@host:port/db)"
                },
                "max_connections": {
                    "type": "integer",
                    "default": 50,
                    "minimum": 1,
                    "maximum": 500,
                    "description": "Maximum number of connections in pool"
                },
                "decode_responses": {
                    "type": "boolean",
                    "default": True,
                    "description": "Decode byte responses to strings"
                },
                "socket_timeout": {
                    "type": "number",
                    "default": 5.0,
                    "minimum": 0.1,
                    "description": "Socket timeout in seconds"
                },
                "socket_connect_timeout": {
                    "type": "number",
                    "default": 5.0,
                    "minimum": 0.1,
                    "description": "Socket connect timeout in seconds"
                }
            }
        }

    def validate_config(self, config: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate Redis configuration"""
        if 'url' not in config:
            return False, "Missing required field: url"

        url = config['url']
        if not (url.startswith('redis://') or url.startswith('rediss://')):
            return False, "URL must start with redis:// or rediss://"

        return True, None

    async def connect(self, config: Dict[str, Any]) -> Any:
        """
        Establish Redis connection pool.

        Args:
            config: Connection configuration

        Returns:
            redis.asyncio.Redis client

        Raises:
            ConnectionError: If connection fails
        """
        try:
            from redis import asyncio as aioredis
        except ImportError:
            raise ImportError(
                "Redis plugin requires 'redis' package. "
                "Install with: pip install redis>=5.0.0"
            )

        self._config = config

        try:
            # Create connection pool
            self._pool = aioredis.ConnectionPool.from_url(
                config['url'],
                max_connections=config.get('max_connections', 50),
                decode_responses=config.get('decode_responses', True),
                socket_timeout=config.get('socket_timeout', 5.0),
                socket_connect_timeout=config.get('socket_connect_timeout', 5.0)
            )

            # Create Redis client
            self._client = aioredis.Redis(connection_pool=self._pool)

            # Test connection
            await self._client.ping()

            return self._client

        except Exception as e:
            raise ConnectionError(f"Failed to connect to Redis: {e}") from e

    async def disconnect(self):
        """Close Redis connection pool"""
        if self._client:
            await self._client.aclose()
            self._client = None

        if self._pool:
            await self._pool.aclose()
            self._pool = None

    async def get_connection(self) -> Any:
        """
        Get Redis client.

        Returns:
            Redis client (connection pooling is handled internally)
        """
        if not self._client:
            raise ConnectionError("Redis client not initialized")

        return self._client

    async def release_connection(self, connection: Any):
        """
        Release connection (no-op for Redis as pooling is internal).

        Args:
            connection: The Redis client
        """
        # Redis handles connection pooling internally
        pass

    def get_builtin_tasks(self) -> Dict[str, Callable]:
        """
        Return built-in Redis tasks.

        These tasks provide zero-boilerplate cache operations in YAML.
        """
        return {
            'redis_get': self._task_get,
            'redis_set': self._task_set,
            'redis_delete': self._task_delete,
            'redis_exists': self._task_exists,
            'redis_expire': self._task_expire,
            'redis_incr': self._task_incr,
            'redis_hgetall': self._task_hgetall,
            'redis_hset': self._task_hset,
        }

    async def _task_get(
        self,
        key: str,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Get value by key.

        Args:
            key: Redis key
            connection: Redis client (injected)

        Returns:
            Dict with 'value' key (None if not found)

        Example YAML:
            - redis_get:
                id: get_cache
                connection: cache
                key: "user:${inputs.user_id}"
                outputs:
                  - value
        """
        try:
            value = await connection.get(key)
            return {'value': value, 'exists': value is not None}

        except Exception as e:
            raise FlowExecutionError(
                f"Redis GET failed: {e}"
            ) from e

    async def _task_set(
        self,
        key: str,
        value: Any,
        ex: Optional[int] = None,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Set key-value pair.

        Args:
            key: Redis key
            value: Value to store
            ex: Optional expiration time in seconds
            connection: Redis client (injected)

        Returns:
            Dict with 'success' boolean

        Example YAML:
            - redis_set:
                id: set_cache
                connection: cache
                key: "user:${inputs.user_id}"
                value: "${fetch_user.data}"
                ex: 3600
                outputs:
                  - success
        """
        try:
            result = await connection.set(key, value, ex=ex)
            return {'success': bool(result)}

        except Exception as e:
            raise FlowExecutionError(
                f"Redis SET failed: {e}"
            ) from e

    async def _task_delete(
        self,
        keys: List[str],
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Delete one or more keys.

        Args:
            keys: List of Redis keys to delete
            connection: Redis client (injected)

        Returns:
            Dict with 'deleted_count' (number of keys deleted)

        Example YAML:
            - redis_delete:
                id: clear_cache
                connection: cache
                keys: ["user:123", "user:456"]
                outputs:
                  - deleted_count
        """
        try:
            count = await connection.delete(*keys)
            return {'deleted_count': count}

        except Exception as e:
            raise FlowExecutionError(
                f"Redis DELETE failed: {e}"
            ) from e

    async def _task_exists(
        self,
        keys: List[str],
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Check if keys exist.

        Args:
            keys: List of Redis keys to check
            connection: Redis client (injected)

        Returns:
            Dict with 'count' (number of keys that exist)

        Example YAML:
            - redis_exists:
                id: check_cache
                connection: cache
                keys: ["user:${inputs.user_id}"]
                outputs:
                  - count
        """
        try:
            count = await connection.exists(*keys)
            return {'count': count, 'exists': count > 0}

        except Exception as e:
            raise FlowExecutionError(
                f"Redis EXISTS failed: {e}"
            ) from e

    async def _task_expire(
        self,
        key: str,
        seconds: int,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Set key expiration.

        Args:
            key: Redis key
            seconds: TTL in seconds
            connection: Redis client (injected)

        Returns:
            Dict with 'success' boolean

        Example YAML:
            - redis_expire:
                id: expire_cache
                connection: cache
                key: "user:${inputs.user_id}"
                seconds: 3600
                outputs:
                  - success
        """
        try:
            result = await connection.expire(key, seconds)
            return {'success': bool(result)}

        except Exception as e:
            raise FlowExecutionError(
                f"Redis EXPIRE failed: {e}"
            ) from e

    async def _task_incr(
        self,
        key: str,
        amount: int = 1,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Increment key value.

        Args:
            key: Redis key
            amount: Amount to increment (default: 1)
            connection: Redis client (injected)

        Returns:
            Dict with 'value' (new value after increment)

        Example YAML:
            - redis_incr:
                id: increment_counter
                connection: cache
                key: "counter:${inputs.metric}"
                amount: 1
                outputs:
                  - value
        """
        try:
            if amount == 1:
                value = await connection.incr(key)
            else:
                value = await connection.incrby(key, amount)

            return {'value': value}

        except Exception as e:
            raise FlowExecutionError(
                f"Redis INCR failed: {e}"
            ) from e

    async def _task_hgetall(
        self,
        key: str,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Get all fields and values in a hash.

        Args:
            key: Redis hash key
            connection: Redis client (injected)

        Returns:
            Dict with 'hash' containing field-value pairs

        Example YAML:
            - redis_hgetall:
                id: get_user_hash
                connection: cache
                key: "user:${inputs.user_id}:profile"
                outputs:
                  - hash
        """
        try:
            hash_data = await connection.hgetall(key)
            return {'hash': hash_data}

        except Exception as e:
            raise FlowExecutionError(
                f"Redis HGETALL failed: {e}"
            ) from e

    async def _task_hset(
        self,
        key: str,
        mapping: Dict[str, Any],
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Set multiple hash fields.

        Args:
            key: Redis hash key
            mapping: Dict of field-value pairs
            connection: Redis client (injected)

        Returns:
            Dict with 'fields_set' (number of fields added)

        Example YAML:
            - redis_hset:
                id: set_user_hash
                connection: cache
                key: "user:${inputs.user_id}:profile"
                mapping:
                  name: "${inputs.name}"
                  email: "${inputs.email}"
                outputs:
                  - fields_set
        """
        try:
            count = await connection.hset(key, mapping=mapping)
            return {'fields_set': count}

        except Exception as e:
            raise FlowExecutionError(
                f"Redis HSET failed: {e}"
            ) from e

    def get_dependencies(self) -> List[str]:
        """Return required pip packages"""
        return ["redis>=5.0.0"]

    def scaffold_connection_config(self, name: str = "cache", **kwargs) -> str:
        """
        Generate Redis connection config YAML snippet.

        Args:
            name: Connection name
            **kwargs: Additional options (max_connections, decode_responses)

        Returns:
            YAML string
        """
        max_connections = kwargs.get('max_connections', 50)
        decode_responses = kwargs.get('decode_responses', True)

        return f"""
  {name}:
    type: redis
    url: ${{env.REDIS_URL}}
    max_connections: {max_connections}
    decode_responses: {str(decode_responses).lower()}
"""

    def scaffold_example_flow(self, output_dir: str, connection_name: str = "cache", **kwargs):
        """
        Generate example flow demonstrating Redis connection.

        Args:
            output_dir: Directory to write example
            connection_name: Connection name to use
        """
        import os

        example = f'''flow: RedisExample
description: Example flow using Redis connection

connections:
  {connection_name}:
    type: redis
    url: ${{env.REDIS_URL}}
    max_connections: 50
    decode_responses: true

inputs:
  - name: user_id
    type: string
    required: true

steps:
  # Check if cached
  - redis_exists:
      id: check_cache
      connection: {connection_name}
      keys: ["user:${{inputs.user_id}}"]
      outputs:
        - exists

  # Get cached value
  - redis_get:
      id: get_cache
      connection: {connection_name}
      key: "user:${{inputs.user_id}}"
      outputs:
        - value

  # Set cache with expiration
  - redis_set:
      id: set_cache
      connection: {connection_name}
      key: "user:${{inputs.user_id}}"
      value: "cached_data"
      ex: 3600
      outputs:
        - success

  # Increment counter
  - redis_incr:
      id: increment
      connection: {connection_name}
      key: "counter:user_lookups"
      amount: 1
      outputs:
        - value

outputs:
  - name: cached
    value: ${{check_cache.exists}}

  - name: data
    value: ${{get_cache.value}}

  - name: lookups
    value: ${{increment.value}}
'''

        os.makedirs(output_dir, exist_ok=True)
        example_path = os.path.join(output_dir, 'redis_example.yaml')

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
