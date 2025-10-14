import { create } from 'zustand';
import { addEdge, applyNodeChanges, applyEdgeChanges, type Node, type Edge, type Connection, type NodeChange, type EdgeChange } from '@xyflow/react';
import type { FlowNodeData } from '../types/node';
import type { FlowDefinition } from '../types/flow';

interface FlowStore {
  // State
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  flowDefinition: FlowDefinition;
  selectedNode: string | null;

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

export const useFlowStore = create<FlowStore>((set, get) => ({
  // Initial state
  nodes: [],
  edges: [],
  flowDefinition: initialFlowDefinition,
  selectedNode: null,

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

  // Reset
  reset: () => {
    set({
      nodes: [],
      edges: [],
      flowDefinition: initialFlowDefinition,
      selectedNode: null,
    });
  },
}));
