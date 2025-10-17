import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';
import { useFlowStore } from '../../store/flowStore';

function ConditionalContainerNode({ data, selected, id }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const removeNode = useFlowStore((state) => state.removeNode);
  const [isHovered, setIsHovered] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  };

  return (
    <>
      <div
        className={`relative bg-white/90 rounded-2xl border-2 transition-all group w-[300px] ${
          selected
            ? 'border-gray-400 shadow-xl ring-2 ring-gray-200'
            : 'border-gray-200 shadow-lg hover:shadow-xl hover:border-gray-300'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
      {/* Delete button - shows on hover */}
      <button
        onClick={handleDelete}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center shadow-sm transition-all z-10 opacity-0 group-hover:opacity-100 cursor-pointer"
        title="Delete node"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      {/* Input Handle - left side */}
      <Handle type="target" position={Position.Left} id="input" className="!w-3 !h-3 !border-2 !border-white !bg-gray-300 !rounded-sm hover:!bg-gray-400 transition-all" />

      {/* Header with subtle gradient */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200 px-4 py-[15px] rounded-t-2xl relative">
        {/* Badge - positioned absolute in top right */}
        {nodeData.badge && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono text-gray-800">
            {nodeData.badge}
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-bold">?</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-gray-900">{nodeData.label || 'Conditional'}</div>
            {nodeData.step?.if ? (
              typeof nodeData.step.if === 'string' ? (
                // Simple condition
                <div className="text-xs text-gray-700 font-mono truncate" title={nodeData.step.if}>
                  {nodeData.step.if}
                </div>
              ) : (
                // Quantified condition (all/any/none)
                (() => {
                  const conditionObj = nodeData.step.if as any;
                  const type = Object.keys(conditionObj)[0] as 'all' | 'any' | 'none';
                  const conditions = conditionObj[type] as string[];

                  const typeLabel = {
                    all: 'All conditions must be true:',
                    any: 'At least one condition must be true:',
                    none: 'No conditions must be true:',
                  }[type];

                  return (
                    <div className="text-xs text-gray-800 mt-1">
                      <div className="font-semibold mb-0.5">{typeLabel}</div>
                      <ul className="space-y-0.5 ml-2">
                        {conditions.map((condition, idx) => (
                          <li key={idx} className="font-mono text-[10px] truncate" title={condition}>
                            • {condition}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()
              )
            ) : (
              <div className="text-xs text-gray-500 font-sans">Configure condition...</div>
            )}
          </div>
        </div>
      </div>

      {/* Body - Output handles with labels */}
      <div className="px-4 py-3 space-y-2 rounded-b-2xl">
        {/* Then output */}
        <div className="relative flex items-center bg-green-50/50 border border-green-200 rounded-lg px-3 py-2 group/then hover:bg-green-100/50 transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-green-700 font-semibold text-xs">✓ Then</span>
            <span className="text-green-600 text-[10px]">when true</span>
          </div>
          <Handle
            type="source"
            position={Position.Right}
            id="then"
            className="!w-3 !h-3 !border-2 !border-white !bg-green-500 hover:!bg-green-600 !rounded-full transition-all"
            style={{ right: '-6px', top: '50%', transform: 'translateY(-50%)' }}
          />
        </div>

        {/* Else output */}
        <div className="relative flex items-center bg-red-50/50 border border-red-200 rounded-lg px-3 py-2 group/else hover:bg-red-100/50 transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-red-700 font-semibold text-xs">✗ Else</span>
            <span className="text-red-600 text-[10px]">when false</span>
          </div>
          <Handle
            type="source"
            position={Position.Right}
            id="else"
            className="!w-3 !h-3 !border-2 !border-white !bg-red-500 hover:!bg-red-600 !rounded-full transition-all"
            style={{ right: '-6px', top: '50%', transform: 'translateY(-50%)' }}
          />
        </div>
      </div>
      </div>
    </>
  );
}

export default memo(ConditionalContainerNode);
