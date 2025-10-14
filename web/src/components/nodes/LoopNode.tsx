import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';

function LoopNode({ data, selected }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const hasErrors = nodeData.errors && nodeData.errors.length > 0;

  return (
    <div
      className={`px-4 py-3 shadow-md rounded-lg border-2 bg-white min-w-[160px] ${
        selected ? 'border-blue-500' : hasErrors ? 'border-red-500' : 'border-purple-400'
      }`}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-center gap-2">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
          <span className="text-purple-600 text-sm font-semibold">↻</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {nodeData.label}
          </div>
          <div className="text-xs text-gray-500">Loop</div>
        </div>
      </div>

      {nodeData.step?.for_each && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-600 font-mono truncate">
            for_each: {nodeData.step.for_each}
          </div>
          {nodeData.step.as && (
            <div className="text-xs text-gray-600 font-mono truncate">
              as: {nodeData.step.as}
            </div>
          )}
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

export default memo(LoopNode);
