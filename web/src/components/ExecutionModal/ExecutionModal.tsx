import { useState, useEffect } from 'react';
import { useFlowStore } from '../../store/flowStore';

interface ExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (inputs: Record<string, any>) => void;
}

export default function ExecutionModal({ isOpen, onClose, onExecute }: ExecutionModalProps) {
  const flowDefinition = useFlowStore((state) => state.flowDefinition);
  const inputs = flowDefinition.inputs || [];
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize input values with defaults
  useEffect(() => {
    if (isOpen) {
      const initialValues: Record<string, any> = {};
      inputs.forEach((input) => {
        initialValues[input.name] = input.default !== undefined ? input.default : '';
      });
      setInputValues(initialValues);
      setErrors({});
    }
  }, [isOpen, inputs]);

  const handleInputChange = (name: string, value: any) => {
    setInputValues((prev) => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateInputs = (): boolean => {
    const newErrors: Record<string, string> = {};

    inputs.forEach((input) => {
      if (input.required && !inputValues[input.name]) {
        newErrors[input.name] = 'This field is required';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleExecute = () => {
    if (validateInputs()) {
      onExecute(inputValues);
      onClose();
    }
  };

  const handleCancel = () => {
    setInputValues({});
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Simulate Flow</h2>
            <p className="text-sm text-gray-600 mt-1">
              Provide test inputs to simulate your flow execution
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {inputs.length === 0 ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">ℹ️</span>
                <div>
                  <p className="text-sm font-medium text-blue-900 mb-1">No inputs required</p>
                  <p className="text-xs text-blue-700">
                    This flow doesn't require any input parameters. Click "Simulate" to run the simulation.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {inputs.map((input, index) => (
                <div key={index}>
                  <label className="block mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">{input.name}</span>
                      {input.required ? (
                        <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded">
                          Required
                        </span>
                      ) : (
                        <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          Optional
                        </span>
                      )}
                      <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                        {input.type || 'any'}
                      </span>
                    </div>
                    {input.description && (
                      <p className="text-xs text-gray-600 mb-2">{input.description}</p>
                    )}
                  </label>

                  {/* Input field based on type */}
                  {input.type === 'boolean' ? (
                    <select
                      value={inputValues[input.name]?.toString() || ''}
                      onChange={(e) => handleInputChange(input.name, e.target.value === 'true')}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors[input.name] ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select...</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : input.type === 'number' ? (
                    <input
                      type="number"
                      value={inputValues[input.name] || ''}
                      onChange={(e) => handleInputChange(input.name, parseFloat(e.target.value))}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors[input.name] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder={`Enter ${input.name}...`}
                    />
                  ) : input.type === 'object' || input.type === 'array' ? (
                    <textarea
                      value={
                        typeof inputValues[input.name] === 'object'
                          ? JSON.stringify(inputValues[input.name], null, 2)
                          : inputValues[input.name] || ''
                      }
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          handleInputChange(input.name, parsed);
                        } catch {
                          handleInputChange(input.name, e.target.value);
                        }
                      }}
                      className={`w-full px-3 py-2 border rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors[input.name] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      rows={4}
                      placeholder={input.type === 'array' ? '["item1", "item2"]' : '{"key": "value"}'}
                    />
                  ) : (
                    <input
                      type="text"
                      value={inputValues[input.name] || ''}
                      onChange={(e) => handleInputChange(input.name, e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors[input.name] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder={`Enter ${input.name}...`}
                    />
                  )}

                  {errors[input.name] && (
                    <p className="text-xs text-red-600 mt-1">{errors[input.name]}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Simulate
          </button>
        </div>
      </div>
    </div>
  );
}
