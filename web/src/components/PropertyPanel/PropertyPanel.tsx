import { useFlowStore } from '../../store/flowStore';
import TaskNodeProperties from './TaskNodeProperties';
import ConditionalNodeProperties from './ConditionalNodeProperties';
import LoopNodeProperties from './LoopNodeProperties';
import ParallelNodeProperties from './ParallelNodeProperties';
import SwitchNodeProperties from './SwitchNodeProperties';
import SubflowNodeProperties from './SubflowNodeProperties';
import ExitNodeProperties from './ExitNodeProperties';

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
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Properties
      </h2>

      {/* Node Type Badge */}
      <div className="mb-4">
        <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
          {node.data.type}
        </span>
      </div>

      {/* Render appropriate property editor based on node type */}
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
