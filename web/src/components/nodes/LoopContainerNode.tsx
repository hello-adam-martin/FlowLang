import { memo, useCallback, useMemo, useState, useRef } from 'react';
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';
import { useFlowStore } from '../../store/flowStore';

function LoopContainerNode({ data, selected, id }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const { getNodes, getNode, setNodes } = useReactFlow();
  const removeNode = useFlowStore((state) => state.removeNode);
  const nodes = useFlowStore((state) => state.nodes);
  const [isHovered, setIsHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ width: number; height: number; mouseX: number; mouseY: number } | null>(null);
  const didResizeRef = useRef(false);

  // Store the original size when first rendered (only once)
  const originalSizeRef = useRef<{ width: number; height: number } | null>(null);

  // Capture original size on first render
  if (!originalSizeRef.current) {
    const nodeElement = document.querySelector(`[data-id="${id}"]`) as HTMLElement;
    if (nodeElement) {
      const rect = nodeElement.getBoundingClientRect();
      originalSizeRef.current = { width: rect.width, height: rect.height };
    } else {
      // Fallback to default sizes
      originalSizeRef.current = { width: 250, height: 150 };
    }
  }

  // Find child nodes - use useMemo to recalculate when nodes change
  const childNodes = useMemo(() => {
    return getNodes().filter((n) => n.parentId === id);
  }, [nodes, id, getNodes]);

  const hasChildren = childNodes.length > 0;

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
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: 'right' | 'bottom') => {
    e.stopPropagation();
    e.preventDefault();

    setIsResizing(true);
    didResizeRef.current = false; // Reset on each resize start

    // Get the freshest node data
    const node = getNode(id);
    if (!node) return;

    // Get the actual rendered dimensions from the DOM
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

      if (direction === 'right') {
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
            ? 'border-purple-400 shadow-xl ring-2 ring-purple-200'
            : 'border-purple-200 shadow-lg hover:shadow-xl hover:border-purple-300'
        } w-full h-full flex flex-col overflow-visible`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
      >
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

      {/* Custom resize handle - Right edge */}
      <div
        className={`nodrag absolute right-0 top-1/2 -translate-y-1/2 w-3 h-16 cursor-ew-resize transition-opacity z-50 ${
          isHovered || selected ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onMouseDown={(e) => {
          e.stopPropagation();
          handleResizeStart(e, 'right');
        }}
        style={{ pointerEvents: 'auto' }}
        title="Drag to resize width"
      >
        <div className="w-full h-full bg-purple-400 hover:bg-purple-500 rounded-l flex items-center justify-center shadow-md">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* Custom resize handle - Bottom edge */}
      <div
        className={`nodrag absolute bottom-0 left-1/2 -translate-x-1/2 h-3 w-16 cursor-ns-resize transition-opacity z-50 ${
          isHovered || selected ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onMouseDown={(e) => {
          e.stopPropagation();
          handleResizeStart(e, 'bottom');
        }}
        style={{ pointerEvents: 'auto' }}
        title="Drag to resize height"
      >
        <div className="w-full h-full bg-purple-400 hover:bg-purple-500 rounded-t flex items-center justify-center shadow-md">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Handles - left (input) and right (output) only */}
      <Handle type="source" position={Position.Left} id="left" className="w-2.5 h-2.5 bg-purple-500 border-2 border-white shadow-sm" />
      <Handle type="source" position={Position.Right} id="right" className="w-2.5 h-2.5 bg-purple-500 border-2 border-white shadow-sm" />

      {/* Header with subtle gradient */}
      <div
        className="bg-gradient-to-r from-purple-50 to-purple-100 border-b-2 border-purple-200 px-4 py-[15px] rounded-t-2xl"
        onDragOver={preventHeaderDrop}
        onDrop={preventHeaderDrop}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-bold">↻</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="font-semibold text-sm text-gray-900">{nodeData.label || 'Loop'}</div>
              {nodeData.badge && (
                <div className="px-2 py-0.5 bg-purple-100 border border-purple-300 rounded text-xs font-mono text-purple-800">
                  {nodeData.badge}
                </div>
              )}
            </div>
            <div className="text-xs text-purple-700">
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
        className="flex-1 min-h-[80px] relative bg-purple-50/10 p-[20px] rounded-b-2xl"
        data-dropzone="true"
        data-section="do"
        onDragOver={onDragOver}
      >
        {/* Empty state hint - only when no children */}
        {!hasChildren && (
          <div className="flex items-center justify-center h-full text-purple-500 text-sm text-center pointer-events-none">
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
