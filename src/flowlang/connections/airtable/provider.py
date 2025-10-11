"""
Airtable Connection Plugin

Provides Airtable API connectivity with metadata discovery,
built-in CRUD operations, and scaffolding commands.

Dependencies: aioairtable>=0.1.0
"""
from typing import Any, Dict, List, Callable, Tuple, Optional
from ..base import ConnectionPlugin


class AirtablePlugin(ConnectionPlugin):
    """
    Airtable API connection plugin.

    Features:
    - Async client using aioairtable
    - Metadata operations: list_bases, list_tables, get_table_schema
    - Built-in tasks: airtable_list, airtable_get, airtable_create, etc.
    - Filter by formula support
    - Sorting and pagination
    - Rate limit handling
    - Scaffolding commands for quick setup

    Example flow.yaml:
        connections:
          airtable:
            type: airtable
            api_key: ${env.AIRTABLE_API_KEY}
            base_id: ${env.AIRTABLE_BASE_ID}  # Optional for metadata operations

        steps:
          # List all bases
          - airtable_list_bases:
              id: list_bases
              connection: airtable
              outputs:
                - bases

          # List records with filtering
          - airtable_list:
              id: fetch_contacts
              connection: airtable
              table: Contacts
              filter_by_formula: "{Active} = 1"
              sort: [["Name", "asc"]]
              max_records: 100
              outputs:
                - records
    """

    name = "airtable"
    description = "Airtable API connection with metadata discovery"
    version = "1.0.0"

    def __init__(self):
        """Initialize Airtable plugin"""
        super().__init__()
        self._client = None
        self._session = None

    def get_config_schema(self) -> Dict[str, Any]:
        """Return JSON schema for Airtable configuration"""
        return {
            "type": "object",
            "required": ["api_key"],
            "properties": {
                "api_key": {
                    "type": "string",
                    "description": "Airtable API key or personal access token"
                },
                "base_id": {
                    "type": "string",
                    "description": "Default Airtable base ID (can be overridden per task)"
                },
                "timeout": {
                    "type": "number",
                    "default": 30.0,
                    "minimum": 1.0,
                    "description": "Request timeout in seconds"
                }
            }
        }

    def validate_config(self, config: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate Airtable configuration"""
        if 'api_key' not in config:
            return False, "Missing required field: api_key"

        api_key = config['api_key']
        if not api_key or not isinstance(api_key, str):
            return False, "Invalid API key format"

        # Validate base_id format if provided
        if 'base_id' in config and config['base_id']:
            base_id = config['base_id']
            if not base_id.startswith('app'):
                return False, "Invalid base_id format (should start with 'app')"

        return True, None

    async def connect(self, config: Dict[str, Any]) -> Any:
        """
        Establish Airtable API connection.

        Args:
            config: Connection configuration

        Returns:
            Airtable client instance

        Raises:
            ConnectionError: If connection fails
        """
        try:
            import aiohttp
        except ImportError:
            raise ImportError(
                "Airtable plugin requires 'aiohttp' package. "
                "Install with: pip install aiohttp>=3.8.0"
            )

        self._config = config

        try:
            # Create aiohttp session for API calls
            timeout = aiohttp.ClientTimeout(total=config.get('timeout', 30.0))
            self._session = aiohttp.ClientSession(
                timeout=timeout,
                headers={
                    'Authorization': f"Bearer {config['api_key']}",
                    'Content-Type': 'application/json'
                }
            )

            # Create a simple client wrapper
            self._client = {
                'session': self._session,
                'api_key': config['api_key'],
                'base_id': config.get('base_id'),
                'timeout': config.get('timeout', 30.0)
            }

            # Test connection by listing bases (requires API access)
            test_url = "https://api.airtable.com/v0/meta/bases"
            async with self._session.get(test_url) as response:
                if response.status == 401:
                    raise ConnectionError("Invalid API key")
                elif response.status != 200:
                    raise ConnectionError(f"API connection test failed: {response.status}")

            return self._client

        except Exception as e:
            if self._session:
                await self._session.close()
            raise ConnectionError(f"Failed to connect to Airtable: {e}") from e

    async def disconnect(self):
        """Close Airtable API connection"""
        if self._session:
            await self._session.close()
            self._session = None
            self._client = None

    async def get_connection(self) -> Any:
        """
        Get Airtable client.

        Returns:
            Airtable client dict with session and config
        """
        if not self._client:
            raise ConnectionError("Airtable client not initialized")

        return self._client

    async def release_connection(self, connection: Any):
        """
        Release connection (no-op for Airtable).

        Args:
            connection: The Airtable client
        """
        # No pooling needed for Airtable
        pass

    def get_builtin_tasks(self) -> Dict[str, Callable]:
        """
        Return built-in Airtable tasks.

        These tasks provide zero-boilerplate Airtable operations in YAML.
        """
        return {
            # Metadata operations
            'airtable_list_bases': self._task_list_bases,
            'airtable_list_tables': self._task_list_tables,
            'airtable_get_table_schema': self._task_get_table_schema,
            # Record operations
            'airtable_list': self._task_list,
            'airtable_get': self._task_get,
            'airtable_create': self._task_create,
            'airtable_update': self._task_update,
            'airtable_delete': self._task_delete,
            'airtable_find': self._task_find,
            'airtable_batch': self._task_batch,
        }

    # Metadata Tasks

    async def _task_list_bases(
        self,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: List all accessible bases.

        Args:
            connection: Airtable client (injected)

        Returns:
            Dict with 'bases' list containing base information

        Example YAML:
            - airtable_list_bases:
                id: list_all_bases
                connection: airtable
                outputs:
                  - bases
        """
        try:
            session = connection['session']
            url = "https://api.airtable.com/v0/meta/bases"

            async with session.get(url) as response:
                if response.status != 200:
                    text = await response.text()
                    raise Exception(f"API request failed ({response.status}): {text}")

                data = await response.json()
                bases = data.get('bases', [])

                return {'bases': bases, 'count': len(bases)}

        except Exception as e:
            raise FlowExecutionError(
                f"Airtable list_bases failed: {e}"
            ) from e

    async def _task_list_tables(
        self,
        base_id: Optional[str] = None,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: List all tables in a base.

        Args:
            base_id: Base ID (optional, uses connection default)
            connection: Airtable client (injected)

        Returns:
            Dict with 'tables' list containing table metadata

        Example YAML:
            - airtable_list_tables:
                id: list_tables
                connection: airtable
                base_id: "appXXXXXXXXXXXXXX"  # Optional
                outputs:
                  - tables
        """
        try:
            session = connection['session']
            base_id = base_id or connection.get('base_id')

            if not base_id:
                raise ValueError("base_id is required (provide in connection config or task)")

            url = f"https://api.airtable.com/v0/meta/bases/{base_id}/tables"

            async with session.get(url) as response:
                if response.status != 200:
                    text = await response.text()
                    raise Exception(f"API request failed ({response.status}): {text}")

                data = await response.json()
                tables = data.get('tables', [])

                return {'tables': tables, 'count': len(tables)}

        except Exception as e:
            raise FlowExecutionError(
                f"Airtable list_tables failed: {e}"
            ) from e

    async def _task_get_table_schema(
        self,
        table: str,
        base_id: Optional[str] = None,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Get schema for a specific table.

        Args:
            table: Table name or ID
            base_id: Base ID (optional, uses connection default)
            connection: Airtable client (injected)

        Returns:
            Dict with 'schema' containing field definitions

        Example YAML:
            - airtable_get_table_schema:
                id: get_schema
                connection: airtable
                table: "Contacts"
                base_id: "appXXXXXXXXXXXXXX"  # Optional
                outputs:
                  - schema
        """
        try:
            # First list tables to find the table
            tables_result = await self._task_list_tables(base_id, connection)
            tables = tables_result['tables']

            # Find table by name or ID
            table_info = None
            for t in tables:
                if t.get('name') == table or t.get('id') == table:
                    table_info = t
                    break

            if not table_info:
                raise ValueError(f"Table not found: {table}")

            # Extract schema
            schema = {
                'table_id': table_info.get('id'),
                'table_name': table_info.get('name'),
                'primary_field_id': table_info.get('primaryFieldId'),
                'fields': table_info.get('fields', [])
            }

            return {'schema': schema, 'field_count': len(schema['fields'])}

        except Exception as e:
            raise FlowExecutionError(
                f"Airtable get_table_schema failed: {e}"
            ) from e

    # Record Operation Tasks

    async def _task_list(
        self,
        table: str,
        base_id: Optional[str] = None,
        filter_by_formula: Optional[str] = None,
        sort: Optional[List[List[str]]] = None,
        max_records: Optional[int] = None,
        page_size: int = 100,
        view: Optional[str] = None,
        fields: Optional[List[str]] = None,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: List records from a table.

        Args:
            table: Table name
            base_id: Base ID (optional, uses connection default)
            filter_by_formula: Airtable formula to filter records
            sort: List of [field, direction] pairs (direction: "asc" or "desc")
            max_records: Maximum number of records to return
            page_size: Records per page (max 100)
            view: View name to use
            fields: List of field names to include
            connection: Airtable client (injected)

        Returns:
            Dict with 'records' list

        Example YAML:
            - airtable_list:
                id: fetch_contacts
                connection: airtable
                table: Contacts
                filter_by_formula: "AND({Active} = 1, {Type} = 'Customer')"
                sort: [["Name", "asc"], ["Created", "desc"]]
                max_records: 100
                fields: ["Name", "Email", "Phone"]
                outputs:
                  - records
                  - count
        """
        try:
            session = connection['session']
            base_id = base_id or connection.get('base_id')

            if not base_id:
                raise ValueError("base_id is required (provide in connection config or task)")

            url = f"https://api.airtable.com/v0/{base_id}/{table}"

            # Build query parameters
            params = {}
            if filter_by_formula:
                params['filterByFormula'] = filter_by_formula
            if view:
                params['view'] = view
            if fields:
                for field in fields:
                    params.setdefault('fields[]', []).append(field)
            if sort:
                for i, (field, direction) in enumerate(sort):
                    params[f'sort[{i}][field]'] = field
                    params[f'sort[{i}][direction]'] = direction
            if page_size:
                params['pageSize'] = min(page_size, 100)
            if max_records:
                params['maxRecords'] = max_records

            # Fetch records (with pagination)
            all_records = []
            offset = None

            while True:
                if offset:
                    params['offset'] = offset

                async with session.get(url, params=params) as response:
                    if response.status != 200:
                        text = await response.text()
                        raise Exception(f"API request failed ({response.status}): {text}")

                    data = await response.json()
                    records = data.get('records', [])
                    all_records.extend(records)

                    offset = data.get('offset')
                    if not offset or (max_records and len(all_records) >= max_records):
                        break

            if max_records:
                all_records = all_records[:max_records]

            return {'records': all_records, 'count': len(all_records)}

        except Exception as e:
            raise FlowExecutionError(
                f"Airtable list failed: {e}"
            ) from e

    async def _task_get(
        self,
        table: str,
        record_id: str,
        base_id: Optional[str] = None,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Get a single record by ID.

        Args:
            table: Table name
            record_id: Record ID
            base_id: Base ID (optional, uses connection default)
            connection: Airtable client (injected)

        Returns:
            Dict with 'record' data

        Example YAML:
            - airtable_get:
                id: fetch_record
                connection: airtable
                table: Contacts
                record_id: "recXXXXXXXXXXXXXX"
                outputs:
                  - record
        """
        try:
            session = connection['session']
            base_id = base_id or connection.get('base_id')

            if not base_id:
                raise ValueError("base_id is required (provide in connection config or task)")

            url = f"https://api.airtable.com/v0/{base_id}/{table}/{record_id}"

            async with session.get(url) as response:
                if response.status == 404:
                    return {'record': None, 'found': False}
                elif response.status != 200:
                    text = await response.text()
                    raise Exception(f"API request failed ({response.status}): {text}")

                record = await response.json()

                return {'record': record, 'found': True}

        except Exception as e:
            raise FlowExecutionError(
                f"Airtable get failed: {e}"
            ) from e

    async def _task_create(
        self,
        table: str,
        fields: Dict[str, Any],
        base_id: Optional[str] = None,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Create a new record.

        Args:
            table: Table name
            fields: Record fields as dict
            base_id: Base ID (optional, uses connection default)
            connection: Airtable client (injected)

        Returns:
            Dict with 'record' and 'record_id'

        Example YAML:
            - airtable_create:
                id: create_contact
                connection: airtable
                table: Contacts
                fields:
                  Name: "${inputs.name}"
                  Email: "${inputs.email}"
                  Active: true
                outputs:
                  - record_id
                  - record
        """
        try:
            session = connection['session']
            base_id = base_id or connection.get('base_id')

            if not base_id:
                raise ValueError("base_id is required (provide in connection config or task)")

            url = f"https://api.airtable.com/v0/{base_id}/{table}"

            payload = {'fields': fields}

            async with session.post(url, json=payload) as response:
                if response.status not in (200, 201):
                    text = await response.text()
                    raise Exception(f"API request failed ({response.status}): {text}")

                record = await response.json()

                return {
                    'record': record,
                    'record_id': record.get('id')
                }

        except Exception as e:
            raise FlowExecutionError(
                f"Airtable create failed: {e}"
            ) from e

    async def _task_update(
        self,
        table: str,
        record_id: str,
        fields: Dict[str, Any],
        base_id: Optional[str] = None,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Update an existing record.

        Args:
            table: Table name
            record_id: Record ID to update
            fields: Fields to update
            base_id: Base ID (optional, uses connection default)
            connection: Airtable client (injected)

        Returns:
            Dict with updated 'record'

        Example YAML:
            - airtable_update:
                id: update_contact
                connection: airtable
                table: Contacts
                record_id: "${create_contact.record_id}"
                fields:
                  Status: "Processed"
                  LastModified: "${now()}"
                outputs:
                  - record
        """
        try:
            session = connection['session']
            base_id = base_id or connection.get('base_id')

            if not base_id:
                raise ValueError("base_id is required (provide in connection config or task)")

            url = f"https://api.airtable.com/v0/{base_id}/{table}/{record_id}"

            payload = {'fields': fields}

            async with session.patch(url, json=payload) as response:
                if response.status != 200:
                    text = await response.text()
                    raise Exception(f"API request failed ({response.status}): {text}")

                record = await response.json()

                return {'record': record}

        except Exception as e:
            raise FlowExecutionError(
                f"Airtable update failed: {e}"
            ) from e

    async def _task_delete(
        self,
        table: str,
        record_ids: List[str],
        base_id: Optional[str] = None,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Delete one or more records.

        Args:
            table: Table name
            record_ids: List of record IDs to delete (max 10)
            base_id: Base ID (optional, uses connection default)
            connection: Airtable client (injected)

        Returns:
            Dict with 'deleted_ids' and 'deleted_count'

        Example YAML:
            - airtable_delete:
                id: delete_records
                connection: airtable
                table: Contacts
                record_ids: ["recXXX", "recYYY"]
                outputs:
                  - deleted_count
        """
        try:
            session = connection['session']
            base_id = base_id or connection.get('base_id')

            if not base_id:
                raise ValueError("base_id is required (provide in connection config or task)")

            if len(record_ids) > 10:
                raise ValueError("Can only delete up to 10 records at once")

            url = f"https://api.airtable.com/v0/{base_id}/{table}"

            # Build delete URL with record IDs as query params
            params = [('records[]', rid) for rid in record_ids]

            async with session.delete(url, params=params) as response:
                if response.status != 200:
                    text = await response.text()
                    raise Exception(f"API request failed ({response.status}): {text}")

                data = await response.json()
                deleted = data.get('records', [])
                deleted_ids = [r.get('id') for r in deleted]

                return {
                    'deleted_ids': deleted_ids,
                    'deleted_count': len(deleted_ids)
                }

        except Exception as e:
            raise FlowExecutionError(
                f"Airtable delete failed: {e}"
            ) from e

    async def _task_find(
        self,
        table: str,
        filter_by_formula: str,
        base_id: Optional[str] = None,
        sort: Optional[List[List[str]]] = None,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Find first record matching formula.

        Args:
            table: Table name
            filter_by_formula: Airtable formula to filter records
            base_id: Base ID (optional, uses connection default)
            sort: List of [field, direction] pairs
            connection: Airtable client (injected)

        Returns:
            Dict with 'record' (None if not found) and 'found' boolean

        Example YAML:
            - airtable_find:
                id: find_by_email
                connection: airtable
                table: Contacts
                filter_by_formula: "{Email} = '${inputs.email}'"
                outputs:
                  - record
                  - found
        """
        try:
            # Use list task with max_records=1
            result = await self._task_list(
                table=table,
                base_id=base_id,
                filter_by_formula=filter_by_formula,
                sort=sort,
                max_records=1,
                connection=connection
            )

            records = result.get('records', [])
            if records:
                return {'record': records[0], 'found': True}
            else:
                return {'record': None, 'found': False}

        except Exception as e:
            raise FlowExecutionError(
                f"Airtable find failed: {e}"
            ) from e

    async def _task_batch(
        self,
        table: str,
        operation: str,
        records: List[Dict[str, Any]],
        base_id: Optional[str] = None,
        connection=None
    ) -> Dict[str, Any]:
        """
        Built-in task: Batch create or update records.

        Args:
            table: Table name
            operation: Operation type ("create" or "update")
            records: List of records (max 10 per batch)
            base_id: Base ID (optional, uses connection default)
            connection: Airtable client (injected)

        Returns:
            Dict with 'records' list and 'count'

        Example YAML:
            - airtable_batch:
                id: batch_create
                connection: airtable
                table: Contacts
                operation: create
                records:
                  - fields: {Name: "Alice", Email: "alice@example.com"}
                  - fields: {Name: "Bob", Email: "bob@example.com"}
                outputs:
                  - records
                  - count
        """
        try:
            session = connection['session']
            base_id = base_id or connection.get('base_id')

            if not base_id:
                raise ValueError("base_id is required (provide in connection config or task)")

            if operation not in ('create', 'update'):
                raise ValueError(f"Invalid operation: {operation} (must be 'create' or 'update')")

            if len(records) > 10:
                raise ValueError("Can only batch up to 10 records at once")

            url = f"https://api.airtable.com/v0/{base_id}/{table}"

            payload = {'records': records}

            if operation == 'create':
                async with session.post(url, json=payload) as response:
                    if response.status not in (200, 201):
                        text = await response.text()
                        raise Exception(f"API request failed ({response.status}): {text}")

                    data = await response.json()
                    created_records = data.get('records', [])

                    return {
                        'records': created_records,
                        'count': len(created_records)
                    }

            elif operation == 'update':
                async with session.patch(url, json=payload) as response:
                    if response.status != 200:
                        text = await response.text()
                        raise Exception(f"API request failed ({response.status}): {text}")

                    data = await response.json()
                    updated_records = data.get('records', [])

                    return {
                        'records': updated_records,
                        'count': len(updated_records)
                    }

        except Exception as e:
            raise FlowExecutionError(
                f"Airtable batch {operation} failed: {e}"
            ) from e

    def get_dependencies(self) -> List[str]:
        """Return required pip packages"""
        return ["aiohttp>=3.8.0"]

    def scaffold_connection_config(self, name: str = "airtable", **kwargs) -> str:
        """
        Generate Airtable connection config YAML snippet.

        Args:
            name: Connection name
            **kwargs: Additional options

        Returns:
            YAML string
        """
        timeout = kwargs.get('timeout', 30.0)

        return f"""
  {name}:
    type: airtable
    api_key: ${{env.AIRTABLE_API_KEY}}
    base_id: ${{env.AIRTABLE_BASE_ID}}  # Optional for metadata operations
    timeout: {timeout}
"""

    def scaffold_example_flow(self, output_dir: str, connection_name: str = "airtable", **kwargs):
        """
        Generate example flow demonstrating Airtable connection.

        Args:
            output_dir: Directory to write example
            connection_name: Connection name to use
        """
        import os

        example = f'''flow: AirtableExample
description: Example flow using Airtable connection with metadata discovery

connections:
  {connection_name}:
    type: airtable
    api_key: ${{env.AIRTABLE_API_KEY}}
    base_id: ${{env.AIRTABLE_BASE_ID}}
    timeout: 30.0

inputs:
  - name: email
    type: string
    required: true

steps:
  # Metadata operations
  - airtable_list_bases:
      id: list_bases
      connection: {connection_name}
      outputs:
        - bases

  - airtable_list_tables:
      id: list_tables
      connection: {connection_name}
      outputs:
        - tables

  - airtable_get_table_schema:
      id: get_schema
      connection: {connection_name}
      table: Contacts
      outputs:
        - schema

  # Find existing record
  - airtable_find:
      id: find_contact
      connection: {connection_name}
      table: Contacts
      filter_by_formula: "{{Email}} = '${{inputs.email}}'"
      outputs:
        - record
        - found

  # Create if not found
  - airtable_create:
      id: create_contact
      connection: {connection_name}
      table: Contacts
      fields:
        Email: "${{inputs.email}}"
        Name: "New Contact"
        Active: true
      outputs:
        - record_id
        - record
      if: "not ${{find_contact.found}}"

  # Update if found
  - airtable_update:
      id: update_contact
      connection: {connection_name}
      table: Contacts
      record_id: "${{find_contact.record.id}}"
      fields:
        LastSeen: "${{now()}}"
      outputs:
        - record
      if: "${{find_contact.found}}"

  # List all active contacts
  - airtable_list:
      id: list_contacts
      connection: {connection_name}
      table: Contacts
      filter_by_formula: "{{Active}} = 1"
      sort: [["Name", "asc"]]
      max_records: 100
      outputs:
        - records
        - count

outputs:
  - name: bases_count
    value: ${{list_bases.count}}

  - name: tables_count
    value: ${{list_tables.count}}

  - name: contact_id
    value: ${{find_contact.record.id if find_contact.found else create_contact.record_id}}

  - name: total_contacts
    value: ${{list_contacts.count}}
'''

        os.makedirs(output_dir, exist_ok=True)
        example_path = os.path.join(output_dir, 'airtable_example.yaml')

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
