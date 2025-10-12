# MySQL Connection Plugin

Production-ready MySQL database integration for FlowLang with connection pooling, transaction support, and built-in query tasks.

## Features

- ✅ Async connection pooling with aiomysql
- ✅ Built-in tasks for zero-boilerplate CRUD operations
- ✅ Transaction support with automatic rollback
- ✅ Parameterized queries for SQL injection prevention
- ✅ Configurable pool sizes, timeouts, and character sets
- ✅ Environment variable support for secure credentials
- ✅ Comprehensive error handling

## Installation

```bash
pip install aiomysql>=0.2.0
```

Or use the CLI:

```bash
flowlang connection install mysql
```

## Quick Start

### 1. Configure Connection

Add to your `flow.yaml`:

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

### 2. Set Environment Variables

```bash
export MYSQL_HOST="localhost"
export MYSQL_USER="myuser"
export MYSQL_PASSWORD="mypassword"
export MYSQL_DATABASE="mydb"
```

### 3. Use Built-in Tasks

```yaml
steps:
  - mysql_query:
      id: fetch_users
      connection: db
      query: "SELECT * FROM users WHERE active = %s"
      params: [true]
      outputs:
        - rows
        - count
```

## Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `host` | string | Yes | - | MySQL server hostname |
| `port` | integer | No | 3306 | MySQL server port |
| `user` | string | Yes | - | Database user |
| `password` | string | Yes | - | Database password |
| `database` | string | Yes | - | Database name |
| `pool_size` | integer | No | 10 | Maximum connections in pool |
| `min_pool_size` | integer | No | 1 | Minimum connections to maintain |
| `charset` | string | No | utf8mb4 | Character set |
| `autocommit` | boolean | No | false | Enable autocommit mode |

## Built-in Tasks

### mysql_query

Execute SELECT query and return rows.

**Parameters:**
- `query` (string, required) - SQL SELECT query (use %s for params)
- `params` (list, optional) - Query parameters
- `connection` (auto-injected) - Database connection

**Returns:**
- `rows` - List of row dictionaries
- `count` - Number of rows returned

**Example:**

```yaml
- mysql_query:
    id: fetch_active_users
    connection: db
    query: "SELECT id, name, email FROM users WHERE active = %s AND created_at > %s"
    params: [true, "2024-01-01"]
    outputs:
      - rows
      - count
```

**With JOIN:**

```yaml
- mysql_query:
    id: user_orders
    connection: db
    query: |
      SELECT u.name, u.email, COUNT(o.id) as order_count
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.id = %s
      GROUP BY u.id
    params: ["${inputs.user_id}"]
    outputs:
      - rows
```

### mysql_execute

Execute INSERT/UPDATE/DELETE and return affected rows.

**Parameters:**
- `query` (string, required) - SQL query
- `params` (list, optional) - Query parameters
- `connection` (auto-injected) - Database connection

**Returns:**
- `rows_affected` - Number of rows modified

**Example - Insert:**

```yaml
- mysql_execute:
    id: create_user
    connection: db
    query: "INSERT INTO users (name, email, active) VALUES (%s, %s, %s)"
    params: ["${inputs.name}", "${inputs.email}", true]
    outputs:
      - rows_affected
```

**Example - Update:**

```yaml
- mysql_execute:
    id: update_user
    connection: db
    query: "UPDATE users SET name = %s, updated_at = NOW() WHERE id = %s"
    params: ["${inputs.name}", "${inputs.user_id}"]
    outputs:
      - rows_affected
```

**Example - Delete:**

```yaml
- mysql_execute:
    id: delete_inactive
    connection: db
    query: "DELETE FROM users WHERE active = %s AND last_login < DATE_SUB(NOW(), INTERVAL 1 YEAR)"
    params: [false]
    outputs:
      - rows_affected
```

### mysql_transaction

Execute multiple queries in a transaction (all-or-nothing).

**Parameters:**
- `queries` (list, required) - List of {query, params} objects
- `connection` (auto-injected) - Database connection

**Returns:**
- `results` - List of query results
- `count` - Number of queries executed

**Example:**

```yaml
- mysql_transaction:
    id: transfer_funds
    connection: db
    queries:
      - query: "UPDATE accounts SET balance = balance - %s WHERE id = %s"
        params: [100, "${inputs.from_account}"]
      - query: "UPDATE accounts SET balance = balance + %s WHERE id = %s"
        params: [100, "${inputs.to_account}"]
      - query: "INSERT INTO transactions (from_id, to_id, amount, created_at) VALUES (%s, %s, %s, NOW())"
        params: ["${inputs.from_account}", "${inputs.to_account}", 100]
    outputs:
      - results
```

## Custom Tasks with Connection Injection

```python
from flowlang import TaskRegistry

registry = TaskRegistry()

@registry.register('GetUserWithOrders', description='Get user with order history')
async def get_user_with_orders(user_id: int, connection):
    """
    The 'connection' parameter triggers automatic injection.
    """
    async with connection.cursor() as cursor:
        # Get user
        await cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        columns = [desc[0] for desc in cursor.description]
        user_row = await cursor.fetchone()

        if not user_row:
            return {'user': None, 'orders': []}

        user = dict(zip(columns, user_row))

        # Get orders
        await cursor.execute(
            "SELECT * FROM orders WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,)
        )
        columns = [desc[0] for desc in cursor.description]
        order_rows = await cursor.fetchall()
        orders = [dict(zip(columns, row)) for row in order_rows]

        return {
            'user': user,
            'orders': orders
        }
```

## Best Practices

### 1. Always Use Parameterized Queries

✅ **Good:**
```yaml
query: "SELECT * FROM users WHERE id = %s"
params: ["${inputs.user_id}"]
```

