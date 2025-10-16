import { useFlowStore } from '../../store/flowStore';
import ExecutionDetailsViewer from '../ExecutionDetailsViewer/ExecutionDetailsViewer';

interface ExecutionResultsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExecutionResultsPanel({ isOpen, onClose }: ExecutionResultsPanelProps) {
  const execution = useFlowStore((state) => state.execution);
  const nodes = useFlowStore((state) => state.nodes);

  if (!isOpen) return null;

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
        <div className="flex-1 overflow-y-auto p-6">
          <ExecutionDetailsViewer
            execution={execution}
            nodes={nodes}
            isHistorical={false}
          />
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
