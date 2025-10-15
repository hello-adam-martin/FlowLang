// FlowLang YAML structure types
export interface FlowInput {
  name: string;
  type: string;
  required?: boolean;
  default?: any;
}

export interface FlowOutput {
  name: string;
  value: string | any;
}

export interface StepInput {
  [key: string]: any;
}

export interface Step {
  task?: string;
  id?: string;
  inputs?: StepInput;
  outputs?: string[];
  depends_on?: string[];
  retry?: RetryConfig;
  on_error?: Step[];
  connection?: string; // Connection name for database/service tasks

  // Control flow
  if?: string | ConditionalExpression;
  then?: Step[];
  else?: Step[];
  switch?: string;
  cases?: CaseExpression[];
  default?: Step[];
  for_each?: string;
  as?: string;
  do?: Step[];
  parallel?: Step[];

  // Termination
  exit?: boolean | ExitConfig;

  // Subflows (planned)
  subflow?: string;
}

export interface ConditionalExpression {
  any?: string[];
  all?: string[];
  none?: string[];
}

export interface CaseExpression {
  when: string | string[];
  do: Step[];
}

export interface ExitConfig {
  reason?: string;
  outputs?: Record<string, any>;
}

export interface RetryConfig {
  max_attempts?: number;
  delay?: number;
  backoff?: number;
}

export interface TriggerConfig {
  type: string;
  path?: string;
  method?: string;
  auth?: {
    type: string;
    header?: string;
    key?: string;
  };
  async?: boolean;
  input_mapping?: string;
}

// Connection configuration types
export type ConnectionType = 'postgres' | 'mysql' | 'mongodb' | 'redis' | 'sqlite' | 'airtable';

export interface BaseConnectionConfig {
  type: ConnectionType;
}

export interface PostgresConnectionConfig extends BaseConnectionConfig {
  type: 'postgres';
  url?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  pool_size?: number;
  min_pool_size?: number;
  timeout?: number;
}

export interface MySQLConnectionConfig extends BaseConnectionConfig {
  type: 'mysql';
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  pool_size?: number;
  charset?: string;
  timeout?: number;
}

export interface MongoDBConnectionConfig extends BaseConnectionConfig {
  type: 'mongodb';
  url?: string;
  database?: string;
  max_pool_size?: number;
  min_pool_size?: number;
}

export interface RedisConnectionConfig extends BaseConnectionConfig {
  type: 'redis';
  url?: string;
  max_connections?: number;
  decode_responses?: boolean;
  socket_timeout?: number;
}

export interface SQLiteConnectionConfig extends BaseConnectionConfig {
  type: 'sqlite';
  database: string;
  timeout?: number;
  isolation_level?: string;
}

export interface AirtableConnectionConfig extends BaseConnectionConfig {
  type: 'airtable';
  api_key?: string;
  base_id?: string;
}

export type ConnectionConfig =
  | PostgresConnectionConfig
  | MySQLConnectionConfig
  | MongoDBConnectionConfig
  | RedisConnectionConfig
  | SQLiteConnectionConfig
  | AirtableConnectionConfig;

export interface FlowDefinition {
  flow: string;
  description?: string;
  inputs?: FlowInput[];
  steps?: Step[];
  outputs?: FlowOutput[];
  triggers?: TriggerConfig[];
  connections?: Record<string, ConnectionConfig>;
  on_cancel?: Step[];
}
