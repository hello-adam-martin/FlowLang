import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';
import { useFlowStore } from '../../store/flowStore';

function SwitchContainerNode({ data, selected, id }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const removeNode = useFlowStore((state) => state.removeNode);
  const updateNode = useFlowStore((state) => state.updateNode);
  const [isHovered, setIsHovered] = useState(false);

  // Get cases from node data
  const cases = nodeData.cases || [];

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  };

  // Add a new case
  const handleAddCase = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newCaseId = `case_${Date.now()}`;
    const newCases = [...cases, { id: newCaseId, when: '' }];
    updateNode(id, { cases: newCases });
  };

  // Remove a case
  const handleRemoveCase = (e: React.MouseEvent, caseId: string) => {
    e.stopPropagation();
    const newCases = cases.filter((c) => c.id !== caseId);
    updateNode(id, { cases: newCases });
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
            <span className="text-white text-sm font-bold">⋮</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-gray-900">{nodeData.label || 'Switch'}</div>
            {nodeData.step?.switch ? (
              <div className="text-xs text-gray-700 font-mono truncate" title={nodeData.step.switch}>
                {nodeData.step.switch}
              </div>
            ) : (
              <div className="text-xs text-gray-500 font-sans">Configure switch expression...</div>
            )}
          </div>
          <button
            onClick={handleAddCase}
            className="flex-shrink-0 w-6 h-6 bg-gray-500 hover:bg-gray-600 text-white rounded flex items-center justify-center shadow-sm transition-all"
            title="Add new case"
          >
            <span className="text-sm font-bold">+</span>
          </button>
        </div>
      </div>

      {/* Body - Output handles with labels */}
      <div className="px-4 py-3 space-y-2 rounded-b-2xl max-h-[400px] overflow-y-auto">
        {/* Render each case as an output handle */}
        {cases.map((switchCase, index) => {
          const whenValue = Array.isArray(switchCase.when)
            ? switchCase.when.join(', ')
            : String(switchCase.when || `Case ${index + 1}`);

          return (
            <div
              key={switchCase.id}
              className="relative flex items-center bg-blue-50/50 border border-blue-200 rounded-lg px-3 py-2 group/case hover:bg-blue-100/50 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-blue-700 font-semibold text-xs">➤</span>
                <span className="text-blue-700 text-xs font-mono truncate" title={whenValue}>
                  {whenValue}
                </span>
              </div>
              {/* Delete case button */}
              <button
                onClick={(e) => handleRemoveCase(e, switchCase.id)}
                className="flex-shrink-0 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all opacity-0 group-hover/case:opacity-100 ml-1"
                title="Remove case"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <Handle
                type="source"
                position={Position.Right}
                id={`case_${switchCase.id}`}
                className="!w-3 !h-3 !border-2 !border-white !bg-blue-500 hover:!bg-blue-600 !rounded-full transition-all"
                style={{ right: '-6px', top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          );
        })}

        {/* Default output - always present */}
        <div className="relative flex items-center bg-gray-50/50 border border-gray-300 rounded-lg px-3 py-2 group/default hover:bg-gray-100/50 transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-gray-700 font-semibold text-xs">⚠ Default</span>
            <span className="text-gray-600 text-[10px]">fallback</span>
          </div>
          <Handle
            type="source"
            position={Position.Right}
            id="default"
            className="!w-3 !h-3 !border-2 !border-white !bg-gray-500 hover:!bg-gray-600 !rounded-full transition-all"
            style={{ right: '-6px', top: '50%', transform: 'translateY(-50%)' }}
          />
        </div>
      </div>
      </div>
    </>
  );
}

export default memo(SwitchContainerNode);
