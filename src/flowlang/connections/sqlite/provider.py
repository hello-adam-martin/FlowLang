"""
SQLite Connection Plugin

Provides SQLite database connectivity with async support,
built-in query tasks, and scaffolding commands.

Dependencies: aiosqlite>=0.19.0
"""
from typing import Any, Dict, List, Callable, Tuple, Optional
from ..base import ConnectionPlugin


class SQLitePlugin(ConnectionPlugin):
    """
    SQLite database connection plugin.

    Features:
    - Async file-based database with aiosqlite
    - Built-in tasks: sqlite_query, sqlite_execute, sqlite_transaction
    - Transaction support
    - Parameterized queries for SQL injection prevention
    - In-memory database support
    - Scaffolding commands for quick setup

    Example flow.yaml:
        connections:
          db:
            type: sqlite
            database: ./data/app.db
            timeout: 5.0

        steps:
          - sqlite_query:
              id: fetch_users
              connection: db
              query: "SELECT * FROM users WHERE active = ?"
              params: [true]
              outputs:
                - users
    """

    name = "sqlite"
    description = "SQLite file-based database connection with aiosqlite"
    version = "1.0.0"
    category = "database"

    def __init__(self):
        """Initialize SQLite plugin"""
        super().__init__()
        self._connection = None

    def get_config_schema(self) -> Dict[str, Any]:
        """Return JSON schema for SQLite configuration"""
        return {
            "type": "object",
            "required": ["database"],
            "properties": {
                "database": {
                    "type": "string",
                    "description": "Database file path (or ':memory:' for in-memory)"
                },
                "timeout": {
                    "type": "number",
                    "default": 5.0,
                    "minimum": 0.1,
                    "description": "Database lock timeout in seconds"
                },
                "isolation_level": {
                    "type": "string",
                    "enum": ["DEFERRED", "IMMEDIATE", "EXCLUSIVE", None],
                    "default": None,
                    "description": "Transaction isolation level"
                },
                "check_same_thread": {
                    "type": "boolean",
                    "default": False,
                    "description": "Check if connection used in same thread"
                }
            }
        }

    def validate_config(self, config: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate SQLite configuration"""
        if 'database' not in config:
            return False, "Missing required field: database"

        return True, None

    async def connect(self, config: Dict[str, Any]) -> Any:
        """
        Establish SQLite connection.

        Args:
            config: Connection configuration

        Returns:
            aiosqlite connection

        Raises:
            ConnectionError: If connection fails
        """
        try:
            import aiosqlite
        except ImportError:
            raise ImportError(
                "SQLite plugin requires 'aiosqlite' package. "
                "Install with: pip install aiosqlite>=0.19.0"
            )

        self._config = config

        try:
            self._connection = await aiosqlite.connect(
                config['database'],
                timeout=config.get('timeout', 5.0),
                isolation_level=config.get('isolation_level'),
                check_same_thread=config.get('check_same_thread', False)
            )

            # Enable foreign keys
            await self._connection.execute("PRAGMA foreign_keys = ON")

            # Set row factory to return dicts
            self._connection.row_factory = aiosqlite.Row

            return self._connection

        except Exception as e:
            raise ConnectionError(f"Failed to connect to SQLite: {e}") from e

    async def disconnect(self):
        """Close SQLite connection"""
        if self._connection:
            await self._connection.close()
            self._connection = None

    async def get_connection(self) -> Any:
        """
        Get SQLite connection.

        Returns:
            aiosqlite connection object
        """
        if not self._connection:
            raise ConnectionError("SQLite connection not initialized")

        return self._connection

    async def release_connection(self, connection: Any):
        """
        Release connection (no-op for SQLite).

        Args:
            connection: The aiosqlite connection
        """
        # SQLite doesn't use connection pooling
        pass

    def get_builtin_tasks(self) -> Dict[str, Callable]:
        """
        Return built-in SQLite tasks.

        These tasks provide zero-boilerplate database operations in YAML.
        """
        return {
            'sqlite_query': self._task_query,
            'sqlite_execute': self._task_execute,
            'sqlite_transaction': self._task_transaction,
            'sqlite_batch_insert': self._task_batch_insert,
            'sqlite_batch_update': self._task_batch_update,
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
            query: SQL SELECT query (use ? for params)
            params: List of query parameters
            connection: Database connection (injected)

        Returns:
            Dict with 'rows' key containing list of row dicts

        Example YAML:
            - sqlite_query:
                id: fetch_users
                connection: db
                query: "SELECT * FROM users WHERE age > ?"
                params: [18]
                outputs:
                  - rows
        """
        params = params or []

        try:
            cursor = await connection.execute(query, params)
            rows = await cursor.fetchall()

            # Convert Row objects to dicts
            result_rows = [dict(row) for row in rows]

            await cursor.close()

            return {'rows': result_rows, 'count': len(result_rows)}

        except Exception as e:
            raise FlowExecutionError(
                f"SQLite query failed: {e}"
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
            query: SQL query (use ? for params)
            params: List of query parameters
            connection: Database connection (injected)

        Returns:
            Dict with 'rows_affected' key

        Example YAML:
            - sqlite_execute:
                id: update_user
                connection: db
                query: "UPDATE users SET active = ? WHERE id = ?"
                params: [true, 123]
                outputs:
                  - rows_affected
        """
        params = params or []

        try:
            cursor = await connection.execute(query, params)
            await connection.commit()

            rows_affected = cursor.rowcount
            await cursor.close()

            return {'rows_affected': rows_affected}

        except Exception as e:
            await connection.rollback()
            raise FlowExecutionError(
                f"SQLite execute failed: {e}"
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
        """
        try:
            results = []

            for q in queries:
                query = q.get('query')
                params = q.get('params', [])

                if not query:
                    raise ValueError("Each query must have 'query' field")

                cursor = await connection.execute(query, params)
                results.append({'rows_affected': cursor.rowcount})
                await cursor.close()

            await connection.commit()

            return {'results': results, 'count': len(results)}

        except Exception as e:
            await connection.rollback()
            raise FlowExecutionError(
                f"SQLite transaction failed: {e}"
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

        Uses executemany for efficient bulk inserts.

        Args:
            table: Table name
            records: List of dicts with column-value pairs
            batch_size: Number of records to insert per batch
            connection: Database connection (injected)

        Returns:
            Dict with 'inserted_count' and 'batches' keys

        Example YAML:
            - sqlite_batch_insert:
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

            # Build INSERT query with ? placeholders for SQLite
            placeholders = ', '.join('?' for _ in columns)
            query = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})"

            inserted_count = 0
            batch_count = 0

            # Process in batches
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

            await connection.commit()

            return {
                'inserted_count': inserted_count,
                'batches': batch_count,
                'table': table
            }

        except Exception as e:
            await connection.rollback()
            raise FlowExecutionError(
                f"SQLite batch insert failed: {e}"
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
            - sqlite_batch_update:
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

            # Build UPDATE query with ? placeholders for SQLite
            set_clause = ', '.join(f'{col} = ?' for col in columns)
            query = f"UPDATE {table} SET {set_clause} WHERE {key_field} = ?"

            updated_count = 0
            batch_count = 0

            # Process in batches
            for i in range(0, len(updates), batch_size):
                batch = updates[i:i + batch_size]

                # Prepare batch values: (col1_value, col2_value, ..., key_value)
                batch_values = [
                    tuple([record[col] for col in columns] + [record[key_field]])
                    for record in batch
                ]

                # Execute batch
                await connection.executemany(query, batch_values)

                # Count affected rows
                updated_count += len(batch)
                batch_count += 1

            await connection.commit()

            return {
                'updated_count': updated_count,
                'batches': batch_count,
                'table': table
            }

        except Exception as e:
            await connection.rollback()
            raise FlowExecutionError(
                f"SQLite batch update failed: {e}"
            ) from e

    def get_dependencies(self) -> List[str]:
        """Return required pip packages"""
        return ["aiosqlite>=0.19.0"]

    def scaffold_connection_config(self, name: str = "db", **kwargs) -> str:
        """
        Generate SQLite connection config YAML snippet.

        Args:
            name: Connection name
            **kwargs: Additional options (database, timeout)

        Returns:
            YAML string
        """
        database = kwargs.get('database', './data/app.db')
        timeout = kwargs.get('timeout', 5.0)

        return f"""
  {name}:
    type: sqlite
    database: {database}
    timeout: {timeout}
"""

    def scaffold_example_flow(self, output_dir: str, connection_name: str = "db", **kwargs):
        """
        Generate example flow demonstrating SQLite connection.

        Args:
            output_dir: Directory to write example
            connection_name: Connection name to use
        """
        import os

        example = f'''flow: SQLiteExample
description: Example flow using SQLite connection

connections:
  {connection_name}:
    type: sqlite
    database: ./data/app.db
    timeout: 5.0

inputs:
  - name: user_id
    type: integer
    required: true

steps:
  # Built-in sqlite_query task
  - sqlite_query:
      id: fetch_user
      connection: {connection_name}
      query: "SELECT * FROM users WHERE id = ?"
      params: [${{inputs.user_id}}]
      outputs:
        - rows

  # Built-in sqlite_execute task
  - sqlite_execute:
      id: update_login
      connection: {connection_name}
      query: "UPDATE users SET last_login = datetime('now') WHERE id = ?"
      params: [${{inputs.user_id}}]
      outputs:
        - rows_affected

  # Transaction example
  - sqlite_transaction:
      id: transfer
      connection: {connection_name}
      queries:
        - query: "UPDATE accounts SET balance = balance - ? WHERE user_id = ?"
          params: [100, ${{inputs.user_id}}]
        - query: "INSERT INTO transactions (user_id, amount, type) VALUES (?, ?, ?)"
          params: [${{inputs.user_id}}, 100, "debit"]
      outputs:
        - results

outputs:
  - name: user
    value: ${{fetch_user.rows[0]}}

  - name: updated
    value: ${{update_login.rows_affected}}

  - name: transaction_results
    value: ${{transfer.results}}
'''

        os.makedirs(output_dir, exist_ok=True)
        example_path = os.path.join(output_dir, 'sqlite_example.yaml')

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
