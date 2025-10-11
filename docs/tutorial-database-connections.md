# Tutorial: Your First Database-Backed Flow

This tutorial will walk you through creating your first FlowLang flow that uses a database connection. We'll build a simple user management workflow using PostgreSQL and Redis for caching.

**What you'll learn:**
- How to set up database connections
- Using built-in database tasks
- Creating custom tasks with connection injection
- Implementing caching patterns
- Testing your database flow

**Time to complete:** 15-20 minutes

## Prerequisites

- Python 3.8 or higher
- FlowLang installed (`pip install flowlang`)
- PostgreSQL database (or Docker)
- Redis server (or Docker)

## Step 1: Set Up Your Databases

### Option A: Using Docker (Recommended)

```bash
# Start PostgreSQL
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_DB=users_db \
  -p 5432:5432 \
  postgres:16

# Start Redis
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7

# Verify they're running
docker ps
```

### Option B: Using Local Installation

If you have PostgreSQL and Redis installed locally, make sure they're running:

```bash
# Check PostgreSQL (macOS with Homebrew)
brew services list | grep postgresql

# Check Redis
brew services list | grep redis
```

## Step 2: Install Database Plugin Dependencies

```bash
# Install PostgreSQL driver
pip install asyncpg>=0.29.0

# Install Redis driver
pip install redis>=5.0.0
```

Verify installation:

```bash
flowlang connection list
```

You should see PostgreSQL and Redis plugins with ✅ checkmarks.

## Step 3: Create the Database Schema

Create a file `setup_db.py`:

```python
"""
Set up the database schema for the tutorial.
"""
import asyncio
import asyncpg

async def setup_database():
    # Connect to database
    conn = await asyncpg.connect(
        host='localhost',
        port=5432,
        user='postgres',
        password='secret',
        database='users_db'
    )

    # Create users table
    await conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW(),
            last_login TIMESTAMP
        )
    ''')

    # Insert sample data
    await conn.execute('''
        INSERT INTO users (email, name, active)
        VALUES
            ('alice@example.com', 'Alice Smith', true),
            ('bob@example.com', 'Bob Johnson', true),
            ('charlie@example.com', 'Charlie Brown', false)
        ON CONFLICT (email) DO NOTHING
    ''')

    print("✅ Database setup complete!")
    print(f"   Created users table with {await conn.fetchval('SELECT COUNT(*) FROM users')} users")

    await conn.close()

if __name__ == '__main__':
    asyncio.run(setup_database())
```

Run the setup:

```bash
python setup_db.py
```

## Step 4: Create Your Flow Project

```bash
# Create project directory
mkdir user_manager
cd user_manager

# Set environment variables
cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres:secret@localhost:5432/users_db
REDIS_URL=redis://localhost:6379/0
EOF
```

## Step 5: Create the Flow Definition

Create `flow.yaml`:

