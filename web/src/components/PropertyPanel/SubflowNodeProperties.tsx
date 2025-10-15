import { useState, useEffect } from 'react';
import type { FlowNode } from '../../types/node';
import type { Step } from '../../types/flow';
import KeyValueEditor from './KeyValueEditor';
import YAMLPreviewModal from '../YAMLPreviewModal/YAMLPreviewModal';
import { nodeToYaml } from '../../services/yamlConverter';

interface SubflowNodePropertiesProps {
  node: FlowNode;
  onUpdate: (nodeId: string, data: any) => void;
}

export default function SubflowNodeProperties({ node, onUpdate }: SubflowNodePropertiesProps) {
  const step = node.data.step || {};

  const [label, setLabel] = useState(node.data.label || '');
  const [subflowName, setSubflowName] = useState(step.subflow || '');
  const [inputs, setInputs] = useState<Record<string, any>>(step.inputs || {});
  const [outputs, setOutputs] = useState<string[]>(step.outputs || []);
  const [outputsText, setOutputsText] = useState((step.outputs || []).join(', '));
  const [showYAMLModal, setShowYAMLModal] = useState(false);

  // Sync state when node changes
  useEffect(() => {
    const newStep = node.data.step || {};
    setLabel(node.data.label || '');
    setSubflowName(newStep.subflow || '');
    setInputs(newStep.inputs || {});
    setOutputs(newStep.outputs || []);
    setOutputsText((newStep.outputs || []).join(', '));
  }, [node.id]);

  // Update node when any field changes
  useEffect(() => {
    const updatedStep: Step = {
      subflow: subflowName || undefined,
      id: step.id || node.id,
      inputs: Object.keys(inputs).length > 0 ? inputs : undefined,
      outputs: outputs.length > 0 ? outputs : undefined,
    };

    onUpdate(node.id, {
      label,
      step: updatedStep,
    });
  }, [label, subflowName, inputs, outputs]);

  const handleOutputsChange = (value: string) => {
    setOutputsText(value);
    // Parse comma-separated list
    const outputArray = value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    setOutputs(outputArray);
  };

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
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="Enter node label"
        />
      </div>

      {/* Subflow Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Subflow Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={subflowName}
          onChange={(e) => setSubflowName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="validate_user"
        />
        <p className="mt-1 text-xs text-gray-500">
          Name of the subflow to execute (snake_case)
        </p>
      </div>

      {/* Inputs */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Inputs
        </label>
        <KeyValueEditor
          value={inputs}
          onChange={setInputs}
          placeholder="Pass inputs to subflow"
        />
        <p className="mt-1 text-xs text-gray-500">
          Map inputs to pass to the subflow (supports $&#123;variable&#125; references)
        </p>
      </div>

      {/* Outputs */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Outputs
        </label>
        <input
          type="text"
          value={outputsText}
          onChange={(e) => handleOutputsChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="is_valid, user_data, status"
        />
        <p className="mt-1 text-xs text-gray-500">
          Comma-separated list of output keys to capture from subflow
        </p>
      </div>

      {/* Example */}
      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
        <p className="text-xs font-medium text-indigo-900 mb-2">Example:</p>
        <div className="text-xs text-indigo-800 font-mono space-y-1">
          <div><strong>Subflow:</strong> <code>validate_user</code></div>
          <div><strong>Inputs:</strong></div>
          <div className="ml-2"><code>user_id: $&#123;inputs.user_id&#125;</code></div>
          <div className="ml-2"><code>required_role: "customer"</code></div>
          <div><strong>Outputs:</strong> <code>is_valid, user_data</code></div>
          <div className="mt-2 text-indigo-700">
            Then use <code>$&#123;step_id.is_valid&#125;</code> in following steps
          </div>
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

      {/* Info */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          Subflows are reusable flows that can be called from other flows. The subflow executes independently and returns outputs.
        </p>
      </div>

      {/* YAML Preview Modal */}
      <YAMLPreviewModal
        isOpen={showYAMLModal}
        onClose={() => setShowYAMLModal(false)}
        title="Subflow Node YAML"
        yamlContent={nodeToYaml(node)}
      />
    </div>
  );
}
