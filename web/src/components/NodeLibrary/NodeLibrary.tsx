import { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import type { NodeTemplate, FlowNodeType } from '../../types/node';
import TaskNode from '../nodes/TaskNode';
import LoopContainerNode from '../nodes/LoopContainerNode';
import ConditionalContainerNode from '../nodes/ConditionalContainerNode';
import ParallelContainerNode from '../nodes/ParallelContainerNode';

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

// Create drag preview by rendering actual React component
const createDragPreview = (nodeType: FlowNodeType): HTMLElement => {
  const preview = document.createElement('div');
  preview.style.position = 'absolute';
  preview.style.top = '-1000px';
  preview.style.pointerEvents = 'none';

  // Create default node data
  const defaultData = {
    label: 'New Task',
    step: nodeType === 'task' ? { id: 'preview', task: undefined, inputs: {}, outputs: [] } : {},
  };

  // Set fixed dimensions for containers
  if (nodeType !== 'task') {
    if (nodeType === 'conditionalContainer') {
      preview.style.width = '600px';
      preview.style.height = '300px';
    } else {
      preview.style.width = '450px';
      preview.style.height = '195px';
    }
  }

  // Render the appropriate node component
  const root = createRoot(preview);
  const nodeProps: any = {
    id: 'preview',
    data: defaultData,
    selected: false,
    type: nodeType,
  };

  let nodeComponent;
  switch (nodeType) {
    case 'task':
      nodeComponent = <TaskNode {...nodeProps} />;
      break;
    case 'loopContainer':
      nodeComponent = <LoopContainerNode {...nodeProps} />;
      break;
    case 'conditionalContainer':
      nodeComponent = <ConditionalContainerNode {...nodeProps} />;
      break;
    case 'parallelContainer':
      nodeComponent = <ParallelContainerNode {...nodeProps} />;
      break;
  }

  // Wrap in ReactFlowProvider to satisfy hooks
  root.render(<ReactFlowProvider>{nodeComponent}</ReactFlowProvider>);

  document.body.appendChild(preview);

  // Store root for cleanup
  (preview as any)._root = root;

  return preview;
};

export default function NodeLibrary() {
  const [searchQuery, setSearchQuery] = useState('');
  const dragPreviewRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (dragPreviewRef.current) {
        // Unmount React root
        const root = (dragPreviewRef.current as any)._root;
        if (root) {
          root.unmount();
        }
        document.body.removeChild(dragPreviewRef.current);
      }
    };
  }, []);

  const onDragStart = (event: React.DragEvent, nodeType: FlowNodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';

    // Create and set custom drag preview
    const preview = createDragPreview(nodeType);
    dragPreviewRef.current = preview;
    event.dataTransfer.setDragImage(preview, preview.offsetWidth / 2, preview.offsetHeight / 2);
  };

  const onDragEnd = () => {
    // Clean up drag preview
    if (dragPreviewRef.current) {
      // Unmount React root
      const root = (dragPreviewRef.current as any)._root;
      if (root) {
        root.unmount();
      }
      document.body.removeChild(dragPreviewRef.current);
      dragPreviewRef.current = null;
    }
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
            onDragEnd={onDragEnd}
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
