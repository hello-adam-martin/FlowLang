import { useState } from 'react';
import type { NodeTemplate, FlowNodeType } from '../../types/node';

const nodeTemplates: NodeTemplate[] = [
  {
    type: 'task',
    label: 'Task',
    description: 'Execute a single task',
    icon: 'T',
  },
  {
    type: 'loopContainer',
    label: 'Loop Container',
    description: 'Repeat tasks for each item',
    icon: '↻',
  },
  {
    type: 'conditionalContainer',
    label: 'Conditional Container',
    description: 'Branch based on condition',
    icon: '?',
  },
  {
    type: 'parallelContainer',
    label: 'Parallel Container',
    description: 'Run tasks concurrently',
    icon: '⇉',
  },
];

export default function NodeLibrary() {
  const [searchQuery, setSearchQuery] = useState('');

  const onDragStart = (event: React.DragEvent, nodeType: FlowNodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredTemplates = nodeTemplates.filter(
    (template) =>
      template.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4">
      {/* Search box */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 pl-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          />
          <svg
            className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      <div className="space-y-2">
        {filteredTemplates.map((template) => (
          <div
            key={template.type}
            draggable
            onDragStart={(e) => onDragStart(e, template.type)}
            className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-move hover:border-blue-400 hover:shadow-md transition-all"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-semibold">
                {template.icon}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">
                {template.label}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {template.description}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
        <p className="text-xs text-blue-800 font-semibold">
          Tips:
        </p>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• Drag Task nodes onto canvas or into containers</li>
          <li>• Drag Container nodes onto canvas</li>
          <li>• Drop Task nodes into containers to nest them</li>
        </ul>
      </div>
    </div>
  );
}
