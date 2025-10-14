"""
PostgreSQL Connection Plugin

Provides PostgreSQL database connectivity with connection pooling,
built-in query tasks, and scaffolding commands.

Dependencies: asyncpg>=0.29.0
"""
from typing import Any, Dict, List, Callable, Tuple, Optional
from ..base import ConnectionPlugin


class PostgresPlugin(ConnectionPlugin):
    """
    PostgreSQL database connection plugin.

    Features:
    - Connection pooling with asyncpg
    - Built-in tasks: pg_query, pg_execute, pg_transaction
    - Transaction support
    - Parameterized queries for SQL injection prevention
    - Scaffolding commands for quick setup

    Example flow.yaml:
        connections:
          db:
            type: postgres
            url: ${env.DATABASE_URL}
            pool_size: 10
            timeout: 30

        steps:
          - pg_query:
              id: fetch_users
              connection: db
              query: "SELECT * FROM users WHERE active = $1"
              params: [true]
              outputs:
                - users
    """

    name = "postgres"
    description = "PostgreSQL database connection with asyncpg"
    version = "1.0.0"
    category = "database"

    def __init__(self):
        """Initialize PostgreSQL plugin"""
        super().__init__()
        self._pool = None

    def get_config_schema(self) -> Dict[str, Any]:
        """Return JSON schema for PostgreSQL configuration"""
        return {
            "type": "object",
            "required": ["url"],
            "properties": {
                "url": {
                    "type": "string",
                    "description": "PostgreSQL connection URL (postgres://user:pass@host:port/db)"
                },
                "pool_size": {
                    "type": "integer",
                    "default": 10,
                    "minimum": 1,
                    "maximum": 100,
                    "description": "Maximum number of connections in pool"
                },
                "min_pool_size": {
                    "type": "integer",
                    "default": 1,
                    "minimum": 0,
                    "description": "Minimum number of connections to maintain"
                },
                "timeout": {
                    "type": "integer",
                    "default": 30,
                    "minimum": 1,
                    "description": "Command timeout in seconds"
                }
            }
        }

    def validate_config(self, config: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate PostgreSQL configuration"""
        if 'url' not in config:
            return False, "Missing required field: url"

        url = config['url']
        if not (url.startswith('postgres://') or url.startswith('postgresql://')):
            return False, "URL must start with postgres:// or postgresql://"

        return True, None

    async def connect(self, config: Dict[str, Any]) -> Any:
        """
        Establish PostgreSQL connection pool.

        Args:
            config: Connection configuration

        Returns:
            asyncpg connection pool

        Raises:
            ConnectionError: If connection fails
        """
        try:
            import asyncpg
        except ImportError:
            raise ImportError(
                "PostgreSQL plugin requires 'asyncpg' package. "
                "Install with: pip install asyncpg>=0.29.0"
            )

        self._config = config

        try:
            self._pool = await asyncpg.create_pool(
                config['url'],
                min_size=config.get('min_pool_size', 1),
                max_size=config.get('pool_size', 10),
                command_timeout=config.get('timeout', 30)
            )
            return self._pool
        except Exception as e:
            raise ConnectionError(f"Failed to connect to PostgreSQL: {e}") from e

    async def disconnect(self):
        """Close PostgreSQL connection pool"""
        if self._pool:
            await self._pool.close()
            self._pool = None

    async def get_connection(self) -> Any:
        """
        Get a connection from the pool.

        Returns:
            asyncpg connection object
        """
        if not self._pool:
            raise ConnectionError("PostgreSQL pool not initialized")

        return await self._pool.acquire()

    async def release_connection(self, connection: Any):
        """
        Release connection back to pool.

        Args:
            connection: The asyncpg connection to release
        """
        if self._pool and connection:
            await self._pool.release(connection)

    def get_builtin_tasks(self) -> Dict[str, Callable]:
        """
        Return built-in PostgreSQL tasks.

        These tasks provide zero-boilerplate database operations in YAML.
        """
        return {
            'pg_query': self._task_query,
            'pg_execute': self._task_execute,
            'pg_transaction': self._task_transaction,
            'pg_batch_insert': self._task_batch_insert,
            'pg_batch_update': self._task_batch_update,
        }

    async def _task_query(
        self,
        query: str,
        params: List = None,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Execute SELECT query and return rows.

        Args:
            query: SQL SELECT query (use $1, $2 for params)
            params: List of query parameters
            connection: Database connection (injected)

        Returns:
            Dict with 'rows' key containing list of row dicts

        Example YAML:
            - pg_query:
                id: fetch_users
                connection: db
                query: "SELECT * FROM users WHERE age > $1"
                params: [18]
                outputs:
                  - rows
        """
        params = params or []

        try:
            async with connection.transaction():
                result = await connection.fetch(query, *params)
                rows = [dict(row) for row in result]

                return {'rows': rows, 'count': len(rows)}

        except Exception as e:
            raise FlowExecutionError(
                f"PostgreSQL query failed: {e}"
            ) from e

    async def _task_execute(
        self,
        query: str,
        params: List = None,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Execute INSERT/UPDATE/DELETE and return affected rows.

        Args:
            query: SQL query (use $1, $2 for params)
            params: List of query parameters
            connection: Database connection (injected)

        Returns:
            Dict with 'rows_affected' key

        Example YAML:
            - pg_execute:
                id: update_user
                connection: db
                query: "UPDATE users SET active = $1 WHERE id = $2"
                params: [true, 123]
                outputs:
                  - rows_affected
        """
        params = params or []

        try:
            result = await connection.execute(query, *params)

            # Parse "UPDATE 5" -> 5
            rows_affected = 0
            if result:
                parts = result.split()
                if len(parts) > 1 and parts[-1].isdigit():
                    rows_affected = int(parts[-1])

            return {'rows_affected': rows_affected}

        except Exception as e:
            raise FlowExecutionError(
                f"PostgreSQL execute failed: {e}"
            ) from e

    async def _task_transaction(
        self,
        queries: List[Dict[str, Any]],
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Execute multiple queries in a transaction.

        Args:
            queries: List of {query: str, params: list} dicts
            connection: Database connection (injected)

        Returns:
            Dict with 'results' list

        Example YAML:
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
        """
        try:
            results = []

            async with connection.transaction():
                for q in queries:
                    query = q.get('query')
                    params = q.get('params', [])

                    if not query:
                        raise ValueError("Each query must have 'query' field")

                    result = await connection.execute(query, *params)
                    results.append(result)

            return {'results': results, 'count': len(results)}

        except Exception as e:
            raise FlowExecutionError(
                f"PostgreSQL transaction failed: {e}"
            ) from e

    async def _task_batch_insert(
        self,
        table: str,
        records: List[Dict[str, Any]],
        batch_size: int = 1000,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Batch insert multiple records efficiently.

        Uses PostgreSQL's COPY or executemany for efficient bulk inserts.

        Args:
            table: Table name
            records: List of dicts with column-value pairs
            batch_size: Number of records to insert per batch
            connection: Database connection (injected)

        Returns:
            Dict with 'inserted_count' and 'batches' keys

        Example YAML:
            - pg_batch_insert:
                id: import_users
                connection: db
                table: users
                records: ${previous_step.user_list}
                batch_size: 500
                outputs:
                  - inserted_count
        """
        if not records:
            return {'inserted_count': 0, 'batches': 0}

        try:
            # Get column names from first record
            columns = list(records[0].keys())

            # Build INSERT query
            placeholders = ', '.join(f'${i+1}' for i in range(len(columns)))
            query = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})"

            inserted_count = 0
            batch_count = 0

            # Process in batches
            async with connection.transaction():
                for i in range(0, len(records), batch_size):
                    batch = records[i:i + batch_size]

                    # Prepare batch values
                    batch_values = [
                        tuple(record[col] for col in columns)
                        for record in batch
                    ]

                    # Execute batch
                    await connection.executemany(query, batch_values)

                    inserted_count += len(batch)
                    batch_count += 1

            return {
                'inserted_count': inserted_count,
                'batches': batch_count,
                'table': table
            }

        except Exception as e:
            raise FlowExecutionError(
                f"PostgreSQL batch insert failed: {e}"
            ) from e

    async def _task_batch_update(
        self,
        table: str,
        updates: List[Dict[str, Any]],
        key_field: str = 'id',
        batch_size: int = 1000,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Batch update multiple records efficiently.

        Args:
            table: Table name
            updates: List of dicts with column-value pairs (must include key_field)
            key_field: Field to use for WHERE clause (default: 'id')
            batch_size: Number of records to update per batch
            connection: Database connection (injected)

        Returns:
            Dict with 'updated_count' and 'batches' keys

        Example YAML:
            - pg_batch_update:
                id: update_prices
                connection: db
                table: products
                key_field: product_id
                updates: ${previous_step.price_changes}
                batch_size: 500
                outputs:
                  - updated_count
        """
        if not updates:
            return {'updated_count': 0, 'batches': 0}

        try:
            # Verify key_field exists in all records
            if not all(key_field in record for record in updates):
                raise ValueError(f"All update records must contain '{key_field}' field")

            # Get column names from first record (excluding key field)
            columns = [col for col in updates[0].keys() if col != key_field]

            # Build UPDATE query
            set_clause = ', '.join(f'{col} = ${i+2}' for i, col in enumerate(columns))
            query = f"UPDATE {table} SET {set_clause} WHERE {key_field} = $1"

            updated_count = 0
            batch_count = 0

            # Process in batches
            async with connection.transaction():
                for i in range(0, len(updates), batch_size):
                    batch = updates[i:i + batch_size]

                    # Prepare batch values: (key_value, col1_value, col2_value, ...)
                    batch_values = [
                        tuple([record[key_field]] + [record[col] for col in columns])
                        for record in batch
                    ]

                    # Execute batch
                    results = await connection.executemany(query, batch_values)

                    # Count affected rows (results might be a string like "UPDATE 5")
                    # For executemany, we just count the batch size
                    updated_count += len(batch)
                    batch_count += 1

            return {
                'updated_count': updated_count,
                'batches': batch_count,
                'table': table
            }

        except Exception as e:
            raise FlowExecutionError(
                f"PostgreSQL batch update failed: {e}"
            ) from e

    def get_dependencies(self) -> List[str]:
        """Return required pip packages"""
        return ["asyncpg>=0.29.0"]

    def scaffold_connection_config(self, name: str = "db", **kwargs) -> str:
        """
        Generate PostgreSQL connection config YAML snippet.

        Args:
            name: Connection name
            **kwargs: Additional options (pool_size, timeout)

        Returns:
            YAML string
        """
        pool_size = kwargs.get('pool_size', 10)
        timeout = kwargs.get('timeout', 30)

        return f"""
  {name}:
    type: postgres
    url: ${{env.DATABASE_URL}}
    pool_size: {pool_size}
    timeout: {timeout}
"""

    def scaffold_task_helpers(self, output_dir: str, connection_name: str = "db", **kwargs):
        """
        Generate PostgreSQL helper functions file.

        Creates a Python file with common database operations.

        Args:
            output_dir: Directory to write helpers
            connection_name: Connection name from YAML
        """
        import os

        helpers_code = f'''"""
PostgreSQL database helper functions.

Auto-generated by FlowLang PostgreSQL plugin.
Connection: {connection_name}
"""
from typing import Dict, List, Any, Optional


async def fetch_by_id(table: str, id_value: Any, connection) -> Optional[Dict]:
    """
    Fetch a single record by ID.

    Args:
        table: Table name
        id_value: ID value
        connection: Database connection

    Returns:
        Row as dict or None if not found

    Example:
        user = await fetch_by_id('users', 123, connection)
    """
    query = f"SELECT * FROM {{table}} WHERE id = $1"
    result = await connection.fetchrow(query, id_value)
    return dict(result) if result else None


async def fetch_all(
    table: str,
    connection,
    where: str = None,
    params: List = None,
    limit: int = 100
) -> List[Dict]:
    """
    Fetch multiple records from table.

    Args:
        table: Table name
        connection: Database connection
        where: Optional WHERE clause (without WHERE keyword)
        params: Parameters for WHERE clause
        limit: Maximum rows to fetch

    Returns:
        List of rows as dicts

    Example:
        users = await fetch_all('users', connection, 'age > $1', [18], limit=50)
    """
    query = f"SELECT * FROM {{table}}"
    if where:
        query += f" WHERE {{where}}"
    query += f" LIMIT ${{len(params or []) + 1}}"

    params = (params or []) + [limit]
    results = await connection.fetch(query, *params)
    return [dict(r) for r in results]


async def insert_record(table: str, data: Dict, connection) -> int:
    """
    Insert a record and return its ID.

    Args:
        table: Table name
        data: Column-value pairs
        connection: Database connection

    Returns:
        ID of inserted record

    Example:
        user_id = await insert_record('users', {{'name': 'Alice', 'age': 30}}, connection)
    """
    columns = ", ".join(data.keys())
    placeholders = ", ".join(f"${i+1}" for i in range(len(data)))
    query = f"INSERT INTO {{table}} ({{columns}}) VALUES ({{placeholders}}) RETURNING id"

    result = await connection.fetchval(query, *data.values())
    return result


async def update_record(table: str, id_value: Any, data: Dict, connection) -> int:
    """
    Update a record by ID.

    Args:
        table: Table name
        id_value: ID value
        data: Column-value pairs to update
        connection: Database connection

    Returns:
        Number of rows updated

    Example:
        rows = await update_record('users', 123, {{'age': 31}}, connection)
    """
    set_clause = ", ".join(f"{{k}} = ${i+1}" for i, k in enumerate(data.keys()))
    query = f"UPDATE {{table}} SET {{set_clause}} WHERE id = ${{len(data)+1}}"

    result = await connection.execute(query, *data.values(), id_value)

    # Parse "UPDATE 1" -> 1
    if result:
        parts = result.split()
        if len(parts) > 1 and parts[-1].isdigit():
            return int(parts[-1])

    return 0


async def delete_record(table: str, id_value: Any, connection) -> int:
    """
    Delete a record by ID.

    Args:
        table: Table name
        id_value: ID value
        connection: Database connection

    Returns:
        Number of rows deleted

    Example:
        rows = await delete_record('users', 123, connection)
    """
    query = f"DELETE FROM {{table}} WHERE id = $1"
    result = await connection.execute(query, id_value)

    # Parse "DELETE 1" -> 1
    if result:
        parts = result.split()
        if len(parts) > 1 and parts[-1].isdigit():
            return int(parts[-1])

    return 0


async def count_records(table: str, connection, where: str = None, params: List = None) -> int:
    """
    Count records in table.

    Args:
        table: Table name
        connection: Database connection
        where: Optional WHERE clause
        params: Parameters for WHERE clause

    Returns:
        Number of rows

    Example:
        count = await count_records('users', connection, 'age > $1', [18])
    """
    query = f"SELECT COUNT(*) FROM {{table}}"
    if where:
        query += f" WHERE {{where}}"

    result = await connection.fetchval(query, *(params or []))
    return result
'''

        os.makedirs(output_dir, exist_ok=True)
        helper_path = os.path.join(output_dir, 'db_helpers.py')

        with open(helper_path, 'w') as f:
            f.write(helpers_code)

        print(f"Generated: {helper_path}")

    def scaffold_example_flow(self, output_dir: str, connection_name: str = "db", **kwargs):
        """
        Generate example flow demonstrating PostgreSQL connection.

        Args:
            output_dir: Directory to write example
            connection_name: Connection name to use
        """
        import os

        example = f'''flow: PostgresExample
description: Example flow using PostgreSQL connection

connections:
  {connection_name}:
    type: postgres
    url: ${{env.DATABASE_URL}}
    pool_size: 10

inputs:
  - name: user_id
    type: integer
    required: true

steps:
  # Built-in pg_query task
  - pg_query:
      id: fetch_user
      connection: {connection_name}
      query: "SELECT * FROM users WHERE id = $1"
      params: [${{inputs.user_id}}]
      outputs:
        - rows

  # Custom task with connection injection
  - task: ProcessUser
    id: process
    connection: {connection_name}
    inputs:
      user: ${{fetch_user.rows[0]}}
    outputs:
      - result

outputs:
  - name: user
    value: ${{fetch_user.rows[0]}}

  - name: result
    value: ${{process.result}}
'''

        os.makedirs(output_dir, exist_ok=True)
        example_path = os.path.join(output_dir, 'postgres_example.yaml')

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
