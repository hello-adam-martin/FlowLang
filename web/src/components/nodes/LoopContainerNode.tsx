import { memo, useCallback, useMemo } from 'react';
import { Handle, Position, type NodeProps, useReactFlow, NodeResizer } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';
import { useFlowStore } from '../../store/flowStore';

function LoopContainerNode({ data, selected, id }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const { getNodes } = useReactFlow();
  const removeNode = useFlowStore((state) => state.removeNode);
  const nodes = useFlowStore((state) => state.nodes);

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

  return (
    <>
      <NodeResizer
        color="#a855f7"
        isVisible={selected}
        minWidth={450}
        minHeight={195}
        keepAspectRatio={false}
      />
      <div
        className={`relative bg-white/90 rounded-2xl border-2 transition-all ${
          selected
            ? 'border-purple-400 shadow-xl ring-2 ring-purple-200'
            : 'border-purple-200 shadow-lg hover:shadow-xl hover:border-purple-300'
        } w-full h-full flex flex-col`}
        onDragOver={onDragOver}
      >
      {/* Delete button - shows when selected */}
      {selected && (
        <button
          onClick={handleDelete}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center shadow-sm transition-all z-10 opacity-90 hover:opacity-100"
          title="Delete container"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}

      {/* Handles - left (input) and right (output) only */}
      <Handle type="source" position={Position.Left} id="left" className="w-2.5 h-2.5 bg-purple-500 border-2 border-white shadow-sm" />
      <Handle type="source" position={Position.Right} id="right" className="w-2.5 h-2.5 bg-purple-500 border-2 border-white shadow-sm" />

      {/* Header with subtle gradient */}
      <div className="bg-gradient-to-r from-purple-50 to-purple-100 border-b-2 border-purple-200 px-4 py-[15px] rounded-t-2xl">
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
          {childNodes.length > 0 && (
            <div className="text-xs font-medium text-purple-700">
              {childNodes.length} task{childNodes.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Droppable body area */}
      <div className="p-[15px] flex-1 flex items-center justify-center" data-dropzone="true">
        {!hasChildren && (
          <div className="text-center text-purple-600">
            <div className="text-sm font-medium mb-1">Drop tasks here</div>
            <div className="text-xs text-purple-500">Tasks will execute in a loop</div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}

export default memo(LoopContainerNode);
