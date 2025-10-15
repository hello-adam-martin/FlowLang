import { useState, useEffect } from 'react';
import { useFlowStore } from '../../store/flowStore';
import FlowInputEditor from './FlowInputEditor';
import FlowOutputEditor from './FlowOutputEditor';
import TriggerEditor from './TriggerEditor';
import ConnectionEditor from './ConnectionEditor';
import OnCancelEditor from './OnCancelEditor';
import type { FlowInput, FlowOutput, TriggerConfig, ConnectionConfig, Step } from '../../types/flow';

interface FlowSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'general' | 'inputs' | 'outputs' | 'triggers' | 'connections' | 'cleanup';

export default function FlowSettingsModal({ isOpen, onClose }: FlowSettingsModalProps) {
  const { flowDefinition, updateFlowDefinition } = useFlowStore();
  const [activeTab, setActiveTab] = useState<Tab>('general');

  // Local state for form fields
  const [flowName, setFlowName] = useState(flowDefinition.flow);
  const [description, setDescription] = useState(flowDefinition.description || '');
  const [inputs, setInputs] = useState<FlowInput[]>(flowDefinition.inputs || []);
  const [outputs, setOutputs] = useState<FlowOutput[]>(flowDefinition.outputs || []);
  const [triggers, setTriggers] = useState<TriggerConfig[]>(flowDefinition.triggers || []);
  const [connections, setConnections] = useState<Record<string, ConnectionConfig>>(flowDefinition.connections || {});
  const [onCancelSteps, setOnCancelSteps] = useState<Step[]>(flowDefinition.on_cancel || []);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFlowName(flowDefinition.flow);
      setDescription(flowDefinition.description || '');
      setInputs(flowDefinition.inputs || []);
      setOutputs(flowDefinition.outputs || []);
      setTriggers(flowDefinition.triggers || []);
      setConnections(flowDefinition.connections || {});
      setOnCancelSteps(flowDefinition.on_cancel || []);
      setActiveTab('general');
    }
  }, [isOpen, flowDefinition]);

  const handleSave = () => {
    updateFlowDefinition({
      flow: flowName,
      description: description || undefined,
      inputs,
      outputs,
      triggers: triggers.length > 0 ? triggers : undefined,
      connections: Object.keys(connections).length > 0 ? connections : undefined,
      on_cancel: onCancelSteps.length > 0 ? onCancelSteps : undefined,
    });
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Flow Settings</h2>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('inputs')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'inputs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Inputs
            {inputs.length > 0 && (
              <span className="ml-1.5 text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full">
                {inputs.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('outputs')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'outputs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Outputs
            {outputs.length > 0 && (
              <span className="ml-1.5 text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full">
                {outputs.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('triggers')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'triggers'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Triggers
            {triggers.length > 0 && (
              <span className="ml-1.5 text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full">
                {triggers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('connections')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'connections'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Connections
            {Object.keys(connections).length > 0 && (
              <span className="ml-1.5 text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full">
                {Object.keys(connections).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('cleanup')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'cleanup'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Cleanup
            {onCancelSteps.length > 0 && (
              <span className="ml-1.5 text-xs bg-orange-200 text-orange-700 px-1.5 py-0.5 rounded-full">
                {onCancelSteps.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === 'general' && (
            <div className="space-y-4">
              {/* Flow Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Flow Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="MyFlow"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  The name of your flow (used in API endpoints)
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={4}
                  placeholder="Describe what this flow does..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  A brief description of the flow's purpose and functionality
                </p>
              </div>
            </div>
          )}

          {activeTab === 'inputs' && (
            <FlowInputEditor inputs={inputs} onChange={setInputs} />
          )}

          {activeTab === 'outputs' && (
            <FlowOutputEditor outputs={outputs} onChange={setOutputs} />
          )}

          {activeTab === 'triggers' && (
            <TriggerEditor triggers={triggers} onChange={setTriggers} />
          )}

          {activeTab === 'connections' && (
            <ConnectionEditor connections={connections} onChange={setConnections} />
          )}

          {activeTab === 'cleanup' && (
            <OnCancelEditor onCancelSteps={onCancelSteps} onChange={setOnCancelSteps} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!flowName.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
