# Airtable Connection Plugin

Production-ready Airtable cloud database integration for FlowLang with metadata discovery, record operations, and batch processing.

## Features

- ✅ Async HTTP client with aiohttp
- ✅ 10 built-in tasks for zero-boilerplate operations
- ✅ Metadata discovery (list bases, tables, schemas)
- ✅ Record CRUD operations
- ✅ Filter by formula support
- ✅ Sorting and pagination
- ✅ Batch operations
- ✅ Environment variable support
- ✅ Comprehensive error handling

## Installation

```bash
pip install aiohttp>=3.9.0
```

Or: `flowlang connection install airtable`

## Quick Start

### 1. Configure Connection

Add to your `flow.yaml`:

```yaml
connections:
  airtable:
    type: airtable
    api_key: ${env.AIRTABLE_API_KEY}
    base_id: ${env.AIRTABLE_BASE_ID}
    timeout: 30.0
```

### 2. Set Environment Variables

```bash
export AIRTABLE_API_KEY="your_api_key_here"
export AIRTABLE_BASE_ID="appXXXXXXXXXXXXXX"
```

Get your API key from: https://airtable.com/account

### 3. Use Built-in Tasks

```yaml
steps:
  - airtable_list:
      id: fetch_contacts
      connection: airtable
      table: Contacts
      filter_by_formula: "{Active} = 1"
      max_records: 100
      outputs:
        - records
        - count
```

## Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `api_key` | string | Yes | - | Airtable API key |
| `base_id` | string | Yes | - | Base ID (appXXXXXXXXXXXXXX) |
| `timeout` | float | No | 30.0 | Request timeout in seconds |

## Built-in Tasks

### Metadata Operations

#### airtable_list_bases

List all accessible bases.

**Parameters:**
- `connection` (auto-injected) - Airtable connection

**Returns:**
- `bases` - List of base objects with id, name, permissionLevel
- `count` - Number of bases

**Example:**

```yaml
- airtable_list_bases:
    id: list_bases
    connection: airtable
    outputs:
      - bases
      - count
```

#### airtable_list_tables

List all tables in the configured base.

**Parameters:**
- `connection` (auto-injected) - Airtable connection

**Returns:**
- `tables` - List of table objects with id, name, description, primaryFieldId, fields
- `count` - Number of tables

**Example:**

```yaml
- airtable_list_tables:
    id: list_tables
    connection: airtable
    outputs:
      - tables
      - count
```

#### airtable_get_table_schema

Get detailed schema for a specific table.

**Parameters:**
- `table` (string, required) - Table name
- `connection` (auto-injected) - Airtable connection

**Returns:**
- `schema` - Table schema with name, description, fields

**Example:**

```yaml
- airtable_get_table_schema:
    id: get_schema
    connection: airtable
    table: Contacts
    outputs:
      - schema
```

**Use Case - Dynamic Validation:**

```yaml
steps:
  - airtable_get_table_schema:
      id: get_schema
      connection: airtable
      table: "${inputs.table_name}"

  - task: ValidateFields
    inputs:
      schema: "${get_schema.schema}"
      data: "${inputs.record_data}"
```

### Record Operations

#### airtable_list

List records with filtering, sorting, and pagination.

**Parameters:**
- `table` (string, required) - Table name
- `base_id` (string, optional) - Override base ID from connection
- `filter_by_formula` (string, optional) - Airtable formula for filtering
- `sort` (list, optional) - Sort order [[field, direction], ...]
- `max_records` (int, optional) - Maximum records to return
- `page_size` (int, optional) - Records per page (max 100)
- `fields` (list, optional) - Specific fields to return
- `view` (string, optional) - View name to use
- `connection` (auto-injected) - Airtable connection

**Returns:**
- `records` - List of record objects
- `count` - Number of records

**Example - Basic:**

```yaml
- airtable_list:
    id: list_contacts
    connection: airtable
    table: Contacts
    outputs:
      - records
      - count
```

**Example - Filtered & Sorted:**

```yaml
- airtable_list:
    id: active_contacts
    connection: airtable
    table: Contacts
    filter_by_formula: "AND({Active} = 1, {Email} != '')"
    sort:
      - ["Name", "asc"]
      - ["Created", "desc"]
    max_records: 50
    outputs:
      - records
```

**Example - Specific Fields:**

```yaml
- airtable_list:
    id: contact_emails
    connection: airtable
    table: Contacts
    fields: ["Name", "Email", "Company"]
    outputs:
      - records
```

