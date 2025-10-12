# SQLite Connection Plugin

Production-ready SQLite embedded database integration for FlowLang with connection pooling, transaction support, and built-in query tasks.

## Features

- ✅ Async connection with aiosqlite
- ✅ Built-in tasks for zero-boilerplate CRUD operations
- ✅ Transaction support with automatic rollback
- ✅ Parameterized queries for SQL injection prevention
- ✅ File-based and in-memory database support
- ✅ Foreign key enforcement
- ✅ Comprehensive error handling

## Installation

```bash
pip install aiosqlite>=0.19.0
```

Or: `flowlang connection install sqlite`

## Quick Start

### 1. Configure Connection

Add to your `flow.yaml`:

```yaml
connections:
  db:
    type: sqlite
    database: ./data/myapp.db
    check_same_thread: false
    timeout: 5.0
    enable_foreign_keys: true
```

### 2. Use Built-in Tasks

```yaml
steps:
  - sqlite_query:
      id: fetch_users
      connection: db
      query: "SELECT * FROM users WHERE active = ?"
      params: [1]
      outputs:
        - rows
        - count
```

## Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `database` | string | Yes | - | Path to database file or `:memory:` |
| `check_same_thread` | boolean | No | false | SQLite thread safety check |
| `timeout` | float | No | 5.0 | Database lock timeout (seconds) |
| `enable_foreign_keys` | boolean | No | true | Enable foreign key constraints |

### Database Path Options

```yaml
# File-based database
database: ./data/myapp.db

# In-memory database
database: ":memory:"

# Absolute path
database: /var/data/myapp.db

# Environment variable
database: ${env.SQLITE_DB_PATH}
```

## Built-in Tasks

### sqlite_query

Execute SELECT query and return rows.

**Parameters:**
- `query` (string, required) - SQL SELECT query (use ? for params)
- `params` (list, optional) - Query parameters
- `connection` (auto-injected) - Database connection

**Returns:**
- `rows` - List of row dictionaries
- `count` - Number of rows returned

**Example:**

```yaml
- sqlite_query:
    id: fetch_active_users
    connection: db
    query: "SELECT id, name, email FROM users WHERE active = ? AND created_at > ?"
    params: [1, "2024-01-01"]
    outputs:
      - rows
      - count
```

**With JOIN:**

```yaml
- sqlite_query:
    id: user_orders
    connection: db
    query: |
      SELECT u.name, u.email, COUNT(o.id) as order_count
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.id = ?
      GROUP BY u.id
    params: ["${inputs.user_id}"]
    outputs:
      - rows
```

### sqlite_execute

Execute INSERT/UPDATE/DELETE and return affected rows.

**Parameters:**
- `query` (string, required) - SQL query
- `params` (list, optional) - Query parameters
- `connection` (auto-injected) - Database connection

**Returns:**
- `rows_affected` - Number of rows modified
- `last_row_id` - ID of last inserted row (INSERT only)

**Example - Insert:**

```yaml
- sqlite_execute:
    id: create_user
    connection: db
    query: "INSERT INTO users (name, email, active) VALUES (?, ?, ?)"
    params: ["${inputs.name}", "${inputs.email}", 1]
    outputs:
      - rows_affected
      - last_row_id
```

**Example - Update:**

```yaml
- sqlite_execute:
    id: update_user
    connection: db
    query: "UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?"
    params: ["${inputs.name}", "${inputs.user_id}"]
    outputs:
      - rows_affected
```

**Example - Delete:**

```yaml
- sqlite_execute:
    id: delete_inactive
    connection: db
    query: "DELETE FROM users WHERE active = 0 AND last_login < date('now', '-1 year')"
    outputs:
      - rows_affected
```

### sqlite_transaction

Execute multiple queries in a transaction (all-or-nothing).

**Parameters:**
- `queries` (list, required) - List of {query, params} objects
- `connection` (auto-injected) - Database connection

**Returns:**
- `results` - List of query results
- `count` - Number of queries executed

**Example:**

