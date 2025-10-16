import type { NodeExecutionData } from './project';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from './node';

/**
 * Metadata about where and how an execution was triggered
 */
export interface ExecutionMetadata {
  flowId?: string;
  flowName: string;
  triggeredBy: 'manual' | 'webhook' | 'schedule' | 'api';
  triggerDetails?: string;
}

/**
 * A complete record of a single flow execution
 */
export interface ExecutionHistoryEntry {
  id: string; // Unique ID for this execution
  timestamp: number; // When execution started
  status: 'completed' | 'error' | 'stopped';
  duration: number; // Duration in milliseconds
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  nodeStates: Record<string, NodeExecutionData>;
  executionLog: Array<{
    nodeId: string;
    timestamp: number;
    message: string;
    level: 'info' | 'warning' | 'error';
  }>;
  metadata: ExecutionMetadata;
  error?: string; // Overall execution error if status is 'error'
  // Flow snapshot at time of execution
  flowSnapshot?: {
    nodes: Node<FlowNodeData>[];
    edges: Edge[];
  };
}

/**
 * Configuration for execution history management
 */
export interface ExecutionHistoryConfig {
  maxEntries: number; // Maximum number of history entries to keep per flow
  autoSave: boolean; // Automatically save executions to history
}

export const DEFAULT_HISTORY_CONFIG: ExecutionHistoryConfig = {
  maxEntries: 50,
  autoSave: true,
};
