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
import StartNode from '../nodes/StartNode';
import TaskNode from '../nodes/TaskNode';
import LoopContainerNode from '../nodes/LoopContainerNode';
import ConditionalContainerNode from '../nodes/ConditionalContainerNode';
import SwitchContainerNode from '../nodes/SwitchContainerNode';
import ParallelContainerNode from '../nodes/ParallelContainerNode';
import SubflowNode from '../nodes/SubflowNode';
import ExitNode from '../nodes/ExitNode';
import NoteNode from '../nodes/NoteNode';

// Import custom edge types
import DeletableEdge from '../edges/DeletableEdge';
import ConnectionTooltip from './ConnectionTooltip';

const nodeTypes = {
  start: StartNode,
  task: TaskNode,
  loopContainer: LoopContainerNode,
  conditionalContainer: ConditionalContainerNode,
  switchContainer: SwitchContainerNode,
  parallelContainer: ParallelContainerNode,
  subflow: SubflowNode,
  exit: ExitNode,
  note: NoteNode,
};

const edgeTypes = {
  default: DeletableEdge,
  smoothstep: DeletableEdge,
};

interface FlowDesignerProps {
  onNodeCreated?: () => void;
  reactFlowInstanceRef?: React.MutableRefObject<ReactFlowInstance | null>;
  onConnectionDragEnd?: (sourceNodeId: string, sourceHandleId: string | null, position: { x: number; y: number }) => void;
}

