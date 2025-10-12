# PostgreSQL Connection Plugin

Production-ready PostgreSQL database integration for FlowLang with connection pooling, transaction support, and built-in query tasks.

## Features

- ✅ Async connection pooling with asyncpg
- ✅ Built-in tasks for zero-boilerplate CRUD operations
- ✅ Transaction support with automatic rollback
- ✅ Parameterized queries for SQL injection prevention
- ✅ Configurable pool sizes and timeouts
- ✅ Environment variable support for secure credentials
- ✅ Comprehensive error handling

## Installation

```bash
pip install asyncpg>=0.29.0
```

Or use the CLI:

```bash
flowlang connection install postgres
```

## Quick Start

### 1. Configure Connection

Add to your `flow.yaml`:

```yaml
connections:
  db:
    type: postgres
    url: ${env.DATABASE_URL}
    pool_size: 10
    timeout: 30
```

### 2. Set Environment Variables

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
```

Or use `.env` file:

```
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
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
        - count
```

## Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `url` | string | Yes | - | PostgreSQL connection URL |
| `pool_size` | integer | No | 10 | Maximum connections in pool |
| `min_pool_size` | integer | No | 1 | Minimum connections to maintain |
| `timeout` | integer | No | 30 | Command timeout in seconds |

### Connection URL Format

```
postgresql://username:password@hostname:port/database
```

## Built-in Tasks

### pg_query

Execute SELECT query and return rows.

**Parameters:**
- `query` (string, required) - SQL SELECT query (use $1, $2 for params)
- `params` (list, optional) - Query parameters
- `connection` (auto-injected) - Database connection

**Returns:**
- `rows` - List of row dictionaries
- `count` - Number of rows returned

**Example:**

```yaml
- pg_query:
    id: fetch_active_users
    connection: db
    query: "SELECT id, name, email FROM users WHERE active = $1 AND created_at > $2"
    params: [true, "2024-01-01"]
    outputs:
      - rows
      - count
```

**With Complex Conditions:**

```yaml
- pg_query:
    id: search_users
    connection: db
    query: |
      SELECT u.*, COUNT(o.id) as order_count
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.name ILIKE $1
      GROUP BY u.id
      ORDER BY order_count DESC
      LIMIT $2
    params: ["%${inputs.search}%", 10]
    outputs:
      - rows
```

### pg_execute

Execute INSERT/UPDATE/DELETE and return affected rows.

**Parameters:**
- `query` (string, required) - SQL query
- `params` (list, optional) - Query parameters
- `connection` (auto-injected) - Database connection

**Returns:**
- `rows_affected` - Number of rows modified

**Example - Insert:**

```yaml
- pg_execute:
    id: create_user
    connection: db
    query: "INSERT INTO users (name, email, active) VALUES ($1, $2, $3)"
    params: ["${inputs.name}", "${inputs.email}", true]
    outputs:
      - rows_affected
```

**Example - Update:**

```yaml
- pg_execute:
    id: deactivate_user
    connection: db
    query: "UPDATE users SET active = $1, updated_at = NOW() WHERE id = $2"
    params: [false, "${inputs.user_id}"]
    outputs:
      - rows_affected
```

**Example - Delete:**

```yaml
- pg_execute:
    id: delete_old_logs
    connection: db
    query: "DELETE FROM logs WHERE created_at < NOW() - INTERVAL '30 days'"
    outputs:
      - rows_affected
```

### pg_transaction

Execute multiple queries in a transaction (all-or-nothing).

**Parameters:**
- `queries` (list, required) - List of {query, params} objects
- `connection` (auto-injected) - Database connection

**Returns:**
- `results` - List of query results
- `count` - Number of queries executed

**Example - Money Transfer:**

```yaml
- pg_transaction:
    id: transfer_funds
    connection: db
    queries:
      - query: "UPDATE accounts SET balance = balance - $1 WHERE id = $2"
        params: [100, "${inputs.from_account}"]
      - query: "UPDATE accounts SET balance = balance + $1 WHERE id = $2"
        params: [100, "${inputs.to_account}"]
      - query: "INSERT INTO transactions (from_id, to_id, amount) VALUES ($1, $2, $3)"
        params: ["${inputs.from_account}", "${inputs.to_account}", 100]
    outputs:
      - results
```

**Note:** If any query fails, all changes are rolled back automatically.

## Custom Tasks with Connection Injection

Create custom tasks that receive the database connection automatically:

```python
from flowlang import TaskRegistry

registry = TaskRegistry()

@registry.register('GetUserStats', description='Get user statistics')
async def get_user_stats(user_id: int, connection):
    """
    The 'connection' parameter triggers automatic injection.
    """
    query = """
        SELECT
            u.name,
            COUNT(DISTINCT o.id) as order_count,
            SUM(o.total) as total_spent
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        WHERE u.id = $1
        GROUP BY u.id, u.name
    """

    result = await connection.fetchrow(query, user_id)

    return {
        'stats': dict(result) if result else None
    }
```

Use in flow:

```yaml
steps:
  - task: GetUserStats
    id: get_stats
    connection: db
    inputs:
      user_id: "${inputs.user_id}"
    outputs:
      - stats
```

## Best Practices

### 1. Always Use Parameterized Queries

✅ **Good:**
```yaml
query: "SELECT * FROM users WHERE id = $1"
params: ["${inputs.user_id}"]
```

❌ **Bad (SQL Injection Risk):**
```yaml
query: "SELECT * FROM users WHERE id = ${inputs.user_id}"
```

### 2. Use Transactions for Related Operations

When multiple operations must succeed together:

```yaml
- pg_transaction:
    queries:
      - query: "INSERT INTO orders (user_id, total) VALUES ($1, $2)"
        params: ["${inputs.user_id}", "${inputs.total}"]
      - query: "UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2"
        params: ["${inputs.quantity}", "${inputs.product_id}"]
