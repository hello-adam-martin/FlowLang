# Redis Connection Plugin

Production-ready Redis key-value store integration for FlowLang with caching, counters, and pub/sub support.

## Features

- ✅ Async connection with redis-py
- ✅ 8 built-in tasks for cache operations
- ✅ String, hash, list, set operations
- ✅ TTL and expiration support
- ✅ Configurable connection pooling
- ✅ Environment variable support
- ✅ Automatic connection pooling

## Installation

```bash
pip install redis>=5.0.0
```

Or: `flowlang connection install redis`

## Quick Start

```yaml
connections:
  cache:
    type: redis
    url: ${env.REDIS_URL}
    max_connections: 50
    decode_responses: true

steps:
  - redis_get:
      id: get_cache
      connection: cache
      key: "user:${inputs.user_id}"
      outputs:
        - value
        - exists
```

## Configuration

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `url` | Yes | - | Redis URL (redis://host:port/db) |
| `max_connections` | No | 50 | Max connections in pool |
| `decode_responses` | No | true | Decode bytes to strings |
| `socket_timeout` | No | 5.0 | Socket timeout (seconds) |

## Built-in Tasks

### redis_get - Get value

```yaml
- redis_get:
    id: get_value
    connection: cache
    key: "user:123"
    outputs:
      - value
      - exists
```

### redis_set - Set value with TTL

```yaml
- redis_set:
    id: set_cache
    connection: cache
    key: "user:${inputs.user_id}"
    value: "${fetch_user.data}"
    ex: 3600  # 1 hour TTL
    outputs:
      - success
```

### redis_delete - Delete keys

```yaml
- redis_delete:
    id: clear_cache
    connection: cache
    keys: ["user:123", "user:456"]
    outputs:
      - deleted_count
```

### redis_exists - Check existence

```yaml
- redis_exists:
    id: check_cache
    connection: cache
    keys: ["user:${inputs.user_id}"]
    outputs:
      - count
      - exists
```

### redis_expire - Set expiration

```yaml
- redis_expire:
    id: expire_key
    connection: cache
    key: "session:${inputs.session_id}"
    seconds: 1800  # 30 minutes
    outputs:
      - success
```

### redis_incr - Increment counter

```yaml
- redis_incr:
    id: increment_views
    connection: cache
    key: "views:${inputs.page_id}"
    amount: 1
    outputs:
      - value
```

### redis_hgetall - Get hash

```yaml
- redis_hgetall:
    id: get_profile
    connection: cache
    key: "user:${inputs.user_id}:profile"
    outputs:
      - hash
```

### redis_hset - Set hash fields

```yaml
- redis_hset:
    id: set_profile
    connection: cache
    key: "user:${inputs.user_id}:profile"
    mapping:
      name: "${inputs.name}"
      email: "${inputs.email}"
      updated_at: "${now()}"
    outputs:
      - fields_set
```

## Common Patterns

### Pattern 1: Cache-aside

```yaml
steps:
  # Try cache first
  - redis_get:
      id: get_cache
      connection: cache
      key: "user:${inputs.user_id}"

  # Fetch from DB if not cached
  - task: FetchFromDB
    id: fetch_db
    inputs:
      user_id: "${inputs.user_id}"
    if: "not ${get_cache.exists}"

  # Cache the result
  - redis_set:
      id: set_cache
      connection: cache
      key: "user:${inputs.user_id}"
      value: "${fetch_db.data}"
      ex: 3600
      if: "not ${get_cache.exists}"
```

### Pattern 2: Rate Limiting

```yaml
steps:
  - redis_incr:
      id: check_rate
      connection: cache
      key: "rate:${inputs.user_id}:${now().hour}"
      amount: 1

  - redis_expire:
      id: set_expiry
      connection: cache
      key: "rate:${inputs.user_id}:${now().hour}"
      seconds: 3600

  - task: ProcessRequest
    if: "${check_rate.value <= 100}"  # Max 100 requests/hour
```

### Pattern 3: Session Management

```yaml
steps:
  - redis_hset:
      id: save_session
      connection: cache
      key: "session:${inputs.session_id}"
      mapping:
        user_id: "${inputs.user_id}"
        logged_in_at: "${now()}"

  - redis_expire:
      id: expire_session
      connection: cache
      key: "session:${inputs.session_id}"
      seconds: 1800  # 30 min timeout
```

## Best Practices

1. **Set appropriate TTLs**
   - Short-lived: 60-300 seconds
   - Medium: 1800-3600 seconds
   - Long: 86400+ seconds

2. **Use consistent key patterns**
   ```
   user:{id}
   session:{id}
   cache:{entity}:{id}
   ```

3. **Monitor memory usage**
   ```bash
   redis-cli INFO memory
   ```

4. **Use pipelining for bulk operations**

## Troubleshooting

### Connection Refused
```bash
redis-cli ping  # Test connection
```

### Memory Issues
```bash
redis-cli INFO memory
redis-cli CONFIG GET maxmemory
```

### Key Debugging
```bash
redis-cli KEYS "user:*"  # List keys (don't use in production!)
redis-cli TTL "user:123"  # Check TTL
```

## CLI Commands

```bash
flowlang connection info redis
flowlang connection install redis
flowlang connection scaffold redis
flowlang connection example redis
```

## Related Documentation

- [Database Integration Guide](../../../docs/database-integration.md)
- [Redis Documentation](https://redis.io/docs/)

## License

Part of FlowLang - MIT License