export default function FlowDesigner({ onNodeCreated, reactFlowInstanceRef: externalRef, onConnectionDragEnd }: FlowDesignerProps) {
  const {
    nodes,
    edges,
    onNodesChange: storeOnNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNode,
    addNode,
    execution,
  } = useFlowStore();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; handleId: string | null } | null>(null);
  const connectingFromRef = useRef<{ nodeId: string; handleId: string | null } | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOverContainerId, setDragOverContainerId] = useState<string | null>(null);
  const [isPanelDragging, setIsPanelDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const hasInitiallyFit = useRef(false);
  const justOpenedNodeLibrary = useRef(false);
  const [connectionTooltip, setConnectionTooltip] = useState<{
    message: string;
    position: { x: number; y: number };
  } | null>(null);

  // Fit view only on initial load when importing a flow (multiple nodes at once)
  useEffect(() => {
    if (reactFlowInstance.current && !hasInitiallyFit.current && nodes.length > 0) {
      // Only fit view if we're loading multiple nodes at once (e.g., from import)
      // Don't fit view when adding nodes one by one
      if (nodes.length >= 5) { // Increased threshold to avoid auto-fit when manually adding nodes
        reactFlowInstance.current.fitView({ maxZoom: 1, duration: 200 });
        hasInitiallyFit.current = true;
      }
    }
  }, [nodes.length]);

  // Center viewport on currently executing node during simulation
  useEffect(() => {
    if (
      reactFlowInstance.current &&
      execution.currentNodeId &&
      execution.status === 'running'
    ) {
      const currentNode = nodes.find(n => n.id === execution.currentNodeId);
      if (currentNode) {
        // Center the view on the current node with a smooth transition
        reactFlowInstance.current.setCenter(
          currentNode.position.x + 100, // Offset by half typical node width
          currentNode.position.y + 40,  // Offset by half typical node height
          {
            zoom: reactFlowInstance.current.getZoom(), // Keep current zoom level
            duration: 400, // Smooth 400ms transition
          }
        );
      }
    }
  }, [execution.currentNodeId, execution.status, nodes]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: any) => {
      // Single click just selects the node visually (border highlight)
      // but doesn't open property panel
    },
    []
  );

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: any) => {
      // Double click opens the property panel
      setSelectedNode(node.id);
      // Close the node library panel when a node is double-clicked
      onNodeCreated?.();
    },
    [setSelectedNode, onNodeCreated]
  );

  const onPaneClick = useCallback(() => {
    // Don't handle pane clicks if we just opened the node library from a connection drag
    // (this prevents the panel from immediately closing after we open it)
    if (justOpenedNodeLibrary.current) {
      justOpenedNodeLibrary.current = false;
      return;
    }

    // Don't close the property panel if execution is running or paused
    if (execution.status === 'idle' || execution.status === 'completed' || execution.status === 'error') {
      setSelectedNode(null);
    }
    setConnectionTooltip(null); // Clear tooltip when clicking pane
    // Close the node library panel when clicking on canvas
    onNodeCreated?.();
  }, [setSelectedNode, onNodeCreated, execution.status]);


  const onMoveStart = useCallback(() => {
    setIsPanning(true);
  }, []);

  const onMoveEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    // Mark that we're in a panel drag and add body class
    if (!isPanelDragging) {
      setIsPanelDragging(true);
      document.body.classList.add('dragging-from-panel');
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
        node.type === 'switchContainer' ||
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

  // Get validation message for a connection attempt (returns null if valid)
  const getConnectionValidationMessage = useCallback(
    (connection: any): string | null => {
      const { source, target } = connection;

      // Rule 1: Node cannot connect to itself
      if (source === target) {
        return 'Cannot connect a node to itself';
      }

      // Rule 2: Nodes cannot be connected more than once
      const connectionExists = edges.some(
        edge => (edge.source === source && edge.target === target) ||
                (edge.source === target && edge.target === source)
      );
      if (connectionExists) {
        return 'Connection already exists between these nodes';
      }

      // Rule 3: Nodes inside a container cannot connect to nodes outside the container
      const sourceNode = nodes.find(n => n.id === source);
      const targetNode = nodes.find(n => n.id === target);

      if (sourceNode && targetNode) {
        // Check if one is in a container and the other is not, or if they're in different containers
        if (sourceNode.parentId !== targetNode.parentId) {
          return 'Cannot connect nodes in different containers';
        }
      }

      return null; // Valid connection
    },
    [edges, nodes]
  );

  const isValidConnection = useCallback(
    (connection: any) => {
      return getConnectionValidationMessage(connection) === null;
    },
    [getConnectionValidationMessage]
  );

  const onConnectStart: OnConnectStart = useCallback((_, params) => {
    const connectionInfo = { nodeId: params.nodeId as string, handleId: params.handleId };
    setConnectingFrom(connectionInfo);
    connectingFromRef.current = connectionInfo;
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback((event) => {
    const connecting = connectingFromRef.current;

    // Always check if we were attempting a connection
    if (connecting && event) {
      const mouseX = (event as MouseEvent).clientX;
      const mouseY = (event as MouseEvent).clientY;

      // If we have mouse coordinates, find what's under the cursor
      if (mouseX && mouseY) {
        // Temporarily hide connection line elements to detect what's underneath
        const connectionLines = document.querySelectorAll('.react-flow__connectionline');
        const originalPointerEvents: string[] = [];
        connectionLines.forEach((line, i) => {
          const el = line as HTMLElement;
          originalPointerEvents[i] = el.style.pointerEvents;
          el.style.pointerEvents = 'none';
        });

        // Get all elements at the point (not just the top one)
        const elementsAtPoint = document.elementsFromPoint(mouseX, mouseY);

        // Restore pointer events
        connectionLines.forEach((line, i) => {
          (line as HTMLElement).style.pointerEvents = originalPointerEvents[i];
        });

        // Find the first element that is a node (not just any element with data-id)
        let targetNodeElement: Element | null = null;
        for (const element of elementsAtPoint) {
          // Check if element or parent is a react-flow node
          if (element.classList.contains('react-flow__node')) {
            targetNodeElement = element;
            break;
          }
          const nodeEl = element.closest('.react-flow__node');
          if (nodeEl) {
            targetNodeElement = nodeEl;
            break;
          }
        }

        if (targetNodeElement) {
          const targetNodeId = targetNodeElement.getAttribute('data-id');

          // Check if this would be an invalid connection
          if (targetNodeId && targetNodeId !== connecting.nodeId) {
            const validationMessage = getConnectionValidationMessage({
              source: connecting.nodeId,
              target: targetNodeId,
              sourceHandle: connecting.handleId,
              targetHandle: null,
            });

            // Show tooltip if connection is invalid
            if (validationMessage) {
              setConnectionTooltip({
                message: validationMessage,
                position: {
                  x: mouseX,
                  y: mouseY,
                },
              });

              // Auto-hide tooltip after 3 seconds
              setTimeout(() => {
                setConnectionTooltip(null);
              }, 3000);
            }
          }
        } else {
          // No target node found - connection ended in open space
          // Set flag to prevent onPaneClick from closing the panel
          justOpenedNodeLibrary.current = true;
          // Convert screen position to flow position and trigger callback
          if (reactFlowInstance.current && onConnectionDragEnd) {
            const flowPosition = reactFlowInstance.current.screenToFlowPosition({
              x: mouseX,
              y: mouseY,
            });
            onConnectionDragEnd(connecting.nodeId, connecting.handleId, flowPosition);
          }
        }
      }
    }

    setConnectingFrom(null);
    connectingFromRef.current = null;
  }, [getConnectionValidationMessage, onConnectionDragEnd]);

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

  // Helper function to constrain node position within container with padding
  const constrainPositionWithinContainer = useCallback(
    (position: { x: number; y: number }, containerNode: any, nodeWidth: number = 200, nodeHeight: number = 80) => {
      // Container-specific padding (30px to ensure snap-to-grid doesn't override)
      const padding = 30;

      // Get container dimensions
      const containerElement = document.querySelector(`[data-id="${containerNode.id}"]`);
      let containerWidth = containerNode.width || containerNode.style?.width || 250;
      let containerHeight = containerNode.height || containerNode.style?.height || 150;

      // For loop containers, we need to account for the header height
      let availableTop = padding;
      if (containerNode.type === 'loopContainer') {
        const headerHeight = 60; // Header height from LoopContainerNode
        availableTop = headerHeight + padding;
      } else if (containerNode.type === 'conditionalContainer' || containerNode.type === 'switchContainer') {
        const headerHeight = 60;
        availableTop = headerHeight + padding;
      } else if (containerNode.type === 'parallelContainer') {
        const headerHeight = 60;
        availableTop = headerHeight + padding;
      }

      // Calculate constrained position
      const constrainedX = Math.max(padding, Math.min(position.x, containerWidth - nodeWidth - padding));
      const constrainedY = Math.max(availableTop, Math.min(position.y, containerHeight - nodeHeight - padding));

      return { x: constrainedX, y: constrainedY };
    },
    []
  );

  // Wrapper for onNodesChange that applies padding constraints to child nodes
  const onNodesChange = useCallback(
    (changes: any[]) => {
      // Process position changes to apply padding constraints
      const constrainedChanges = changes.map(change => {
        // Process position changes for nodes with a parent (both during and after dragging)
        if (change.type === 'position' && change.position) {
          const node = nodes.find(n => n.id === change.id);
          if (node?.parentId) {
            const parentNode = nodes.find(n => n.id === node.parentId);
            if (parentNode && (
              parentNode.type === 'loopContainer' ||
              parentNode.type === 'conditionalContainer' ||
              parentNode.type === 'switchContainer' ||
              parentNode.type === 'parallelContainer'
            )) {
              // Get node dimensions
              const nodeElement = document.querySelector(`[data-id="${node.id}"]`);
              const nodeWidth = nodeElement?.getBoundingClientRect().width || 200;
              const nodeHeight = nodeElement?.getBoundingClientRect().height || 80;

              // Apply constraints
              const constrainedPosition = constrainPositionWithinContainer(
                change.position,
                parentNode,
                nodeWidth,
                nodeHeight
              );

              return {
                ...change,
                position: constrainedPosition,
              };
            }
          }
        }
        return change;
      });

      storeOnNodesChange(constrainedChanges);
    },
    [nodes, storeOnNodesChange, constrainPositionWithinContainer]
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
              containerNode.type === 'switchContainer' ||
              containerNode.type === 'parallelContainer')
          ) {
            // Don't reparent if already a child of this container
            if (node.parentId === containerId) return;

            // Calculate position relative to container
            let relativePosition = {
              x: node.position.x - containerNode.position.x,
              y: node.position.y - containerNode.position.y,
            };

            // Constrain position within container with padding
            relativePosition = constrainPositionWithinContainer(
              relativePosition,
              containerNode,
              nodeRect.width,
              nodeRect.height
            );

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
    [onNodesChange, constrainPositionWithinContainer]
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
      document.body.classList.remove('dragging-from-panel'); // Remove body class

      const dragData = event.dataTransfer.getData('application/reactflow');

      if (!dragData || !reactFlowInstance.current) {
        return;
      }

      // Try to parse as JSON first (connection tasks), fall back to string (standard nodes)
      let type: FlowNodeType;
      let taskData: any = null;

      try {
        const parsed = JSON.parse(dragData);
        if (parsed.type === 'task' && parsed.taskName && parsed.connectionName && parsed.metadata) {
          // This is a connection task with metadata
          type = 'task';
          taskData = {
            taskName: parsed.taskName,
            connectionName: parsed.connectionName,
            metadata: parsed.metadata,
          };
        } else {
          type = dragData as FlowNodeType;
        }
      } catch {
        // Not JSON, treat as plain node type
        type = dragData as FlowNodeType;
      }

      if (!type) {
        return;
      }

      // Get node dimensions for centering (based on actual node sizes)
      let nodeWidth: number;
      let nodeHeight: number;

      if (type === 'task' || type === 'subflow') {
        nodeWidth = 200;
        nodeHeight = 80;
      } else if (type === 'exit') {
        nodeWidth = 160;
        nodeHeight = 60;
      } else if (type === 'note') {
        nodeWidth = 150;
        nodeHeight = 80;
      } else if (type === 'conditionalContainer' || type === 'switchContainer') {
        nodeWidth = 600;
        nodeHeight = 300;
      } else if (type === 'parallelContainer') {
        nodeWidth = 450;
        nodeHeight = 150;
      } else {
        // loopContainer
        nodeWidth = 250;
        nodeHeight = 150;
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
          containerNodeData.type === 'switchContainer' ||
          containerNodeData.type === 'parallelContainer'
        )) {
          parentId = containerId;

          // Calculate position relative to parent container
          relativePosition = {
            x: position.x - containerNodeData.position.x,
            y: position.y - containerNodeData.position.y,
          };

          // Constrain position within container with padding
          relativePosition = constrainPositionWithinContainer(
            relativePosition,
            containerNodeData,
            nodeWidth,
            nodeHeight
          );

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

      const nodeId = useFlowStore.getState().getNextNodeId();

      // Build step data for task nodes
      let stepData: any = undefined;
      let nodeLabel = `New ${type}`;

      if (type === 'task') {
        if (taskData) {
          // Pre-fill with connection task data
          const { metadata, connectionName } = taskData;

          // Pre-populate inputs with empty values based on metadata
          const prefilledInputs: Record<string, any> = {};
          metadata.inputs.forEach((input: any) => {
            prefilledInputs[input.name] = input.required ? '' : undefined;
          });

          stepData = {
            id: nodeId,
            task: metadata.name,
            connection: connectionName,
            inputs: prefilledInputs,
            outputs: metadata.outputs || [],
          };

          nodeLabel = metadata.label || metadata.name;
        } else {
          // Default empty task
          stepData = {
            id: nodeId,
            task: undefined,
            inputs: {},
            outputs: [],
          };
        }
      }

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
          label: nodeLabel,
          type,
          ...((position as any).section && { section: (position as any).section }),
          // Add step data for task nodes
          ...(type === 'task' && stepData && { step: stepData }),
        } as FlowNodeData,
      };

      addNode(newNode);

      // Automatically connect first task to Start node if Start node has no outgoing connections
      if (type === 'task' && !parentId) {
        // Get the latest state from the store to avoid stale closure
        const currentEdges = useFlowStore.getState().edges;
        const startNode = nodes.find(n => n.type === 'start');

        if (startNode) {
          // Check if Start node has any outgoing connections
          const startHasConnection = currentEdges.some(e => e.source === startNode.id);

          console.log('[FlowDesigner] Auto-connect check:', {
            nodeId,
            startNodeId: startNode.id,
            currentEdgesCount: currentEdges.length,
            startHasConnection,
            willAutoConnect: !startHasConnection
          });

          if (!startHasConnection) {
            // Auto-connect Start to this new task (after a brief delay to ensure node is added)
            setTimeout(() => {
              console.log('[FlowDesigner] Creating auto-connection');
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

      // Don't auto-open property panel on drop - user needs to double-click
      // Just close the node library panel
      onNodeCreated?.();
    },
    [addNode, nodes, onConnect, setSelectedNode, onNodeCreated, constrainPositionWithinContainer]
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
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onInit={(instance) => {
          reactFlowInstance.current = instance as any;
          if (externalRef) {
            externalRef.current = instance as any;
          }
        }}
        onDrop={onDrop}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onMoveStart={onMoveStart}
        onMoveEnd={onMoveEnd}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode="loose"
        isValidConnection={isValidConnection}
        connectionLineStyle={{ stroke: '#e5e7eb', strokeWidth: 1.5 }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#e5e7eb', strokeWidth: 1.5 },
          markerEnd: {
            type: 'arrowclosed',
            color: '#e5e7eb',
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
        <Controls position="bottom-right" />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        {isPanning && <MiniMap position="bottom-left" />}
      </ReactFlow>

      {/* Connection validation tooltip */}
      {connectionTooltip && (
        <ConnectionTooltip
          message={connectionTooltip.message}
          position={connectionTooltip.position}
          onClose={() => setConnectionTooltip(null)}
        />
      )}
    </div>
  );
}
