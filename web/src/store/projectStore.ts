import { create } from 'zustand';
import type { Project, FlowData, FlowMetadata, ProjectMetadata } from '../types/project';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '../types/node';
import type { FlowDefinition } from '../types/flow';
import { loadProject, saveProject, clearProject } from '../services/projectPersistence';

interface ProjectStore {
  // State
  project: Project;

  // Project actions
  setProjectName: (name: string) => void;
  setProjectDescription: (description: string) => void;

  // Flow actions
  createFlow: (name: string, description?: string) => string;
  deleteFlow: (flowId: string) => void;
  renameFlow: (flowId: string, newName: string) => void;
  duplicateFlow: (flowId: string) => string;
  switchFlow: (flowId: string) => void;

  // Flow data updates
  updateFlowNodes: (flowId: string, nodes: Node<FlowNodeData>[]) => void;
  updateFlowEdges: (flowId: string, edges: Edge[]) => void;
  updateFlowDefinition: (flowId: string, definition: Partial<FlowDefinition>) => void;
  updateFlowExecutionHistory: (flowId: string, history: any[]) => void;

  // Current flow helpers
  getCurrentFlow: () => FlowData | null;
  getCurrentFlowId: () => string | null;

  // Project-level operations
  exportProject: () => Project;
  importProject: (project: Project) => void;
  resetProject: () => void;

  // Persistence
  loadFromStorage: () => void;
  saveToStorage: () => void;
  clearStorage: () => void;
}

// Create initial project with one flow
const createInitialProject = (): Project => {
  const now = Date.now();
  const flowId = `flow_${now}`;

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
      position: { x: 105, y: 105 },
      data: {
        label: 'Start',
        type: 'start',
      },
      deletable: false,
      draggable: true,
    },
  ];

  return {
    metadata: {
      name: 'My Project',
      description: 'A FlowLang project',
      version: '1.0.0',
      created: now,
      modified: now,
    },
    flows: {
      [flowId]: {
        metadata: {
          id: flowId,
          name: 'NewFlow',
          created: now,
          modified: now,
        },
        nodes: initialNodes,
        edges: [],
        flowDefinition: initialFlowDefinition,
      },
    },
    currentFlowId: flowId,
  };
};