```yaml
flow: UserManager
description: Manage users with database and caching

# Define database connections
connections:
  db:
    type: postgres
    url: ${env.DATABASE_URL}
    pool_size: 10
    timeout: 30

  cache:
    type: redis
    url: ${env.REDIS_URL}
    max_connections: 50
    decode_responses: true

# Flow inputs
inputs:
  - name: user_id
    type: integer
    required: true
    description: User ID to fetch

# Workflow steps
steps:
  # Step 1: Check if user is cached
  - redis_exists:
      id: check_cache
      connection: cache
      keys: ["user:${inputs.user_id}"]
      outputs:
        - exists

  # Step 2: Get from cache if it exists
  - redis_get:
      id: get_cached_user
      connection: cache
      key: "user:${inputs.user_id}"
      outputs:
        - value
      if: ${check_cache.exists}

  # Step 3: Query database if not cached (built-in task)
  - pg_query:
      id: fetch_from_db
      connection: db
      query: "SELECT id, email, name, active, last_login FROM users WHERE id = $1"
      params: [${inputs.user_id}]
      outputs:
        - rows
      if: "not ${check_cache.exists}"

  # Step 4: Transform and validate the data (custom task)
  - task: TransformUser
    id: transform
    inputs:
      user_data: ${fetch_from_db.rows[0]}
    outputs:
      - user
    if: "not ${check_cache.exists}"

  # Step 5: Cache the transformed user
  - redis_set:
      id: cache_user
      connection: cache
      key: "user:${inputs.user_id}"
      value: ${transform.user}
      ex: 3600
      outputs:
        - success
      if: "not ${check_cache.exists}"

  # Step 6: Update last login timestamp (custom task with connection)
  - task: UpdateLastLogin
    id: update_login
    connection: db
    inputs:
      user_id: ${inputs.user_id}
    outputs:
      - updated
    if: "not ${check_cache.exists}"

  # Step 7: Increment view counter
  - redis_incr:
      id: increment_views
      connection: cache
      key: "stats:user_views"
      amount: 1
      outputs:
        - value

# Flow outputs
outputs:
  - name: user
    value: ${get_cached_user.value if check_cache.exists else transform.user}

  - name: from_cache
    value: ${check_cache.exists}

  - name: total_views
    value: ${increment_views.value}
```

## Step 6: Implement Custom Tasks

Create `flow.py`:

```python
"""
UserManager - Custom task implementations
"""
from typing import Any, Dict
from datetime import datetime
from flowlang import TaskRegistry


def create_task_registry() -> TaskRegistry:
    """Create and register all tasks for UserManager flow."""
    registry = TaskRegistry()

    @registry.register(
        'TransformUser',
        description='Transform and validate user data from database'
    )
    async def transform_user(user_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw database user data into application format.

        Args:
            user_data: Raw user data from database

        Returns:
            Dict with 'user' containing transformed data
        """
        if not user_data:
            raise ValueError("User not found")

        # Validate required fields
        required_fields = ['id', 'email', 'name']
        for field in required_fields:
            if field not in user_data or user_data[field] is None:
                raise ValueError(f"Missing required field: {field}")

        # Transform data
        transformed = {
            'id': user_data['id'],
            'email': user_data['email'],
            'name': user_data['name'],
            'active': user_data.get('active', False),
            'display_name': user_data['name'],
            'last_login': user_data.get('last_login').isoformat() if user_data.get('last_login') else None,
            'status': 'active' if user_data.get('active') else 'inactive'
        }

        return {'user': transformed}

    @registry.register(
        'UpdateLastLogin',
        description='Update user last login timestamp'
    )
    async def update_last_login(
        user_id: int,
        connection  # Connection is automatically injected!
    ) -> Dict[str, Any]:
        """
        Update the last_login timestamp for a user.

        The 'connection' parameter triggers automatic database
        connection injection by FlowLang.

        Args:
            user_id: User ID to update
            connection: Database connection (injected automatically)

        Returns:
            Dict with 'updated' boolean
        """
        query = """
            UPDATE users
            SET last_login = NOW()
            WHERE id = $1
        """

        try:
            result = await connection.execute(query, user_id)

            # Parse result (format: "UPDATE 1")
            rows_affected = 0
            if result:
                parts = result.split()
                if len(parts) > 1 and parts[-1].isdigit():
                    rows_affected = int(parts[-1])

            return {'updated': rows_affected > 0}

        except Exception as e:
            raise Exception(f"Failed to update last login: {e}") from e

    return registry
```

## Step 7: Generate the API Server

Use FlowLang's scaffolder to generate a complete project:

```bash
# Generate project structure
python -m flowlang.scaffolder scaffold flow.yaml -o .

# This creates:
# - api.py (FastAPI server)
# - tests/test_tasks.py
# - tools/start_server.sh
# - README.md
```

## Step 8: Test Your Flow

### Test Directly

Create `test_flow.py`:

