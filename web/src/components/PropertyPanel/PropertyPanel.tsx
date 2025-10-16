import { useFlowStore } from '../../store/flowStore';
import StartNodeProperties from './StartNodeProperties';
import TaskNodeProperties from './TaskNodeProperties';
import ConditionalNodeProperties from './ConditionalNodeProperties';
import LoopNodeProperties from './LoopNodeProperties';
import ParallelNodeProperties from './ParallelNodeProperties';
import SwitchNodeProperties from './SwitchNodeProperties';
import SubflowNodeProperties from './SubflowNodeProperties';
import ExitNodeProperties from './ExitNodeProperties';

// Get badge colors based on node type
const getNodeBadgeColors = (nodeType: string) => {
  switch (nodeType) {
    case 'start':
      return 'bg-gray-100 text-gray-700';
    case 'task':
      return 'bg-blue-100 text-blue-800';
    case 'loopContainer':
      return 'bg-purple-100 text-purple-800';
    case 'conditionalContainer':
      return 'bg-amber-100 text-amber-800';
    case 'switchContainer':
      return 'bg-indigo-100 text-indigo-800';
    case 'parallelContainer':
      return 'bg-green-100 text-green-800';
    case 'subflow':
      return 'bg-cyan-100 text-cyan-800';
    case 'exit':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

export default function PropertyPanel() {
  const { selectedNode, nodes, updateNode } = useFlowStore();

  const node = nodes.find((n) => n.id === selectedNode);

  if (!node) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Properties
        </h2>
        <div className="text-sm text-gray-500">
          Select a node to view and edit its properties
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header with title and badge */}
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Properties
        </h2>
        {/* Node Type Badge - top right */}
        <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getNodeBadgeColors(node.data.type)}`}>
          {node.data.type}
        </span>
      </div>

      {/* Render appropriate property editor based on node type */}
      {node.data.type === 'start' && (
        <StartNodeProperties />
      )}

      {node.data.type === 'task' && (
        <TaskNodeProperties node={node} onUpdate={updateNode} />
      )}

      {node.data.type === 'loopContainer' && (
        <LoopNodeProperties node={node} onUpdate={updateNode} />
      )}

      {node.data.type === 'conditionalContainer' && (
        <ConditionalNodeProperties node={node} onUpdate={updateNode} />
      )}

      {node.data.type === 'switchContainer' && (
        <SwitchNodeProperties node={node} onUpdate={updateNode} />
      )}

      {node.data.type === 'parallelContainer' && (
        <ParallelNodeProperties node={node} onUpdate={updateNode} />
      )}

      {node.data.type === 'subflow' && (
        <SubflowNodeProperties node={node} onUpdate={updateNode} />
      )}

      {node.data.type === 'exit' && (
        <ExitNodeProperties node={node} onUpdate={updateNode} />
      )}
    </div>
  );
}