export const useProjectStore = create<ProjectStore>((set, get) => ({
  // Initial state - will be loaded from localStorage if available
  project: createInitialProject(),

  // Project actions
  setProjectName: (name) => {
    set((state) => ({
      project: {
        ...state.project,
        metadata: {
          ...state.project.metadata,
          name,
          modified: Date.now(),
        },
      },
    }));
    get().saveToStorage();
  },

  setProjectDescription: (description) => {
    set((state) => ({
      project: {
        ...state.project,
        metadata: {
          ...state.project.metadata,
          description,
          modified: Date.now(),
        },
      },
    }));
    get().saveToStorage();
  },

  // Flow actions
  createFlow: (name, description) => {
    const now = Date.now();
    const flowId = `flow_${now}`;

    const initialFlowDefinition: FlowDefinition = {
      flow: name,
      description: description || `A new flow: ${name}`,
      inputs: [],
      steps: [],
      outputs: [],
    };

    const initialNodes: Node<FlowNodeData>[] = [
      {
        id: 'start',
        type: 'start',
        position: { x: 105, y: 105 },
        data: {
          label: 'Start',
          type: 'start',
        },
        deletable: false,
        draggable: true,
      },
    ];

    const newFlow: FlowData = {
      metadata: {
        id: flowId,
        name,
        description,
        created: now,
        modified: now,
      },
      nodes: initialNodes,
      edges: [],
      flowDefinition: initialFlowDefinition,
    };

    set((state) => ({
      project: {
        ...state.project,
        flows: {
          ...state.project.flows,
          [flowId]: newFlow,
        },
        currentFlowId: flowId,
        metadata: {
          ...state.project.metadata,
          modified: now,
        },
      },
    }));

    get().saveToStorage();
    return flowId;
  },

  deleteFlow: (flowId) => {
    const state = get();
    const { [flowId]: deleted, ...remainingFlows } = state.project.flows;

    // If deleting current flow, switch to another
    let newCurrentFlowId = state.project.currentFlowId;
    if (newCurrentFlowId === flowId) {
      const remainingIds = Object.keys(remainingFlows);
      newCurrentFlowId = remainingIds[0] || null;
    }

    set({
      project: {
        ...state.project,
        flows: remainingFlows,
        currentFlowId: newCurrentFlowId,
        metadata: {
          ...state.project.metadata,
          modified: Date.now(),
        },
      },
    });

    get().saveToStorage();
  },

  renameFlow: (flowId, newName) => {
    set((state) => {
      const flow = state.project.flows[flowId];
      if (!flow) return state;

      return {
        project: {
          ...state.project,
          flows: {
            ...state.project.flows,
            [flowId]: {
              ...flow,
              metadata: {
                ...flow.metadata,
                name: newName,
                modified: Date.now(),
              },
              flowDefinition: {
                ...flow.flowDefinition,
                flow: newName,
              },
            },
          },
          metadata: {
            ...state.project.metadata,
            modified: Date.now(),
          },
        },
      };
    });

    get().saveToStorage();
  },

  duplicateFlow: (flowId) => {
    const state = get();
    const originalFlow = state.project.flows[flowId];
    if (!originalFlow) return '';

    const now = Date.now();
    const newFlowId = `flow_${now}`;
    const newName = `${originalFlow.metadata.name} (Copy)`;

    const duplicatedFlow: FlowData = {
      metadata: {
        id: newFlowId,
        name: newName,
        description: originalFlow.metadata.description,
        created: now,
        modified: now,
      },
      nodes: JSON.parse(JSON.stringify(originalFlow.nodes)),
      edges: JSON.parse(JSON.stringify(originalFlow.edges)),
      flowDefinition: {
        ...JSON.parse(JSON.stringify(originalFlow.flowDefinition)),
        flow: newName,
      },
    };

    set({
      project: {
        ...state.project,
        flows: {
          ...state.project.flows,
          [newFlowId]: duplicatedFlow,
        },
        currentFlowId: newFlowId,
        metadata: {
          ...state.project.metadata,
          modified: now,
        },
      },
    });

    get().saveToStorage();
    return newFlowId;
  },

  switchFlow: (flowId) => {
    const state = get();
    if (!state.project.flows[flowId]) return;

    set({
      project: {
        ...state.project,
        currentFlowId: flowId,
      },
    });

    get().saveToStorage();
  },

  // Flow data updates
  updateFlowNodes: (flowId, nodes) => {
    set((state) => {
      const flow = state.project.flows[flowId];
      if (!flow) return state;

      return {
        project: {
          ...state.project,
          flows: {
            ...state.project.flows,
            [flowId]: {
              ...flow,
              nodes,
              metadata: {
                ...flow.metadata,
                modified: Date.now(),
              },
            },
          },
          metadata: {
            ...state.project.metadata,
            modified: Date.now(),
          },
        },
      };
    });

    get().saveToStorage();
  },

  updateFlowEdges: (flowId, edges) => {
    set((state) => {
      const flow = state.project.flows[flowId];
      if (!flow) return state;

      return {
        project: {
          ...state.project,
          flows: {
            ...state.project.flows,
            [flowId]: {
              ...flow,
              edges,
              metadata: {
                ...flow.metadata,
                modified: Date.now(),
              },
            },
          },
          metadata: {
            ...state.project.metadata,
            modified: Date.now(),
          },
        },
      };
    });

    get().saveToStorage();
  },

  updateFlowDefinition: (flowId, definitionUpdates) => {
    set((state) => {
      const flow = state.project.flows[flowId];
      if (!flow) return state;

      return {
        project: {
          ...state.project,
          flows: {
            ...state.project.flows,
            [flowId]: {
              ...flow,
              flowDefinition: {
                ...flow.flowDefinition,
                ...definitionUpdates,
              },
              metadata: {
                ...flow.metadata,
                modified: Date.now(),
              },
            },
          },
          metadata: {
            ...state.project.metadata,
            modified: Date.now(),
          },
        },
      };
    });

    get().saveToStorage();
  },

  updateFlowExecutionHistory: (flowId, history) => {
    set((state) => {
      const flow = state.project.flows[flowId];
      if (!flow) return state;

      return {
        project: {
          ...state.project,
          flows: {
            ...state.project.flows,
            [flowId]: {
              ...flow,
              executionHistory: history,
              metadata: {
                ...flow.metadata,
                modified: Date.now(),
              },
            },
          },
        },
      };
    });

    get().saveToStorage();
  },

  // Current flow helpers
  getCurrentFlow: () => {
    const state = get();
    const currentId = state.project.currentFlowId;
    return currentId ? state.project.flows[currentId] || null : null;
  },

  getCurrentFlowId: () => {
    return get().project.currentFlowId;
  },

  // Project-level operations
  exportProject: () => {
    return get().project;
  },

  importProject: (project) => {
    set({ project });
    get().saveToStorage();
  },

  resetProject: () => {
    set({ project: createInitialProject() });
    get().saveToStorage();
  },

  // Persistence
  loadFromStorage: () => {
    const loaded = loadProject();
    if (loaded) {
      set({ project: loaded });
    }
  },

  saveToStorage: () => {
    saveProject(get().project);
  },

  clearStorage: () => {
    clearProject();
    set({ project: createInitialProject() });
  },
}));
