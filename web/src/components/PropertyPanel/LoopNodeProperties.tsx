import { useState, useEffect } from 'react';
import type { FlowNode } from '../../types/node';
import type { Step } from '../../types/flow';
import VariableSelector from './VariableSelector';
import YAMLPreviewModal from '../YAMLPreviewModal/YAMLPreviewModal';
import { nodeToYaml } from '../../services/yamlConverter';
import { useFlowStore } from '../../store/flowStore';
import ExecutionStatusDisplay from './ExecutionStatusDisplay';

interface LoopNodePropertiesProps {
  node: FlowNode;
  onUpdate: (nodeId: string, data: any) => void;
}

export default function LoopNodeProperties({ node, onUpdate }: LoopNodePropertiesProps) {
  const step = node.data.step || {};
  const execution = useFlowStore((state) => state.execution);
  const nodeExecutionState = execution.nodeStates[node.id];

  const [label, setLabel] = useState(node.data.label || '');
  const [badge, setBadge] = useState(node.data.badge || '');
  const [forEach, setForEach] = useState(step.for_each || '');
  const [asVariable, setAsVariable] = useState(step.as || '');
  const [showYAMLModal, setShowYAMLModal] = useState(false);

  // Sync state when node changes
  useEffect(() => {
    const newStep = node.data.step || {};
    setLabel(node.data.label || '');
    setBadge(node.data.badge || '');
    setForEach(newStep.for_each || '');
    setAsVariable(newStep.as || '');
  }, [node.id]);

  // Update node when any field changes
  useEffect(() => {
    const updatedStep: Step = {
      for_each: forEach || undefined,
      as: asVariable || undefined,
      do: step.do,
    };

    onUpdate(node.id, {
      label,
      badge: badge || undefined,
      step: updatedStep,
    });
  }, [label, badge, forEach, asVariable]);

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
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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

      {/* For Each */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          For Each <span className="text-red-500">*</span>
        </label>
        <VariableSelector
          value={forEach}
          onChange={setForEach}
          placeholder="${inputs.items}"
          currentNodeId={node.id}
          className="font-mono"
        />
        <p className="mt-1 text-xs text-gray-500">
          Array or list to iterate over
        </p>
      </div>

      {/* As Variable */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          As Variable <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={asVariable}
          onChange={(e) => setAsVariable(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="item"
        />
        <p className="mt-1 text-xs text-gray-500">
          Variable name for the current item (accessible as $&#123;inputs.item&#125; inside loop)
        </p>
      </div>

      {/* Examples */}
      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
        <p className="text-xs font-medium text-purple-900 mb-2">Example:</p>
        <div className="text-xs text-purple-800 font-mono space-y-1">
          <div><strong>For each:</strong> <code>$&#123;inputs.users&#125;</code></div>
          <div><strong>As:</strong> <code>user</code></div>
          <div className="mt-2 text-purple-700">Then use <code>$&#123;inputs.user&#125;</code> in tasks inside the loop</div>
        </div>
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
          Drag task nodes into this container to define what happens in each iteration of the loop.
        </p>
      </div>

      {/* YAML Preview Modal */}
      <YAMLPreviewModal
        isOpen={showYAMLModal}
        onClose={() => setShowYAMLModal(false)}
        title="Loop Container YAML"
        yamlContent={nodeToYaml(node)}
      />
    </div>
  );
}
