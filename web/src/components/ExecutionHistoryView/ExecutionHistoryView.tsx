import { useState } from 'react';
import { useFlowStore } from '../../store/flowStore';
import HistoryFlowViewer from '../HistoryFlowViewer/HistoryFlowViewer';
import type { ExecutionHistoryEntry } from '../../types/execution';

interface ExecutionHistoryViewProps {
  onClose: () => void;
}

type FilterStatus = 'all' | 'completed' | 'error' | 'stopped';

export default function ExecutionHistoryView({ onClose }: ExecutionHistoryViewProps) {
  const executionHistory = useFlowStore((state) => state.executionHistory);
  const clearExecutionHistory = useFlowStore((state) => state.clearExecutionHistory);
  const deleteExecutionById = useFlowStore((state) => state.deleteExecutionById);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const flowDefinition = useFlowStore((state) => state.flowDefinition);

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedExecution, setSelectedExecution] = useState<ExecutionHistoryEntry | null>(null);

  // Filter executions based on status
  const filteredHistory = filterStatus === 'all'
    ? executionHistory
    : executionHistory.filter(entry => entry.status === filterStatus);

  // Get status icon and color
  const getStatusDisplay = (status: 'completed' | 'error' | 'stopped') => {
    switch (status) {
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
      case 'stopped':
        return {
          icon: '⏹',
          color: 'text-orange-600 bg-orange-50 border-orange-200',
          text: 'Stopped',
        };
    }
  };

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear all execution history? This cannot be undone.')) {
      clearExecutionHistory();
      setSelectedExecution(null);
    }
  };

  const handleDeleteExecution = (id: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent selecting the execution
    if (confirm('Delete this execution from history?')) {
      deleteExecutionById(id);
      // If the deleted execution was selected, clear selection or select another
      if (selectedExecution?.id === id) {
        const remaining = executionHistory.filter(e => e.id !== id);
        setSelectedExecution(remaining.length > 0 ? remaining[0] : null);
      }
    }
  };

  return (
    <div className="flex h-full bg-gray-50">
      {/* Left Sidebar - Execution List */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Execution History</h2>
            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
              {executionHistory.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Back to Designer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filterStatus === 'completed'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setFilterStatus('error')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filterStatus === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              Error
            </button>
            <button
              onClick={() => setFilterStatus('stopped')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filterStatus === 'stopped'
                  ? 'bg-orange-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              Stopped
            </button>
          </div>
        </div>

        {/* Execution List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No execution history</h3>
              <p className="text-sm text-gray-600">
                {filterStatus === 'all'
                  ? 'Run your flow to see execution history here.'
                  : `No ${filterStatus} executions found.`}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map((entry) => {
                const statusDisplay = getStatusDisplay(entry.status);
                const isSelected = selectedExecution?.id === entry.id;

                return (
                  <div
                    key={entry.id}
                    className={`relative w-full bg-white border rounded-lg p-3 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group ${
                      isSelected ? 'border-blue-500 shadow-md ring-2 ring-blue-200' : 'border-gray-200'
                    }`}
                    onClick={() => setSelectedExecution(entry)}
                  >
                    {/* Delete button - appears on hover */}
                    <button
                      onClick={(e) => handleDeleteExecution(entry.id, e)}
                      className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"
                      title="Delete execution"
                    >
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>

                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${statusDisplay.color}`}>
                        <span className="text-xs font-bold">{statusDisplay.icon}</span>
                        <span className="text-xs font-medium">{statusDisplay.text}</span>
                      </div>
                      <span className="text-xs text-gray-600 font-medium">
                        {(entry.duration / 1000).toFixed(2)}s
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 mb-1">
                      {new Date(entry.timestamp).toLocaleString()}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {Object.keys(entry.inputs).length > 0 && (
                        <div className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span>{Object.keys(entry.inputs).length} inputs</span>
                        </div>
                      )}
                      {Object.keys(entry.outputs).length > 0 && (
                        <div className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span>{Object.keys(entry.outputs).length} outputs</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                        </svg>
                        <span>{Object.keys(entry.nodeStates).length} nodes</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {executionHistory.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleClearHistory}
              className="w-full px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50"
            >
              Clear History
            </button>
          </div>
        )}
      </div>

      {/* Right Panel - Flow Viewer */}
      <div className="flex-1 relative">
        {selectedExecution ? (
          <HistoryFlowViewer
            execution={selectedExecution}
            nodes={selectedExecution.flowSnapshot?.nodes || nodes}
            edges={selectedExecution.flowSnapshot?.edges || edges}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-center p-8">
            <div>
              <svg className="w-24 h-24 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Execution Selected</h2>
              <p className="text-gray-600">
                Select an execution from the list to view its flow visualization
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
