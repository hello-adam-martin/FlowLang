interface ExecutionStatusDisplayProps {
  nodeExecutionState: any; // The execution state from the store
}

export default function ExecutionStatusDisplay({ nodeExecutionState }: ExecutionStatusDisplayProps) {
  if (!nodeExecutionState) return null;

  return (
    <div className="p-4 rounded-lg border-2 bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <span className="text-blue-600">⚡</span>
        Execution Status
      </h3>

      {/* Status Badge */}
      <div className="mb-3">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
          nodeExecutionState.state === 'pending' ? 'bg-purple-100 text-purple-700 border border-purple-300' :
          nodeExecutionState.state === 'running' ? 'bg-yellow-100 text-yellow-700 border border-yellow-300' :
          nodeExecutionState.state === 'completed' ? 'bg-green-100 text-green-700 border border-green-300' :
          nodeExecutionState.state === 'error' ? 'bg-red-100 text-red-700 border border-red-300' :
          nodeExecutionState.state === 'skipped' ? 'bg-gray-100 text-gray-600 border border-gray-300' :
          'bg-blue-100 text-blue-700 border border-blue-300'
        }`}>
          {nodeExecutionState.state === 'pending' && '⏸'}
          {nodeExecutionState.state === 'running' && '⟳'}
          {nodeExecutionState.state === 'completed' && '✓'}
          {nodeExecutionState.state === 'error' && '✗'}
          {nodeExecutionState.state === 'skipped' && '⊘'}
          <span className="uppercase">{nodeExecutionState.state}</span>
        </span>
      </div>

      {/* Timing Information */}
      {nodeExecutionState.startTime && (
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 font-medium">Started:</span>
            <span className="text-gray-900 font-mono">
              {new Date(nodeExecutionState.startTime).toLocaleTimeString()}
            </span>
          </div>
          {nodeExecutionState.endTime && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">Ended:</span>
                <span className="text-gray-900 font-mono">
                  {new Date(nodeExecutionState.endTime).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-300">
                <span className="text-gray-600 font-semibold">Duration:</span>
                <span className="text-blue-700 font-bold">
                  {((nodeExecutionState.endTime - nodeExecutionState.startTime) / 1000).toFixed(2)}s
                </span>
              </div>
            </>
          )}
          {!nodeExecutionState.endTime && nodeExecutionState.state === 'running' && (
            <div className="text-yellow-600 font-medium animate-pulse">
              Running...
            </div>
          )}
        </div>
      )}

      {/* Input Data */}
      {nodeExecutionState.inputs && Object.keys(nodeExecutionState.inputs).length > 0 && (
        <div className="mt-3 pt-3 border-t border-blue-300">
          <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Input Data:
          </h4>
          <div className="text-xs font-mono bg-white p-2 rounded border border-blue-200 overflow-x-auto max-h-32 overflow-y-auto">
            <pre className="inline">{`{`}</pre>
            {Object.entries(nodeExecutionState.inputs).map(([key, value], index, arr) => (
              <div key={key} className="ml-4">
                <pre className="inline">{`"${key}": `}</pre>
                <pre className="inline">{JSON.stringify(value)}</pre>
                {nodeExecutionState.inputSources?.[key] && (
                  <span className="text-gray-400 ml-2">{`// from ${nodeExecutionState.inputSources[key]}`}</span>
                )}
                {index < arr.length - 1 && <pre className="inline">,</pre>}
              </div>
            ))}
            <pre className="inline">{`}`}</pre>
          </div>
        </div>
      )}

      {/* Output Data */}
      {nodeExecutionState.output && (
        <div className="mt-3 pt-3 border-t border-blue-300">
          <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Output Data:
          </h4>
          <pre className="text-xs font-mono bg-white p-2 rounded border border-blue-200 overflow-x-auto max-h-32 overflow-y-auto">
            {JSON.stringify(nodeExecutionState.output, null, 2)}
          </pre>
        </div>
      )}

      {/* Error Information */}
      {nodeExecutionState.error && (
        <div className="mt-3 pt-3 border-t border-red-300">
          <h4 className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Error:
          </h4>
          <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
            {nodeExecutionState.error}
          </div>
        </div>
      )}
    </div>
  );
}
