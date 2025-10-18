import { useState, useEffect } from 'react';
import type { FlowNode } from '../../types/node';
import VariableSelector from './VariableSelector';
import YAMLPreviewModal from '../YAMLPreviewModal/YAMLPreviewModal';
import { nodeToYaml } from '../../services/yamlConverter';
import { useFlowStore } from '../../store/flowStore';
import ExecutionStatusDisplay from './ExecutionStatusDisplay';

interface ParallelNodePropertiesProps {
  node: FlowNode;
  onUpdate: (nodeId: string, data: any) => void;
}

export default function ParallelNodeProperties({ node, onUpdate }: ParallelNodePropertiesProps) {
  const execution = useFlowStore((state) => state.execution);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const nodeExecutionState = execution.nodeStates[node.id];

  // Find child nodes and calculate execution order
  const childNodes = nodes.filter(n => n.parentId === node.id).sort((a, b) => a.position.y - b.position.y);

  // Calculate execution order based on edges
  const executionOrder = new Map<string, number>();
  const childEdges = edges.filter(e => {
    const sourceNode = nodes.find(n => n.id === e.source);
    const targetNode = nodes.find(n => n.id === e.target);
    return sourceNode?.parentId === node.id && targetNode?.parentId === node.id;
  });

  if (childEdges.length > 0) {
    const incomingCount = new Map<string, number>();
    const adjacency = new Map<string, string[]>();
    const connectedNodes = new Set<string>();

    childNodes.forEach(child => {
      incomingCount.set(child.id, 0);
      adjacency.set(child.id, []);
    });

    childEdges.forEach(edge => {
      adjacency.get(edge.source)?.push(edge.target);
      incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    });

    const startNodes = childNodes.filter(child =>
      incomingCount.get(child.id) === 0 && connectedNodes.has(child.id)
    );

    const order: string[] = [];
    const queue = [...startNodes.map(n => n.id)];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      order.push(current);

      const neighbors = adjacency.get(current) || [];
      neighbors.forEach(neighbor => {
        const count = incomingCount.get(neighbor) || 0;
        incomingCount.set(neighbor, count - 1);
        if (incomingCount.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      });
    }

    order.forEach((nodeId, index) => {
      executionOrder.set(nodeId, index + 1);
    });
  }

  const [label, setLabel] = useState(node.data.label || '');
  const [badge, setBadge] = useState(node.data.badge || '');
  const [showYAMLModal, setShowYAMLModal] = useState(false);
  const [childrenExpanded, setChildrenExpanded] = useState(true);

  // Sync state when node changes
  useEffect(() => {
    setLabel(node.data.label || '');
    setBadge(node.data.badge || '');
  }, [node.id]);

  // Update node when any field changes
  useEffect(() => {
    onUpdate(node.id, {
      label,
      badge: badge || undefined,
    });
  }, [label, badge]);

  return (
    <div className="space-y-4">
      {/* Execution Status */}
      <ExecutionStatusDisplay nodeExecutionState={nodeExecutionState} />

      {/* Node Label */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Label
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="Enter node label"
        />
      </div>

      {/* Badge (Count/Variable) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Badge
        </label>
        <VariableSelector
          value={badge}
          onChange={setBadge}
          placeholder="${previous_step.count}"
          currentNodeId={node.id}
          className="font-mono"
        />
        <p className="mt-1 text-xs text-gray-500">
          Optional badge to display next to the label (e.g., item count, status)
        </p>
      </div>

      {/* Children Section */}
      <div>
        <div
          className="flex items-center justify-between mb-2 cursor-pointer"
          onClick={() => setChildrenExpanded(!childrenExpanded)}
        >
          <label className="text-sm font-medium text-gray-700">
            Children ({childNodes.length})
          </label>
          <button
            type="button"
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setChildrenExpanded(!childrenExpanded);
            }}
          >
            <svg
              className={`w-4 h-4 text-gray-600 transition-transform ${childrenExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        {childrenExpanded && childNodes.length > 0 && (
          <>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              {childNodes.map((child) => {
                const nodeTypeIcon = child.type === 'task' ? '📋' :
                                     child.type === 'loopContainer' ? '↻' :
                                     child.type === 'parallelContainer' ? '⇉' :
                                     child.type === 'conditionalContainer' ? '?' :
                                     child.type === 'switchContainer' ? '⋮' :
                                     child.type === 'subflow' ? '🔁' : '•';

                const order = executionOrder.get(child.id);

                return (
                  <div
                    key={child.id}
                    className="px-3 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    {order && (
                      <div className="flex-shrink-0 w-5 h-5 bg-gray-300 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                        {order}
                      </div>
                    )}
                    {!order && (
                      <div className="flex-shrink-0 w-5 h-5"></div>
                    )}
                    <div className="flex-shrink-0 text-base">
                      {nodeTypeIcon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {child.data.label || 'Untitled'}
                      </div>
                      <div className="text-xs text-gray-500 font-mono truncate">
                        {child.id}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
              <div className="flex items-center gap-1 mb-1">
                <div className="w-4 h-4 bg-gray-300 text-white rounded-full flex items-center justify-center text-[8px] font-bold">N</div>
                <span>= Execution order (waits for step N to complete)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4"></div>
                <span>No badge = Runs immediately (no dependencies)</span>
              </div>
            </div>
          </>
        )}
        {childrenExpanded && childNodes.length === 0 && (
          <div className="border border-dashed border-gray-300 rounded-lg px-4 py-6 text-center">
            <p className="text-sm text-gray-500">
              No children. Drag nodes into this container.
            </p>
          </div>
        )}
      </div>

      {/* Node ID (read-only) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Node ID
        </label>
        <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded border border-gray-200 font-mono">
          {node.id}
        </div>
      </div>

      {/* Info about parallel execution */}
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-xs font-medium text-green-900 mb-2">About Parallel Execution:</p>
        <p className="text-xs text-green-800">
          Tasks dropped into this container will execute concurrently. Entry points (tasks without internal incoming connections) will start simultaneously as separate parallel tracks.
        </p>
      </div>

      {/* View YAML Button */}
      <div>
        <button
          onClick={() => setShowYAMLModal(true)}
          className="w-full px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          View Node YAML
        </button>
      </div>

      {/* Info about child nodes */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          Drag task nodes into this container. Nodes without incoming edges from other internal nodes will become entry points for parallel tracks.
        </p>
      </div>

      {/* YAML Preview Modal */}
      <YAMLPreviewModal
        isOpen={showYAMLModal}
        onClose={() => setShowYAMLModal(false)}
        title="Parallel Container YAML"
        yamlContent={nodeToYaml(node)}
      />
    </div>
  );
}
