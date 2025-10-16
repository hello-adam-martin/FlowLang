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
  const nodeExecutionState = execution.nodeStates[node.id];

  const [label, setLabel] = useState(node.data.label || '');
  const [badge, setBadge] = useState(node.data.badge || '');
  const [showYAMLModal, setShowYAMLModal] = useState(false);

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
