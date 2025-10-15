import { useState } from 'react';
import type { ConnectionConfig } from '../../types/flow';
import { getTasksForConnectionType, type ConnectionTaskMetadata } from '../../data/connectionTasks';

interface ConnectionTaskSectionProps {
  connectionName: string;
  connectionConfig: ConnectionConfig;
  onTaskDragStart: (task: ConnectionTaskMetadata, connectionName: string) => void;
}

const CONNECTION_ICONS: Record<string, string> = {
  postgres: '🗄️',
  mysql: '🗄️',
  mongodb: '📄',
  redis: '🔴',
  sqlite: '💾',
  airtable: '📊',
};

const CONNECTION_COLORS: Record<string, { bg: string; border: string; text: string; hover: string }> = {
  postgres: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', hover: 'hover:bg-blue-100' },
  mysql: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', hover: 'hover:bg-orange-100' },
  mongodb: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', hover: 'hover:bg-green-100' },
  redis: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', hover: 'hover:bg-red-100' },
  sqlite: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', hover: 'hover:bg-purple-100' },
  airtable: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', hover: 'hover:bg-yellow-100' },
};

export default function ConnectionTaskSection({ connectionName, connectionConfig, onTaskDragStart }: ConnectionTaskSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const tasks = getTasksForConnectionType(connectionConfig.type);
  const icon = CONNECTION_ICONS[connectionConfig.type] || '🔌';
  const colors = CONNECTION_COLORS[connectionConfig.type] || { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', hover: 'hover:bg-gray-100' };

  const handleDragStart = (e: React.DragEvent, task: ConnectionTaskMetadata) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/reactflow', JSON.stringify({
      type: 'task',
      taskName: task.name,
      connectionName,
      metadata: task,
    }));
    onTaskDragStart(task, connectionName);
  };

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="mb-3">
      {/* Section Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium ${colors.bg} border ${colors.border} rounded-md ${colors.hover} transition-colors`}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className={colors.text}>
            {connectionConfig.type.charAt(0).toUpperCase() + connectionConfig.type.slice(1)}
          </span>
          <span className="text-xs text-gray-500">({connectionName})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{tasks.length} tasks</span>
          <svg
            className={`w-4 h-4 ${colors.text} transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Task List */}
      {isExpanded && (
        <div className="mt-2 space-y-1">
          {tasks.map((task) => (
            <div
              key={task.name}
              draggable
              onDragStart={(e) => handleDragStart(e, task)}
              className={`px-3 py-2 ${colors.bg} border ${colors.border} rounded cursor-move ${colors.hover} transition-colors group`}
              title={task.description}
            >
              <div className="flex items-start gap-2">
                <span className="text-sm flex-shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${colors.text}`}>{task.label}</span>
                    <span className="text-xs text-gray-500 font-mono">({task.name})</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{task.description}</div>

                  {/* Inputs/Outputs Preview */}
                  <div className="flex items-center gap-3 mt-1 text-xs">
                    {task.inputs.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">in:</span>
                        <span className="text-gray-600 font-mono">
                          {task.inputs.slice(0, 2).map(i => i.name).join(', ')}
                          {task.inputs.length > 2 && '...'}
                        </span>
                      </div>
                    )}
                    {task.outputs.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">out:</span>
                        <span className="text-gray-600 font-mono">
                          {task.outputs.slice(0, 2).join(', ')}
                          {task.outputs.length > 2 && '...'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
