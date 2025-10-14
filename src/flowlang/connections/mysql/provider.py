"""
MySQL Connection Plugin

Provides MySQL database connectivity with connection pooling,
built-in query tasks, and scaffolding commands.

Dependencies: aiomysql>=0.2.0
"""
from typing import Any, Dict, List, Callable, Tuple, Optional
from ..base import ConnectionPlugin


class MySQLPlugin(ConnectionPlugin):
    """
    MySQL database connection plugin.

    Features:
    - Connection pooling with aiomysql
    - Built-in tasks: mysql_query, mysql_execute, mysql_transaction
    - Transaction support
    - Parameterized queries for SQL injection prevention
    - Scaffolding commands for quick setup

    Example flow.yaml:
        connections:
          db:
            type: mysql
            host: ${env.MYSQL_HOST}
            port: 3306
            user: ${env.MYSQL_USER}
            password: ${env.MYSQL_PASSWORD}
            database: ${env.MYSQL_DATABASE}
            pool_size: 10

        steps:
          - mysql_query:
              id: fetch_users
              connection: db
              query: "SELECT * FROM users WHERE active = %s"
              params: [true]
              outputs:
                - users
    """

    name = "mysql"
    description = "MySQL database connection with aiomysql"
    version = "1.0.0"
    category = "database"

    def __init__(self):
        """Initialize MySQL plugin"""
        super().__init__()
        self._pool = None

    def get_config_schema(self) -> Dict[str, Any]:
        """Return JSON schema for MySQL configuration"""
        return {
            "type": "object",
            "required": ["host", "user", "password", "database"],
            "properties": {
                "host": {
                    "type": "string",
                    "description": "MySQL server hostname"
                },
                "port": {
                    "type": "integer",
                    "default": 3306,
                    "description": "MySQL server port"
                },
                "user": {
                    "type": "string",
                    "description": "Database user"
                },
                "password": {
                    "type": "string",
                    "description": "Database password"
                },
                "database": {
                    "type": "string",
                    "description": "Database name"
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
                "charset": {
                    "type": "string",
                    "default": "utf8mb4",
                    "description": "Character set"
                },
                "autocommit": {
                    "type": "boolean",
                    "default": False,
                    "description": "Enable autocommit mode"
                }
            }
        }

    def validate_config(self, config: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate MySQL configuration"""
        required = ['host', 'user', 'password', 'database']
        for field in required:
            if field not in config:
                return False, f"Missing required field: {field}"

        return True, None

    async def connect(self, config: Dict[str, Any]) -> Any:
        """
        Establish MySQL connection pool.

        Args:
            config: Connection configuration

        Returns:
            aiomysql connection pool

        Raises:
            ConnectionError: If connection fails
        """
        try:
            import aiomysql
        except ImportError:
            raise ImportError(
                "MySQL plugin requires 'aiomysql' package. "
                "Install with: pip install aiomysql>=0.2.0"
            )

        self._config = config

        try:
            self._pool = await aiomysql.create_pool(
                host=config['host'],
                port=config.get('port', 3306),
                user=config['user'],
                password=config['password'],
                db=config['database'],
                minsize=config.get('min_pool_size', 1),
                maxsize=config.get('pool_size', 10),
                charset=config.get('charset', 'utf8mb4'),
                autocommit=config.get('autocommit', False)
            )
            return self._pool
        except Exception as e:
            raise ConnectionError(f"Failed to connect to MySQL: {e}") from e

    async def disconnect(self):
        """Close MySQL connection pool"""
        if self._pool:
            self._pool.close()
            await self._pool.wait_closed()
            self._pool = None

    async def get_connection(self) -> Any:
        """
        Get a connection from the pool.

        Returns:
            aiomysql connection object
        """
        if not self._pool:
            raise ConnectionError("MySQL pool not initialized")

        return await self._pool.acquire()

    async def release_connection(self, connection: Any):
        """
        Release connection back to pool.

        Args:
            connection: The aiomysql connection to release
        """
        if self._pool and connection:
            self._pool.release(connection)

    def get_builtin_tasks(self) -> Dict[str, Callable]:
        """
        Return built-in MySQL tasks.

        These tasks provide zero-boilerplate database operations in YAML.
        """
        return {
            'mysql_query': self._task_query,
            'mysql_execute': self._task_execute,
            'mysql_transaction': self._task_transaction,
            'mysql_batch_insert': self._task_batch_insert,
            'mysql_batch_update': self._task_batch_update,
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
            query: SQL SELECT query (use %s for params)
            params: List of query parameters
            connection: Database connection (injected)

        Returns:
            Dict with 'rows' key containing list of row dicts

        Example YAML:
            - mysql_query:
                id: fetch_users
                connection: db
                query: "SELECT * FROM users WHERE age > %s"
                params: [18]
                outputs:
                  - rows
        """
        params = params or []

        try:
            async with connection.cursor() as cursor:
                await cursor.execute(query, params)
                columns = [desc[0] for desc in cursor.description]
                rows = await cursor.fetchall()

                result_rows = [
                    dict(zip(columns, row))
                    for row in rows
                ]

                return {'rows': result_rows, 'count': len(result_rows)}

        except Exception as e:
            raise FlowExecutionError(
                f"MySQL query failed: {e}"
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
            query: SQL query (use %s for params)
            params: List of query parameters
            connection: Database connection (injected)

        Returns:
            Dict with 'rows_affected' key

        Example YAML:
            - mysql_execute:
                id: update_user
                connection: db
                query: "UPDATE users SET active = %s WHERE id = %s"
                params: [true, 123]
                outputs:
                  - rows_affected
        """
        params = params or []

        try:
            async with connection.cursor() as cursor:
                await cursor.execute(query, params)
                await connection.commit()

                return {'rows_affected': cursor.rowcount}

        except Exception as e:
            await connection.rollback()
            raise FlowExecutionError(
                f"MySQL execute failed: {e}"
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
        """
        try:
            results = []

            async with connection.cursor() as cursor:
                for q in queries:
                    query = q.get('query')
                    params = q.get('params', [])

                    if not query:
                        raise ValueError("Each query must have 'query' field")

                    await cursor.execute(query, params)
                    results.append({'rows_affected': cursor.rowcount})

                await connection.commit()

            return {'results': results, 'count': len(results)}

        except Exception as e:
            await connection.rollback()
            raise FlowExecutionError(
                f"MySQL transaction failed: {e}"
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
            - mysql_batch_insert:
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

            # Build INSERT query with %s placeholders for MySQL
            placeholders = ', '.join('%s' for _ in columns)
            query = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})"

            inserted_count = 0
            batch_count = 0

            # Process in batches
            async with connection.cursor() as cursor:
                for i in range(0, len(records), batch_size):
                    batch = records[i:i + batch_size]

                    # Prepare batch values
                    batch_values = [
                        tuple(record[col] for col in columns)
                        for record in batch
                    ]

                    # Execute batch
                    await cursor.executemany(query, batch_values)

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
                f"MySQL batch insert failed: {e}"
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
            - mysql_batch_update:
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

            # Build UPDATE query with %s placeholders for MySQL
            set_clause = ', '.join(f'{col} = %s' for col in columns)
            query = f"UPDATE {table} SET {set_clause} WHERE {key_field} = %s"

            updated_count = 0
            batch_count = 0

            # Process in batches
            async with connection.cursor() as cursor:
                for i in range(0, len(updates), batch_size):
                    batch = updates[i:i + batch_size]

                    # Prepare batch values: (col1_value, col2_value, ..., key_value)
                    batch_values = [
                        tuple([record[col] for col in columns] + [record[key_field]])
                        for record in batch
                    ]

                    # Execute batch
                    await cursor.executemany(query, batch_values)

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
                f"MySQL batch update failed: {e}"
            ) from e

    def get_dependencies(self) -> List[str]:
        """Return required pip packages"""
        return ["aiomysql>=0.2.0"]

    def scaffold_connection_config(self, name: str = "db", **kwargs) -> str:
        """
        Generate MySQL connection config YAML snippet.

        Args:
            name: Connection name
            **kwargs: Additional options (pool_size, charset)

        Returns:
            YAML string
        """
        pool_size = kwargs.get('pool_size', 10)
        charset = kwargs.get('charset', 'utf8mb4')

        return f"""
  {name}:
    type: mysql
    host: ${{env.MYSQL_HOST}}
    port: 3306
    user: ${{env.MYSQL_USER}}
    password: ${{env.MYSQL_PASSWORD}}
    database: ${{env.MYSQL_DATABASE}}
    pool_size: {pool_size}
    charset: {charset}
"""

    def scaffold_example_flow(self, output_dir: str, connection_name: str = "db", **kwargs):
        """
        Generate example flow demonstrating MySQL connection.

        Args:
            output_dir: Directory to write example
            connection_name: Connection name to use
        """
        import os

        example = f'''flow: MySQLExample
description: Example flow using MySQL connection

connections:
  {connection_name}:
    type: mysql
    host: ${{env.MYSQL_HOST}}
    port: 3306
    user: ${{env.MYSQL_USER}}
    password: ${{env.MYSQL_PASSWORD}}
    database: ${{env.MYSQL_DATABASE}}
    pool_size: 10

inputs:
  - name: user_id
    type: integer
    required: true

steps:
  # Built-in mysql_query task
  - mysql_query:
      id: fetch_user
      connection: {connection_name}
      query: "SELECT * FROM users WHERE id = %s"
      params: [${{inputs.user_id}}]
      outputs:
        - rows

  # Built-in mysql_execute task
  - mysql_execute:
      id: update_login
      connection: {connection_name}
      query: "UPDATE users SET last_login = NOW() WHERE id = %s"
      params: [${{inputs.user_id}}]
      outputs:
        - rows_affected

outputs:
  - name: user
    value: ${{fetch_user.rows[0]}}

  - name: updated
    value: ${{update_login.rows_affected}}
'''

        os.makedirs(output_dir, exist_ok=True)
        example_path = os.path.join(output_dir, 'mysql_example.yaml')

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
