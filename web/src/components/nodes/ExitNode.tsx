import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';
import { useFlowStore } from '../../store/flowStore';

function ExitNode({ data, selected, id }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const removeNode = useFlowStore((state) => state.removeNode);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  };

  const exitConfig = nodeData.step?.exit;
  const reason = typeof exitConfig === 'object' ? exitConfig.reason : undefined;

  return (
    <div
      className={`px-3 py-2 rounded-xl border min-w-[140px] transition-all relative group ${
        selected
          ? 'border-red-400 shadow-lg ring-2 ring-red-200 bg-red-50'
          : 'border-red-200 shadow-md hover:shadow-lg hover:border-red-300 bg-gradient-to-br from-red-50 to-white'
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Only input handle - no output since this terminates the flow */}
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 bg-red-500 border-2 border-white shadow-sm" />

      <div className="flex items-center gap-2">
        {/* Icon */}
        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-sm">
          <span className="text-white text-xs font-bold">⏹</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {nodeData.label || 'Exit Flow'}
          </div>
          {reason && (
            <div className="text-xs text-red-700 truncate" title={reason}>
              {reason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ExitNode);
