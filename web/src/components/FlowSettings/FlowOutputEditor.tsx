import { useState } from 'react';
import type { FlowOutput } from '../../types/flow';

interface FlowOutputEditorProps {
  outputs: FlowOutput[];
  onChange: (outputs: FlowOutput[]) => void;
}

export default function FlowOutputEditor({ outputs, onChange }: FlowOutputEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleAdd = () => {
    onChange([
      ...outputs,
      {
        name: '',
        value: '',
      },
    ]);
    setEditingIndex(outputs.length);
  };

  const handleRemove = (index: number) => {
    onChange(outputs.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const handleUpdate = (index: number, updates: Partial<FlowOutput>) => {
    onChange(
      outputs.map((output, i) =>
        i === index ? { ...output, ...updates } : output
      )
    );
  };

  const isValidIdentifier = (name: string): boolean => {
    // Valid identifier: starts with letter or underscore, contains only letters, numbers, underscores
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  };

  const hasNameError = (output: FlowOutput): boolean => {
    return output.name !== '' && !isValidIdentifier(output.name);
  };

  const hasValueError = (output: FlowOutput): boolean => {
    return output.value === '';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Flow Outputs
        </label>
        <button
          onClick={handleAdd}
          className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          + Add Output
        </button>
      </div>

      {outputs.length === 0 ? (
        <div className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded border border-gray-200">
          No outputs defined. Click "Add Output" to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {outputs.map((output, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2"
            >
              {/* Name Row */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={output.name}
                    onChange={(e) => handleUpdate(index, { name: e.target.value })}
                    className={`w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 ${
                      hasNameError(output)
                        ? 'border-red-400 focus:ring-red-500 bg-red-50'
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    placeholder="output_name"
                  />
                  {hasNameError(output) && (
                    <p className="mt-0.5 text-[10px] text-red-600">
                      Must start with letter/underscore, contain only letters, numbers, underscores
                    </p>
                  )}
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => handleRemove(index)}
                    className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                    title="Remove output"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Value */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Value
                </label>
                <input
                  type="text"
                  value={output.value}
                  onChange={(e) => handleUpdate(index, { value: e.target.value })}
                  className={`w-full px-2 py-1 text-xs font-mono border rounded focus:outline-none focus:ring-1 ${
                    hasValueError(output)
                      ? 'border-red-400 focus:ring-red-500 bg-red-50'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="${step_id.output}"
                />
                {hasValueError(output) ? (
                  <p className="mt-1 text-[10px] text-red-600">
                    Value is required
                  </p>
                ) : (
                  <div className="mt-1 text-[10px] text-gray-500">
                    Use variable syntax: <span className="font-mono">${"{"}step_id.output{"}"}</span> or <span className="font-mono">${"{"}inputs.name{"}"}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={output.description || ''}
                  onChange={(e) => handleUpdate(index, {
                    description: e.target.value === '' ? undefined : e.target.value
                  })}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  rows={2}
                  placeholder="Describe this output"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help text */}
      <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded p-2">
        <span className="font-medium">Tip:</span> Flow outputs define what data is returned after execution. Use variable references to pull values from step outputs or inputs.
      </div>
    </div>
  );
}