#### airtable_get

Get a single record by ID.

**Parameters:**
- `table` (string, required) - Table name
- `record_id` (string, required) - Record ID
- `base_id` (string, optional) - Override base ID
- `connection` (auto-injected) - Airtable connection

**Returns:**
- `record` - Record object with id and fields
- `found` - Boolean indicating if record exists

**Example:**

```yaml
- airtable_get:
    id: get_contact
    connection: airtable
    table: Contacts
    record_id: "${inputs.contact_id}"
    outputs:
      - record
      - found
```

#### airtable_create

Create a new record.

**Parameters:**
- `table` (string, required) - Table name
- `fields` (dict, required) - Field values
- `base_id` (string, optional) - Override base ID
- `connection` (auto-injected) - Airtable connection

**Returns:**
- `record` - Created record object
- `record_id` - ID of created record

**Example:**

```yaml
- airtable_create:
    id: create_contact
    connection: airtable
    table: Contacts
    fields:
      Name: "${inputs.name}"
      Email: "${inputs.email}"
      Active: true
      Tags: ["new", "prospect"]
    outputs:
      - record_id
      - record
```

#### airtable_update

Update an existing record.

**Parameters:**
- `table` (string, required) - Table name
- `record_id` (string, required) - Record ID to update
- `fields` (dict, required) - Fields to update
- `base_id` (string, optional) - Override base ID
- `connection` (auto-injected) - Airtable connection

**Returns:**
- `record` - Updated record object

**Example:**

```yaml
- airtable_update:
    id: update_contact
    connection: airtable
    table: Contacts
    record_id: "${inputs.contact_id}"
    fields:
      LastSeen: "${now()}"
      Status: "contacted"
    outputs:
      - record
```

#### airtable_delete

Delete a record.

**Parameters:**
- `table` (string, required) - Table name
- `record_id` (string, required) - Record ID to delete
- `base_id` (string, optional) - Override base ID
- `connection` (auto-injected) - Airtable connection

**Returns:**
- `deleted` - Boolean indicating success
- `record_id` - ID of deleted record

**Example:**

```yaml
- airtable_delete:
    id: delete_contact
    connection: airtable
    table: Contacts
    record_id: "${inputs.contact_id}"
    outputs:
      - deleted
```

#### airtable_find

Find first record matching a formula.

**Parameters:**
- `table` (string, required) - Table name
- `filter_by_formula` (string, required) - Airtable formula
- `base_id` (string, optional) - Override base ID
- `connection` (auto-injected) - Airtable connection

**Returns:**
- `record` - First matching record (or None)
- `found` - Boolean indicating if record was found

**Example:**

```yaml
- airtable_find:
    id: find_by_email
    connection: airtable
    table: Contacts
    filter_by_formula: "{Email} = '${inputs.email}'"
    outputs:
      - record
      - found
```

#### airtable_batch

Batch create, update, or delete records.

**Parameters:**
- `table` (string, required) - Table name
- `operation` (string, required) - Operation type: "create", "update", or "delete"
- `records` (list, required) - List of records (format varies by operation)
- `base_id` (string, optional) - Override base ID
- `connection` (auto-injected) - Airtable connection

**Returns:**
- `records` - List of affected records
- `count` - Number of records processed

**Example - Batch Create:**

```yaml
- airtable_batch:
    id: batch_create
    connection: airtable
    table: Contacts
    operation: create
    records:
      - fields:
          Name: "Alice"
          Email: "alice@example.com"
      - fields:
          Name: "Bob"
          Email: "bob@example.com"
    outputs:
      - records
      - count
```

**Example - Batch Update:**

```yaml
- airtable_batch:
    id: batch_update
    connection: airtable
    table: Contacts
    operation: update
    records:
      - id: "recXXXXXXXXXXXXXX"
        fields:
          Status: "active"
      - id: "recYYYYYYYYYYYYYY"
        fields:
          Status: "active"
    outputs:
      - records
```

**Example - Batch Delete:**

```yaml
- airtable_batch:
    id: batch_delete
    connection: airtable
    table: Contacts
    operation: delete
    records: ["recXXXXXXXXXXXXXX", "recYYYYYYYYYYYYYY"]
    outputs:
      - count
```

## Airtable Formula Language

### Comparison Operators

