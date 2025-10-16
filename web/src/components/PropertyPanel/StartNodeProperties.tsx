import { useState, useEffect } from 'react';
import { useFlowStore } from '../../store/flowStore';

export default function StartNodeProperties() {
  const flowDefinition = useFlowStore((state) => state.flowDefinition);
  const execution = useFlowStore((state) => state.execution);
  const triggers = flowDefinition.triggers || [];
  const inputs = flowDefinition.inputs || [];
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize input values with defaults
  useEffect(() => {
    const initialValues: Record<string, any> = {};
    inputs.forEach((input: any) => {
      initialValues[input.name] = input.default !== undefined ? input.default : '';
    });
    setInputValues(initialValues);
    setErrors({});
  }, [inputs]);

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

    inputs.forEach((input: any) => {
      if (input.required && !inputValues[input.name]) {
        newErrors[input.name] = 'This field is required';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

    startExecution(inputValues);

    try {
      const nodes = useFlowStore.getState().nodes;
      const edges = useFlowStore.getState().edges;
      const stepMode = execution.stepMode;

      const simulator = new FlowSimulator(nodes, edges, {
        inputs: inputValues,
        variables: {},
        updateNodeState: updateNodeExecutionState,
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

  const handleStepNext = () => {
    const { resumeExecution } = useFlowStore.getState();
    resumeExecution();
  };

  const handlePause = () => {
    const { pauseExecution } = useFlowStore.getState();
    pauseExecution();
  };

  const handleResume = () => {
    const { resumeExecution } = useFlowStore.getState();
    resumeExecution();
  };

  const handleStop = () => {
    const { stopExecution } = useFlowStore.getState();
    stopExecution();
  };

  return (
    <div className="space-y-6">
      {/* Simulate Section */}
      <div className="pb-6 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Simulate Flow</h3>
        <p className="text-xs text-gray-600 mb-4">
          {inputs.length === 0
            ? 'Run a test simulation of your flow'
            : 'Provide test inputs and run a simulation'}
        </p>

        {/* Step Mode Toggle */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={execution.stepMode}
              onChange={(e) => {
                const { setStepMode } = useFlowStore.getState();
                setStepMode(e.target.checked);
              }}
              disabled={execution.status === 'running'}
              className="w-4 h-4 text-purple-600 bg-white border-gray-300 rounded focus:ring-purple-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">Step Mode</span>
                {execution.stepMode && (
                  <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                Pause execution at each node to step through manually
              </p>
            </div>
          </label>
        </div>

        {/* Flow Inputs */}
        {inputs.length > 0 && (
          <div className="space-y-4 mb-4">
            {inputs.map((input: any, index: number) => (
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
                    disabled={execution.status === 'running' || execution.status === 'paused'}
                    className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 ${
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
                    disabled={execution.status === 'running' || execution.status === 'paused'}
                    className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 ${
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
                    disabled={execution.status === 'running' || execution.status === 'paused'}
                    className={`w-full px-3 py-2 border rounded-md font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 ${
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
                    disabled={execution.status === 'running' || execution.status === 'paused'}
                    className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 ${
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

        {/* Primary Action Button - Dynamic based on status */}
        {execution.status === 'idle' || execution.status === 'completed' || execution.status === 'error' ? (
          <button
            onClick={handleSimulate}
            className="w-full px-4 py-3 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 flex items-center justify-center gap-2 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Simulate Flow
          </button>
        ) : null}

        {/* Step Controls - Show when in step mode (paused or running) */}
        {execution.stepMode && (execution.status === 'paused' || execution.status === 'running') && (
          <div className="space-y-2">
            <button
              onClick={handleStepNext}
              disabled={execution.status === 'running'}
              className="w-full px-4 py-3 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
              {execution.status === 'running' ? 'Processing...' : 'Step Next'}
            </button>
            <button
              onClick={handleStop}
              className="w-full px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 border border-red-200 flex items-center justify-center gap-2 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Stop
            </button>
          </div>
        )}

        {/* Pause/Resume Controls - Show when running in non-step mode */}
        {execution.status === 'running' && !execution.stepMode && (
          <div className="space-y-2">
            <button
              onClick={handlePause}
              className="w-full px-4 py-3 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 flex items-center justify-center gap-2 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Pause
            </button>
            <button
              onClick={handleStop}
              className="w-full px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 border border-red-200 flex items-center justify-center gap-2 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Stop
            </button>
          </div>
        )}

        {/* Resume Controls - Show when paused in non-step mode */}
        {execution.status === 'paused' && !execution.stepMode && (
          <div className="space-y-2">
            <button
              onClick={handleResume}
              className="w-full px-4 py-3 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 flex items-center justify-center gap-2 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Resume
            </button>
            <button
              onClick={handleStop}
              className="w-full px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 border border-red-200 flex items-center justify-center gap-2 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Stop
            </button>
          </div>
        )}
      </div>

      {/* Flow Triggers Section */}
      <div className="pb-6 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Flow Triggers</h3>
        <p className="text-xs text-gray-600 mb-4">
          Define how this flow will be executed
        </p>

        {triggers.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-sm font-medium text-amber-900 mb-1">No triggers configured</p>
                <p className="text-xs text-amber-700 mb-3">
                  This flow can only be executed manually via API or command line.
                </p>
                <button
                  onClick={() => {
                    // TODO: Open flow settings modal to add triggers
                    console.log('Open flow settings to add triggers');
                  }}
                  className="text-xs font-medium text-amber-800 hover:text-amber-900 underline"
                >
                  Add a trigger in Flow Settings
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {triggers.map((trigger: any, index: number) => (
              <div
                key={index}
                className="bg-blue-50 border border-blue-200 rounded-lg p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">
                    {trigger.type === 'webhook' ? '🔗' :
                     trigger.type === 'schedule' ? '⏰' : '🎯'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-blue-900 uppercase">
                        {trigger.type || 'webhook'}
                      </span>
                      {trigger.method && (
                        <span className="text-xs font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          {trigger.method}
                        </span>
                      )}
                    </div>

                    {/* Webhook details */}
                    {trigger.type === 'webhook' && trigger.path && (
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Endpoint:</p>
                          <code className="text-xs font-mono bg-white px-2 py-1 rounded border border-blue-200 block truncate">
                            {trigger.path}
                          </code>
                        </div>

                        {trigger.auth && (
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Authentication:</p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono bg-white px-2 py-1 rounded border border-blue-200">
                                {trigger.auth.type === 'api_key' ? '🔑 API Key' :
                                 trigger.auth.type === 'bearer' ? '🎫 Bearer Token' :
                                 '🔓 None'}
                              </span>
                              {trigger.auth.header && (
                                <span className="text-xs text-gray-500">
                                  ({trigger.auth.header})
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {trigger.input_mapping && (
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Input Mapping:</p>
                            <span className="text-xs font-mono bg-white px-2 py-1 rounded border border-blue-200">
                              {trigger.input_mapping}
                            </span>
                          </div>
                        )}

                        {trigger.async !== undefined && (
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Execution Mode:</p>
                            <span className="text-xs font-mono bg-white px-2 py-1 rounded border border-blue-200">
                              {trigger.async ? '⚡ Async (immediate response)' : '⏳ Sync (wait for completion)'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Schedule details */}
                    {trigger.type === 'schedule' && trigger.cron && (
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Schedule:</p>
                        <code className="text-xs font-mono bg-white px-2 py-1 rounded border border-blue-200 block">
                          {trigger.cron}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Manual Execution</h3>
        <p className="text-xs text-gray-600 mb-3">
          You can also execute this flow manually via:
        </p>
        <div className="space-y-2 text-xs">
          <div className="bg-gray-50 rounded p-2 font-mono">
            <span className="text-gray-500">POST</span> /flows/{flowDefinition.flow || 'FlowName'}/execute
          </div>
          <div className="bg-gray-50 rounded p-2 font-mono">
            flowlang execute flow.yaml
          </div>
        </div>
      </div>
    </div>
  );
}
