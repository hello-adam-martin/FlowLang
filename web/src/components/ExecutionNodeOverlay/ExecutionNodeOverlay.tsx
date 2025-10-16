import type { NodeExecutionData } from '../../types/project';

interface ExecutionNodeOverlayProps {
  nodeState: NodeExecutionData;
  compact?: boolean;
  progressPercent?: number; // 0-100, shows progress fill for running nodes
}

export default function ExecutionNodeOverlay({ nodeState, compact = false, progressPercent = 100 }: ExecutionNodeOverlayProps) {
  const getStateColor = () => {
    switch (nodeState.state) {
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'running':
        return 'bg-yellow-500';
      case 'skipped':
        return 'bg-gray-400';
      default:
        return 'bg-blue-500';
    }
  };

  const getStateIcon = () => {
    switch (nodeState.state) {
      case 'completed':
        return '✓';
      case 'error':
        return '✗';
      case 'running':
        return '⟳';
      case 'skipped':
        return '○';
      default:
        return '•';
    }
  };

  const duration = nodeState.startTime && nodeState.endTime
    ? ((nodeState.endTime - nodeState.startTime) / 1000).toFixed(2)
    : null;

  const getProgressColor = () => {
    switch (nodeState.state) {
      case 'completed':
        return '#10b981'; // green
      case 'error':
        return '#ef4444'; // red
      case 'running':
        return '#eab308'; // yellow
      case 'skipped':
        return '#9ca3af'; // gray
      default:
        return '#3b82f6'; // blue
    }
  };

  if (compact) {
    // Compact mode - badge with progress fill
    return (
      <>
        {/* Progress fill background */}
        {nodeState.state === 'running' && progressPercent < 100 && (
          <div
            className="absolute inset-0 rounded-lg pointer-events-none overflow-hidden"
            style={{ zIndex: -1 }}
          >
            <div
              className="h-full transition-all duration-300 ease-out"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: `${getProgressColor()}20`, // 20% opacity
                borderRight: `2px solid ${getProgressColor()}`,
              }}
            />
          </div>
        )}

        {/* Status badge */}
        <div className={`absolute top-1 right-1 w-5 h-5 ${getStateColor()} text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm`}>
          {getStateIcon()}
        </div>
      </>
    );
  }

  // Full mode - badge + timing
  return (
    <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/10 to-transparent pointer-events-none rounded-t-md">
      <div className="flex items-center justify-between p-1.5">
        <div className={`px-2 py-0.5 ${getStateColor()} text-white rounded-full text-xs font-medium shadow-sm flex items-center gap-1`}>
          <span className="font-bold">{getStateIcon()}</span>
          <span className="capitalize">{nodeState.state}</span>
        </div>
        {duration && (
          <div className="px-2 py-0.5 bg-white/90 text-gray-700 rounded-full text-xs font-medium shadow-sm">
            {duration}s
          </div>
        )}
      </div>
    </div>
  );
}
