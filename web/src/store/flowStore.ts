import { create } from 'zustand';
import { addEdge, applyNodeChanges, applyEdgeChanges, type Node, type Edge, type Connection, type NodeChange, type EdgeChange } from '@xyflow/react';
import type { FlowNodeData } from '../types/node';
import type { FlowDefinition } from '../types/flow';

type ExecutionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';
type NodeExecutionState = 'pending' | 'running' | 'completed' | 'error' | 'skipped';

interface NodeExecutionData {
  state: NodeExecutionState;
  startTime?: number;
  endTime?: number;
  output?: any;
  error?: string;
}

interface ExecutionState {
  status: ExecutionStatus;
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

interface FlowStore {
  // State
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  flowDefinition: FlowDefinition;
  selectedNode: string | null;
  nodeIdCounter: number;
  execution: ExecutionState;

  // Actions
  setNodes: (nodes: Node<FlowNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  setFlowDefinition: (definition: FlowDefinition) => void;
  setSelectedNode: (nodeId: string | null) => void;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  addNode: (node: Node<FlowNodeData>) => void;
  removeNode: (nodeId: string) => void;
  updateNode: (nodeId: string, data: Partial<FlowNodeData>) => void;
  updateFlowDefinition: (updates: Partial<FlowDefinition>) => void;
  getNextNodeId: () => string;

  // Execution actions
  startExecution: (inputs: Record<string, any>) => void;
  stopExecution: () => void;
  pauseExecution: () => void;
  resumeExecution: () => void;
  setStepMode: (enabled: boolean) => void;
  updateNodeExecutionState: (nodeId: string, state: Partial<NodeExecutionData>) => void;
  addExecutionLog: (nodeId: string, message: string, level?: 'info' | 'warning' | 'error') => void;
  completeExecution: (outputs: Record<string, any>) => void;
  resetExecution: () => void;

  // Reset
  reset: () => void;
}

const initialFlowDefinition: FlowDefinition = {
  flow: 'NewFlow',
  description: 'A new flow created with FlowLang Designer',
  inputs: [],
  steps: [],
  outputs: [],
};

const initialNodes: Node<FlowNodeData>[] = [
  {
    id: 'start',
    type: 'start',
    position: { x: 105, y: 105 }, // Grid-aligned to 15x15 grid (7x7 grid cells)
    data: {
      label: 'Start',
      type: 'start',
    },
    deletable: false, // Start node cannot be deleted
    draggable: true,
  },
];

const initialExecutionState: ExecutionState = {
  status: 'idle',
  stepMode: false,
  currentNodeId: null,
  nodeStates: {},
  executionLog: [],
  inputs: {},
  outputs: {},
};

export const useFlowStore = create<FlowStore>((set, get) => ({
  // Initial state
  nodes: initialNodes,
  edges: [],
  flowDefinition: initialFlowDefinition,
  selectedNode: null,
  nodeIdCounter: 0,
  execution: initialExecutionState,

  // Setters
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setFlowDefinition: (flowDefinition) => set({ flowDefinition }),
  setSelectedNode: (selectedNode) => set({ selectedNode }),

  // ReactFlow change handlers
  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as Node<FlowNodeData>[],
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection) => {
    // Add edge styling with arrowhead at the target
    const newEdge = {
      ...connection,
      type: 'smoothstep',
      deletable: true,
      focusable: true,
      style: { stroke: '#94a3b8', strokeWidth: 2 },
      markerEnd: {
        type: 'arrowclosed' as const,
        color: '#94a3b8',
      },
      data: {
        onDelete: () => {
          set({
            edges: get().edges.filter(e => e.id !== newEdge.id),
          });
        },
      },
    };
    set({
      edges: addEdge(newEdge, get().edges),
    });
  },

  // Node operations
  addNode: (node) => {
    set({
      nodes: [...get().nodes, node],
    });
  },

  removeNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    });
  },

  updateNode: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
    });
  },

  updateFlowDefinition: (updates) => {
    set({
      flowDefinition: { ...get().flowDefinition, ...updates },
    });
  },

  getNextNodeId: () => {
    const currentCounter = get().nodeIdCounter;
    set({ nodeIdCounter: currentCounter + 1 });
    return `node_${currentCounter}`;
  },

  // Execution actions
  startExecution: (inputs) => {
    set((state) => ({
      execution: {
        ...initialExecutionState,
        stepMode: state.execution.stepMode, // Preserve step mode setting
        status: 'running',
        inputs,
        startTime: Date.now(),
      },
    }));
  },

  stopExecution: () => {
    set((state) => ({
      execution: {
        ...state.execution,
        status: 'idle',
        currentNodeId: null,
        endTime: Date.now(),
      },
    }));
  },

  pauseExecution: () => {
    set((state) => ({
      execution: {
        ...state.execution,
        status: 'paused',
      },
    }));
  },

  resumeExecution: () => {
    set((state) => ({
      execution: {
        ...state.execution,
        status: 'running',
      },
    }));
  },

  setStepMode: (enabled) => {
    set((state) => ({
      execution: {
        ...state.execution,
        stepMode: enabled,
      },
    }));
  },

  updateNodeExecutionState: (nodeId, stateUpdate) => {
    set((state) => ({
      execution: {
        ...state.execution,
        currentNodeId: stateUpdate.state === 'running' ? nodeId : state.execution.currentNodeId,
        nodeStates: {
          ...state.execution.nodeStates,
          [nodeId]: {
            ...state.execution.nodeStates[nodeId],
            ...stateUpdate,
          },
        },
      },
    }));
  },

  addExecutionLog: (nodeId, message, level = 'info') => {
    set((state) => ({
      execution: {
        ...state.execution,
        executionLog: [
          ...state.execution.executionLog,
          {
            nodeId,
            timestamp: Date.now(),
            message,
            level,
          },
        ],
      },
    }));
  },

  completeExecution: (outputs) => {
    set((state) => ({
      execution: {
        ...state.execution,
        status: 'completed',
        outputs,
        currentNodeId: null,
        endTime: Date.now(),
      },
    }));
  },

  resetExecution: () => {
    set({
      execution: initialExecutionState,
    });
  },

  // Reset
  reset: () => {
    set({
      nodes: initialNodes,
      edges: [],
      flowDefinition: initialFlowDefinition,
      selectedNode: null,
      nodeIdCounter: 0,
      execution: initialExecutionState,
    });
  },
}));
