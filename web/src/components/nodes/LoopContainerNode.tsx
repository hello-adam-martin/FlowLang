import { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';
import { useFlowStore } from '../../store/flowStore';

function LoopContainerNode({ data, selected, id }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const { getNodes, getNode, setNodes } = useReactFlow();
  const removeNode = useFlowStore((state) => state.removeNode);
  const updateNode = useFlowStore((state) => state.updateNode);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const [isHovered, setIsHovered] = useState(false);
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
          width: node.width ?? node.measured?.width ?? 250,
          height: node.height ?? node.measured?.height ?? 150,
        };
      } else {
        // Fallback to DOM measurement
        const nodeElement = document.querySelector(`[data-id="${id}"]`) as HTMLElement;
        if (nodeElement) {
          const rect = nodeElement.getBoundingClientRect();
          originalSizeRef.current = { width: rect.width, height: rect.height };
        } else {
          // Final fallback to default sizes
          originalSizeRef.current = { width: 250, height: 150 };
        }
      }
    }
  }, [id, getNode]);

  // Find child nodes and calculate execution order based on edges
  const { childNodes, hasChildren, executionOrder } = useMemo(() => {
    const children = getNodes().filter((n) => n.parentId === id);

    // Calculate execution order based on connections
    const childEdges = edges.filter(e => {
      const sourceNode = nodes.find(n => n.id === e.source);
      const targetNode = nodes.find(n => n.id === e.target);
      return sourceNode?.parentId === id && targetNode?.parentId === id;
    });

    // If there are no edges, don't assign any execution order
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

    // Perform topological sort to determine execution order (only for connected nodes)
    const order: string[] = [];
    const queue = [...startNodes.map(n => n.id)];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      order.push(current);

      const neighbors = adjacency.get(current) || [];
      neighbors.forEach(neighbor => {
        const count = incomingCount.get(neighbor) || 0;
        incomingCount.set(neighbor, count - 1);
        if (incomingCount.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      });
    }

    // Create execution order map (nodeId -> order number)
    // Only assign numbers to nodes that are part of the connected flow
    const orderMap = new Map<string, number>();
    order.forEach((nodeId, index) => {
      orderMap.set(nodeId, index + 1);
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
      const currentOrder = (child.data as FlowNodeData).loopExecutionOrder;

      // Only update if order has changed to avoid infinite loops
      if (orderNumber !== currentOrder) {
        updateNode(child.id, { loopExecutionOrder: orderNumber });
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

  // Custom resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: 'right' | 'bottom' | 'corner') => {
    e.stopPropagation();
    e.preventDefault();

    setIsResizing(true);
    didResizeRef.current = false; // Reset on each resize start

    // Get the freshest node data
    const node = getNode(id);
    if (!node) return;

    // Get current size - prefer DOM measurement as it's most accurate
    const nodeElement = document.querySelector(`[data-id="${id}"]`) as HTMLElement;
    let currentWidth = 250;
    let currentHeight = 150;

    if (nodeElement) {
      // Use getBoundingClientRect to get the actual rendered size
      const rect = nodeElement.getBoundingClientRect();
      currentWidth = rect.width;
      currentHeight = rect.height;
    } else {
      // Fallback to node properties if DOM element not found
      currentWidth = node.width ?? node.measured?.width ?? 250;
      currentHeight = node.height ?? node.measured?.height ?? 150;
    }

    resizeStartRef.current = {
      width: currentWidth,
      height: currentHeight,
      mouseX: e.clientX,
      mouseY: e.clientY,
    };

    // Disable node dragging during resize
    setNodes((nodes) =>
      nodes.map((n) =>
        n.id === id ? { ...n, draggable: false } : n
      )
    );

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeStartRef.current) return;

      const deltaX = moveEvent.clientX - resizeStartRef.current.mouseX;
      const deltaY = moveEvent.clientY - resizeStartRef.current.mouseY;

      // Track if we actually moved
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        didResizeRef.current = true;
      }

      let newWidth = resizeStartRef.current.width;
      let newHeight = resizeStartRef.current.height;

      if (direction === 'corner') {
        // Corner resize - update both dimensions
        newWidth = Math.max(originalSizeRef.current?.width ?? 250, resizeStartRef.current.width + deltaX);
        newHeight = Math.max(originalSizeRef.current?.height ?? 150, resizeStartRef.current.height + deltaY);
      } else if (direction === 'right') {
        // Allow resizing, but not smaller than the original size
        newWidth = Math.max(originalSizeRef.current?.width ?? 250, resizeStartRef.current.width + deltaX);
      } else if (direction === 'bottom') {
        // Allow resizing, but not smaller than the original size
        newHeight = Math.max(originalSizeRef.current?.height ?? 150, resizeStartRef.current.height + deltaY);
      }

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

      // Re-enable node dragging
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

  return (
    <>
      <div
        className={`relative bg-white/90 rounded-2xl border-2 transition-all group ${
          selected
            ? 'border-gray-400 shadow-xl ring-2 ring-gray-200'
            : 'border-gray-200 shadow-lg hover:shadow-xl hover:border-gray-300'
        } w-full h-full flex flex-col overflow-visible`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
      >
      {/* Execution order badge - shows when node is inside a parallel container */}
      {nodeData.executionOrder && (
        <div
          className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-gray-300 text-white rounded-full flex items-center justify-center shadow-sm z-10 text-[10px] font-bold"
          title={`Execution order: ${nodeData.executionOrder}`}
        >
          {nodeData.executionOrder}
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
          handleResizeStart(e, 'corner');
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
            <span className="text-white text-sm font-bold">↻</span>
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm text-gray-900">{nodeData.label || 'Loop'}</div>
            <div className="text-xs text-gray-700">
              {nodeData.step?.for_each ? (
                <>
                  <span className="font-mono font-medium">{nodeData.step.for_each}</span>
                  {nodeData.step?.as && <> as <span className="font-mono font-medium">{nodeData.step.as}</span></>}
                </>
              ) : (
                <span className="text-gray-500 font-sans">Configure loop...</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Droppable body area - entire area is droppable */}
      <div
        className="flex-1 min-h-[80px] relative bg-gray-50/30 p-[20px] rounded-b-2xl"
        data-dropzone="true"
        data-section="do"
        onDragOver={onDragOver}
      >
        {/* Empty state hint - only when no children */}
        {!hasChildren && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm text-center pointer-events-none">
            Drop tasks here to execute in loop
          </div>
        )}

        {/* Child nodes render here automatically by ReactFlow */}
      </div>
      </div>
    </>
  );
}

export default memo(LoopContainerNode);
