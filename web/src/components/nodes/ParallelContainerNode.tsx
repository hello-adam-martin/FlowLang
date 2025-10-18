import { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';
import { useFlowStore } from '../../store/flowStore';

function ParallelContainerNode({ data, selected, id }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const { getNodes, getNode, setNodes } = useReactFlow();
  const removeNode = useFlowStore((state) => state.removeNode);
  const updateNode = useFlowStore((state) => state.updateNode);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const execution = useFlowStore((state) => state.execution);
  const [isHovered, setIsHovered] = useState(false);

  // Get execution state for this node
  const nodeExecutionState = execution.nodeStates[id];
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ width: number; height: number; mouseX: number; mouseY: number } | null>(null);
  const didResizeRef = useRef(false);

  // Store the original size when first rendered (only once)
  const originalSizeRef = useRef<{ width: number; height: number } | null>(null);

  // Capture original size on first render - prefer node properties over DOM
  useEffect(() => {
    if (!originalSizeRef.current) {
      const node = getNode(id);
      if (node && (node.width || node.measured?.width)) {
        // Use node properties if available (from YAML import)
        originalSizeRef.current = {
          width: node.width ?? node.measured?.width ?? 450,
          height: node.height ?? node.measured?.height ?? 200,
        };
      } else {
        // Fallback to DOM measurement
        const nodeElement = document.querySelector(`[data-id="${id}"]`) as HTMLElement;
        if (nodeElement) {
          const rect = nodeElement.getBoundingClientRect();
          originalSizeRef.current = { width: rect.width, height: rect.height };
        } else {
          // Final fallback to default sizes
          originalSizeRef.current = { width: 450, height: 200 };
        }
      }
    }
  }, [id, getNode]);

  // Find child nodes and calculate execution order based on edges
  const { childNodes, hasChildren, executionOrder } = useMemo(() => {
    const children = getNodes().filter((n) => n.parentId === id);

    // Calculate execution order based on connections (parallel tracks)
    const childEdges = edges.filter(e => {
      const sourceNode = nodes.find(n => n.id === e.source);
      const targetNode = nodes.find(n => n.id === e.target);
      return sourceNode?.parentId === id && targetNode?.parentId === id;
    });

    // If there are no edges, all nodes execute in parallel (no order needed)
    if (childEdges.length === 0) {
      return {
        childNodes: children,
        hasChildren: children.length > 0,
        executionOrder: new Map<string, number>(),
      };
    }

    // Build adjacency list and track which nodes are connected
    const incomingCount = new Map<string, number>();
    const adjacency = new Map<string, string[]>();
    const connectedNodes = new Set<string>();

    children.forEach(child => {
      incomingCount.set(child.id, 0);
      adjacency.set(child.id, []);
    });

    childEdges.forEach(edge => {
      adjacency.get(edge.source)?.push(edge.target);
      incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    });

    // Find starting nodes (those with no incoming edges BUT are connected)
    const startNodes = children.filter(child =>
      incomingCount.get(child.id) === 0 && connectedNodes.has(child.id)
    );

    // Create execution order map - assign numbers independently per chain
    const orderMap = new Map<string, number>();

    // Process each independent chain starting from each start node
    startNodes.forEach(startNode => {
      let chainOrder = 1;
      const queue = [startNode.id];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);

        // Assign order number for this chain
        orderMap.set(current, chainOrder++);

        const neighbors = adjacency.get(current) || [];
        neighbors.forEach(neighbor => {
          // Only follow edges within this chain (not already visited)
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        });
      }
    });

    return {
      childNodes: children,
      hasChildren: children.length > 0,
      executionOrder: orderMap,
    };
  }, [nodes, edges, id, getNodes]);

  // Update child nodes with their execution order
  useEffect(() => {
    childNodes.forEach(child => {
      const orderNumber = executionOrder.get(child.id);
      const currentOrder = (child.data as FlowNodeData).executionOrder;

      // Only update if order has changed to avoid infinite loops
      if (orderNumber !== currentOrder) {
        updateNode(child.id, { executionOrder: orderNumber });
      }
    });
  }, [childNodes, executionOrder, updateNode]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    // Don't stop propagation - allow parent to handle drag-over detection
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  };

  const preventHeaderDrop = useCallback((event: React.DragEvent) => {
    event.stopPropagation();
    event.preventDefault();
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Prevent click from bubbling if we just resized
    if (didResizeRef.current) {
      e.stopPropagation();
      didResizeRef.current = false;
    }
  }, []);

  // Custom resize handler
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    setIsResizing(true);
    didResizeRef.current = false;

    const node = getNode(id);
    if (!node) return;

    // Get current size - prefer DOM measurement as it's most accurate
    const nodeElement = document.querySelector(`[data-id="${id}"]`) as HTMLElement;
    let currentWidth = 450;
    let currentHeight = 200;

    if (nodeElement) {
      const rect = nodeElement.getBoundingClientRect();
      currentWidth = rect.width;
      currentHeight = rect.height;
    } else {
      currentWidth = node.width ?? node.measured?.width ?? 450;
      currentHeight = node.height ?? node.measured?.height ?? 200;
    }

    resizeStartRef.current = {
      width: currentWidth,
      height: currentHeight,
      mouseX: e.clientX,
      mouseY: e.clientY,
    };

    setNodes((nodes) =>
      nodes.map((n) =>
        n.id === id ? { ...n, draggable: false } : n
      )
    );

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeStartRef.current) return;

      const deltaX = moveEvent.clientX - resizeStartRef.current.mouseX;
      const deltaY = moveEvent.clientY - resizeStartRef.current.mouseY;

      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        didResizeRef.current = true;
      }

      const newWidth = Math.max(originalSizeRef.current?.width ?? 450, resizeStartRef.current.width + deltaX);
      const newHeight = Math.max(originalSizeRef.current?.height ?? 200, resizeStartRef.current.height + deltaY);

      setNodes((nodes) =>
        nodes.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              style: { ...n.style, width: newWidth, height: newHeight },
              width: newWidth,
              height: newHeight,
            };
          }
          return n;
        })
      );
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;

      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === id ? { ...n, draggable: true } : n
        )
      );

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [id, getNode, setNodes]);

  // Calculate execution-based border color
  let borderColor = 'border-gray-200';
  let pulseAnimation = '';

  if (nodeExecutionState) {
    switch (nodeExecutionState.state) {
      case 'running':
        borderColor = 'border-blue-500';
        pulseAnimation = 'animate-pulse';
        break;
      case 'completed':
        borderColor = 'border-green-500';
        break;
      case 'error':
        borderColor = 'border-red-500';
        break;
    }
  }

  return (
    <>
      <div
        className={`relative bg-white/90 rounded-2xl border-2 transition-all group ${
          selected
            ? 'border-gray-400 shadow-xl ring-2 ring-gray-200'
            : nodeExecutionState
            ? `${borderColor} shadow-xl`
            : 'border-gray-200 shadow-lg hover:shadow-xl hover:border-gray-300'
        } ${pulseAnimation} w-full h-full flex flex-col overflow-visible`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
      >
      {/* Execution order badge - shows when node is inside another container */}
      {nodeData.executionOrder && (
        <div
          className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-gray-300 text-white rounded-full flex items-center justify-center shadow-sm z-10 text-[10px] font-bold"
          title={`Execution order: ${nodeData.executionOrder}`}
        >
          {nodeData.executionOrder}
        </div>
      )}

      {/* Parallel progress badge - shows running/completed children */}
      {nodeExecutionState?.containerMeta?.activeChildren && (
        <div
          className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-2 py-0.5 bg-blue-500 text-white rounded-full shadow-md z-10 text-[10px] font-bold whitespace-nowrap"
          title={`${nodeExecutionState.containerMeta.completedChildren?.length || 0} completed, ${nodeExecutionState.containerMeta.activeChildren.length} running`}
        >
          {nodeExecutionState.containerMeta.completedChildren?.length || 0}/{(nodeExecutionState.containerMeta.completedChildren?.length || 0) + nodeExecutionState.containerMeta.activeChildren.length} done
        </div>
      )}

      {/* Delete button - shows on hover */}
      <button
        onClick={handleDelete}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center shadow-sm transition-all z-10 opacity-0 group-hover:opacity-100 cursor-pointer"
        title="Delete container"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      {/* Custom resize handle - Bottom-right corner */}
      <div
        className={`nodrag absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize transition-opacity z-50 ${
          isHovered || selected ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onMouseDown={(e) => {
          e.stopPropagation();
          handleResizeStart(e);
        }}
        style={{ pointerEvents: 'auto' }}
        title="Drag to resize"
      >
        <div className="w-full h-full bg-gray-400 hover:bg-gray-500 rounded-tl flex items-center justify-center shadow-md">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </div>
      </div>

      {/* Handles - left (input square) and right (output circle) like task node */}
      <Handle type="target" position={Position.Left} id="left" className="!w-3 !h-3 !border-2 !border-white !bg-gray-300 !rounded-sm hover:!bg-gray-400 transition-all" />
      <Handle type="source" position={Position.Right} id="right" className="!w-3 !h-3 !border-2 !border-white !bg-gray-300 !rounded-full hover:!bg-gray-400 transition-all" />

      {/* Header with subtle gradient */}
      <div
        className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200 px-4 py-[15px] rounded-t-2xl relative"
        onDragOver={preventHeaderDrop}
        onDrop={preventHeaderDrop}
      >
        {/* Badge - positioned absolute in top right */}
        {nodeData.badge && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono text-gray-800">
            {nodeData.badge}
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-bold">⇉</span>
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm text-gray-900">{nodeData.label || 'Parallel Execution'}</div>
            <div className="text-xs text-gray-700">
              {childNodes.length > 0 ? `${childNodes.length} task${childNodes.length !== 1 ? 's' : ''} in parallel` : 'All tasks execute concurrently'}
            </div>
            {/* Execution progress - only shown when running */}
            {nodeExecutionState?.containerMeta && (
              <div className="text-xs text-blue-600 mt-1 font-mono">
                {nodeExecutionState.containerMeta.activeChildren && nodeExecutionState.containerMeta.activeChildren.length > 0
                  ? `${nodeExecutionState.containerMeta.activeChildren.length} running, ${nodeExecutionState.containerMeta.completedChildren?.length || 0} completed`
                  : `All ${nodeExecutionState.containerMeta.completedChildren?.length || 0} tasks completed`
                }
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Droppable body area - entire area is droppable */}
      <div
        className="flex-1 min-h-[80px] relative bg-gray-50/30 p-[30px] rounded-b-2xl"
        data-dropzone="true"
        onDragOver={onDragOver}
      >
        {/* Empty state hint - only when no children */}
        {!hasChildren && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm text-center pointer-events-none">
            Drop tasks here - they will execute in parallel
          </div>
        )}

        {/* Child nodes render here automatically by ReactFlow */}
      </div>
      </div>
    </>
  );
}

export default memo(ParallelContainerNode);