```python
"""
Test the UserManager flow directly.
"""
import asyncio
from flowlang import FlowExecutor
from flow import create_task_registry

async def test_user_flow():
    # Load flow definition
    with open('flow.yaml') as f:
        flow_yaml = f.read()

    # Create executor
    registry = create_task_registry()
    executor = FlowExecutor(registry)

    # Test with user_id = 1
    print("Testing user_id = 1...")
    result = await executor.execute_flow(
        flow_yaml,
        inputs={'user_id': 1}
    )

    print("\n✅ Flow executed successfully!")
    print(f"   User: {result['user']['name']} ({result['user']['email']})")
    print(f"   From cache: {result['from_cache']}")
    print(f"   Total views: {result['total_views']}")

    # Run again to test caching
    print("\nTesting again (should use cache)...")
    result2 = await executor.execute_flow(
        flow_yaml,
        inputs={'user_id': 1}
    )

    print(f"   From cache: {result2['from_cache']}")
    print(f"   Cache hit: {'✅' if result2['from_cache'] else '❌'}")

if __name__ == '__main__':
    asyncio.run(test_user_flow())
```

Run the test:

```bash
python test_flow.py
```

Expected output:
```
Testing user_id = 1...

✅ Flow executed successfully!
   User: Alice Smith (alice@example.com)
   From cache: False
   Total views: 1

Testing again (should use cache)...
   From cache: True
   Cache hit: ✅
```

### Test via API Server

Start the server:

```bash
./tools/start_server.sh
```

Test with curl:

```bash
# Fetch user (first time - from database)
curl -X POST http://localhost:8000/flows/UserManager/execute \
  -H "Content-Type: application/json" \
  -d '{"inputs": {"user_id": 1}}'

# Fetch again (from cache)
curl -X POST http://localhost:8000/flows/UserManager/execute \
  -H "Content-Type: application/json" \
  -d '{"inputs": {"user_id": 1}}'
```

### Test with Interactive Docs

Open http://localhost:8000/docs in your browser and try the API interactively!

## Step 9: Watch Mode for Development

Use watch mode to see live updates as you modify your flow:

```bash
# Create test inputs file
cat > test_inputs.json << 'EOF'
{
  "user_id": 2
}
EOF

# Start watch mode
python -m flowlang watch flow.yaml --tasks-file flow.py --test-inputs test_inputs.json
```

Now edit `flow.py` or `flow.yaml` and save - the flow will automatically re-execute!

## Understanding What We Built

### Flow Architecture

```
Input: user_id
  ↓
Check Cache (redis_exists)
  ↓
├─ Cache Hit
│  ├─ Get from Redis (redis_get)
│  ├─ Increment views (redis_incr)
│  └─ Return cached data
│
└─ Cache Miss
   ├─ Query Database (pg_query)
   ├─ Transform Data (TransformUser)
   ├─ Update Last Login (UpdateLastLogin)
   ├─ Cache Result (redis_set)
   ├─ Increment views (redis_incr)
   └─ Return fresh data
```

### Key Concepts Demonstrated

**1. Connection Declaration:**
```yaml
connections:
  db:
    type: postgres
    url: ${env.DATABASE_URL}
  cache:
    type: redis
    url: ${env.REDIS_URL}
```

**2. Built-in Database Tasks (Zero Code):**
```yaml
- pg_query:
    connection: db
    query: "SELECT * FROM users WHERE id = $1"
    params: [${inputs.user_id}]
```

**3. Automatic Connection Injection:**
```python
async def update_last_login(user_id: int, connection):
    # 'connection' parameter triggers automatic injection
    await connection.execute(query, user_id)
```

**4. Conditional Execution:**
```yaml
if: ${check_cache.exists}          # Execute if cached
if: "not ${check_cache.exists}"    # Execute if not cached
```

**5. Environment Variables:**
```yaml
url: ${env.DATABASE_URL}  # Resolved at runtime
```

