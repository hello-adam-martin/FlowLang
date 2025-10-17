import { useFlowStore } from '../../store/flowStore';

export default function StartNodeProperties() {
  const flowDefinition = useFlowStore((state) => state.flowDefinition);
  const execution = useFlowStore((state) => state.execution);
  const triggers = flowDefinition.triggers || [];

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
      {/* Execution Controls Section */}
      {execution.status !== 'idle' && (
        <div className="pb-6 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Simulation Controls</h3>
          <p className="text-xs text-gray-600 mb-4">
            Control the running simulation
          </p>

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
      )}

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
