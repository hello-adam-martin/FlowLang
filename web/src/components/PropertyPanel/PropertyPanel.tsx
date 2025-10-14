import { useFlowStore } from '../../store/flowStore';

export default function PropertyPanel() {
  const { selectedNode, nodes } = useFlowStore();

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

      <div className="space-y-4">
        {/* Node Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded border border-gray-200">
            {node.data.type}
          </div>
        </div>

        {/* Node Label */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Label
          </label>
          <input
            type="text"
            value={node.data.label}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="Enter node label"
            readOnly
          />
        </div>

        {/* Node ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ID
          </label>
          <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded border border-gray-200 font-mono">
            {node.id}
          </div>
        </div>

        {/* Step Configuration - TODO: Make editable */}
        {node.data.step && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Configuration
            </label>
            <pre className="text-xs text-gray-900 bg-gray-50 px-3 py-2 rounded border border-gray-200 overflow-auto max-h-64">
              {JSON.stringify(node.data.step, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-800">
          Property editing coming soon! For now, properties are read-only.
        </p>
      </div>
    </div>
  );
}
