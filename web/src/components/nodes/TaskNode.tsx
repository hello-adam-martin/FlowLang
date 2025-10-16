import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';
import { useFlowStore } from '../../store/flowStore';
import type { ConnectionType } from '../../types/flow';
import QuickConnectHandle from '../handles/QuickConnectHandle';

// Connection icons and colors
const CONNECTION_ICONS: Record<ConnectionType, string> = {
  postgres: '🗄️',
  mysql: '🗄️',
  mongodb: '📄',
  redis: '🔴',
  sqlite: '💾',
  airtable: '📊',
};

const CONNECTION_COLORS: Record<ConnectionType, { from: string; to: string; bg: string }> = {
  postgres: { from: 'from-blue-400', to: 'to-blue-600', bg: 'bg-blue-50' },
  mysql: { from: 'from-orange-400', to: 'to-orange-600', bg: 'bg-orange-50' },
  mongodb: { from: 'from-green-400', to: 'to-green-600', bg: 'bg-green-50' },
  redis: { from: 'from-red-400', to: 'to-red-600', bg: 'bg-red-50' },
  sqlite: { from: 'from-purple-400', to: 'to-purple-600', bg: 'bg-purple-50' },
  airtable: { from: 'from-yellow-400', to: 'to-yellow-600', bg: 'bg-yellow-50' },
};

function TaskNode({ data, selected, id }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const hasErrors = nodeData.errors && nodeData.errors.length > 0;
  const removeNode = useFlowStore((state) => state.removeNode);
  const flowDefinition = useFlowStore((state) => state.flowDefinition);
  const execution = useFlowStore((state) => state.execution);

  // Get execution state for this node (from store or passed in data for history mode)
  const nodeExecutionState = (nodeData as any).executionState || execution.nodeStates[id];
  const executionProgress = (nodeData as any).executionProgress || 100;

  // Get connection type if this task has a connection
  const connectionName = nodeData.step?.connection;
  const connectionType = connectionName && flowDefinition.connections?.[connectionName]
    ? flowDefinition.connections[connectionName].type
    : null;

  // Get icon and colors based on connection type
  const icon = connectionType ? CONNECTION_ICONS[connectionType] : 'T';
  const colors = connectionType
    ? CONNECTION_COLORS[connectionType]
    : { from: 'from-blue-400', to: 'to-blue-600', bg: 'bg-white' };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  };

  // Determine border and background based on execution state
  let executionStyles = '';
  let progressFillColor = '#3b82f6'; // Default blue

  if (nodeExecutionState) {
    switch (nodeExecutionState.state) {
      case 'pending':
        executionStyles = 'border-purple-400 bg-purple-50 shadow-lg ring-2 ring-purple-200 animate-pulse';
        progressFillColor = '#c084fc'; // purple-400
        break;
      case 'running':
        executionStyles = 'border-yellow-400 bg-yellow-50 shadow-lg ring-2 ring-yellow-200 animate-pulse';
        progressFillColor = '#facc15'; // yellow-400
        break;
      case 'completed':
        executionStyles = 'border-green-400 bg-green-50 shadow-md';
        progressFillColor = '#4ade80'; // green-400
        break;
      case 'error':
        executionStyles = 'border-red-500 bg-red-50 shadow-md';
        progressFillColor = '#ef4444'; // red-500
        break;
      case 'skipped':
        executionStyles = 'border-gray-300 bg-gray-100 opacity-60';
        progressFillColor = '#d1d5db'; // gray-300
        break;
      default:
        executionStyles = 'border-blue-200 bg-blue-50';
        progressFillColor = '#93c5fd'; // blue-200
    }
  }

  return (
    <div
      className={`px-3 py-2 rounded-xl border min-w-[140px] transition-all relative group overflow-visible ${
        nodeExecutionState
          ? executionStyles
          : connectionType
          ? colors.bg
          : 'bg-white'
      } ${
        !nodeExecutionState && selected
          ? 'border-blue-500 shadow-lg ring-2 ring-blue-200'
          : !nodeExecutionState && hasErrors
          ? 'border-red-400 shadow-md'
          : !nodeExecutionState
          ? 'border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300'
          : ''
      }`}
      style={{ minHeight: '47px' }}
    >
      {/* Progress fill background for running nodes */}
      {nodeExecutionState?.state === 'running' && executionProgress < 100 && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none transition-all duration-300 ease-out overflow-hidden"
          style={{ zIndex: 0 }}
        >
          <div
            className="h-full transition-all duration-300 ease-out"
            style={{
              width: `${executionProgress}%`,
              backgroundColor: `${progressFillColor}40`, // 25% opacity (hex 40 = 64/256)
              borderRight: `3px solid ${progressFillColor}`,
            }}
          />
        </div>
      )}
      {/* Delete button - shows when selected */}
      {selected && (
        <button
          onClick={handleDelete}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center shadow-sm transition-all z-10 opacity-90 hover:opacity-100"
          title="Delete node"
        >
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}

      {/* Input handle (left side) - square shape to distinguish from output */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!w-3 !h-3 !border-2 !border-white !bg-gray-300 !rounded-sm hover:!bg-gray-400 transition-all"
      />

      {/* Output handle (right side) with quick connect */}
      <QuickConnectHandle
        nodeId={id}
        position={Position.Right}
        id="output"
      />

      <div className="flex items-center gap-2 relative z-10">
        <div className={`flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br ${colors.from} ${colors.to} flex items-center justify-center shadow-sm`}>
          <span className="text-white text-xs font-bold">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-gray-900 truncate">
              {nodeData.label || 'New Task'}
            </span>
            {/* Execution state badge */}
            {nodeExecutionState && (
              <span className="flex-shrink-0">
                {nodeExecutionState.state === 'pending' && (
                  <span className="text-[10px] font-bold text-purple-600">⏸</span>
                )}
                {nodeExecutionState.state === 'running' && (
                  <span className="text-[10px] font-bold text-yellow-600">⟳</span>
                )}
                {nodeExecutionState.state === 'completed' && (
                  <span className="text-[10px] font-bold text-green-600">✓</span>
                )}
                {nodeExecutionState.state === 'error' && (
                  <span className="text-[10px] font-bold text-red-600">✗</span>
                )}
                {nodeExecutionState.state === 'skipped' && (
                  <span className="text-[10px] font-bold text-gray-500">⊘</span>
                )}
              </span>
            )}
          </div>
          {nodeData.step?.task && (
            <div className="text-[10px] text-gray-600 font-mono truncate">
              {nodeData.step.task}
            </div>
          )}
          {connectionName && (
            <div className="text-[10px] text-gray-500 truncate mt-0.5">
              📌 {connectionName}
            </div>
          )}
          {/* Show execution timing */}
          {nodeExecutionState && nodeExecutionState.startTime && (
            <div className="text-[10px] text-gray-500 mt-0.5">
              {nodeExecutionState.endTime
                ? `${((nodeExecutionState.endTime - nodeExecutionState.startTime) / 1000).toFixed(2)}s`
                : 'Running...'}
            </div>
          )}
        </div>
      </div>

      {/* Show execution error if present */}
      {nodeExecutionState?.error && (
        <div className="mt-1.5 text-[10px] text-red-600 truncate">
          {nodeExecutionState.error}
        </div>
      )}

      {/* Show validation errors if present */}
      {hasErrors && !nodeExecutionState?.error && (
        <div className="mt-1.5 text-[10px] text-red-600 truncate">
          {nodeData.errors![0]}
        </div>
      )}
    </div>
  );
}

export default memo(TaskNode);
