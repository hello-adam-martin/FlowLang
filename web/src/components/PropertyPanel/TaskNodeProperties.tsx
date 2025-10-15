import { useState, useEffect } from 'react';
import type { FlowNode } from '../../types/node';
import type { Step } from '../../types/flow';
import KeyValueEditor from './KeyValueEditor';
import YAMLPreviewModal from '../YAMLPreviewModal/YAMLPreviewModal';
import { nodeToYaml } from '../../services/yamlConverter';

interface TaskNodePropertiesProps {
  node: FlowNode;
  onUpdate: (nodeId: string, data: any) => void;
}

export default function TaskNodeProperties({ node, onUpdate }: TaskNodePropertiesProps) {
  const step = node.data.step || {};

  const [label, setLabel] = useState(node.data.label || '');
  const [taskName, setTaskName] = useState(step.task || '');
  const [stepId, setStepId] = useState(step.id || '');
  const [description, setDescription] = useState(step.description || '');
  const [inputs, setInputs] = useState(step.inputs || {});
  const [outputs, setOutputs] = useState((step.outputs || []).join(', '));
  const [showYAMLModal, setShowYAMLModal] = useState(false);

  // Sync state when node changes (when user selects a different node)
  useEffect(() => {
    const newStep = node.data.step || {};
    setLabel(node.data.label || '');
    setTaskName(newStep.task || '');
    setStepId(newStep.id || '');
    setDescription(newStep.description || '');
    setInputs(newStep.inputs || {});
    setOutputs((newStep.outputs || []).join(', '));
  }, [node.id]); // Re-sync when node ID changes

  // Update node when any field changes
  useEffect(() => {
    const updatedStep: Step = {
      task: taskName || undefined,
      id: stepId || undefined,
      description: description || undefined,
      inputs: Object.keys(inputs).length > 0 ? inputs : undefined,
      outputs: outputs.trim() ? outputs.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    };

    onUpdate(node.id, {
      label,
      step: updatedStep,
    });
  }, [label, taskName, stepId, description, inputs, outputs]);

  return (
    <div className="space-y-4">
      {/* Node Label */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Label
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter node label"
        />
      </div>

      {/* Task Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Task Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="e.g., ValidateInput"
        />
        <p className="mt-1 text-xs text-gray-500">
          The task function name to execute
        </p>
      </div>

      {/* Step ID */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Step ID <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={stepId}
          onChange={(e) => setStepId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="e.g., validate_input"
        />
        <p className="mt-1 text-xs text-gray-500">
          Unique identifier for this step (used in variables: $&#123;step_id.output&#125;)
        </p>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Describe what this task does..."
          rows={2}
        />
      </div>

      {/* Inputs */}
      <KeyValueEditor
        label="Inputs"
        value={inputs}
        onChange={setInputs}
        placeholder={{ key: 'parameter', value: '${inputs.value}' }}
        allowVariables={true}
        currentNodeId={node.id}
      />

      {/* Outputs */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Outputs
        </label>
        <input
          type="text"
          value={outputs}
          onChange={(e) => setOutputs(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="result, status, data (comma-separated)"
        />
        <p className="mt-1 text-xs text-gray-500">
          Output variable names (comma-separated)
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

      {/* YAML Preview Modal */}
      <YAMLPreviewModal
        isOpen={showYAMLModal}
        onClose={() => setShowYAMLModal(false)}
        title="Task Node YAML"
        yamlContent={nodeToYaml(node)}
      />
    </div>
  );
}
