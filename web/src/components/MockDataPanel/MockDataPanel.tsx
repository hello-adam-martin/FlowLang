import { useState } from 'react';
import { useFlowStore } from '../../store/flowStore';

interface MockDataPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MockDataPanel({ isOpen, onClose }: MockDataPanelProps) {
  const { flowDefinition, mockData, setMockInputData, clearMockData } = useFlowStore();
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  // Get flow inputs from definition
  const flowInputs = flowDefinition.inputs || [];

  // Initialize editing values from mockData
  const getInputValue = (inputName: string): string => {
    if (editingValues[inputName] !== undefined) {
      return editingValues[inputName];
    }
    const mockValue = mockData.inputs[inputName];
    if (mockValue !== undefined) {
      return typeof mockValue === 'string' ? mockValue : JSON.stringify(mockValue);
    }
    return '';
  };

  const handleInputChange = (inputName: string, value: string) => {
    setEditingValues(prev => ({ ...prev, [inputName]: value }));
  };

  const handleInputBlur = (inputName: string, inputType: string) => {
    const value = editingValues[inputName];
    if (value === undefined) return;

    try {
      // Parse value based on type
      let parsedValue: any = value;

      if (inputType === 'number') {
        parsedValue = value === '' ? undefined : Number(value);
        if (isNaN(parsedValue)) {
          alert(`Invalid number: ${value}`);
          return;
        }
      } else if (inputType === 'boolean') {
        parsedValue = value.toLowerCase() === 'true';
      } else if (inputType === 'array' || inputType === 'object') {
        parsedValue = value === '' ? undefined : JSON.parse(value);
      }
      // string type stays as-is

      if (parsedValue !== undefined) {
        setMockInputData(inputName, parsedValue);
      }
    } catch (error) {
      alert(`Invalid JSON for ${inputName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleClearAll = () => {
    if (confirm('Clear all mock data?')) {
      clearMockData();
      setEditingValues({});
    }
  };

  const mockInputCount = Object.keys(mockData.inputs).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">Mock Data Configuration</h2>
            {mockInputCount > 0 && (
              <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
                {mockInputCount} configured
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Info Box */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-start gap-3">
              <span className="text-blue-600 text-lg">ℹ️</span>
              <div className="flex-1 text-sm text-blue-900">
                <p className="font-semibold mb-1">Mock Data for Testing</p>
                <p>Configure specific values for flow inputs to test different scenarios (e.g., force conditional branches, test switch cases, control loop items).</p>
              </div>
            </div>
          </div>

          {/* Flow Inputs Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Flow Inputs</h3>

            {flowInputs.length === 0 ? (
              <div className="p-6 text-center text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                No flow inputs defined. Add inputs in Flow Settings.
              </div>
            ) : (
              <div className="space-y-4">
                {flowInputs.map((input: any) => {
                  const inputName = input.name;
                  const inputType = input.type || 'string';
                  const isRequired = input.required || false;
                  const isMocked = mockData.inputs[inputName] !== undefined;

                  return (
                    <div key={inputName} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <label className="font-medium text-gray-900">
                            {inputName}
                          </label>
                          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                            {inputType}
                          </span>
                          {isRequired && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded">
                              required
                            </span>
                          )}
                          {isMocked && (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded">
                              ✓ mocked
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {inputType === 'boolean' ? (
                          <select
                            value={getInputValue(inputName)}
                            onChange={(e) => {
                              handleInputChange(inputName, e.target.value);
                              handleInputBlur(inputName, inputType);
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">-- Select --</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        ) : inputType === 'array' || inputType === 'object' ? (
                          <textarea
                            value={getInputValue(inputName)}
                            onChange={(e) => handleInputChange(inputName, e.target.value)}
                            onBlur={() => handleInputBlur(inputName, inputType)}
                            placeholder={inputType === 'array' ? '["item1", "item2"]' : '{"key": "value"}'}
                            rows={3}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                          />
                        ) : (
                          <input
                            type={inputType === 'number' ? 'number' : 'text'}
                            value={getInputValue(inputName)}
                            onChange={(e) => handleInputChange(inputName, e.target.value)}
                            onBlur={() => handleInputBlur(inputName, inputType)}
                            placeholder={`Enter ${inputType} value`}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Task Outputs Section - Coming Soon */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Task Outputs</h3>
            <div className="p-6 text-center text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="font-medium mb-1">Coming Soon</p>
              <p className="text-sm">Configure mock outputs for individual task nodes.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClearAll}
            disabled={mockInputCount === 0}
            className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear All
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
