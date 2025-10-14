import { useState, useEffect } from 'react';
import type { FlowNode } from '../../types/node';

interface ParallelNodePropertiesProps {
  node: FlowNode;
  onUpdate: (nodeId: string, data: any) => void;
}

export default function ParallelNodeProperties({ node, onUpdate }: ParallelNodePropertiesProps) {
  const [label, setLabel] = useState(node.data.label || '');

  // Sync state when node changes
  useEffect(() => {
    setLabel(node.data.label || '');
  }, [node.id]);

  // Update node when label changes
  useEffect(() => {
    onUpdate(node.id, {
      label,
    });
  }, [label]);

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
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="Enter node label"
        />
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

      {/* Info about child nodes */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          Drag task nodes into this container. Nodes without incoming edges from other internal nodes will become entry points for parallel tracks.
        </p>
      </div>
    </div>
  );
}
