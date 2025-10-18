import { useState } from 'react';
import { useFlowStore } from '../../store/flowStore';

interface SimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SimulationModal({ isOpen, onClose }: SimulationModalProps) {
  const flowDefinition = useFlowStore((state) => state.flowDefinition);
  const execution = useFlowStore((state) => state.execution);
  const mockData = useFlowStore((state) => state.mockData);
  const { setMockInputData, clearMockData, setStepMode } = useFlowStore();
  const inputs = flowDefinition.inputs || [];
  const [mockEditingValues, setMockEditingValues] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const getMockInputValue = (inputName: string): string => {
    if (mockEditingValues[inputName] !== undefined) {
      return mockEditingValues[inputName];
    }
    const mockValue = mockData.inputs[inputName];
    if (mockValue !== undefined) {
      return typeof mockValue === 'string' ? mockValue : JSON.stringify(mockValue);
    }
    return '';
  };

  const handleMockInputChange = (inputName: string, value: string) => {
    setMockEditingValues(prev => ({ ...prev, [inputName]: value }));
  };

  const handleMockInputBlur = (inputName: string, inputType: string) => {
    const value = mockEditingValues[inputName];
    if (value === undefined) return;

    try {
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

      if (parsedValue !== undefined) {
        setMockInputData(inputName, parsedValue);
      }
    } catch (error) {
      alert(`Invalid JSON for ${inputName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleClearMockData = () => {
    if (confirm('Clear all input values?')) {
      clearMockData();
      setMockEditingValues({});
    }
  };

  const validateInputs = (): boolean => {
    // Check if all required inputs have values in mock data
    for (const input of inputs) {
      if (input.required && mockData.inputs[input.name] === undefined) {
        alert(`Required input "${input.name}" must have a value`);
        return false;
      }
    }
    return true;
  };

  const handleSimulate = async () => {
    if (!validateInputs()) return;

    const { FlowSimulator } = await import('../../services/flowSimulator');
    const {
      startExecution,
      updateNodeExecutionState,
      addExecutionLog,
      completeExecution,
      stopExecution,
      pauseExecution
    } = useFlowStore.getState();

    // Use mock data as the input values
    startExecution(mockData.inputs);

    // Close the modal
    onClose();

    try {
      const nodes = useFlowStore.getState().nodes;
      const edges = useFlowStore.getState().edges;
      const currentMockData = useFlowStore.getState().mockData;
      const stepMode = execution.stepMode;

      const simulator = new FlowSimulator(nodes, edges, {
        inputs: mockData.inputs,
        variables: {},
        mockData: currentMockData,
        updateNodeState: updateNodeExecutionState,
        getNodeState: (nodeId: string) => useFlowStore.getState().execution.nodeStates[nodeId],
        addLog: addExecutionLog,
        isPaused: () => useFlowStore.getState().execution.status === 'paused',
        stepMode,
      });

      // In step mode, pause immediately after starting
      if (stepMode) {
        pauseExecution();
      }

      const result = await simulator.simulate();
      completeExecution(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addExecutionLog('flow', `Simulation failed: ${errorMessage}`, 'error');
      stopExecution();
    }
  };

  const mockInputCount = Object.keys(mockData.inputs).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">Configure Simulation</h2>
            <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded">
              {flowDefinition.flow}
            </span>
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
          {/* Step Mode Toggle */}
          <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={execution.stepMode}
                onChange={(e) => setStepMode(e.target.checked)}
                className="w-4 h-4 text-purple-600 bg-white border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">Step-by-Step Mode</span>
                  {execution.stepMode && (
                    <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-0.5">
                  Pause at each node and step through manually
                </p>
              </div>
            </label>
          </div>

          {/* Input Configuration */}
          {inputs.length === 0 ? (
            <div className="p-6 text-center text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="font-medium mb-1">No inputs required</p>
              <p className="text-sm">This flow doesn't require any input values</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">Flow Inputs</h3>
                {mockInputCount > 0 && (
                  <span className="text-xs font-medium text-gray-600">
                    {mockInputCount} of {inputs.length} configured
                  </span>
                )}
              </div>

              {inputs.map((input: any) => {
                const inputValue = getMockInputValue(input.name);
                const isMocked = mockData.inputs[input.name] !== undefined;

                return (
                  <div key={input.name} className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <label className="font-medium text-gray-900 text-sm">
                          {input.name}
                        </label>
                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                          {input.type || 'string'}
                        </span>
                        {input.required && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                            required
                          </span>
                        )}
                        {isMocked && (
                          <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded">
                            ✓ set
                          </span>
                        )}
                      </div>
                    </div>

                    {input.description && (
                      <p className="text-xs text-gray-600 mb-2">{input.description}</p>
                    )}

                    {input.type === 'boolean' ? (
                      <select
                        value={inputValue}
                        onChange={(e) => {
                          handleMockInputChange(input.name, e.target.value);
                          handleMockInputBlur(input.name, input.type);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Select --</option>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : input.type === 'array' || input.type === 'object' ? (
                      <textarea
                        value={inputValue}
                        onChange={(e) => handleMockInputChange(input.name, e.target.value)}
                        onBlur={() => handleMockInputBlur(input.name, input.type)}
                        placeholder={input.type === 'array' ? '["item1", "item2"]' : '{"key": "value"}'}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <input
                        type={input.type === 'number' ? 'number' : 'text'}
                        value={inputValue}
                        onChange={(e) => handleMockInputChange(input.name, e.target.value)}
                        onBlur={() => handleMockInputBlur(input.name, input.type)}
                        placeholder={`Enter ${input.type || 'string'} value...`}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-2">
            {mockInputCount > 0 && (
              <button
                onClick={handleClearMockData}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSimulate}
              className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 flex items-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Simulation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
