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

let nodeId = 0;
const getNodeId = () => `node_${nodeId++}`;

export default function FlowDesigner() {
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
  const hasInitiallyFit = useRef(false);

  // Fit view only on initial load
  useEffect(() => {
    if (reactFlowInstance.current && !hasInitiallyFit.current && nodes.length > 0) {
      reactFlowInstance.current.fitView({ maxZoom: 1, duration: 200 });
      hasInitiallyFit.current = true;
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
  }, []);

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
      return !sourceHandleUsedAsTarget && !targetHandleUsedAsSource;
    },
    [edges]
  );

  const onConnectStart: OnConnectStart = useCallback((_, params) => {
    setConnectingFrom({ nodeId: params.nodeId as string, handleId: params.handleId });
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(() => {
    setConnectingFrom(null);
  }, []);

  // Add invalid class to nodes that cannot be connected to
  const nodesWithInvalidClass = nodes.map(node => {
    if (!connectingFrom) return node;

    // Check if this node would be an invalid connection target
    const wouldBeInvalid = !isValidConnection({
      source: connectingFrom.nodeId,
      target: node.id,
      sourceHandle: connectingFrom.handleId,
      targetHandle: null, // We don't know which handle yet
    });

    return {
      ...node,
      className: wouldBeInvalid ? 'invalid-connection-target' : '',
    };
  });

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as FlowNodeType;

      if (!type || !reactFlowInstance.current) {
        return;
      }

      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Check if we're dropping onto a container node's drop zone
      const targetElement = event.target as HTMLElement;

      // First check if we're in a valid drop zone
      const dropZone = targetElement.closest('[data-dropzone="true"]');
      const containerNode = targetElement.closest('[data-id]');
      let parentId: string | undefined;

      if (dropZone && containerNode) {
        const containerId = containerNode.getAttribute('data-id');
        if (!containerId) return;
        const containerNodeData = nodes.find(n => n.id === containerId);

        // Check if the target is a container type
        if (containerNodeData && (
          containerNodeData.type === 'loopContainer' ||
          containerNodeData.type === 'conditionalContainer' ||
          containerNodeData.type === 'parallelContainer'
        )) {
          parentId = containerId;

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

      const newNode = {
        id: getNodeId(),
        type,
        position: parentId ? {
          x: 20, // Relative to parent
          y: 60
        } : position,
        ...(parentId && {
          parentId,
          extent: 'parent' as const,
        }),
        data: {
          label: `New ${type}`,
          type,
          ...((position as any).section && { section: (position as any).section }),
        } as FlowNodeData,
      };

      addNode(newNode);
    },
    [addNode, nodes]
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
    <div className="w-full h-full" ref={reactFlowWrapper}>
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
        onDragOver={onDragOver}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
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
