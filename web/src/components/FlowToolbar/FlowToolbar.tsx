import { useFlowStore } from '../../store/flowStore';
import { flowToYaml, yamlToFlow, validateYaml } from '../../services/yamlConverter';
import { useRef } from 'react';

export default function FlowToolbar() {
  const { flowDefinition, reset, nodes, edges, setNodes, setEdges, setFlowDefinition } = useFlowStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          <span className="text-sm text-gray-500">
            {flowDefinition.flow}
          </span>
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
    </div>
  );
}
