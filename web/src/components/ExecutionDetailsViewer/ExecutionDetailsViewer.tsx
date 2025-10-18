import { useState } from 'react';
import type { ExecutionHistoryEntry } from '../../types/execution';
import type { ExecutionState } from '../../types/project';
import type { Node } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';

interface ExecutionDetailsViewerProps {
  execution: ExecutionHistoryEntry | ExecutionState;
  nodes?: Node<FlowNodeData>[];
  isHistorical?: boolean;
}

export default function ExecutionDetailsViewer({ execution, nodes = [], isHistorical = false }: ExecutionDetailsViewerProps) {
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

  // Helper to check if this is a historical entry
  const isHistory = (exec: any): exec is ExecutionHistoryEntry => {
    return 'id' in exec && 'timestamp' in exec && 'duration' in exec;
  };

  const historical = isHistory(execution);
  const duration = historical
    ? (execution.duration / 1000).toFixed(2)
    : execution.startTime && execution.endTime
    ? ((execution.endTime - execution.startTime) / 1000).toFixed(2)
    : execution.startTime
    ? ((Date.now() - execution.startTime) / 1000).toFixed(2)
    : null;

  // Get status for display
  const status = historical ? execution.status : execution.status;

  // Calculate summary stats
  const totalNodes = Object.keys(execution.nodeStates).length;
  const completedNodes = Object.values(execution.nodeStates).filter(n => n.state === 'completed').length;
  const errorNodes = Object.values(execution.nodeStates).filter(n => n.state === 'error').length;
  const skippedNodes = Object.values(execution.nodeStates).filter(n => n.state === 'skipped').length;
  const inputCount = Object.keys(execution.inputs).length;
  const outputCount = Object.keys(execution.outputs).length;
  const hasError = status === 'error' || errorNodes > 0;

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-3">
          <div className="text-xs font-medium text-blue-700 mb-1">Nodes Executed</div>
          <div className="text-2xl font-bold text-blue-900">{totalNodes}</div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-3">
          <div className="text-xs font-medium text-green-700 mb-1">Completed</div>
          <div className="text-2xl font-bold text-green-900">{completedNodes}</div>
        </div>

        {(errorNodes > 0 || skippedNodes > 0) && (
          <>
            {errorNodes > 0 && (
              <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg p-3">
                <div className="text-xs font-medium text-red-700 mb-1">Errors</div>
                <div className="text-2xl font-bold text-red-900">{errorNodes}</div>
              </div>
            )}
            {skippedNodes > 0 && (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-3">
                <div className="text-xs font-medium text-gray-700 mb-1">Skipped</div>
                <div className="text-2xl font-bold text-gray-900">{skippedNodes}</div>
              </div>
            )}
          </>
        )}

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-3">
          <div className="text-xs font-medium text-purple-700 mb-1">I/O</div>
          <div className="text-2xl font-bold text-purple-900">{inputCount} → {outputCount}</div>
        </div>
      </div>

      {/* Inputs - Compact */}
      <div className="border border-gray-200 rounded-lg">
        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-900">Inputs {inputCount > 0 && <span className="text-gray-500">({inputCount})</span>}</h3>
        </div>
        <div className="p-3">
          {inputCount === 0 ? (
            <p className="text-xs text-gray-500 italic">No inputs provided</p>
          ) : (
            <pre className="text-xs font-mono bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto">
              {JSON.stringify(execution.inputs, null, 2)}
            </pre>
          )}
        </div>
      </div>

      {/* Outputs - Compact */}
      <div className="border border-gray-200 rounded-lg">
        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-900">Outputs {outputCount > 0 && <span className="text-gray-500">({outputCount})</span>}</h3>
        </div>
        <div className="p-3">
          {outputCount === 0 ? (
            <p className="text-xs text-gray-500 italic">
              {!historical && status === 'running' ? 'Outputs will appear when execution completes' : 'No outputs generated'}
            </p>
          ) : (
            <pre className="text-xs font-mono bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto">
              {JSON.stringify(execution.outputs, null, 2)}
            </pre>
          )}
        </div>
      </div>

      {/* Node Execution Details */}
      <div className="border border-gray-200 rounded-lg">
        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
          <h3 className="text-xs font-semibold text-gray-900">Node Details {totalNodes > 0 && <span className="text-gray-500">({totalNodes})</span>}</h3>
        </div>
        <div className="p-3">
          {totalNodes === 0 ? (
            <p className="text-xs text-gray-500 italic">No nodes executed yet</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(execution.nodeStates).map(([nodeId, nodeState]) => {
                const node = nodes.find(n => n.id === nodeId);
                const isExpanded = expandedNodes.has(nodeId);

                return (
                  <div key={nodeId} className="border border-gray-200 rounded-md overflow-hidden">
                    {/* Node Header - Always visible */}
                    <button
                      onClick={() => toggleNodeExpanded(nodeId)}
                      className="w-full flex items-center justify-between p-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <svg
                          className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-900 truncate">
                              {node?.data.label || nodeId}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                              nodeState.state === 'running' ? 'bg-yellow-100 text-yellow-700' :
                              nodeState.state === 'completed' ? 'bg-green-100 text-green-700' :
                              nodeState.state === 'error' ? 'bg-red-100 text-red-700' :
                              nodeState.state === 'skipped' ? 'bg-gray-100 text-gray-600' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {nodeState.state}
                            </span>
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
                      <div className="p-3 bg-white border-t border-gray-200 space-y-2">
                        {/* Task/Step Info */}
                        {node?.data.step?.task && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 mb-0.5">Task</h4>
                            <p className="text-xs font-mono text-gray-900">{node.data.step.task}</p>
                          </div>
                        )}

                        {/* Input Data */}
                        {nodeState.inputs && Object.keys(nodeState.inputs).length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                              <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Inputs
                            </h4>
                            <div className="text-xs font-mono bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto">
                              <pre className="inline">{`{`}</pre>
                              {Object.entries(nodeState.inputs).map(([key, value], index, arr) => (
                                <div key={key} className="ml-3">
                                  <pre className="inline">{`"${key}": `}</pre>
                                  <pre className="inline">{JSON.stringify(value)}</pre>
                                  {nodeState.inputSources?.[key] && (
                                    <span className="text-gray-400 ml-2">{`// ${nodeState.inputSources[key]}`}</span>
                                  )}
                                  {index < arr.length - 1 && <pre className="inline">,</pre>}
                                </div>
                              ))}
                              <pre className="inline">{`}`}</pre>
                            </div>
                          </div>
                        )}

                        {/* Output Data */}
                        {nodeState.output && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                              <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              Output
                            </h4>
                            <pre className="text-xs font-mono bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto">
                              {JSON.stringify(nodeState.output, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Error Info */}
                        {nodeState.error && (
                          <div>
                            <h4 className="text-xs font-semibold text-red-700 mb-0.5">Error</h4>
                            <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                              {nodeState.error}
                            </p>
                          </div>
                        )}

                        {/* Timing Details */}
                        {nodeState.startTime && (
                          <div className="flex items-center gap-3 text-xs text-gray-600 pt-1 border-t border-gray-100">
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
        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
          <h3 className="text-xs font-semibold text-gray-900">Execution Logs {execution.executionLog.length > 0 && <span className="text-gray-500">({execution.executionLog.length})</span>}</h3>
        </div>
        <div className="p-3">
          {execution.executionLog.length === 0 ? (
            <p className="text-xs text-gray-500 italic">No logs available</p>
          ) : (
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {execution.executionLog.map((log, index) => (
                <div key={index} className="flex items-start gap-2 text-xs font-mono">
                  <span className="text-gray-500 flex-shrink-0 text-[10px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`flex-shrink-0 font-bold text-[10px] ${
                    log.level === 'error' ? 'text-red-600' :
                    log.level === 'warning' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`}>
                    {log.level === 'error' ? '[ERR]' :
                     log.level === 'warning' ? '[WRN]' :
                     '[INF]'}
                  </span>
                  <span className="text-gray-700 flex-shrink-0">{log.nodeId}:</span>
                  <span className="text-gray-900 flex-1">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
