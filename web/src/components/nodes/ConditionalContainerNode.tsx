import { memo, useCallback, useMemo } from 'react';
import { Handle, Position, type NodeProps, useReactFlow, NodeResizer } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';
import { useFlowStore } from '../../store/flowStore';

function ConditionalContainerNode({ data, selected, id }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const { getNodes } = useReactFlow();
  const removeNode = useFlowStore((state) => state.removeNode);
  const nodes = useFlowStore((state) => state.nodes);

  // Find child nodes - we'll use node data to track which section they belong to
  // Use useMemo to recalculate when nodes change
  const { thenNodes, elseNodes } = useMemo(() => {
    const childNodes = getNodes().filter((n) => n.parentId === id);
    return {
      thenNodes: childNodes.filter((n) => (n.data as any).section === 'then'),
      elseNodes: childNodes.filter((n) => (n.data as any).section === 'else'),
    };
  }, [nodes, id, getNodes]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    // Don't stop propagation - allow parent to handle drag-over detection
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  };

  return (
    <>
      <NodeResizer
        color="#f59e0b"
        isVisible={selected}
        minWidth={600}
        minHeight={300}
        keepAspectRatio={false}
      />
      <div
        className={`relative bg-white/90 rounded-2xl border-2 transition-all ${
          selected
            ? 'border-amber-400 shadow-xl ring-2 ring-amber-200'
            : 'border-amber-200 shadow-lg hover:shadow-xl hover:border-amber-300'
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

      {/* Handles - left (input) and right (output) only */}
      <Handle type="source" position={Position.Left} id="left" className="w-2.5 h-2.5 bg-amber-500 border-2 border-white shadow-sm" />
      <Handle type="source" position={Position.Right} id="right" className="w-2.5 h-2.5 bg-amber-500 border-2 border-white shadow-sm" />

      {/* Header with subtle gradient */}
      <div className="bg-gradient-to-r from-amber-50 to-amber-100 border-b-2 border-amber-200 px-4 py-[15px] rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-bold">?</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-semibold text-sm text-gray-900">{nodeData.label || 'Conditional'}</div>
              {nodeData.badge && (
                <div className="px-2 py-0.5 bg-amber-100 border border-amber-300 rounded text-xs font-mono text-amber-800">
                  {nodeData.badge}
                </div>
              )}
            </div>
            {nodeData.step?.if ? (
              typeof nodeData.step.if === 'string' ? (
                // Simple condition
                <div className="text-xs text-amber-700 font-mono truncate" title={nodeData.step.if}>
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
                    <div className="text-xs text-amber-800 mt-1">
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

      {/* Then/Else sections */}
      <div className="flex p-[15px] gap-4 flex-1 overflow-visible">
        {/* Then section */}
        <div
          className="relative flex-1 border-2 border-dashed border-green-300 rounded-xl bg-green-50/20 p-[15px] min-h-[120px] min-w-[200px]"
          onDragOver={onDragOver}
          data-section="then"
          data-dropzone="true"
        >
          {/* Header label - always visible */}
          <div className="absolute top-2 left-2 text-xs font-semibold text-green-700 bg-green-100/80 px-2 py-0.5 rounded z-10">
            ✓ Then {thenNodes.length > 0 && `(${thenNodes.length})`}
          </div>

          {/* Empty state hint - only when no children */}
          {thenNodes.length === 0 && (
            <div className="flex items-center justify-center h-full text-green-600 text-xs text-center pointer-events-none">
              Drop tasks for<br/>true condition
            </div>
          )}

          {/* Child nodes render here automatically by ReactFlow */}
        </div>

        {/* Else section */}
        <div
          className="relative flex-1 border-2 border-dashed border-red-300 rounded-xl bg-red-50/20 p-[15px] min-h-[120px] min-w-[200px]"
          onDragOver={onDragOver}
          data-section="else"
          data-dropzone="true"
        >
          {/* Header label - always visible */}
          <div className="absolute top-2 left-2 text-xs font-semibold text-red-700 bg-red-100/80 px-2 py-0.5 rounded z-10">
            ✗ Else {elseNodes.length > 0 && `(${elseNodes.length})`}
          </div>

          {/* Empty state hint - only when no children */}
          {elseNodes.length === 0 && (
            <div className="flex items-center justify-center h-full text-red-600 text-xs text-center pointer-events-none">
              Drop tasks for<br/>false condition
            </div>
          )}

          {/* Child nodes render here automatically by ReactFlow */}
        </div>
      </div>
      </div>
    </>
  );
}

export default memo(ConditionalContainerNode);
