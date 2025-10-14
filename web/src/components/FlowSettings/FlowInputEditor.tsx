import { useState } from 'react';
import type { FlowInput } from '../../types/flow';

interface FlowInputEditorProps {
  inputs: FlowInput[];
  onChange: (inputs: FlowInput[]) => void;
}

const INPUT_TYPES = ['string', 'number', 'boolean', 'array', 'object'];

export default function FlowInputEditor({ inputs, onChange }: FlowInputEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleAdd = () => {
    onChange([
      ...inputs,
      {
        name: '',
        type: 'string',
        required: false,
      },
    ]);
    setEditingIndex(inputs.length);
  };

  const handleRemove = (index: number) => {
    onChange(inputs.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const handleUpdate = (index: number, updates: Partial<FlowInput>) => {
    onChange(
      inputs.map((input, i) =>
        i === index ? { ...input, ...updates } : input
      )
    );
  };

  const isValidIdentifier = (name: string): boolean => {
    // Valid identifier: starts with letter or underscore, contains only letters, numbers, underscores
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  };

  const hasError = (input: FlowInput): boolean => {
    return input.name !== '' && !isValidIdentifier(input.name);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Flow Inputs
        </label>
        <button
          onClick={handleAdd}
          className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          + Add Input
        </button>
      </div>

      {inputs.length === 0 ? (
        <div className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded border border-gray-200">
          No inputs defined. Click "Add Input" to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {inputs.map((input, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2"
            >
              {/* Name and Type Row */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={input.name}
                    onChange={(e) => handleUpdate(index, { name: e.target.value })}
                    className={`w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 ${
                      hasError(input)
                        ? 'border-red-400 focus:ring-red-500 bg-red-50'
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    placeholder="input_name"
                  />
                  {hasError(input) && (
                    <p className="mt-0.5 text-[10px] text-red-600">
                      Must start with letter/underscore, contain only letters, numbers, underscores
                    </p>
                  )}
                </div>
                <div className="w-28">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Type
                  </label>
                  <select
                    value={input.type}
                    onChange={(e) => handleUpdate(index, { type: e.target.value })}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {INPUT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => handleRemove(index)}
                    className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                    title="Remove input"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Required Checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={input.required || false}
                  onChange={(e) => handleUpdate(index, { required: e.target.checked })}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  id={`required-${index}`}
                />
                <label htmlFor={`required-${index}`} className="text-xs text-gray-700">
                  Required
                </label>
              </div>

              {/* Default Value */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Default Value (optional)
                </label>
                <input
                  type="text"
                  value={input.default?.toString() || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    handleUpdate(index, {
                      default: value === '' ? undefined : value
                    });
                  }}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Default value"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={input.description || ''}
                  onChange={(e) => handleUpdate(index, {
                    description: e.target.value === '' ? undefined : e.target.value
                  })}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  rows={2}
                  placeholder="Describe this input"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help text */}
      <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded p-2">
        <span className="font-medium">Tip:</span> Flow inputs define the data that must be provided when executing the flow.
      </div>
    </div>
  );
}
