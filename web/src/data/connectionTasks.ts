import type { ConnectionType } from '../types/flow';

export interface TaskInput {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: any;
}

export interface ConnectionTaskMetadata {
  name: string;
  connectionType: ConnectionType;
  label: string;
  description: string;
  inputs: TaskInput[];
  outputs: string[];
  example?: string;
}

export const CONNECTION_TASKS: ConnectionTaskMetadata[] = [
  // PostgreSQL Tasks
  {
    name: 'pg_query',
    connectionType: 'postgres',
    label: 'Query',
    description: 'Execute SELECT query and return rows',
    inputs: [
      { name: 'query', type: 'string', required: true, description: 'SQL SELECT query' },
      { name: 'params', type: 'array', required: false, description: 'Query parameters ($1, $2, ...)' },
    ],
    outputs: ['rows', 'count'],
    example: 'SELECT * FROM users WHERE age > $1',
  },
  {
    name: 'pg_execute',
    connectionType: 'postgres',
    label: 'Execute',
    description: 'Execute INSERT/UPDATE/DELETE operation',
    inputs: [
      { name: 'query', type: 'string', required: true, description: 'SQL INSERT/UPDATE/DELETE query' },
      { name: 'params', type: 'array', required: false, description: 'Query parameters ($1, $2, ...)' },
    ],
    outputs: ['rows_affected'],
    example: 'UPDATE users SET active = $1 WHERE id = $2',
  },
  {
    name: 'pg_transaction',
    connectionType: 'postgres',
    label: 'Transaction',
    description: 'Execute multiple queries atomically',
    inputs: [
      { name: 'queries', type: 'array', required: true, description: 'Array of {query, params} objects' },
    ],
    outputs: ['results', 'count'],
    example: '[{query: "UPDATE accounts SET balance = balance - $1 WHERE id = $2", params: [100, 1]}]',
  },
  {
    name: 'pg_batch_insert',
    connectionType: 'postgres',
    label: 'Batch Insert',
    description: 'Bulk insert records efficiently (10-30x faster)',
    inputs: [
      { name: 'table', type: 'string', required: true, description: 'Table name' },
      { name: 'records', type: 'array', required: true, description: 'Array of record objects' },
      { name: 'batch_size', type: 'number', required: false, description: 'Batch size (default: 1000)', default: 1000 },
    ],
    outputs: ['inserted_count', 'batches', 'table'],
    example: 'table: "users", records: [{name: "Alice", email: "alice@example.com"}]',
  },
  {
    name: 'pg_batch_update',
    connectionType: 'postgres',
    label: 'Batch Update',
    description: 'Bulk update records efficiently',
    inputs: [
      { name: 'table', type: 'string', required: true, description: 'Table name' },
      { name: 'key_field', type: 'string', required: false, description: 'Field to match on (default: "id")', default: 'id' },
      { name: 'updates', type: 'array', required: true, description: 'Array of update objects' },
      { name: 'batch_size', type: 'number', required: false, description: 'Batch size (default: 1000)', default: 1000 },
    ],
    outputs: ['updated_count', 'batches', 'table'],
    example: 'table: "products", updates: [{id: 1, price: 29.99}]',
  },

  // MySQL Tasks
  {
    name: 'mysql_query',
    connectionType: 'mysql',
    label: 'Query',
    description: 'Execute SELECT query and return rows',
    inputs: [
      { name: 'query', type: 'string', required: true, description: 'SQL SELECT query' },
      { name: 'params', type: 'array', required: false, description: 'Query parameters (%s placeholders)' },
    ],
    outputs: ['rows', 'count'],
    example: 'SELECT * FROM users WHERE age > %s',
  },
  {
    name: 'mysql_execute',
    connectionType: 'mysql',
    label: 'Execute',
    description: 'Execute INSERT/UPDATE/DELETE operation',
    inputs: [
      { name: 'query', type: 'string', required: true, description: 'SQL INSERT/UPDATE/DELETE query' },
      { name: 'params', type: 'array', required: false, description: 'Query parameters (%s placeholders)' },
    ],
    outputs: ['rows_affected'],
    example: 'INSERT INTO users (name, email) VALUES (%s, %s)',
  },
  {
    name: 'mysql_transaction',
    connectionType: 'mysql',
    label: 'Transaction',
    description: 'Execute multiple queries atomically',
    inputs: [
      { name: 'queries', type: 'array', required: true, description: 'Array of {query, params} objects' },
    ],
    outputs: ['results'],
    example: '[{query: "UPDATE accounts SET balance = balance - %s WHERE id = %s", params: [100, 1]}]',
  },
  {
    name: 'mysql_batch_insert',
    connectionType: 'mysql',
    label: 'Batch Insert',
    description: 'Bulk insert records efficiently',
    inputs: [
      { name: 'table', type: 'string', required: true, description: 'Table name' },
      { name: 'records', type: 'array', required: true, description: 'Array of record objects' },
      { name: 'batch_size', type: 'number', required: false, description: 'Batch size (default: 1000)', default: 1000 },
    ],
    outputs: ['inserted_count', 'batches'],
    example: 'table: "orders", records: [{order_id: "ORD001", total: 99.99}]',
  },
  {
    name: 'mysql_batch_update',
    connectionType: 'mysql',
    label: 'Batch Update',
    description: 'Bulk update records efficiently',
    inputs: [
      { name: 'table', type: 'string', required: true, description: 'Table name' },
      { name: 'key_field', type: 'string', required: false, description: 'Field to match on (default: "id")', default: 'id' },
      { name: 'updates', type: 'array', required: true, description: 'Array of update objects' },
      { name: 'batch_size', type: 'number', required: false, description: 'Batch size (default: 1000)', default: 1000 },
    ],
    outputs: ['updated_count'],
    example: 'table: "orders", updates: [{order_id: "ORD001", status: "shipped"}]',
  },

  // MongoDB Tasks
  {
    name: 'mongo_find',
    connectionType: 'mongodb',
    label: 'Find',
    description: 'Find multiple documents',
    inputs: [
      { name: 'collection', type: 'string', required: true, description: 'Collection name' },
      { name: 'filter', type: 'object', required: false, description: 'Query filter object', default: {} },
      { name: 'sort', type: 'array', required: false, description: 'Sort specification' },
      { name: 'limit', type: 'number', required: false, description: 'Maximum documents to return' },
    ],
    outputs: ['documents', 'count'],
    example: 'filter: {active: true, age: {$gt: 18}}',
  },
  {
    name: 'mongo_find_one',
    connectionType: 'mongodb',
    label: 'Find One',
    description: 'Find single document',
    inputs: [
      { name: 'collection', type: 'string', required: true, description: 'Collection name' },
      { name: 'filter', type: 'object', required: true, description: 'Query filter object' },
    ],
    outputs: ['document', 'found'],
    example: 'filter: {_id: "507f1f77bcf86cd799439011"}',
  },
  {
    name: 'mongo_insert',
    connectionType: 'mongodb',
    label: 'Insert',
    description: 'Insert documents',
    inputs: [
      { name: 'collection', type: 'string', required: true, description: 'Collection name' },
      { name: 'documents', type: 'array', required: true, description: 'Array of documents to insert' },
    ],
    outputs: ['inserted_ids', 'count'],
    example: 'documents: [{name: "Alice", email: "alice@example.com"}]',
  },
  {
    name: 'mongo_update',
    connectionType: 'mongodb',
    label: 'Update',
    description: 'Update documents',
    inputs: [
      { name: 'collection', type: 'string', required: true, description: 'Collection name' },
      { name: 'filter', type: 'object', required: true, description: 'Query filter object' },
      { name: 'update', type: 'object', required: true, description: 'Update operations' },
      { name: 'many', type: 'boolean', required: false, description: 'Update multiple documents', default: false },
      { name: 'upsert', type: 'boolean', required: false, description: 'Insert if not found', default: false },
    ],
    outputs: ['matched_count', 'modified_count', 'upserted_id'],
    example: 'update: {$set: {active: false}}',
  },
  {
    name: 'mongo_delete',
    connectionType: 'mongodb',
    label: 'Delete',
    description: 'Delete documents',
    inputs: [
      { name: 'collection', type: 'string', required: true, description: 'Collection name' },
      { name: 'filter', type: 'object', required: true, description: 'Query filter object' },
      { name: 'many', type: 'boolean', required: false, description: 'Delete multiple documents', default: false },
    ],
    outputs: ['deleted_count'],
    example: 'filter: {active: false, created_at: {$lt: "2020-01-01"}}',
  },
  {
    name: 'mongo_count',
    connectionType: 'mongodb',
    label: 'Count',
    description: 'Count documents',
    inputs: [
      { name: 'collection', type: 'string', required: true, description: 'Collection name' },
      { name: 'filter', type: 'object', required: false, description: 'Query filter object', default: {} },
    ],
    outputs: ['count'],
    example: 'filter: {status: "active"}',
  },
  {
    name: 'mongo_aggregate',
    connectionType: 'mongodb',
    label: 'Aggregate',
    description: 'Run aggregation pipeline',
    inputs: [
      { name: 'collection', type: 'string', required: true, description: 'Collection name' },
      { name: 'pipeline', type: 'array', required: true, description: 'Aggregation pipeline stages' },
    ],
    outputs: ['documents', 'count'],
    example: 'pipeline: [{$match: {active: true}}, {$group: {_id: "$country", count: {$sum: 1}}}]',
  },

  // Redis Tasks
  {
    name: 'redis_get',
    connectionType: 'redis',
    label: 'Get',
    description: 'Get value by key',
    inputs: [
      { name: 'key', type: 'string', required: true, description: 'Key to retrieve' },
    ],
    outputs: ['value', 'exists'],
    example: 'key: "user:123"',
  },
  {
    name: 'redis_set',
    connectionType: 'redis',
    label: 'Set',
    description: 'Set key-value pair with optional TTL',
    inputs: [
      { name: 'key', type: 'string', required: true, description: 'Key to set' },
      { name: 'value', type: 'string', required: true, description: 'Value to store' },
      { name: 'ex', type: 'number', required: false, description: 'Expiration in seconds (TTL)' },
    ],
    outputs: ['success'],
    example: 'key: "session:abc123", value: "user_data", ex: 3600',
  },
  {
    name: 'redis_delete',
    connectionType: 'redis',
    label: 'Delete',
    description: 'Delete keys',
    inputs: [
      { name: 'keys', type: 'array', required: true, description: 'Array of keys to delete' },
    ],
    outputs: ['deleted_count'],
    example: 'keys: ["user:123", "user:456"]',
  },
  {
    name: 'redis_exists',
    connectionType: 'redis',
    label: 'Exists',
    description: 'Check if keys exist',
    inputs: [
      { name: 'keys', type: 'array', required: true, description: 'Array of keys to check' },
    ],
    outputs: ['count', 'exists'],
    example: 'keys: ["user:123"]',
  },
  {
    name: 'redis_expire',
    connectionType: 'redis',
    label: 'Expire',
    description: 'Set key expiration',
    inputs: [
      { name: 'key', type: 'string', required: true, description: 'Key to expire' },
      { name: 'seconds', type: 'number', required: true, description: 'TTL in seconds' },
    ],
    outputs: ['success'],
    example: 'key: "session:abc123", seconds: 3600',
  },
  {
    name: 'redis_incr',
    connectionType: 'redis',
    label: 'Increment',
    description: 'Increment counter',
    inputs: [
      { name: 'key', type: 'string', required: true, description: 'Key to increment' },
      { name: 'amount', type: 'number', required: false, description: 'Amount to increment', default: 1 },
    ],
    outputs: ['value'],
    example: 'key: "counter:page_views"',
  },
  {
    name: 'redis_hgetall',
    connectionType: 'redis',
    label: 'Hash Get All',
    description: 'Get all hash fields',
    inputs: [
      { name: 'key', type: 'string', required: true, description: 'Hash key' },
    ],
    outputs: ['hash'],
    example: 'key: "user:123:profile"',
  },
  {
    name: 'redis_hset',
    connectionType: 'redis',
    label: 'Hash Set',
    description: 'Set multiple hash fields',
    inputs: [
      { name: 'key', type: 'string', required: true, description: 'Hash key' },
      { name: 'mapping', type: 'object', required: true, description: 'Field-value pairs' },
    ],
    outputs: ['fields_set'],
    example: 'key: "user:123:profile", mapping: {name: "Alice", email: "alice@example.com"}',
  },

  // SQLite Tasks
  {
    name: 'sqlite_query',
    connectionType: 'sqlite',
    label: 'Query',
    description: 'Execute SELECT query and return rows',
    inputs: [
      { name: 'query', type: 'string', required: true, description: 'SQL SELECT query' },
      { name: 'params', type: 'array', required: false, description: 'Query parameters (? placeholders)' },
    ],
    outputs: ['rows', 'count'],
    example: 'SELECT * FROM users WHERE age > ?',
  },
  {
    name: 'sqlite_execute',
    connectionType: 'sqlite',
    label: 'Execute',
    description: 'Execute INSERT/UPDATE/DELETE operation',
    inputs: [
      { name: 'query', type: 'string', required: true, description: 'SQL INSERT/UPDATE/DELETE query' },
      { name: 'params', type: 'array', required: false, description: 'Query parameters (? placeholders)' },
    ],
    outputs: ['rows_affected'],
    example: 'UPDATE users SET active = ? WHERE id = ?',
  },
  {
    name: 'sqlite_transaction',
    connectionType: 'sqlite',
    label: 'Transaction',
    description: 'Execute multiple queries atomically',
    inputs: [
      { name: 'queries', type: 'array', required: true, description: 'Array of {query, params} objects' },
    ],
    outputs: ['results', 'count'],
    example: '[{query: "UPDATE accounts SET balance = balance - ? WHERE id = ?", params: [100, 1]}]',
  },
  {
    name: 'sqlite_batch_insert',
    connectionType: 'sqlite',
    label: 'Batch Insert',
    description: 'Bulk insert records efficiently',
    inputs: [
      { name: 'table', type: 'string', required: true, description: 'Table name' },
      { name: 'records', type: 'array', required: true, description: 'Array of record objects' },
      { name: 'batch_size', type: 'number', required: false, description: 'Batch size (default: 1000)', default: 1000 },
    ],
    outputs: ['inserted_count', 'batches'],
    example: 'table: "logs", records: [{level: "INFO", message: "Server started"}]',
  },
  {
    name: 'sqlite_batch_update',
    connectionType: 'sqlite',
    label: 'Batch Update',
    description: 'Bulk update records efficiently',
    inputs: [
      { name: 'table', type: 'string', required: true, description: 'Table name' },
      { name: 'key_field', type: 'string', required: false, description: 'Field to match on (default: "id")', default: 'id' },
      { name: 'updates', type: 'array', required: true, description: 'Array of update objects' },
      { name: 'batch_size', type: 'number', required: false, description: 'Batch size (default: 1000)', default: 1000 },
    ],
    outputs: ['updated_count'],
    example: 'table: "users", updates: [{id: 1, status: "verified"}]',
  },

  // Airtable Tasks
  {
    name: 'airtable_list_bases',
    connectionType: 'airtable',
    label: 'List Bases',
    description: 'List available bases',
    inputs: [],
    outputs: ['bases'],
    example: 'Returns all bases accessible with the API key',
  },
  {
    name: 'airtable_list_tables',
    connectionType: 'airtable',
    label: 'List Tables',
    description: 'List tables in base',
    inputs: [],
    outputs: ['tables'],
    example: 'Lists all tables in the configured base',
  },
  {
    name: 'airtable_get_table_schema',
    connectionType: 'airtable',
    label: 'Get Schema',
    description: 'Get table schema',
    inputs: [
      { name: 'table', type: 'string', required: true, description: 'Table name or ID' },
    ],
    outputs: ['schema', 'fields'],
    example: 'table: "Users"',
  },
  {
    name: 'airtable_list',
    connectionType: 'airtable',
    label: 'List Records',
    description: 'List records from table',
    inputs: [
      { name: 'table', type: 'string', required: true, description: 'Table name or ID' },
      { name: 'max_records', type: 'number', required: false, description: 'Maximum records to return' },
      { name: 'view', type: 'string', required: false, description: 'View name' },
    ],
    outputs: ['records', 'count'],
    example: 'table: "Users", max_records: 100',
  },
  {
    name: 'airtable_get',
    connectionType: 'airtable',
    label: 'Get Record',
    description: 'Get single record by ID',
    inputs: [
      { name: 'table', type: 'string', required: true, description: 'Table name or ID' },
      { name: 'record_id', type: 'string', required: true, description: 'Record ID' },
    ],
    outputs: ['record', 'found'],
    example: 'table: "Users", record_id: "recABC123"',
  },
  {
    name: 'airtable_create',
    connectionType: 'airtable',
    label: 'Create Records',
    description: 'Create new records',
    inputs: [
      { name: 'table', type: 'string', required: true, description: 'Table name or ID' },
      { name: 'records', type: 'array', required: true, description: 'Array of record objects' },
    ],
    outputs: ['created_ids', 'count'],
    example: 'table: "Users", records: [{fields: {Name: "Alice", Email: "alice@example.com"}}]',
  },
  {
    name: 'airtable_update',
    connectionType: 'airtable',
    label: 'Update Records',
    description: 'Update existing records',
    inputs: [
      { name: 'table', type: 'string', required: true, description: 'Table name or ID' },
      { name: 'records', type: 'array', required: true, description: 'Array of {id, fields} objects' },
    ],
    outputs: ['updated_count'],
    example: 'table: "Users", records: [{id: "recABC123", fields: {Status: "Active"}}]',
  },
  {
    name: 'airtable_delete',
    connectionType: 'airtable',
    label: 'Delete Records',
    description: 'Delete records',
    inputs: [
      { name: 'table', type: 'string', required: true, description: 'Table name or ID' },
      { name: 'record_ids', type: 'array', required: true, description: 'Array of record IDs' },
    ],
    outputs: ['deleted_count'],
    example: 'table: "Users", record_ids: ["recABC123", "recDEF456"]',
  },
  {
    name: 'airtable_find',
    connectionType: 'airtable',
    label: 'Find Records',
    description: 'Find records by filter formula',
    inputs: [
      { name: 'table', type: 'string', required: true, description: 'Table name or ID' },
      { name: 'filter_formula', type: 'string', required: true, description: 'Airtable filter formula' },
      { name: 'max_records', type: 'number', required: false, description: 'Maximum records to return' },
    ],
    outputs: ['records', 'count'],
    example: 'filter_formula: "{Status} = \'Active\'"',
  },
  {
    name: 'airtable_batch',
    connectionType: 'airtable',
    label: 'Batch Operations',
    description: 'Batch create/update/delete operations',
    inputs: [
      { name: 'table', type: 'string', required: true, description: 'Table name or ID' },
      { name: 'operations', type: 'array', required: true, description: 'Array of operation objects' },
    ],
    outputs: ['results', 'count'],
    example: 'operations: [{type: "create", fields: {...}}, {type: "update", id: "recABC123", fields: {...}}]',
  },
];

/**
 * Get all tasks for a specific connection type
 */
export function getTasksForConnectionType(connectionType: ConnectionType): ConnectionTaskMetadata[] {
  return CONNECTION_TASKS.filter(task => task.connectionType === connectionType);
}

/**
 * Get task metadata by task name
 */
export function getTaskMetadata(taskName: string): ConnectionTaskMetadata | undefined {
  return CONNECTION_TASKS.find(task => task.name === taskName);
}

/**
 * Check if a task is a built-in connection task
 */
export function isBuiltInTask(taskName: string): boolean {
  return CONNECTION_TASKS.some(task => task.name === taskName);
}