## Common Issues and Solutions

### Issue 1: Connection Refused

```
ConnectionError: Failed to connect to PostgreSQL
```

**Solution:**
- Check Docker containers are running: `docker ps`
- Verify environment variables: `cat .env`
- Test connection manually:
  ```bash
  psql postgresql://postgres:secret@localhost:5432/users_db -c "SELECT 1"
  ```

### Issue 2: Module Not Found

```
ModuleNotFoundError: No module named 'asyncpg'
```

**Solution:**
```bash
pip install asyncpg redis
```

### Issue 3: User Not Found

```
ValueError: User not found
```

**Solution:**
- Verify the user exists:
  ```bash
  psql postgresql://postgres:secret@localhost:5432/users_db \
    -c "SELECT * FROM users WHERE id = 1"
  ```
- Run `setup_db.py` again to insert sample data

### Issue 4: Cache Not Working

**Symptoms:** `from_cache` is always False

**Solution:**
- Check Redis is running: `docker ps | grep redis`
- Test Redis connection:
  ```bash
  redis-cli ping
  ```
- Check cache keys:
  ```bash
  redis-cli KEYS "user:*"
  ```

## Next Steps

Now that you've built your first database-backed flow, try:

### 1. Add More Operations

Add update and delete operations:

```yaml
steps:
  - pg_execute:
      id: update_user
      connection: db
      query: "UPDATE users SET name = $1 WHERE id = $2"
      params: [${inputs.new_name}, ${inputs.user_id}]
```

### 2. Add Error Handling

```yaml
steps:
  - pg_query:
      id: fetch_user
      connection: db
      query: "SELECT * FROM users WHERE id = $1"
      params: [${inputs.user_id}]
      on_error:
        - task: LogError
          inputs:
            error: ${context.last_error}
```

### 3. Add Retry Logic

```yaml
steps:
  - pg_query:
      id: fetch_user
      connection: db
      query: "SELECT * FROM users WHERE id = $1"
      params: [${inputs.user_id}]
      retry:
        max_attempts: 3
        delay: 1
        backoff: 2
```

### 4. Add Transactions

```yaml
steps:
  - pg_transaction:
      id: transfer_credits
      connection: db
      queries:
        - query: "UPDATE accounts SET balance = balance - $1 WHERE user_id = $2"
          params: [100, ${inputs.from_user}]
        - query: "UPDATE accounts SET balance = balance + $1 WHERE user_id = $2"
          params: [100, ${inputs.to_user}]
```

### 5. Try Other Databases

```bash
# List all available database plugins
flowlang connection list

# Generate example for MongoDB
flowlang connection example mongodb

# Generate example for Redis operations
flowlang connection example redis
```

### 6. Create a Custom Plugin

See [Creating Connection Plugins](./creating-connection-plugins.md) to build your own.

## Resources

- **Database Integration Guide**: [database-integration.md](./database-integration.md)
- **Connection Plugins Reference**: [connections.md](./connections.md)
- **Creating Plugins**: [creating-connection-plugins.md](./creating-connection-plugins.md)
- **Examples**: `flowlang connection example <plugin>`

## Clean Up

When you're done with the tutorial:

```bash
# Stop and remove Docker containers
docker stop postgres redis
docker rm postgres redis

# Remove project files (optional)
cd ..
rm -rf user_manager
```

## Congratulations! 🎉

You've successfully created your first database-backed FlowLang workflow!

You learned how to:
- ✅ Set up database connections with environment variables
- ✅ Use built-in database tasks for zero-boilerplate operations
- ✅ Create custom tasks with automatic connection injection
- ✅ Implement caching patterns with Redis
- ✅ Test flows directly and via API
- ✅ Use watch mode for rapid development

**What's next?** Try building a real application with FlowLang's database connections, or explore other integrations in the [connections catalog](./connections.md).

Happy building! 🚀
