# Database Integration Guide

FlowLang provides production-ready database integration through connection plugins. This guide shows you how to integrate databases into your workflows.

## Quick Start

### 1. Install Database Plugin Dependencies

```bash
# PostgreSQL
pip install asyncpg>=0.29.0

# MySQL
pip install aiomysql>=0.2.0

# MongoDB
pip install motor>=3.3.0

# Redis
pip install redis>=5.0.0

# SQLite
pip install aiosqlite>=0.19.0

# Or install all at once
pip install asyncpg aiomysql motor redis aiosqlite
```

### 2. Define Connection in flow.yaml

```yaml
connections:
  db:
    type: postgres
    url: ${env.DATABASE_URL}
    pool_size: 10
    timeout: 30
```

### 3. Use Built-in Tasks

```yaml
steps:
  - pg_query:
      id: fetch_users
      connection: db
      query: "SELECT * FROM users WHERE active = $1"
      params: [true]
      outputs:
        - rows
```

## Supported Databases

### PostgreSQL

**Connection Config:**
```yaml
connections:
  db:
    type: postgres
    url: ${env.DATABASE_URL}  # postgres://user:pass@host:port/dbname
    pool_size: 10
    min_pool_size: 1
    timeout: 30
```

**Built-in Tasks:**

**`pg_query`** - Execute SELECT query
```yaml
- pg_query:
    id: fetch_users
    connection: db
    query: "SELECT * FROM users WHERE age > $1"
    params: [18]
    outputs:
      - rows    # List of row dicts
      - count   # Number of rows
```

**`pg_execute`** - Execute INSERT/UPDATE/DELETE
```yaml
- pg_execute:
    id: update_user
    connection: db
    query: "UPDATE users SET active = $1 WHERE id = $2"
    params: [false, 123]
    outputs:
      - rows_affected
```

**`pg_transaction`** - Execute multiple queries atomically
```yaml
- pg_transaction:
    id: transfer
    connection: db
    queries:
      - query: "UPDATE accounts SET balance = balance - $1 WHERE id = $2"
        params: [100, 1]
      - query: "UPDATE accounts SET balance = balance + $1 WHERE id = $2"
        params: [100, 2]
    outputs:
      - results
      - count
```

### MySQL

**Connection Config:**
```yaml
connections:
  db:
    type: mysql
    host: ${env.MYSQL_HOST}
    port: 3306
    user: ${env.MYSQL_USER}
    password: ${env.MYSQL_PASSWORD}
    database: ${env.MYSQL_DATABASE}
    pool_size: 10
    charset: utf8mb4
```

**Built-in Tasks:**

**`mysql_query`** - Execute SELECT query
```yaml
- mysql_query:
    id: fetch_users
    connection: db
    query: "SELECT * FROM users WHERE age > %s"
    params: [18]
    outputs:
      - rows
      - count
```

**`mysql_execute`** - Execute INSERT/UPDATE/DELETE
```yaml
- mysql_execute:
    id: create_user
    connection: db
    query: "INSERT INTO users (name, email) VALUES (%s, %s)"
    params: ["Alice", "alice@example.com"]
    outputs:
      - rows_affected
```

**`mysql_transaction`** - Execute multiple queries atomically
```yaml
- mysql_transaction:
    id: transfer
    connection: db
    queries:
      - query: "UPDATE accounts SET balance = balance - %s WHERE id = %s"
        params: [100, 1]
      - query: "UPDATE accounts SET balance = balance + %s WHERE id = %s"
        params: [100, 2]
    outputs:
      - results
```

### MongoDB

**Connection Config:**
```yaml
connections:
  db:
    type: mongodb
    url: ${env.MONGODB_URL}  # mongodb://host:port or mongodb+srv://...
    database: ${env.MONGODB_DATABASE}
    max_pool_size: 100
    min_pool_size: 0
```

**Built-in Tasks:**

**`mongo_find`** - Find multiple documents
```yaml
- mongo_find:
    id: fetch_users
    connection: db
    collection: users
    filter: {active: true, age: {$gt: 18}}
    sort: [["name", 1]]
    limit: 100
    outputs:
      - documents
      - count
```

**`mongo_find_one`** - Find single document
```yaml
- mongo_find_one:
    id: fetch_user
    connection: db
    collection: users
    filter: {_id: "${inputs.user_id}"}
    outputs:
      - document
      - found
```

**`mongo_insert`** - Insert documents
```yaml
- mongo_insert:
    id: create_user
    connection: db
    collection: users
    documents:
      - name: "${inputs.name}"
        email: "${inputs.email}"
        active: true
    outputs:
      - inserted_ids
      - count
```