❌ **Bad (SQL Injection Risk):**
```yaml
query: "SELECT * FROM users WHERE id = ${inputs.user_id}"
```

### 2. Use utf8mb4 for Full Unicode Support

```yaml
connections:
  db:
    type: mysql
    charset: utf8mb4  # Supports emojis and all Unicode characters
```

### 3. Configure Appropriate Pool Sizes

- **Low traffic**: `pool_size: 5-10`
- **Medium traffic**: `pool_size: 20-50`
- **High traffic**: `pool_size: 50-100`

### 4. Use Indexes for Performance

```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_user_id_created ON orders(user_id, created_at);
```

### 5. Limit Large Result Sets

```yaml
- mysql_query:
    query: "SELECT * FROM logs ORDER BY created_at DESC LIMIT 100"
```

## Common Patterns

### Pattern 1: Insert with Last Insert ID

```yaml
- mysql_query:
    id: create_user
    connection: db
    query: "INSERT INTO users (name, email) VALUES (%s, %s)"
    params: ["${inputs.name}", "${inputs.email}"]
    outputs:
      - rows_affected

# Get the last inserted ID
- mysql_query:
    id: get_new_id
    connection: db
    query: "SELECT LAST_INSERT_ID() as id"
    outputs:
      - rows
```

### Pattern 2: Upsert (INSERT ... ON DUPLICATE KEY UPDATE)

```yaml
- mysql_execute:
    id: upsert_user
    connection: db
    query: |
      INSERT INTO users (email, name, login_count)
      VALUES (%s, %s, 1)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        login_count = login_count + 1,
        last_login = NOW()
    params: ["${inputs.email}", "${inputs.name}"]
```

### Pattern 3: Conditional Update

```yaml
- mysql_execute:
    id: increment_if_positive
    connection: db
    query: "UPDATE accounts SET balance = balance + %s WHERE id = %s AND balance + %s >= 0"
    params: ["${inputs.amount}", "${inputs.account_id}", "${inputs.amount}"]
```

## Error Handling

### With Retry Logic

```yaml
- mysql_query:
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
- mysql_execute:
    id: update_user
    connection: db
    query: "UPDATE users SET name = %s WHERE id = %s"
    params: ["${inputs.name}", "${inputs.user_id}"]
    on_error:
      - task: LogError
        inputs:
          error: "${context.last_error}"
```

## Performance Optimization

### 1. Use EXPLAIN

```sql
EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';
```

### 2. Monitor Connection Pool

```sql
SHOW STATUS LIKE 'Threads_connected';
SHOW STATUS LIKE 'Max_used_connections';
```

### 3. Enable Query Logging (Development)

Add to `my.cnf`:

```ini
general_log = 1
general_log_file = /var/log/mysql/query.log
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2
```

## Troubleshooting

### Connection Refused

```
ConnectionError: Failed to connect to MySQL
```

**Solutions:**
- Verify MySQL is running: `systemctl status mysql`
- Check host/port configuration
- Verify firewall rules
- Check MySQL error log

### Authentication Failed

```
ConnectionError: Access denied for user
```

**Solutions:**
- Verify username/password
- Check user permissions:
  ```sql
  SHOW GRANTS FOR 'username'@'host';
  ```
- Create user if needed:
  ```sql
  CREATE USER 'username'@'%' IDENTIFIED BY 'password';
  GRANT ALL PRIVILEGES ON dbname.* TO 'username'@'%';
  FLUSH PRIVILEGES;
  ```

### Character Encoding Issues

**Solution - Use utf8mb4:**
```yaml
connections:
  db:
    charset: utf8mb4
```

## CLI Commands

```bash
# Show plugin information
flowlang connection info mysql

# Check dependencies
flowlang connection deps mysql --check

# Install dependencies
flowlang connection install mysql

# Generate connection config
flowlang connection scaffold mysql --name primary_db

# Generate example flow
flowlang connection example mysql
```

## Example Flow

```yaml
flow: MySQLUserManager
description: Complete user management with MySQL

connections:
  db:
    type: mysql
    host: ${env.MYSQL_HOST}
    user: ${env.MYSQL_USER}
    password: ${env.MYSQL_PASSWORD}
    database: ${env.MYSQL_DATABASE}
    pool_size: 20
    charset: utf8mb4

inputs:
  - name: email
    type: string
    required: true

steps:
  # Check if user exists
  - mysql_query:
      id: check_user
      connection: db
      query: "SELECT id, name FROM users WHERE email = %s"
      params: ["${inputs.email}"]
      outputs:
        - rows

  # Create if not exists
  - mysql_execute:
      id: create_user
      connection: db
      query: "INSERT INTO users (email, name, created_at) VALUES (%s, %s, NOW())"
      params: ["${inputs.email}", "New User"]
      if: "${len(check_user.rows) == 0}"

  # Update last login
  - mysql_execute:
      id: update_login
      connection: db
      query: "UPDATE users SET last_login = NOW() WHERE email = %s"
      params: ["${inputs.email}"]
      if: "${len(check_user.rows) > 0}"

  # Get final user data
  - mysql_query:
      id: get_user
      connection: db
      query: "SELECT * FROM users WHERE email = %s"
      params: ["${inputs.email}"]
      outputs:
        - rows

outputs:
  - name: user
    value: "${get_user.rows[0]}"
  - name: was_created
    value: "${len(check_user.rows) == 0}"
```

## Related Documentation

- [Database Integration Guide](../../../docs/database-integration.md)
- [Creating Connection Plugins](../../../docs/creating-connection-plugins.md)
- [FlowLang Documentation](../../../README.md)

## License

Part of FlowLang - MIT License
