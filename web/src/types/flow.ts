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

export interface FlowDefinition {
  flow: string;
  description?: string;
  inputs?: FlowInput[];
  steps?: Step[];
  outputs?: FlowOutput[];
  triggers?: TriggerConfig[];
  on_cancel?: Step[];
}
