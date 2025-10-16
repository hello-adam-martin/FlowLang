import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { useFlowStore } from '../../store/flowStore';

export default function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  source,
  target,
}: EdgeProps) {
  const removeEdge = useFlowStore((state) => state.onEdgesChange);
  const execution = useFlowStore((state) => state.execution);

  // Check if this edge should be animated (data is flowing through it)
  const sourceNodeState = execution.nodeStates[source || ''];
  const targetNodeState = execution.nodeStates[target || ''];

  // Edge is active if source is completed/running and target is running/pending
  const isActive =
    sourceNodeState &&
    (sourceNodeState.state === 'completed' || sourceNodeState.state === 'running') &&
    targetNodeState &&
    (targetNodeState.state === 'running' || targetNodeState.state === 'pending');

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleDelete = () => {
    removeEdge([{ type: 'remove', id }]);
  };

  // Determine edge style based on state
  const edgeStyle = isActive
    ? {
        ...style,
        stroke: '#f59e0b', // Amber color for active flow
        strokeWidth: 3,
        animation: 'dashdraw 0.5s linear infinite',
        strokeDasharray: '5, 5',
      }
    : style;

  // Update marker color if active
  const edgeMarkerEnd = isActive
    ? {
        type: 'arrowclosed' as const,
        color: '#f59e0b',
      }
    : markerEnd;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={edgeMarkerEnd} style={edgeStyle} />
      {selected && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <button
              className="edge-delete-button"
              onClick={handleDelete}
              title="Delete connection"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
