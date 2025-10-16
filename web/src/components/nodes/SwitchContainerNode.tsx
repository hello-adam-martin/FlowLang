import { memo, useCallback, useMemo } from 'react';
import { Handle, Position, type NodeProps, useReactFlow, NodeResizer } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';
import { useFlowStore } from '../../store/flowStore';

function SwitchContainerNode({ data, selected, id }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const { getNodes } = useReactFlow();
  const removeNode = useFlowStore((state) => state.removeNode);
  const updateNode = useFlowStore((state) => state.updateNode);
  const nodes = useFlowStore((state) => state.nodes);

  // Get cases from node data
  const cases = nodeData.cases || [];
  const caseCount = cases.length;

  // Find child nodes - group by case
  const { caseNodes, defaultNodes } = useMemo(() => {
    const childNodes = getNodes().filter((n) => n.parentId === id);
    return {
      caseNodes: childNodes.filter((n) => (n.data as any).caseId),
      defaultNodes: childNodes.filter((n) => (n.data as any).section === 'default'),
    };
  }, [nodes, id, getNodes]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

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
      <NodeResizer
        color="#9ca3af"
        isVisible={selected}
        minWidth={600}
        minHeight={300}
        keepAspectRatio={false}
      />
      <div
        className={`relative bg-white/90 rounded-2xl border-2 transition-all group ${
          selected
            ? 'border-gray-400 shadow-xl ring-2 ring-gray-200'
            : 'border-gray-200 shadow-lg hover:shadow-xl hover:border-gray-300'
        } w-full h-full flex flex-col`}
      >
      {/* Delete button - shows on hover */}
      <button
        onClick={handleDelete}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center shadow-sm transition-all z-10 opacity-0 group-hover:opacity-100 cursor-pointer"
        title="Delete container"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      {/* Handles - left (input square) and right (output circle) like task node */}
      <Handle type="target" position={Position.Left} id="left" className="!w-3 !h-3 !border-2 !border-white !bg-gray-300 !rounded-sm hover:!bg-gray-400 transition-all" />
      <Handle type="source" position={Position.Right} id="right" className="!w-3 !h-3 !border-2 !border-white !bg-gray-300 !rounded-full hover:!bg-gray-400 transition-all" />

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

      {/* Cases and Default sections */}
      <div className="flex-1 p-[15px] overflow-y-auto overflow-visible" data-dropzone="true">
        <div className="space-y-3">
          {/* Render each case */}
          {cases.map((switchCase, index) => {
            const caseHasTasks = caseNodes.some((node) => (node.data as FlowNodeData).caseId === switchCase.id);
            const caseTaskCount = caseNodes.filter((n) => (n.data as FlowNodeData).caseId === switchCase.id).length;
            const whenValue = Array.isArray(switchCase.when)
              ? switchCase.when.join(', ')
              : String(switchCase.when || `Case ${index + 1}`);

            return (
              <div
                key={switchCase.id}
                className="relative border-2 border-dashed border-gray-300 rounded-xl bg-gray-50/20 p-[15px] min-h-[90px]"
                onDragOver={onDragOver}
                data-case-id={switchCase.id}
                data-dropzone="true"
              >
                {/* Case label badge - positioned absolute to not block */}
                <div className="absolute top-2 left-2 text-xs font-semibold text-gray-700 bg-gray-100/80 px-2 py-0.5 rounded z-10 flex items-center gap-1.5">
                  ➤ {whenValue} {caseHasTasks && `(${caseTaskCount})`}
                </div>

                {/* Delete case button - positioned absolute */}
                <button
                  onClick={(e) => handleRemoveCase(e, switchCase.id)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-sm transition-all z-10"
                  title="Remove case"
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Empty state hint - only when no tasks */}
                {!caseHasTasks && (
                  <div className="flex items-center justify-center h-full text-gray-400 text-xs text-center pointer-events-none">
                    Drop tasks for this case
                  </div>
                )}

                {/* Child nodes with caseId render here automatically by ReactFlow */}
              </div>
            );
          })}

          {/* Default section */}
          <div
            className="relative border-2 border-dashed border-gray-400 rounded-xl bg-gray-50/20 p-[15px] min-h-[90px]"
            onDragOver={onDragOver}
            data-section="default"
            data-dropzone="true"
          >
            {/* Default label badge */}
            <div className="absolute top-2 left-2 text-xs font-semibold text-gray-700 bg-gray-200/80 px-2 py-0.5 rounded z-10">
              ⚠ Default {defaultNodes.length > 0 && `(${defaultNodes.length})`}
            </div>

            {/* Empty state hint - only when no tasks */}
            {defaultNodes.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-600 text-xs text-center pointer-events-none">
                Drop tasks for default case
              </div>
            )}

            {/* Child nodes with section="default" render here automatically by ReactFlow */}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

export default memo(SwitchContainerNode);
