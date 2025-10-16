import { useState } from 'react';
import { useFlowStore } from '../../store/flowStore';

interface ExecutionResultsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExecutionResultsPanel({ isOpen, onClose }: ExecutionResultsPanelProps) {
  const execution = useFlowStore((state) => state.execution);
  const nodes = useFlowStore((state) => state.nodes);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleNodeExpanded = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  const duration = execution.startTime && execution.endTime
    ? ((execution.endTime - execution.startTime) / 1000).toFixed(2)
    : execution.startTime
    ? ((Date.now() - execution.startTime) / 1000).toFixed(2)
    : null;

  // Get status icon and color
  const getStatusDisplay = () => {
    switch (execution.status) {
      case 'running':
        return {
          icon: '⟳',
          color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
          text: 'Running...',
        };
      case 'completed':
        return {
          icon: '✓',
          color: 'text-green-600 bg-green-50 border-green-200',
          text: 'Completed',
        };
      case 'error':
        return {
          icon: '✗',
          color: 'text-red-600 bg-red-50 border-red-200',
          text: 'Error',
        };
      case 'paused':
        return {
          icon: '⏸',
          color: 'text-blue-600 bg-blue-50 border-blue-200',
          text: 'Paused',
        };
      default:
        return {
          icon: '○',
          color: 'text-gray-600 bg-gray-50 border-gray-200',
          text: 'Idle',
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">Execution Results</h2>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${statusDisplay.color}`}>
              <span className="font-bold">{statusDisplay.icon}</span>
              <span className="text-sm font-medium">{statusDisplay.text}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Execution Timing */}
          {duration && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Execution Time</h3>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-blue-600">{duration}s</span>
                {execution.status === 'running' && (
                  <span className="text-xs text-gray-600">(in progress)</span>
                )}
              </div>
            </div>
          )}

          {/* Inputs */}
          <div className="border border-gray-200 rounded-lg">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Inputs</h3>
            </div>
            <div className="p-4">
              {Object.keys(execution.inputs).length === 0 ? (
                <p className="text-sm text-gray-600">No inputs provided</p>
              ) : (
                <pre className="text-xs font-mono bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto">
                  {JSON.stringify(execution.inputs, null, 2)}
                </pre>
              )}
            </div>
          </div>

          {/* Outputs */}
          <div className="border border-gray-200 rounded-lg">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Outputs</h3>
            </div>
            <div className="p-4">
              {Object.keys(execution.outputs).length === 0 ? (
                <p className="text-sm text-gray-600">
                  {execution.status === 'running' ? 'Outputs will appear here when execution completes' : 'No outputs generated'}
                </p>
              ) : (
                <pre className="text-xs font-mono bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto">
                  {JSON.stringify(execution.outputs, null, 2)}
                </pre>
              )}
            </div>
          </div>

          {/* Node Execution Details */}
          <div className="border border-gray-200 rounded-lg">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Node Execution Details</h3>
              <p className="text-xs text-gray-600 mt-1">Click to expand and see node outputs</p>
            </div>
            <div className="p-4">
              {Object.keys(execution.nodeStates).length === 0 ? (
                <p className="text-sm text-gray-600">No nodes executed yet</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(execution.nodeStates).map(([nodeId, nodeState]) => {
                    const node = nodes.find(n => n.id === nodeId);
                    const isExpanded = expandedNodes.has(nodeId);

                    return (
                      <div key={nodeId} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Node Header - Always visible */}
                        <button
                          onClick={() => toggleNodeExpanded(nodeId)}
                          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <svg
                              className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-900 truncate">
                                  {node?.data.label || nodeId}
                                </span>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 ${
                                  nodeState.state === 'running' ? 'bg-yellow-100 text-yellow-700' :
                                  nodeState.state === 'completed' ? 'bg-green-100 text-green-700' :
                                  nodeState.state === 'error' ? 'bg-red-100 text-red-700' :
                                  nodeState.state === 'skipped' ? 'bg-gray-100 text-gray-600' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {nodeState.state}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-gray-500">{nodeId}</span>
                                {node?.type && (
                                  <span className="text-xs text-gray-400">• {node.type}</span>
                                )}
                              </div>
                            </div>

                            {nodeState.startTime && nodeState.endTime && (
                              <span className="text-xs font-medium text-gray-600 flex-shrink-0">
                                {((nodeState.endTime - nodeState.startTime) / 1000).toFixed(2)}s
                              </span>
                            )}
                          </div>
                        </button>

                        {/* Node Details - Expandable */}
                        {isExpanded && (
                          <div className="p-4 bg-white border-t border-gray-200 space-y-3">
                            {/* Task/Step Info */}
                            {node?.data.step?.task && (
                              <div>
                                <h4 className="text-xs font-semibold text-gray-700 mb-1">Task</h4>
                                <p className="text-xs font-mono text-gray-900">{node.data.step.task}</p>
                              </div>
                            )}

                            {/* Output Data */}
                            {nodeState.output && (
                              <div>
                                <h4 className="text-xs font-semibold text-gray-700 mb-1">Output</h4>
                                <pre className="text-xs font-mono bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto">
                                  {JSON.stringify(nodeState.output, null, 2)}
                                </pre>
                              </div>
                            )}

                            {/* Error Info */}
                            {nodeState.error && (
                              <div>
                                <h4 className="text-xs font-semibold text-red-700 mb-1">Error</h4>
                                <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                                  {nodeState.error}
                                </p>
                              </div>
                            )}

                            {/* Timing Details */}
                            {nodeState.startTime && (
                              <div className="flex items-center gap-4 text-xs text-gray-600">
                                <div>
                                  <span className="font-semibold">Started:</span>{' '}
                                  {new Date(nodeState.startTime).toLocaleTimeString()}
                                </div>
                                {nodeState.endTime && (
                                  <div>
                                    <span className="font-semibold">Ended:</span>{' '}
                                    {new Date(nodeState.endTime).toLocaleTimeString()}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Execution Logs */}
          <div className="border border-gray-200 rounded-lg">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Execution Logs</h3>
            </div>
            <div className="p-4">
              {execution.executionLog.length === 0 ? (
                <p className="text-sm text-gray-600">No logs available</p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {execution.executionLog.map((log, index) => (
                    <div key={index} className="flex items-start gap-3 text-xs font-mono">
                      <span className="text-gray-500 flex-shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`flex-shrink-0 font-bold ${
                        log.level === 'error' ? 'text-red-600' :
                        log.level === 'warning' ? 'text-yellow-600' :
                        'text-blue-600'
                      }`}>
                        {log.level === 'error' ? '[ERROR]' :
                         log.level === 'warning' ? '[WARN]' :
                         '[INFO]'}
                      </span>
                      <span className="text-gray-700">{log.nodeId}:</span>
                      <span className="text-gray-900 flex-1">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
