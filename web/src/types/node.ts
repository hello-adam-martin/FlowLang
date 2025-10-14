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

// Data stored in each node
export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  type: FlowNodeType;
  step?: Step;
  config?: any;
  errors?: string[];
  validated?: boolean;
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