**`mongo_update`** - Update documents
```yaml
- mongo_update:
    id: update_user
    connection: db
    collection: users
    filter: {_id: "${inputs.user_id}"}
    update: {$set: {active: false}}
    many: false
    upsert: false
    outputs:
      - matched_count
      - modified_count
      - upserted_id
```

**`mongo_delete`** - Delete documents
```yaml
- mongo_delete:
    id: delete_user
    connection: db
    collection: users
    filter: {_id: "${inputs.user_id}"}
    many: false
    outputs:
      - deleted_count
```

**`mongo_count`** - Count documents
```yaml
- mongo_count:
    id: count_users
    connection: db
    collection: users
    filter: {active: true}
    outputs:
      - count
```

**`mongo_aggregate`** - Run aggregation pipeline
```yaml
- mongo_aggregate:
    id: user_stats
    connection: db
    collection: users
    pipeline:
      - {$match: {active: true}}
      - {$group: {_id: "$country", count: {$sum: 1}}}
      - {$sort: {count: -1}}
    outputs:
      - documents
      - count
```

### Redis

**Connection Config:**
```yaml
connections:
  cache:
    type: redis
    url: ${env.REDIS_URL}  # redis://host:port/db or rediss://... (SSL)
    max_connections: 50
    decode_responses: true
    socket_timeout: 5.0
```

**Built-in Tasks:**

**`redis_get`** - Get value by key
```yaml
- redis_get:
    id: get_cache
    connection: cache
    key: "user:${inputs.user_id}"
    outputs:
      - value
      - exists
```

**`redis_set`** - Set key-value pair
```yaml
- redis_set:
    id: set_cache
    connection: cache
    key: "user:${inputs.user_id}"
    value: "${fetch_user.data}"
    ex: 3600  # TTL in seconds
    outputs:
      - success
```

**`redis_delete`** - Delete keys
```yaml
- redis_delete:
    id: clear_cache
    connection: cache
    keys: ["user:123", "user:456"]
    outputs:
      - deleted_count
```

**`redis_exists`** - Check if keys exist
```yaml
- redis_exists:
    id: check_cache
    connection: cache
    keys: ["user:${inputs.user_id}"]
    outputs:
      - count
      - exists
```

**`redis_expire`** - Set key expiration
```yaml
- redis_expire:
    id: expire_cache
    connection: cache
    key: "user:${inputs.user_id}"
    seconds: 3600
    outputs:
      - success
```

**`redis_incr`** - Increment counter
```yaml
- redis_incr:
    id: increment
    connection: cache
    key: "counter:${inputs.metric}"
    amount: 1
    outputs:
      - value
```

**`redis_hgetall`** - Get all hash fields
```yaml
- redis_hgetall:
    id: get_profile
    connection: cache
    key: "user:${inputs.user_id}:profile"
    outputs:
      - hash
```

**`redis_hset`** - Set multiple hash fields
```yaml
- redis_hset:
    id: set_profile
    connection: cache
    key: "user:${inputs.user_id}:profile"
    mapping:
      name: "${inputs.name}"
      email: "${inputs.email}"
    outputs:
      - fields_set
```

### SQLite

**Connection Config:**
```yaml
connections:
  db:
    type: sqlite
    database: ./data/app.db  # or :memory: for in-memory
    timeout: 5.0
    isolation_level: null  # or DEFERRED, IMMEDIATE, EXCLUSIVE
```

**Built-in Tasks:**

**`sqlite_query`** - Execute SELECT query
```yaml
- sqlite_query:
    id: fetch_users
    connection: db
    query: "SELECT * FROM users WHERE age > ?"
    params: [18]
    outputs:
      - rows
      - count
```

**`sqlite_execute`** - Execute INSERT/UPDATE/DELETE
```yaml
- sqlite_execute:
    id: update_user
    connection: db
    query: "UPDATE users SET active = ? WHERE id = ?"
    params: [false, 123]
    outputs:
      - rows_affected
```

**`sqlite_transaction`** - Execute multiple queries atomically
```yaml
- sqlite_transaction:
    id: transfer
    connection: db
    queries:
      - query: "UPDATE accounts SET balance = balance - ? WHERE id = ?"
        params: [100, 1]
      - query: "UPDATE accounts SET balance = balance + ? WHERE id = ?"
        params: [100, 2]
    outputs:
      - results
      - count
```

## Custom Tasks with Connection Injection

You can create custom tasks that receive database connections automatically:

```python
from flowlang import TaskRegistry

registry = TaskRegistry()

@registry.register('ProcessUsers', description='Process user data')
async def process_users(users: list, connection):
    """
    Custom task that receives connection automatically.

    The 'connection' parameter triggers automatic injection.
    """
    results = []

    for user in users:
        # Use connection directly
        cursor = await connection.execute(
            "UPDATE users SET processed = ? WHERE id = ?",
            [True, user['id']]
        )
        results.append({'id': user['id'], 'rows': cursor.rowcount})

    await connection.commit()

    return {'results': results, 'count': len(results)}
```

