import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from './node';
import type { FlowDefinition } from './flow';
import type { ExecutionHistoryEntry } from './execution';

/**
 * Metadata for a single flow within a project
 */
export interface FlowMetadata {
  id: string;
  name: string;
  created: number;
  modified: number;
  description?: string;
}

/**
 * Execution state for a flow
 */
export interface ExecutionState {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  stepMode: boolean;
  currentNodeId: string | null;
  nodeStates: Record<string, NodeExecutionData>;
  executionLog: Array<{
    nodeId: string;
    timestamp: number;
    message: string;
    level: 'info' | 'warning' | 'error';
  }>;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  startTime?: number;
  endTime?: number;
}

/**
 * Node execution data
 */
export interface NodeExecutionData {
  state: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
  startTime?: number;
  endTime?: number;
  output?: any;
  error?: string;
  inputs?: Record<string, any>;
  inputSources?: Record<string, string>;
}

/**
 * Complete flow data including graph, definition, and execution state
 */
export interface FlowData {
  metadata: FlowMetadata;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  flowDefinition: FlowDefinition;
  execution?: ExecutionState;
  executionHistory?: ExecutionHistoryEntry[];
}

/**
 * Project-level metadata
 */
export interface ProjectMetadata {
  name: string;
  description?: string;
  version: string;
  created: number;
  modified: number;
}

/**
 * Complete project containing multiple flows
 */
export interface Project {
  metadata: ProjectMetadata;
  flows: Record<string, FlowData>;
  currentFlowId: string | null;
}

/**
 * Serializable project format for localStorage
 */
export interface SerializedProject {
  metadata: ProjectMetadata;
  flows: Record<string, FlowData>;
  currentFlowId: string | null;
  version: string; // Schema version for migrations
}
