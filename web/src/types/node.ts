import type { Node as ReactFlowNode, Edge } from '@xyflow/react';
import type { Step } from './flow';

// Node types in our visual designer
export type FlowNodeType =
  | 'start'             // Start node - always present, entry point of flow
  | 'task'              // Regular task node (can be child or standalone)
  | 'loopContainer'     // Loop wrapper - contains child tasks
  | 'conditionalContainer'  // If/then/else wrapper - contains child tasks
  | 'switchContainer'   // Switch/case wrapper - contains child tasks in cases
  | 'parallelContainer'     // Parallel execution wrapper - contains child tasks
  | 'subflow'           // Subflow execution node
  | 'exit'              // Exit/termination node
  | 'note'              // Annotation/comment node - doesn't affect flow execution
  | 'input'
  | 'output';

// Track definition for parallel containers
export interface ParallelTrack {
  id: string;
  taskId?: string; // ID of the task node assigned to this track
}

// Case definition for switch containers
export interface SwitchCase {
  id: string;
  when: string | number | boolean | (string | number | boolean)[];
}

// Data stored in each node
export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  type: FlowNodeType;
  step?: Step;
  config?: any;
  errors?: string[];
  validated?: boolean;
  badge?: string;          // Optional badge display (e.g., count, status)
  isEntryPoint?: boolean;  // Marks entry point for parallel tracks
  section?: string;        // For conditional containers (then/else)
  caseId?: string;         // For tasks inside switch containers - which case they belong to
  tracks?: ParallelTrack[]; // For parallel containers - explicit track definitions
  trackId?: string;        // For tasks inside parallel containers - which track they belong to
  cases?: SwitchCase[];    // For switch containers - case definitions
  loopExecutionOrder?: number; // For tasks inside loop containers - execution order (1, 2, 3, ...)
  executionOrder?: number; // For tasks inside parallel containers - execution order based on dependencies
}

// Extended ReactFlow node with our custom data
export type FlowNode = ReactFlowNode<FlowNodeData>;

// Flow state
export interface FlowState {
  nodes: FlowNode[];
  edges: Edge[];
  flowDefinition: import('./flow').FlowDefinition;
}

// Node template for drag-and-drop palette
export interface NodeTemplate {
  type: FlowNodeType;
  label: string;
  description: string;
  icon?: string;
  defaultData?: Partial<FlowNodeData>;
}
