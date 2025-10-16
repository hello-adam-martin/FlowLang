import { useState, useCallback, useRef, useEffect } from 'react';
import FlowDesigner from './components/FlowDesigner/FlowDesigner';
import NodeLibrary from './components/NodeLibrary/NodeLibrary';
import PropertyPanel from './components/PropertyPanel/PropertyPanel';
import FlowToolbar from './components/FlowToolbar/FlowToolbar';
import FlowManager from './components/FlowManager/FlowManager';
import KeyboardShortcutsHelp from './components/KeyboardShortcutsHelp/KeyboardShortcutsHelp';
import { useFlowStore, initialExecutionState } from './store/flowStore';
import { useProjectStore } from './store/projectStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import type { FlowNodeType } from './types/node';
import { flowToYaml } from './services/yamlConverter';
import './index.css';

function App() {
  const [showNodeLibrary, setShowNodeLibrary] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showFlowManager, setShowFlowManager] = useState(true);
  const selectedNode = useFlowStore((state) => state.selectedNode);
  const { nodes, edges, flowDefinition, addNode, onConnect, setNodes, setEdges, setFlowDefinition, setExecution } = useFlowStore();
  const { project, getCurrentFlow, getCurrentFlowId, updateFlowNodes, updateFlowEdges, updateFlowDefinition, loadFromStorage } = useProjectStore();
  const reactFlowInstanceRef = useRef<any>(null);

  // Load project from localStorage on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Sync flowStore with current flow from projectStore
  useEffect(() => {
    const currentFlow = getCurrentFlow();
    if (currentFlow) {
      setNodes(currentFlow.nodes);
      setEdges(currentFlow.edges);
      setFlowDefinition(currentFlow.flowDefinition);
      // Restore execution state if it exists, otherwise reset to idle
      setExecution(currentFlow.execution || initialExecutionState);
    }
  }, [project.currentFlowId, getCurrentFlow, setNodes, setEdges, setFlowDefinition, setExecution]);

  // Sync changes from flowStore back to projectStore (debounced)
  useEffect(() => {
    const currentFlowId = getCurrentFlowId();
    if (!currentFlowId) return;

    const timeout = setTimeout(() => {
      updateFlowNodes(currentFlowId, nodes);
      updateFlowEdges(currentFlowId, edges);
      updateFlowDefinition(currentFlowId, flowDefinition);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeout);
  }, [nodes, edges, flowDefinition, getCurrentFlowId, updateFlowNodes, updateFlowEdges, updateFlowDefinition]);

  // Show properties panel when a node is selected
  const showProperties = selectedNode !== null;

  // Handle creating a node from keyboard shortcut
  const handleCreateNode = useCallback((nodeType: FlowNodeType) => {
    // Get node dimensions
    let nodeWidth = 200;
    let nodeHeight = 80;

    if (nodeType === 'conditionalContainer' || nodeType === 'switchContainer') {
      nodeWidth = 600;
      nodeHeight = 300;
    } else if (nodeType === 'parallelContainer') {
      nodeWidth = 450;
      nodeHeight = 150;
    } else if (nodeType === 'loopContainer') {
      nodeWidth = 450;
      nodeHeight = 195;
    } else if (nodeType === 'exit') {
      nodeWidth = 160;
      nodeHeight = 60;
    } else if (nodeType === 'note') {
      nodeWidth = 200;
      nodeHeight = 150;
    }

    // Helper function to get node dimensions
    const getNodeDimensions = (node: any) => {
      if (node.type === 'start') return { width: 180, height: 100 };
      if (node.type === 'conditionalContainer' || node.type === 'switchContainer') return { width: 600, height: 300 };
      if (node.type === 'parallelContainer') return { width: 450, height: 150 };
      if (node.type === 'loopContainer') return { width: 450, height: 195 };
      if (node.type === 'exit') return { width: 160, height: 60 };
      if (node.type === 'note') return { width: 200, height: 150 };
      return { width: 200, height: 80 };
    };

    // Find the rightmost node to place new node to its right
    let position = { x: 100, y: 100 }; // Default starting position
    const horizontalGap = 50; // Gap between nodes
    const verticalGap = 30; // Gap when stacking

    if (nodes.length > 0) {
      // Find the rightmost node
      let rightmostX = -Infinity;
      let rightmostNode = null;

      for (const node of nodes) {
        const dims = getNodeDimensions(node);
        const nodeRightEdge = node.position.x + dims.width;
        if (nodeRightEdge > rightmostX) {
          rightmostX = nodeRightEdge;
          rightmostNode = node;
        }
      }

      if (rightmostNode) {
        const rightmostDims = getNodeDimensions(rightmostNode);

        // Place to the right of the rightmost node
        position = {
          x: rightmostNode.position.x + rightmostDims.width + horizontalGap,
          y: rightmostNode.position.y
        };

        // Check if this position overlaps with any node
        const padding = 20;
        let hasOverlap = true;
        let verticalOffset = 0;
        const maxVerticalAttempts = 10;

        for (let attempt = 0; attempt < maxVerticalAttempts && hasOverlap; attempt++) {
          hasOverlap = false;
          const testY = position.y + verticalOffset;

          for (const node of nodes) {
            const dims = getNodeDimensions(node);

            // Check for overlap
            const overlapsX = !(position.x + nodeWidth + padding < node.position.x - padding ||
                               node.position.x + dims.width + padding < position.x - padding);
            const overlapsY = !(testY + nodeHeight + padding < node.position.y - padding ||
                               node.position.y + dims.height + padding < testY - padding);

            if (overlapsX && overlapsY) {
              hasOverlap = true;
              break;
            }
          }

          if (hasOverlap) {
            // Try next vertical position
            verticalOffset += nodeHeight + verticalGap;
          } else {
            position.y = testY;
          }
        }
      }
    }

    const nodeId = useFlowStore.getState().getNextNodeId();
    let stepData: any = undefined;

    // Build step data for task nodes
    if (nodeType === 'task') {
      stepData = {
        id: nodeId,
        task: undefined,
        inputs: {},
        outputs: [],
      };
    }

    const newNode = {
      id: nodeId,
      type: nodeType,
      position,
      data: {
        label: `New ${nodeType}`,
        type: nodeType,
        ...(nodeType === 'task' && stepData && { step: stepData }),
        ...(nodeType === 'parallelContainer' && {
          tracks: [
            { id: `track_${Date.now()}_1` },
            { id: `track_${Date.now()}_2` },
          ],
        }),
      },
    };

    addNode(newNode);

    // Automatically connect new node to the last added node
    if (nodeType === 'task') {
      // Get the latest state from the store to avoid stale closure
      const currentEdges = useFlowStore.getState().edges;
      const currentNodes = useFlowStore.getState().nodes;

      // Find the last added node (excluding Start and the node we just added)
      const nonStartNodes = currentNodes.filter(n => n.type !== 'start' && n.id !== nodeId);

      if (nonStartNodes.length > 0) {
        // Connect to the last added node
        const lastNode = nonStartNodes[nonStartNodes.length - 1];

        setTimeout(() => {
          onConnect({
            source: lastNode.id,
            sourceHandle: 'output',
            target: nodeId,
            targetHandle: 'input',
          });
        }, 10);
      } else {
        // If this is the first node, connect to Start
        const startNode = currentNodes.find(n => n.type === 'start');
        if (startNode) {
          setTimeout(() => {
            onConnect({
              source: startNode.id,
              sourceHandle: 'output',
              target: nodeId,
              targetHandle: 'input',
            });
          }, 10);
        }
      }
    }
  }, [addNode, nodes, onConnect]);

  // Handle export to YAML
  const handleExportYaml = useCallback(() => {
    const yaml = flowToYaml(nodes, edges, flowDefinition);
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${flowDefinition.flow || 'flow'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, flowDefinition]);

  // Handle import YAML - trigger file input click
  const handleImportYaml = useCallback(() => {
    // This would need to be implemented with a file input element
    console.log('Import YAML triggered - needs implementation');
  }, []);

  // Handle fit view
  const handleFitView = useCallback(() => {
    if (reactFlowInstanceRef.current?.fitView) {
      reactFlowInstanceRef.current.fitView({ maxZoom: 1, duration: 200 });
    }
  }, []);

  // Handle flow navigation
  const handleNextFlow = useCallback(() => {
    const flowIds = Object.keys(project.flows).sort((a, b) => {
      return project.flows[b].metadata.modified - project.flows[a].metadata.modified;
    });
    const currentIndex = flowIds.indexOf(project.currentFlowId || '');
    if (currentIndex !== -1 && currentIndex < flowIds.length - 1) {
      const nextFlowId = flowIds[currentIndex + 1];
      const { switchFlow } = useProjectStore.getState();
      switchFlow(nextFlowId);
    }
  }, [project.flows, project.currentFlowId]);

  const handlePreviousFlow = useCallback(() => {
    const flowIds = Object.keys(project.flows).sort((a, b) => {
      return project.flows[b].metadata.modified - project.flows[a].metadata.modified;
    });
    const currentIndex = flowIds.indexOf(project.currentFlowId || '');
    if (currentIndex > 0) {
      const prevFlowId = flowIds[currentIndex - 1];
      const { switchFlow } = useProjectStore.getState();
      switchFlow(prevFlowId);
    }
  }, [project.flows, project.currentFlowId]);

  const handleNewFlow = useCallback(() => {
    setShowFlowManager(true);
    // Small delay to ensure FlowManager is visible
    setTimeout(() => {
      // The FlowManager will handle showing the new flow modal
      // We could potentially expose a method to trigger it directly
    }, 100);
  }, []);

  // Set up keyboard shortcuts
  useKeyboardShortcuts({
    onCreateNode: handleCreateNode,
    onToggleNodeLibrary: () => setShowNodeLibrary(prev => !prev),
    onShowHelp: () => setShowKeyboardHelp(prev => !prev),
    onExportYaml: handleExportYaml,
    onImportYaml: handleImportYaml,
    onFitView: handleFitView,
    onToggleFlowManager: () => setShowFlowManager(prev => !prev),
    onNextFlow: handleNextFlow,
    onPreviousFlow: handlePreviousFlow,
    onNewFlow: handleNewFlow,
  });

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Toolbar */}
      <FlowToolbar
        onShowKeyboardHelp={() => setShowKeyboardHelp(true)}
        onToggleFlowManager={() => setShowFlowManager(!showFlowManager)}
        showFlowManager={showFlowManager}
      />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left sidebar - Flow Manager */}
        {showFlowManager && (
          <FlowManager
            isOpen={showFlowManager}
            onClose={() => setShowFlowManager(false)}
          />
        )}

        {/* Add Node Button */}
        <button
          onClick={() => setShowNodeLibrary(!showNodeLibrary)}
          className="absolute top-4 right-4 z-10 w-14 h-14 bg-white rounded-lg shadow-lg border border-gray-200 flex items-center justify-center hover:bg-blue-50 hover:border-blue-400 transition-all"
          title="Add Node"
        >
          <span className="text-2xl font-semibold text-gray-700">+</span>
        </button>

        {/* Sliding Node Library Panel - Right Side */}
        <div
          className={`absolute top-0 right-0 h-full w-120 bg-white border-l border-gray-200 shadow-xl z-20 transform transition-transform duration-300 ease-in-out ${
            showNodeLibrary ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">What happens next?</h2>
            <button
              onClick={() => setShowNodeLibrary(false)}
              className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            >
              ×
            </button>
          </div>
          <div className="overflow-y-auto h-[calc(100%-4rem)]">
            <NodeLibrary />
          </div>
        </div>

        {/* Center - Flow Designer */}
        <div className="flex-1">
          <FlowDesigner
            onNodeCreated={() => setShowNodeLibrary(false)}
            reactFlowInstanceRef={reactFlowInstanceRef}
          />
        </div>

        {/* Right sidebar - Property Panel (hidden by default) */}
        {showProperties && (
          <div className="w-120 h-full bg-white border-l border-gray-200 overflow-y-auto z-30">
            <PropertyPanel />
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />
    </div>
  );
}

export default App;
