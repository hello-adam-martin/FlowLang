import { useCallback, useRef, useState, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  type ReactFlowInstance,
  type OnConnectStart,
  type OnConnectEnd,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useFlowStore } from '../../store/flowStore';
import type { FlowNodeData, FlowNodeType } from '../../types/node';

// Import custom node types
import TaskNode from '../nodes/TaskNode';
import LoopContainerNode from '../nodes/LoopContainerNode';
import ConditionalContainerNode from '../nodes/ConditionalContainerNode';
import ParallelContainerNode from '../nodes/ParallelContainerNode';

// Import custom edge types
import DeletableEdge from '../edges/DeletableEdge';

const nodeTypes = {
  task: TaskNode,
  loopContainer: LoopContainerNode,
  conditionalContainer: ConditionalContainerNode,
  parallelContainer: ParallelContainerNode,
};

const edgeTypes = {
  default: DeletableEdge,
  smoothstep: DeletableEdge,
};

interface FlowDesignerProps {
  onNodeCreated?: () => void;
}

export default function FlowDesigner({ onNodeCreated }: FlowDesignerProps) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNode,
    addNode,
  } = useFlowStore();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; handleId: string | null } | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOverContainerId, setDragOverContainerId] = useState<string | null>(null);
  const [isPanelDragging, setIsPanelDragging] = useState(false);
  const hasInitiallyFit = useRef(false);
  const nodeIdCounter = useRef(0);

  // Initialize counter from existing nodes on mount
  useEffect(() => {
    const existingIds = nodes
      .map(n => n.id)
      .filter(id => id.startsWith('node_'))
      .map(id => parseInt(id.replace('node_', ''), 10))
      .filter(num => !isNaN(num));

    if (existingIds.length > 0) {
      nodeIdCounter.current = Math.max(...existingIds) + 1;
    }
  }, []);

  // Generate unique node ID using ref counter
  const getNodeId = useCallback(() => {
    return `node_${nodeIdCounter.current++}`;
  }, []);

  // Fit view only on initial load when importing a flow (multiple nodes at once)
  useEffect(() => {
    if (reactFlowInstance.current && !hasInitiallyFit.current && nodes.length > 0) {
      // Only fit view if we're loading multiple nodes at once (e.g., from import)
      // Don't fit view when adding nodes one by one
      if (nodes.length >= 3) {
        reactFlowInstance.current.fitView({ maxZoom: 1, duration: 200 });
        hasInitiallyFit.current = true;
      }
    }
  }, [nodes.length]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: any) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    // Mark that we're in a panel drag
    if (!isPanelDragging) {
      setIsPanelDragging(true);
    }

    // Convert screen coordinates to flow coordinates
    if (!reactFlowInstance.current) return;

    const flowPosition = reactFlowInstance.current.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    // Check if flow position is inside any container node
    let hoveredContainerId: string | null = null;

    const containerNodes = nodes.filter(
      (node) =>
        node.type === 'loopContainer' ||
        node.type === 'conditionalContainer' ||
        node.type === 'parallelContainer'
    );

    for (const node of containerNodes) {
      // Get the node's dimensions
      const nodeElement = document.querySelector(`[data-id="${node.id}"]`);
      if (!nodeElement) continue;

      const rect = nodeElement.getBoundingClientRect();

      // Check if cursor is within the node's screen bounds
      if (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      ) {
        hoveredContainerId = node.id;
        break;
      }
    }

    if (hoveredContainerId && hoveredContainerId !== dragOverContainerId) {
      setDragOverContainerId(hoveredContainerId);
    } else if (!hoveredContainerId && dragOverContainerId) {
      setDragOverContainerId(null);
    }
  }, [dragOverContainerId, isPanelDragging, nodes, reactFlowInstance]);

  const isValidConnection = useCallback(
    (connection: any) => {
      const { source, target, sourceHandle, targetHandle } = connection;

      // Rule 1: Node cannot connect to itself
      if (source === target) {
        return false;
      }

      // Rule 2: Nodes cannot be connected more than once (check if connection already exists)
      const connectionExists = edges.some(
        edge => (edge.source === source && edge.target === target) ||
                (edge.source === target && edge.target === source)
      );
      if (connectionExists) {
        return false;
      }

      // Rule 3: Check if source handle is already used as a target
      const sourceHandleUsedAsTarget = edges.some(
        edge => edge.target === source && edge.targetHandle === sourceHandle
      );

      // Rule 4: Check if target handle is already used as a source
      const targetHandleUsedAsSource = edges.some(
        edge => edge.source === target && edge.sourceHandle === targetHandle
      );

      // Reject connection if handle is already locked to the opposite direction
      if (sourceHandleUsedAsTarget || targetHandleUsedAsSource) {
        return false;
      }

      // Rule 5: Nodes inside a container cannot connect to nodes outside the container
      const sourceNode = nodes.find(n => n.id === source);
      const targetNode = nodes.find(n => n.id === target);

      if (sourceNode && targetNode) {
        // Check if one is in a container and the other is not, or if they're in different containers
        if (sourceNode.parentId !== targetNode.parentId) {
          return false;
        }
      }

      return true;
    },
    [edges, nodes]
  );

  const onConnectStart: OnConnectStart = useCallback((_, params) => {
    setConnectingFrom({ nodeId: params.nodeId as string, handleId: params.handleId });
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(() => {
    setConnectingFrom(null);
  }, []);

  const onNodeDragStart = useCallback(
    (_event: React.MouseEvent, node: any) => {
      setDraggingNodeId(node.id);
    },
    []
  );

  const onNodeDrag = useCallback(
    (event: React.MouseEvent, node: any) => {
      if (!draggingNodeId) return;

      // Get the node's current position in screen coordinates
      const nodeElement = document.querySelector(`[data-id="${node.id}"]`);
      if (!nodeElement) return;

      const nodeRect = nodeElement.getBoundingClientRect();
      const nodeCenterX = nodeRect.left + nodeRect.width / 2;
      const nodeCenterY = nodeRect.top + nodeRect.height / 2;

      // Check if the node center is over a container's drop zone
      const elementsAtPoint = document.elementsFromPoint(nodeCenterX, nodeCenterY);
      const dropZone = elementsAtPoint.find((el) => el.getAttribute('data-dropzone') === 'true');

      if (dropZone) {
        const containerElement = dropZone.closest('[data-id]');
        if (containerElement) {
          const containerId = containerElement.getAttribute('data-id');
          if (containerId && containerId !== dragOverContainerId) {
            setDragOverContainerId(containerId);
          }
        }
      } else if (dragOverContainerId) {
        setDragOverContainerId(null);
      }
    },
    [draggingNodeId, dragOverContainerId]
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: any) => {
      setDraggingNodeId(null);
      setDragOverContainerId(null);

      if (!reactFlowInstance.current) return;

      // Get the node's current position in screen coordinates
      const nodeElement = document.querySelector(`[data-id="${node.id}"]`);
      if (!nodeElement) return;

      const nodeRect = nodeElement.getBoundingClientRect();
      const nodeCenterX = nodeRect.left + nodeRect.width / 2;
      const nodeCenterY = nodeRect.top + nodeRect.height / 2;

      // Check if the node center is over a container's drop zone
      const elementsAtPoint = document.elementsFromPoint(nodeCenterX, nodeCenterY);
      const dropZone = elementsAtPoint.find((el) => el.getAttribute('data-dropzone') === 'true');

      if (dropZone) {
        const containerElement = dropZone.closest('[data-id]');
        if (containerElement) {
          const containerId = containerElement.getAttribute('data-id');
          const containerNode = reactFlowInstance.current.getNode(containerId);

          if (
            containerNode &&
            containerNode.id !== node.id &&
            (containerNode.type === 'loopContainer' ||
              containerNode.type === 'conditionalContainer' ||
              containerNode.type === 'parallelContainer')
          ) {
            // Don't reparent if already a child of this container
            if (node.parentId === containerId) return;

            // Calculate position relative to container
            const relativePosition = {
              x: node.position.x - containerNode.position.x,
              y: node.position.y - containerNode.position.y,
            };

            // Update the node to make it a child of the container
            onNodesChange([
              {
                type: 'remove',
                id: node.id,
              },
              {
                type: 'add',
                item: {
                  ...node,
                  position: relativePosition,
                  parentId: containerId,
                  extent: 'parent' as const,
                },
              },
            ]);
          }
        }
      }
    },
    [onNodesChange]
  );

  // Add invalid class to nodes that cannot be connected to, and drag-over class to containers
  const nodesWithInvalidClass = nodes.map(node => {
    let className = '';

    // Add invalid connection styling
    if (connectingFrom) {
      const wouldBeInvalid = !isValidConnection({
        source: connectingFrom.nodeId,
        target: node.id,
        sourceHandle: connectingFrom.handleId,
        targetHandle: null,
      });
      if (wouldBeInvalid) {
        className = 'invalid-connection-target';
      }
    }

    // Add drag-over styling only to the specific container being hovered
    if (dragOverContainerId === node.id) {
      className += (className ? ' ' : '') + 'container-drag-over';
    }

    return {
      ...node,
      className: className || undefined,
    };
  });

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragOverContainerId(null); // Clear drag-over state
      setIsPanelDragging(false); // Clear panel dragging state

      const type = event.dataTransfer.getData('application/reactflow') as FlowNodeType;

      if (!type || !reactFlowInstance.current) {
        return;
      }

      // Get node dimensions for centering (based on actual node sizes)
      let nodeWidth: number;
      let nodeHeight: number;

      if (type === 'task') {
        nodeWidth = 200;
        nodeHeight = 80;
      } else if (type === 'conditionalContainer') {
        nodeWidth = 600;
        nodeHeight = 300;
      } else if (type === 'parallelContainer') {
        nodeWidth = 450;
        nodeHeight = 140;
      } else {
        // loopContainer
        nodeWidth = 450;
        nodeHeight = 195;
      }

      // Calculate position centered on cursor
      const cursorPosition = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const position = {
        x: cursorPosition.x - nodeWidth / 2,
        y: cursorPosition.y - nodeHeight / 2,
      };

      // Check if we're dropping onto a container node's drop zone
      const targetElement = event.target as HTMLElement;

      // First check if we're in a valid drop zone
      const dropZone = targetElement.closest('[data-dropzone="true"]');
      const containerNode = targetElement.closest('[data-id]');
      let parentId: string | undefined;
      let relativePosition = position;

      if (dropZone && containerNode) {
        const containerId = containerNode.getAttribute('data-id');
        if (!containerId) return;

        // Use ReactFlow instance to get the current node with actual dimensions
        const containerNodeData = reactFlowInstance.current.getNode(containerId);

        // Check if the target is a container type
        if (containerNodeData && (
          containerNodeData.type === 'loopContainer' ||
          containerNodeData.type === 'conditionalContainer' ||
          containerNodeData.type === 'parallelContainer'
        )) {
          parentId = containerId;

          // Calculate position relative to parent container
          relativePosition = {
            x: position.x - containerNodeData.position.x,
            y: position.y - containerNodeData.position.y,
          };

          // For parallel containers, detect which track ghost is being hovered and assign trackId
          if (containerNodeData.type === 'parallelContainer' && type === 'task') {
            const headerHeight = 60;

            // Find which track ghost element is under the cursor
            const elementsAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
            const trackGhostElement = elementsAtPoint.find((el) =>
              el.getAttribute('data-track-id') !== null
            );

            if (trackGhostElement) {
              const trackId = trackGhostElement.getAttribute('data-track-id');

              // Get the container's track data to determine position
              const containerData = containerNodeData.data as FlowNodeData;
              const tracks = containerData.tracks || [];
              const trackIndex = tracks.findIndex((t) => t.id === trackId);

              if (trackIndex !== -1) {
                // Snap to track ghost position (grid-aligned)
                relativePosition = {
                  x: 45,
                  y: headerHeight + 15 + (trackIndex * 60) // 60 + 15 + (index * 60)
                };

                // Store trackId in position for later assignment to node data
                (position as any).trackId = trackId;
              }
            } else {
              // No track ghost detected - prevent drop
              console.warn('Task must be dropped on a track ghost in parallel container');
              return;
            }
          }

          // For conditional containers, detect which section (then/else)
          if (containerNodeData.type === 'conditionalContainer') {
            const section = targetElement.closest('[data-section]');
            if (section) {
              const sectionType = section.getAttribute('data-section');
              // Store section info in node data
              (position as any).section = sectionType;
            }
          }
        }
      }

      const nodeId = getNodeId();
      const newNode = {
        id: nodeId,
        type,
        position: relativePosition,
        ...(parentId && {
          parentId,
          extent: 'parent' as const,
        }),
        // Set explicit dimensions for containers to prevent resize on drop
        ...(type !== 'task' && {
          style: {
            width: nodeWidth,
            height: nodeHeight,
          },
        }),
        data: {
          label: `New ${type}`,
          type,
          ...((position as any).section && { section: (position as any).section }),
          ...((position as any).trackId && { trackId: (position as any).trackId }),
          // Add default step object for task nodes
          ...(type === 'task' && {
            step: {
              id: nodeId, // Use node ID as default step ID
              task: undefined,
              inputs: {},
              outputs: [],
            },
          }),
          // Add default tracks for parallel containers
          ...(type === 'parallelContainer' && {
            tracks: [
              { id: `track_${Date.now()}_1` },
              { id: `track_${Date.now()}_2` },
            ],
          }),
        } as FlowNodeData,
      };

      addNode(newNode);

      // Automatically select the newly created node to show its properties
      setSelectedNode(nodeId);

      // Close the node library panel
      onNodeCreated?.();
    },
    [addNode, nodes, setSelectedNode, onNodeCreated]
  );

  // Add selected styling to edges
  const edgesWithSelectedStyle = edges.map(edge => ({
    ...edge,
    style: edge.selected
      ? { stroke: '#3b82f6', strokeWidth: 2 }
      : edge.style,
    markerEnd: edge.selected
      ? { type: 'arrowclosed' as const, color: '#3b82f6' }
      : edge.markerEnd,
  }));

  return (
    <div
      className="w-full h-full"
      ref={reactFlowWrapper}
      onDragOver={onDragOver}
    >
      <ReactFlow
        nodes={nodesWithInvalidClass}
        edges={edgesWithSelectedStyle}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onInit={(instance) => (reactFlowInstance.current = instance as any)}
        onDrop={onDrop}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode="loose"
        isValidConnection={isValidConnection}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#94a3b8', strokeWidth: 2 },
          markerEnd: {
            type: 'arrowclosed',
            color: '#94a3b8',
            width: 20,
            height: 20,
          },
        }}
        deleteKeyCode="Delete"
        selectNodesOnDrag={false}
        snapToGrid={true}
        snapGrid={[15, 15]}
        attributionPosition="bottom-left"
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <MiniMap />
        <Panel position="top-left" className="bg-white rounded-lg shadow-lg p-4">
          <div className="text-sm font-semibold text-gray-700">
            FlowLang Designer
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Drag and drop nodes to design your workflow
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