```yaml
# Equals
filter_by_formula: "{Status} = 'active'"

# Not equals
filter_by_formula: "{Status} != 'inactive'"

# Greater than
filter_by_formula: "{Age} > 18"

# Contains
filter_by_formula: "FIND('urgent', {Tags}) > 0"
```

### Logical Operators

```yaml
# AND
filter_by_formula: "AND({Active} = 1, {Email} != '')"

# OR
filter_by_formula: "OR({Status} = 'new', {Status} = 'pending')"

# NOT
filter_by_formula: "NOT({Archived} = 1)"
```

### String Functions

```yaml
# String concatenation
filter_by_formula: "{Name} & ' ' & {LastName} = '${inputs.full_name}'"

# Search
filter_by_formula: "SEARCH('${inputs.query}', {Description}) > 0"

# Case-insensitive
filter_by_formula: "LOWER({Email}) = LOWER('${inputs.email}')"
```

### Date Functions

```yaml
# Today
filter_by_formula: "{Created} = TODAY()"

# Date comparison
filter_by_formula: "IS_AFTER({DueDate}, TODAY())"

# Date range
filter_by_formula: "AND(IS_AFTER({Date}, '2024-01-01'), IS_BEFORE({Date}, '2024-12-31'))"
```

## Common Patterns

### Pattern 1: Upsert (Find or Create)

```yaml
steps:
  - airtable_find:
      id: find_contact
      connection: airtable
      table: Contacts
      filter_by_formula: "{Email} = '${inputs.email}'"
      outputs:
        - record
        - found

  - airtable_create:
      id: create_contact
      connection: airtable
      table: Contacts
      fields:
        Name: "${inputs.name}"
        Email: "${inputs.email}"
      if: "not ${find_contact.found}"

  - airtable_update:
      id: update_contact
      connection: airtable
      table: Contacts
      record_id: "${find_contact.record.id}"
      fields:
        LastSeen: "${now()}"
      if: "${find_contact.found}"
```

### Pattern 2: Multi-Base Integration

```yaml
connections:
  airtable:
    type: airtable
    api_key: ${env.AIRTABLE_API_KEY}
    # No base_id - will be specified per-task

steps:
  - airtable_list_bases:
      id: list_bases
      connection: airtable

  - airtable_list:
      id: fetch_from_base1
      connection: airtable
      base_id: "appXXXXXXXXXXXXXX"
      table: Customers

  - airtable_create:
      id: create_in_base2
      connection: airtable
      base_id: "appYYYYYYYYYYYYYY"
      table: Orders
      fields:
        Customer: "${fetch_from_base1.records[0].fields.Name}"
```

### Pattern 3: Schema-Driven Validation

```yaml
steps:
  - airtable_get_table_schema:
      id: get_schema
      connection: airtable
      table: "${inputs.table_name}"

  - task: ValidateData
    inputs:
      schema: "${get_schema.schema}"
      data: "${inputs.data}"

  - airtable_create:
      id: create_record
      connection: airtable
      table: "${inputs.table_name}"
      fields: "${inputs.data}"
      if: "${validate_data.valid}"
```

### Pattern 4: Bulk Data Migration

```yaml
steps:
  - airtable_list:
      id: fetch_all
      connection: airtable
      table: OldTable
      max_records: 1000

  - task: TransformRecords
    inputs:
      records: "${fetch_all.records}"
    outputs:
      - transformed

  - airtable_batch:
      id: import_records
      connection: airtable
      table: NewTable
      operation: create
      records: "${transformed.records}"
```

### Pattern 5: Webhook to Airtable

```yaml
flow: WebhookToAirtable
description: Receive webhook and create Airtable record

inputs:
  - name: webhook_data
    type: object

steps:
  - task: ParseWebhook
    inputs:
      data: "${inputs.webhook_data}"
    outputs:
      - parsed

  - airtable_create:
      id: create_record
      connection: airtable
      table: Leads
      fields:
        Name: "${parsed.name}"
        Email: "${parsed.email}"
        Source: "webhook"
        ReceivedAt: "${now()}"
```

## Best Practices

### 1. Use Environment Variables for Credentials

```yaml
connections:
  airtable:
    type: airtable
    api_key: ${env.AIRTABLE_API_KEY}  # Never hardcode
    base_id: ${env.AIRTABLE_BASE_ID}
```

### 2. Handle Rate Limits

Airtable has rate limits (5 requests/second per base):

```yaml
- airtable_list:
    retry:
      max_attempts: 3
      delay: 1
      backoff: 2
```

