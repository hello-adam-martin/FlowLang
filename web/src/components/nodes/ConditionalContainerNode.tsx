import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';
import { useFlowStore } from '../../store/flowStore';

function ConditionalContainerNode({ data, selected, id }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const { getNodes } = useReactFlow();
  const removeNode = useFlowStore((state) => state.removeNode);

  // Find child nodes - we'll use node data to track which section they belong to
  const childNodes = getNodes().filter((n) => n.parentId === id);
  const thenNodes = childNodes.filter((n) => (n.data as any).section === 'then');
  const elseNodes = childNodes.filter((n) => (n.data as any).section === 'else');

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  };

  return (
    <div
      className={`relative bg-white/90 rounded-2xl border-2 transition-all ${
        selected
          ? 'border-amber-400 shadow-xl ring-2 ring-amber-200'
          : 'border-amber-200 shadow-lg hover:shadow-xl hover:border-amber-300'
      } min-w-[540px] min-h-[320px]`}
    >
      {/* Delete button - shows when selected */}
      {selected && (
        <button
          onClick={handleDelete}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center shadow-sm transition-all z-10 opacity-90 hover:opacity-100"
          title="Delete container"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}

      {/* Handles on all four sides - works as both source and target with connectionMode="loose" */}
      <Handle type="source" position={Position.Top} id="top" className="w-2.5 h-2.5 bg-amber-500 border-2 border-white shadow-sm" />
      <Handle type="source" position={Position.Right} id="right" className="w-2.5 h-2.5 bg-amber-500 border-2 border-white shadow-sm" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="w-2.5 h-2.5 bg-amber-500 border-2 border-white shadow-sm" />
      <Handle type="source" position={Position.Left} id="left" className="w-2.5 h-2.5 bg-amber-500 border-2 border-white shadow-sm" />

      {/* Header with subtle gradient */}
      <div className="bg-gradient-to-r from-amber-50 to-amber-100 border-b-2 border-amber-200 px-4 py-3 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-bold">?</span>
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm text-gray-900">Conditional</div>
            <div className="text-xs text-amber-700 font-mono">
              {nodeData.step?.if ? (
                typeof nodeData.step.if === 'string'
                  ? nodeData.step.if
                  : 'complex condition'
              ) : (
                <span className="text-gray-500 font-sans">Configure condition...</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Then/Else sections */}
      <div className="flex p-5 gap-4 min-h-[240px]">
        {/* Then section */}
        <div
          className="flex-1 border-2 border-dashed border-green-300 rounded-xl bg-green-50/40 backdrop-blur-sm p-4"
          onDragOver={onDragOver}
          data-section="then"
          data-dropzone="true"
        >
          <div className="text-xs font-semibold text-green-700 mb-3">✓ Then</div>
          {thenNodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-green-600 text-xs text-center">
              Drop tasks for<br/>true condition
            </div>
          ) : (
            <div className="text-xs font-medium text-green-700">
              {thenNodes.length} task{thenNodes.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Else section */}
        <div
          className="flex-1 border-2 border-dashed border-red-300 rounded-xl bg-red-50/40 backdrop-blur-sm p-4"
          onDragOver={onDragOver}
          data-section="else"
          data-dropzone="true"
        >
          <div className="text-xs font-semibold text-red-700 mb-3">✗ Else</div>
          {elseNodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-red-600 text-xs text-center">
              Drop tasks for<br/>false condition
            </div>
          ) : (
            <div className="text-xs font-medium text-red-700">
              {elseNodes.length} task{elseNodes.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ConditionalContainerNode);
