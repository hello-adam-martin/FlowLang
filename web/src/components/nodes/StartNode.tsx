import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';

const StartNode = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
  return (
    <div
      className={`
        px-4 py-2
        rounded-lg
        bg-white
        border-2
        transition-all
        shadow-sm
        ${selected ? 'border-blue-500 ring-2 ring-blue-300 shadow-md' : 'border-gray-300'}
      `}
      style={{
        minWidth: '80px',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">▶</span>
        <span className="text-sm font-medium text-gray-700">Start</span>
      </div>

      {/* Output handle (right side) */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="!bg-gray-400 !w-2 !h-2 !border-2 !border-white"
      />
    </div>
  );
});

StartNode.displayName = 'StartNode';

export default StartNode;
