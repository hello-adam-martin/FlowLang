import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';
import { useFlowStore } from '../../store/flowStore';

function LoopContainerNode({ data, selected, id }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const { getNodes } = useReactFlow();
  const removeNode = useFlowStore((state) => state.removeNode);

  // Find child nodes
  const childNodes = getNodes().filter((n) => n.parentId === id);
  const hasChildren = childNodes.length > 0;

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  };

  return (
    <div
      className={`relative bg-white/90 rounded-2xl border-2 transition-all ${
        selected
          ? 'border-purple-400 shadow-xl ring-2 ring-purple-200'
          : 'border-purple-200 shadow-lg hover:shadow-xl hover:border-purple-300'
      } min-w-[420px] min-h-[280px]`}
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

      {/* Handles on all four sides - works as both source and target with connectionMode="loose" */}
      <Handle type="source" position={Position.Top} id="top" className="w-2.5 h-2.5 bg-purple-500 border-2 border-white shadow-sm" />
      <Handle type="source" position={Position.Right} id="right" className="w-2.5 h-2.5 bg-purple-500 border-2 border-white shadow-sm" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="w-2.5 h-2.5 bg-purple-500 border-2 border-white shadow-sm" />
      <Handle type="source" position={Position.Left} id="left" className="w-2.5 h-2.5 bg-purple-500 border-2 border-white shadow-sm" />

      {/* Header with subtle gradient */}
      <div className="bg-gradient-to-r from-purple-50 to-purple-100 border-b-2 border-purple-200 px-4 py-3 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-bold">↻</span>
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm text-gray-900">Loop</div>
            <div className="text-xs text-purple-700">
              {nodeData.step?.for_each ? (
                <>
                  For each: <span className="font-mono font-medium">{nodeData.step.for_each}</span>
                  {nodeData.step?.as && <> as <span className="font-mono font-medium">{nodeData.step.as}</span></>}
                </>
              ) : (
                <span className="text-gray-500">Configure loop...</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Droppable body area */}
      <div className="p-5 min-h-[200px]" data-dropzone="true">
        {!hasChildren && (
          <div className="flex items-center justify-center h-full border-2 border-dashed border-purple-300 rounded-xl bg-purple-50/30 backdrop-blur-sm">
            <div className="text-center text-purple-600">
              <div className="text-sm font-medium mb-1">Drop tasks here</div>
              <div className="text-xs text-purple-500">Tasks will execute in a loop</div>
            </div>
          </div>
        )}
        {hasChildren && (
          <div className="text-xs font-medium text-purple-700">
            {childNodes.length} task{childNodes.length !== 1 ? 's' : ''} in loop
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(LoopContainerNode);
