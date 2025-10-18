import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';
import { useFlowStore } from '../../store/flowStore';

function ConditionalContainerNode({ data, selected, id }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const removeNode = useFlowStore((state) => state.removeNode);
  const execution = useFlowStore((state) => state.execution);
  const [isHovered, setIsHovered] = useState(false);

  // Get execution state for this node
  const nodeExecutionState = execution.nodeStates[id];

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  };

  // Calculate execution-based border color
  let borderColor = 'border-gray-200';
  let pulseAnimation = '';

  if (nodeExecutionState) {
    switch (nodeExecutionState.state) {
      case 'running':
        borderColor = 'border-blue-500';
        pulseAnimation = 'animate-pulse';
        break;
      case 'completed':
        borderColor = 'border-green-500';
        break;
      case 'error':
        borderColor = 'border-red-500';
        break;
    }
  }

  return (
    <>
      <div
        className={`relative bg-white/90 rounded-2xl border-2 transition-all group w-[300px] ${
          selected
            ? 'border-gray-400 shadow-xl ring-2 ring-gray-200'
            : nodeExecutionState
            ? `${borderColor} shadow-xl`
            : 'border-gray-200 shadow-lg hover:shadow-xl hover:border-gray-300'
        } ${pulseAnimation}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
      {/* Active branch badge - shows which branch is executing */}
      {nodeExecutionState?.containerMeta?.activeBranch && (
        <div
          className={`absolute -top-3 left-1/2 transform -translate-x-1/2 px-2 py-0.5 text-white rounded-full shadow-md z-10 text-[10px] font-bold whitespace-nowrap ${
            nodeExecutionState.containerMeta.activeBranch === 'then' ? 'bg-green-500' : 'bg-red-500'
          }`}
          title={`Following ${nodeExecutionState.containerMeta.activeBranch} branch`}
        >
          {nodeExecutionState.containerMeta.activeBranch === 'then' ? '✓ THEN' : '✗ ELSE'}
        </div>
      )}

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
        <div className={`relative flex items-center rounded-lg px-3 py-2 group/then transition-all ${
          nodeExecutionState?.containerMeta?.activeBranch === 'then'
            ? 'bg-green-200 border-2 border-green-500 shadow-md'
            : 'bg-green-50/50 border border-green-200 hover:bg-green-100/50'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`font-semibold text-xs ${
              nodeExecutionState?.containerMeta?.activeBranch === 'then' ? 'text-green-800' : 'text-green-700'
            }`}>✓ Then</span>
            <span className={`text-[10px] ${
              nodeExecutionState?.containerMeta?.activeBranch === 'then' ? 'text-green-700' : 'text-green-600'
            }`}>when true</span>
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
        <div className={`relative flex items-center rounded-lg px-3 py-2 group/else transition-all ${
          nodeExecutionState?.containerMeta?.activeBranch === 'else'
            ? 'bg-red-200 border-2 border-red-500 shadow-md'
            : 'bg-red-50/50 border border-red-200 hover:bg-red-100/50'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`font-semibold text-xs ${
              nodeExecutionState?.containerMeta?.activeBranch === 'else' ? 'text-red-800' : 'text-red-700'
            }`}>✗ Else</span>
            <span className={`text-[10px] ${
              nodeExecutionState?.containerMeta?.activeBranch === 'else' ? 'text-red-700' : 'text-red-600'
            }`}>when false</span>
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