```yaml
- sqlite_transaction:
    id: transfer_funds
    connection: db
    queries:
      - query: "UPDATE accounts SET balance = balance - ? WHERE id = ?"
        params: [100, "${inputs.from_account}"]
      - query: "UPDATE accounts SET balance = balance + ? WHERE id = ?"
        params: [100, "${inputs.to_account}"]
      - query: "INSERT INTO transactions (from_id, to_id, amount, created_at) VALUES (?, ?, ?, datetime('now'))"
        params: ["${inputs.from_account}", "${inputs.to_account}", 100]
    outputs:
      - results
```

## Best Practices

### 1. Always Use Parameterized Queries

✅ **Good:**
```yaml
query: "SELECT * FROM users WHERE id = ?"
params: ["${inputs.user_id}"]
```

❌ **Bad (SQL Injection Risk):**
```yaml
query: "SELECT * FROM users WHERE id = ${inputs.user_id}"
```

### 2. Enable Foreign Keys

```yaml
connections:
  db:
    type: sqlite
    database: ./data/myapp.db
    enable_foreign_keys: true  # Enforce referential integrity
```

### 3. Use Appropriate Database Type

- **Development/Testing**: `:memory:` for fast in-memory database
- **Production**: File-based database with regular backups
- **Embedded Apps**: Local file in app directory

### 4. Handle Database Locks

```yaml
connections:
  db:
    timeout: 10.0  # Wait up to 10 seconds for locks
```

### 5. Use Indexes for Performance

```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

## Common Patterns

### Pattern 1: In-Memory Testing Database

```yaml
connections:
  test_db:
    type: sqlite
    database: ":memory:"
    enable_foreign_keys: true

steps:
  # Create schema
  - sqlite_execute:
      id: create_schema
      connection: test_db
      query: |
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL
        )

  # Run tests
  - sqlite_execute:
      id: insert_test_data
      connection: test_db
      query: "INSERT INTO users (name, email) VALUES (?, ?)"
      params: ["Test User", "test@example.com"]
```

### Pattern 2: Upsert (INSERT OR REPLACE)

```yaml
- sqlite_execute:
    id: upsert_user
    connection: db
    query: |
      INSERT INTO users (id, name, email, login_count)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        email = excluded.email,
        login_count = login_count + 1,
        last_login = datetime('now')
    params: ["${inputs.user_id}", "${inputs.name}", "${inputs.email}"]
```

### Pattern 3: Conditional Update

```yaml
- sqlite_execute:
    id: increment_if_positive
    connection: db
    query: |
      UPDATE accounts 
      SET balance = balance + ? 
      WHERE id = ? AND balance + ? >= 0
    params: ["${inputs.amount}", "${inputs.account_id}", "${inputs.amount}"]
```

### Pattern 4: Backup Database

```yaml
- sqlite_execute:
    id: backup_db
    connection: db
    query: "VACUUM INTO '${inputs.backup_path}'"
```

## SQLite-Specific Features

### Date/Time Functions

```yaml
# Current timestamp
query: "INSERT INTO logs (message, created_at) VALUES (?, datetime('now'))"

# Date arithmetic
query: "SELECT * FROM events WHERE date > date('now', '-7 days')"

# Format timestamp
query: "SELECT strftime('%Y-%m-%d', created_at) as date FROM users"
```

### JSON Support (SQLite 3.38+)

```yaml
# Store JSON
- sqlite_execute:
    query: "INSERT INTO settings (key, value) VALUES (?, json(?))"
    params: ["config", "{\"theme\": \"dark\"}"]

# Query JSON
- sqlite_query:
    query: "SELECT json_extract(value, '$.theme') as theme FROM settings WHERE key = ?"
    params: ["config"]
```

### Full-Text Search

```sql
-- Create FTS table
CREATE VIRTUAL TABLE documents_fts USING fts5(title, content);

-- Insert data
INSERT INTO documents_fts (title, content) VALUES ('Guide', 'FlowLang tutorial');

