import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';

function ParallelNode({ data, selected }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const hasErrors = nodeData.errors && nodeData.errors.length > 0;

  return (
    <div
      className={`px-4 py-3 shadow-md rounded-lg border-2 bg-white min-w-[160px] ${
        selected ? 'border-blue-500' : hasErrors ? 'border-red-500' : 'border-green-400'
      }`}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-center gap-2">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
          <span className="text-green-600 text-sm font-semibold">⇉</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {nodeData.label}
          </div>
          <div className="text-xs text-gray-500">Parallel</div>
        </div>
      </div>

      {nodeData.step?.parallel && Array.isArray(nodeData.step.parallel) && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-600">
            {nodeData.step.parallel.length} parallel steps
          </div>
        </div>
      )}

      {hasErrors && (
        <div className="mt-2 text-xs text-red-600">
          {nodeData.errors![0]}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

export default memo(ParallelNode);