### 3. Use Batch Operations for Bulk Updates

✅ **Good (Single Request):**
```yaml
- airtable_batch:
    operation: update
    records: [...]  # Up to 10 records
```

❌ **Bad (Multiple Requests):**
```yaml
- airtable_update:
    record_id: "rec1"
- airtable_update:
    record_id: "rec2"
# ...
```

### 4. Leverage Metadata Discovery

```yaml
# Discover available tables dynamically
- airtable_list_tables:
    id: discover_tables

# Process each table
- for_each: "${discover_tables.tables}"
  as: table
  do:
    - airtable_list:
        table: "${table.name}"
```

### 5. Use Field-Specific Queries

```yaml
# Only fetch needed fields to reduce payload
- airtable_list:
    table: Contacts
    fields: ["Name", "Email"]  # Not all fields
```

## Error Handling

### Common Errors

#### Authentication Failed (401)

```
ConnectionError: Invalid API key
```

**Solution**: Verify API key is correct and has proper permissions

#### Not Found (404)

```
API request failed (404)
```

**Solutions:**
- Verify base_id is correct
- Verify table name matches exactly (case-sensitive)
- Check record_id exists

#### Rate Limited (429)

```
API request failed (429): Rate limit exceeded
```

**Solution**: Use retry logic with exponential backoff

### Error Handling Example

```yaml
- airtable_create:
    id: create_contact
    connection: airtable
    table: Contacts
    fields: "${inputs.data}"
    retry:
      max_attempts: 3
      delay: 1
      backoff: 2
    on_error:
      - task: LogError
        inputs:
          error: "${context.last_error}"
          operation: "create_contact"
```

## CLI Commands

```bash
# Show plugin information
flowlang connection info airtable

# Check dependencies
flowlang connection deps airtable --check

# Install dependencies
flowlang connection install airtable

# Generate connection config
flowlang connection scaffold airtable --name my_airtable

# Generate example flow
flowlang connection example airtable
```

## Complete Example Flow

```yaml
flow: AirtableContactManager
description: Complete contact management with Airtable metadata discovery

connections:
  airtable:
    type: airtable
    api_key: ${env.AIRTABLE_API_KEY}
    base_id: ${env.AIRTABLE_BASE_ID}
    timeout: 30.0

inputs:
  - name: action
    type: string
    required: true
  - name: email
    type: string
  - name: contact_data
    type: object

steps:
  # Discover schema
  - airtable_list_tables:
      id: list_tables
      connection: airtable

  - airtable_get_table_schema:
      id: get_schema
      connection: airtable
      table: Contacts

  # Find existing contact
  - airtable_find:
      id: find_contact
      connection: airtable
      table: Contacts
      filter_by_formula: "{Email} = '${inputs.email}'"
      if: "${inputs.action in ['get', 'update', 'delete']}"

  # Create new contact
  - airtable_create:
      id: create_contact
      connection: airtable
      table: Contacts
      fields: "${inputs.contact_data}"
      if: "${inputs.action == 'create'}"

  # Update existing contact
  - airtable_update:
      id: update_contact
      connection: airtable
      table: Contacts
      record_id: "${find_contact.record.id}"
      fields: "${inputs.contact_data}"
      if: "${inputs.action == 'update' and find_contact.found}"

  # Delete contact
  - airtable_delete:
      id: delete_contact
      connection: airtable
      table: Contacts
      record_id: "${find_contact.record.id}"
      if: "${inputs.action == 'delete' and find_contact.found}"

  # List all active contacts
  - airtable_list:
      id: list_contacts
      connection: airtable
      table: Contacts
      filter_by_formula: "{Active} = 1"
      sort: [["Name", "asc"]]
      if: "${inputs.action == 'list'}"

outputs:
  - name: tables_count
    value: ${list_tables.count}
  
  - name: result
    value: |
      ${
        create_contact.record if inputs.action == 'create' else
        update_contact.record if inputs.action == 'update' else
        find_contact.record if inputs.action == 'get' else
        list_contacts.records if inputs.action == 'list' else
        {'deleted': delete_contact.deleted}
      }
```

## Related Documentation

- [Database Integration Guide](../../../docs/database-integration.md)
- [Creating Connection Plugins](../../../docs/creating-connection-plugins.md)
- [Airtable API Documentation](https://airtable.com/developers/web/api/introduction)

## License

Part of FlowLang - MIT License