-- Search
SELECT * FROM documents_fts WHERE documents_fts MATCH 'tutorial';
```

## Error Handling

### With Retry Logic

```yaml
- sqlite_query:
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
- sqlite_execute:
    id: update_user
    connection: db
    query: "UPDATE users SET name = ? WHERE id = ?"
    params: ["${inputs.name}", "${inputs.user_id}"]
    on_error:
      - task: LogError
        inputs:
          error: "${context.last_error}"
```

## Performance Optimization

### 1. Use WAL Mode (Write-Ahead Logging)

```sql
-- Enable WAL for better concurrency
PRAGMA journal_mode=WAL;
```

### 2. Optimize Queries

```sql
-- Use EXPLAIN QUERY PLAN
EXPLAIN QUERY PLAN SELECT * FROM users WHERE email = 'test@example.com';
```

### 3. Batch Inserts

```yaml
- sqlite_transaction:
    queries:
      - query: "INSERT INTO users (name, email) VALUES (?, ?)"
        params: ["User 1", "user1@example.com"]
      - query: "INSERT INTO users (name, email) VALUES (?, ?)"
        params: ["User 2", "user2@example.com"]
      # ... more inserts
```

### 4. Use Prepared Statements (Automatic)

FlowLang automatically uses prepared statements for all queries.

## Troubleshooting

### Database Locked

```
sqlite3.OperationalError: database is locked
```

**Solutions:**
- Increase timeout: `timeout: 30.0`
- Enable WAL mode: `PRAGMA journal_mode=WAL;`
- Ensure connections are properly closed
- Check for long-running transactions

### Foreign Key Violation

```
FOREIGN KEY constraint failed
```

**Solutions:**
- Verify foreign keys are enabled: `enable_foreign_keys: true`
- Check referenced records exist
- Use transactions for related inserts

### File Permission Issues

```
unable to open database file
```

**Solutions:**
- Check file path exists and is writable
- Verify directory permissions
- Use absolute paths

## CLI Commands

```bash
# Show plugin information
flowlang connection info sqlite

# Check dependencies
flowlang connection deps sqlite --check

# Install dependencies
flowlang connection install sqlite

# Generate connection config
flowlang connection scaffold sqlite --name local_db

# Generate example flow
flowlang connection example sqlite
```

## Example Flow

```yaml
flow: SQLiteUserManager
description: Complete user management with SQLite

connections:
  db:
    type: sqlite
    database: ./data/users.db
    enable_foreign_keys: true
    timeout: 10.0

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
  # Create schema if needed
  - sqlite_execute:
      id: create_table
      connection: db
      query: |
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )

  # Create user
  - sqlite_execute:
      id: create
      connection: db
      query: "INSERT INTO users (name, email) VALUES (?, ?)"
      params: ["${inputs.name}", "${inputs.email}"]
      if: "${inputs.action == 'create'}"
      outputs:
        - last_row_id

  # Get user
  - sqlite_query:
      id: get
      connection: db
      query: "SELECT * FROM users WHERE id = ?"
      params: ["${inputs.user_id}"]
      if: "${inputs.action == 'get'}"
      outputs:
        - rows

  # Update user
  - sqlite_execute:
      id: update
      connection: db
      query: "UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?"
      params: ["${inputs.name}", "${inputs.user_id}"]
      if: "${inputs.action == 'update'}"

  # Delete user
  - sqlite_execute:
      id: delete
      connection: db
      query: "DELETE FROM users WHERE id = ?"
      params: ["${inputs.user_id}"]
      if: "${inputs.action == 'delete'}"

outputs:
  - name: result
    value: "${get.rows[0] if inputs.action == 'get' else create.last_row_id if inputs.action == 'create' else 'Success'}"
```

## Related Documentation

- [Database Integration Guide](../../../docs/database-integration.md)
- [Creating Connection Plugins](../../../docs/creating-connection-plugins.md)
- [SQLite Documentation](https://www.sqlite.org/docs.html)

## License

Part of FlowLang - MIT License
