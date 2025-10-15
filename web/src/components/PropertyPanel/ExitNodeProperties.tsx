import { useState, useEffect } from 'react';
import type { FlowNode } from '../../types/node';
import type { Step, ExitConfig } from '../../types/flow';
import KeyValueEditor from './KeyValueEditor';
import YAMLPreviewModal from '../YAMLPreviewModal/YAMLPreviewModal';
import { nodeToYaml } from '../../services/yamlConverter';

interface ExitNodePropertiesProps {
  node: FlowNode;
  onUpdate: (nodeId: string, data: any) => void;
}

export default function ExitNodeProperties({ node, onUpdate }: ExitNodePropertiesProps) {
  const step = node.data.step || {};
  const exitConfig = typeof step.exit === 'object' ? step.exit : {};

  const [label, setLabel] = useState(node.data.label || '');
  const [reason, setReason] = useState(exitConfig.reason || '');
  const [outputs, setOutputs] = useState<Record<string, any>>(exitConfig.outputs || {});
  const [showYAMLModal, setShowYAMLModal] = useState(false);

  // Sync state when node changes
  useEffect(() => {
    const newStep = node.data.step || {};
    const newExitConfig = typeof newStep.exit === 'object' ? newStep.exit : {};

    setLabel(node.data.label || '');
    setReason(newExitConfig.reason || '');
    setOutputs(newExitConfig.outputs || {});
  }, [node.id]);

  // Update node when any field changes
  useEffect(() => {
    const exitValue: ExitConfig | boolean = reason || Object.keys(outputs).length > 0
      ? {
          reason: reason || undefined,
          outputs: Object.keys(outputs).length > 0 ? outputs : undefined,
        }
      : true;

    const updatedStep: Step = {
      exit: exitValue,
    };

    onUpdate(node.id, {
      label,
      step: updatedStep,
    });
  }, [label, reason, outputs]);

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
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          placeholder="Enter node label"
        />
      </div>

      {/* Exit Reason */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Reason
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          placeholder="User validation failed"
        />
        <p className="mt-1 text-xs text-gray-500">
          Optional reason for flow termination
        </p>
      </div>

      {/* Exit Outputs */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Outputs
        </label>
        <KeyValueEditor
          value={outputs}
          onChange={setOutputs}
          placeholder="Optional outputs to return"
        />
        <p className="mt-1 text-xs text-gray-500">
          Optional key-value pairs to return when flow exits
        </p>
      </div>

      {/* Example */}
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-xs font-medium text-red-900 mb-2">Examples:</p>
        <div className="text-xs text-red-800 space-y-2">
          <div>
            <div className="font-semibold">Simple exit:</div>
            <div className="font-mono ml-2">No reason or outputs</div>
          </div>
          <div>
            <div className="font-semibold">Exit with reason:</div>
            <div className="font-mono ml-2">reason: "Validation failed"</div>
          </div>
          <div>
            <div className="font-semibold">Exit with outputs:</div>
            <div className="font-mono ml-2">success: false</div>
            <div className="font-mono ml-2">error: "Invalid input"</div>
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

      {/* Warning */}
      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-xs text-yellow-800">
          ⚠️ Exit nodes terminate the flow immediately. Any steps after this node will not execute.
        </p>
      </div>

      {/* YAML Preview Modal */}
      <YAMLPreviewModal
        isOpen={showYAMLModal}
        onClose={() => setShowYAMLModal(false)}
        title="Exit Node YAML"
        yamlContent={nodeToYaml(node)}
      />
    </div>
  );
}