```

### 3. Configure Appropriate Pool Sizes

- **Low traffic** (< 10 concurrent requests): `pool_size: 5-10`
- **Medium traffic** (10-100 requests): `pool_size: 20-50`
- **High traffic** (> 100 requests): `pool_size: 50-100`

### 4. Use Indexes for Frequently Queried Columns

```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

### 5. Limit Large Result Sets

```yaml
- pg_query:
    query: "SELECT * FROM logs ORDER BY created_at DESC LIMIT 100"
```

### 6. Use Connection Timeouts

```yaml
connections:
  db:
    type: postgres
    url: ${env.DATABASE_URL}
    timeout: 30  # Prevent long-running queries
```

## Common Patterns

### Pattern 1: Check Existence Before Insert

```yaml
steps:
  - pg_query:
      id: check_user
      connection: db
      query: "SELECT id FROM users WHERE email = $1"
      params: ["${inputs.email}"]
      outputs:
        - rows

  - pg_execute:
      id: create_user
      connection: db
      query: "INSERT INTO users (name, email) VALUES ($1, $2)"
      params: ["${inputs.name}", "${inputs.email}"]
      if: "${len(check_user.rows) == 0}"
```

### Pattern 2: Update with RETURNING

```yaml
- pg_query:
    id: update_user
    connection: db
    query: "UPDATE users SET name = $1 WHERE id = $2 RETURNING *"
    params: ["${inputs.name}", "${inputs.user_id}"]
    outputs:
      - rows
```

### Pattern 3: Bulk Operations

```yaml
- pg_execute:
    id: bulk_update
    connection: db
    query: "UPDATE products SET active = true WHERE id = ANY($1::int[])"
    params: [[1, 2, 3, 4, 5]]
```

## Error Handling

### With Retry Logic

```yaml
- pg_query:
    id: fetch_users
    connection: db
    query: "SELECT * FROM users"
    retry:
      max_attempts: 3
      delay: 1
      backoff: 2
```

### With Error Handler

```yaml
- pg_query:
    id: fetch_users
    connection: db
    query: "SELECT * FROM users"
    on_error:
      - task: LogError
        inputs:
          error: "${context.last_error}"
          query: "fetch_users"
```

## Performance Optimization

### 1. Use EXPLAIN ANALYZE

```sql
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
```

### 2. Monitor Connection Pool

```sql
SELECT
    count(*) as active_connections,
    max_conn as max_connections
FROM pg_stat_activity
CROSS JOIN (SELECT setting::int as max_conn FROM pg_settings WHERE name = 'max_connections') s;
```

### 3. Enable Query Logging (Development)

Add to `postgresql.conf`:

```
log_statement = 'all'
log_duration = on
```

## Troubleshooting

### Connection Refused

```
ConnectionError: Failed to connect to PostgreSQL
```

**Solutions:**
- Verify PostgreSQL is running: `pg_isready`
- Check connection URL format
- Verify firewall/security group rules
- Check PostgreSQL logs

### Pool Exhausted

```
TimeoutError: Could not acquire connection from pool
```

**Solutions:**
- Increase `pool_size` in configuration
- Check for connection leaks (not releasing connections)
- Monitor slow queries with `log_min_duration_statement`
- Scale horizontally (add more instances)

### SSL Required

```
ConnectionError: SSL required
```

**Solution - Add SSL to URL:**
```
postgresql://user:pass@host:5432/db?sslmode=require
```

## CLI Commands

```bash
# Show plugin information
flowlang connection info postgres

# Check dependencies
flowlang connection deps postgres --check

# Install dependencies
flowlang connection install postgres

# Generate connection config
flowlang connection scaffold postgres --name primary_db

# Generate example flow
flowlang connection example postgres
```

## Examples

### Complete User Management Flow

```yaml
flow: UserManager
description: Manage users with PostgreSQL

connections:
  db:
    type: postgres
    url: ${env.DATABASE_URL}
    pool_size: 20

inputs:
  - name: action
    type: string
    required: true
  - name: user_id
    type: integer
  - name: name
    type: string
  - name: email
    type: string

steps:
  # Create user
  - pg_execute:
      id: create
      connection: db
      query: "INSERT INTO users (name, email, created_at) VALUES ($1, $2, NOW()) RETURNING id"
      params: ["${inputs.name}", "${inputs.email}"]
      if: "${inputs.action == 'create'}"

  # Get user
  - pg_query:
      id: get
      connection: db
      query: "SELECT * FROM users WHERE id = $1"
      params: ["${inputs.user_id}"]
      if: "${inputs.action == 'get'}"

  # Update user
  - pg_execute:
      id: update
      connection: db
      query: "UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2"
      params: ["${inputs.name}", "${inputs.user_id}"]
      if: "${inputs.action == 'update'}"

  # Delete user
  - pg_execute:
      id: delete
      connection: db
      query: "DELETE FROM users WHERE id = $1"
      params: ["${inputs.user_id}"]
      if: "${inputs.action == 'delete'}"

outputs:
  - name: result
    value: "${get.rows[0] if inputs.action == 'get' else 'Success'}"
```

## Related Documentation

- [Database Integration Guide](../../../docs/database-integration.md)
- [Creating Connection Plugins](../../../docs/creating-connection-plugins.md)
- [FlowLang Documentation](../../../README.md)

## License

Part of FlowLang - MIT License
