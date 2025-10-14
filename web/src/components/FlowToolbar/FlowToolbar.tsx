import { useFlowStore } from '../../store/flowStore';
import { flowToYaml, yamlToFlow, validateYaml } from '../../services/yamlConverter';
import { useRef, useState } from 'react';
import FlowSettingsModal from '../FlowSettings/FlowSettingsModal';

export default function FlowToolbar() {
  const { flowDefinition, reset, nodes, edges, setNodes, setEdges, setFlowDefinition } = useFlowStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSettings, setShowSettings] = useState(false);

  const handleNew = () => {
    if (confirm('Create new flow? Current progress will be lost.')) {
      reset();
    }
  };

  const handleExport = () => {
    try {
      const yamlString = flowToYaml(nodes, edges, flowDefinition);

      // Create a download link
      const blob = new Blob([yamlString], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${flowDefinition.flow || 'flow'}.yaml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();

      // Validate YAML
      const validation = validateYaml(text);
      if (!validation.valid) {
        alert(`Invalid YAML:\n${validation.errors.join('\n')}`);
        return;
      }

      // Convert to flow
      const { nodes: newNodes, edges: newEdges, flowDefinition: newFlowDef } = yamlToFlow(text);

      setNodes(newNodes);
      setEdges(newEdges);
      setFlowDefinition(newFlowDef);
    } catch (error) {
      alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    // TODO: Implement save to server
    alert('Save to server coming soon!');
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">
            FlowLang Designer
          </h1>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
            title="Flow Settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {flowDefinition.flow}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleNew}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            New
          </button>
          <button
            onClick={handleImport}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Import YAML
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={nodes.length === 0}
          >
            Export YAML
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>

      {/* Flow Settings Modal */}
      <FlowSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