Use in flow.yaml:
```yaml
steps:
  - sqlite_query:
      id: fetch_users
      connection: db
      query: "SELECT * FROM users WHERE processed = ?"
      params: [false]
      outputs:
        - rows

  - task: ProcessUsers
    id: process
    connection: db  # Same connection is injected
    inputs:
      users: ${fetch_users.rows}
    outputs:
      - results
```

## Environment Variables

Keep credentials secure using environment variables:

```yaml
connections:
  db:
    type: postgres
    url: ${env.DATABASE_URL}

  cache:
    type: redis
    url: ${env.REDIS_URL}
```

Set in your environment:
```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"
export REDIS_URL="redis://localhost:6379/0"
```

Or use `.env` file:
```
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
REDIS_URL=redis://localhost:6379/0
```

## Connection Pooling

All database plugins use connection pooling for optimal performance:

- **PostgreSQL**: asyncpg connection pool (configurable size)
- **MySQL**: aiomysql connection pool (configurable size)
- **MongoDB**: Motor connection pool (internal)
- **Redis**: redis-py connection pool (internal)
- **SQLite**: Single connection (no pooling needed for file-based)

Configure pool sizes based on your workload:

```yaml
connections:
  db:
    type: postgres
    url: ${env.DATABASE_URL}
    pool_size: 20        # Max connections
    min_pool_size: 5     # Min connections to maintain
    timeout: 30          # Command timeout in seconds
```

## Error Handling

Database operations can fail. Use error handlers:

```yaml
steps:
  - pg_query:
      id: fetch_users
      connection: db
      query: "SELECT * FROM users"
      outputs:
        - rows
      on_error:
        - task: LogError
          inputs:
            error: ${context.last_error}
```

With retries:
```yaml
steps:
  - pg_query:
      id: fetch_users
      connection: db
      query: "SELECT * FROM users"
      outputs:
        - rows
      retry:
        max_attempts: 3
        delay: 1
        backoff: 2
```

## Best Practices

### 1. Use Parameterized Queries

Always use parameterized queries to prevent SQL injection:

```yaml
# Good
- pg_query:
    query: "SELECT * FROM users WHERE id = $1"
    params: [${inputs.user_id}]

# Bad - vulnerable to SQL injection
- pg_query:
    query: "SELECT * FROM users WHERE id = ${inputs.user_id}"
```

### 2. Use Transactions for Multiple Operations

When multiple database operations must succeed together, use transactions:

```yaml
- pg_transaction:
    queries:
      - query: "UPDATE accounts SET balance = balance - $1 WHERE id = $2"
        params: [100, 1]
      - query: "UPDATE accounts SET balance = balance + $1 WHERE id = $2"
        params: [100, 2]
      - query: "INSERT INTO transactions (from_id, to_id, amount) VALUES ($1, $2, $3)"
        params: [1, 2, 100]
```

### 3. Configure Appropriate Pool Sizes

- **Low traffic** (< 10 concurrent requests): pool_size = 5-10
- **Medium traffic** (10-100 concurrent requests): pool_size = 20-50
- **High traffic** (> 100 concurrent requests): pool_size = 50-100

### 4. Use Connection Timeouts

Set reasonable timeouts to prevent hanging:

```yaml
connections:
  db:
    type: postgres
    url: ${env.DATABASE_URL}
    timeout: 30  # 30 second timeout
```

### 5. Keep Credentials Secure

Never hardcode credentials in YAML:

```yaml
# Good
url: ${env.DATABASE_URL}

# Bad
url: "postgresql://user:password123@localhost:5432/mydb"
```

### 6. Use Indexes for Query Performance

Ensure your database tables have appropriate indexes for frequently queried columns.

### 7. Limit Result Sets

Always use LIMIT when querying potentially large datasets:

```yaml
- pg_query:
    query: "SELECT * FROM users ORDER BY created_at DESC LIMIT 100"
```

Or for MongoDB:
```yaml
- mongo_find:
    collection: users
    filter: {}
    limit: 100
```

## CLI Commands

```bash
# List all available database plugins
flowlang connection list

# Show detailed info about a plugin
flowlang connection info postgres

# Check if dependencies are installed
flowlang connection deps postgres --check

# Install plugin dependencies
flowlang connection install postgres

# Generate connection config snippet
flowlang connection scaffold postgres --name primary_db

# Generate example flow
flowlang connection example postgres
```

## Next Steps

- See [Creating Connection Plugins](./creating-connection-plugins.md) to create custom plugins
- See [connections.md](./connections.md) for all available integrations
- See [examples/](../examples/) for complete working examples
