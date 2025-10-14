import type { Node as ReactFlowNode, Edge } from '@xyflow/react';
import type { Step } from './flow';

// Node types in our visual designer
export type FlowNodeType =
  | 'task'              // Regular task node (can be child or standalone)
  | 'loopContainer'     // Loop wrapper - contains child tasks
  | 'conditionalContainer'  // If/then/else wrapper - contains child tasks
  | 'parallelContainer'     // Parallel execution wrapper - contains child tasks
  | 'exit'
  | 'input'
  | 'output';

// Track definition for parallel containers
export interface ParallelTrack {
  id: string;
  taskId?: string; // ID of the task node assigned to this track
}

// Data stored in each node
export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  type: FlowNodeType;
  step?: Step;
  config?: any;
  errors?: string[];
  validated?: boolean;
  isEntryPoint?: boolean;  // Marks entry point for parallel tracks
  section?: string;        // For conditional containers (then/else)
  tracks?: ParallelTrack[]; // For parallel containers - explicit track definitions
  trackId?: string;        // For tasks inside parallel containers - which track they belong to
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
