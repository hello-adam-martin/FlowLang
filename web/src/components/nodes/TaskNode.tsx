import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';
import { useFlowStore } from '../../store/flowStore';

function TaskNode({ data, selected, id }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const hasErrors = nodeData.errors && nodeData.errors.length > 0;
  const removeNode = useFlowStore((state) => state.removeNode);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  };

  return (
    <div
      className={`px-3 py-2 rounded-xl border bg-white min-w-[140px] transition-all relative group ${
        selected
          ? 'border-blue-500 shadow-lg ring-2 ring-blue-200'
          : hasErrors
          ? 'border-red-400 shadow-md'
          : 'border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300'
      }`}
    >
      {/* Delete button - shows when selected */}
      {selected && (
        <button
          onClick={handleDelete}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center shadow-sm transition-all z-10 opacity-90 hover:opacity-100"
          title="Delete node"
        >
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}

      {/* Handles on all four sides - works as both source and target with connectionMode="loose" */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="w-2 h-2 border-2 border-white bg-gray-400"
      />

      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-2 h-2 border-2 border-white bg-gray-400"
      />

      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-2 h-2 border-2 border-white bg-gray-400"
      />

      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="w-2 h-2 border-2 border-white bg-gray-400"
      />

      <div className="flex items-center gap-2">
        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-sm">
          <span className="text-white text-xs font-bold">T</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-900 truncate">
            {nodeData.label || 'New Task'}
          </div>
          {nodeData.step?.task && (
            <div className="text-[10px] text-gray-600 font-mono truncate">
              {nodeData.step.task}
            </div>
          )}
        </div>
      </div>

      {hasErrors && (
        <div className="mt-1.5 text-[10px] text-red-600 truncate">
          {nodeData.errors![0]}
        </div>
      )}
    </div>
  );
}

export default memo(TaskNode);
