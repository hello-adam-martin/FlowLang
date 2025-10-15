import { useState } from 'react';
import type { Step } from '../../types/flow';

interface OnCancelEditorProps {
  onCancelSteps: Step[];
  onChange: (steps: Step[]) => void;
}

export default function OnCancelEditor({ onCancelSteps, onChange }: OnCancelEditorProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const handleAddStep = () => {
    const newStep: Step = {
      task: '',
      id: `cleanup_${Date.now()}`,
      inputs: {},
    };
    onChange([...onCancelSteps, newStep]);
  };

  const handleRemoveStep = (index: number) => {
    onChange(onCancelSteps.filter((_, i) => i !== index));
  };

  const handleUpdateStep = (index: number, updates: Partial<Step>) => {
    const updated = [...onCancelSteps];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...onCancelSteps];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === onCancelSteps.length - 1) return;
    const updated = [...onCancelSteps];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(updated);
  };

  const toggleExpanded = (index: number) => {
    setExpandedStep(expandedStep === index ? null : index);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Cleanup Steps (on_cancel)</h3>
        <p className="text-sm text-gray-600 mb-4">
          These steps execute when the flow is cancelled. They run in <strong>LIFO order</strong> (last added runs first),
          like a cleanup stack. Use them to release resources, rollback transactions, or notify external systems.
        </p>
      </div>

      {/* Cleanup Steps List */}
      {onCancelSteps.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
          <p className="text-sm text-gray-500 mb-2">No cleanup steps configured</p>
          <p className="text-xs text-gray-400 mb-4">
            Add cleanup tasks to run when flow is cancelled
          </p>
          <button
            onClick={handleAddStep}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 transition-colors"
          >
            + Add Cleanup Step
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {onCancelSteps.map((step, index) => (
            <div
              key={step.id || index}
              className="border border-gray-200 rounded-lg bg-white overflow-hidden"
            >
              {/* Step Header */}
              <div className="flex items-center gap-2 p-3 bg-orange-50 border-b border-orange-100">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up (runs later)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === onCancelSteps.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down (runs sooner)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                <span className="text-xs font-mono text-orange-600 font-semibold">
                  #{onCancelSteps.length - index}
                </span>

                <input
                  type="text"
                  value={step.task || ''}
                  onChange={(e) => handleUpdateStep(index, { task: e.target.value })}
                  placeholder="TaskName"
                  className="flex-1 px-2 py-1 text-sm font-mono border border-orange-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />

                <button
                  onClick={() => toggleExpanded(index)}
                  className="p-1 text-gray-500 hover:text-gray-700"
                  title={expandedStep === index ? 'Collapse' : 'Expand'}
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${expandedStep === index ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <button
                  onClick={() => handleRemoveStep(index)}
                  className="p-1 text-red-500 hover:text-red-700"
                  title="Remove step"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Step Details (Expanded) */}
              {expandedStep === index && (
                <div className="p-3 space-y-3 bg-gray-50">
                  {/* Step ID */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Step ID
                    </label>
                    <input
                      type="text"
                      value={step.id || ''}
                      onChange={(e) => handleUpdateStep(index, { id: e.target.value })}
                      placeholder="cleanup_step_id"
                      className="w-full px-2 py-1 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  {/* Inputs */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Inputs (JSON)
                    </label>
                    <textarea
                      value={JSON.stringify(step.inputs || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const inputs = JSON.parse(e.target.value);
                          handleUpdateStep(index, { inputs });
                        } catch {
                          // Invalid JSON, ignore
                        }
                      }}
                      placeholder='{\n  "key": "value"\n}'
                      className="w-full px-2 py-1 text-xs font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                      rows={4}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      value={step.description || ''}
                      onChange={(e) => handleUpdateStep(index, { description: e.target.value })}
                      placeholder="What this cleanup step does"
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add Step Button */}
          <button
            onClick={handleAddStep}
            className="w-full px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 border-2 border-dashed border-orange-300 rounded-lg hover:bg-orange-100 transition-colors"
          >
            + Add Cleanup Step
          </button>
        </div>
      )}

      {/* Info Box */}
      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-xs font-medium text-yellow-900 mb-2">LIFO Execution Order:</p>
        <ul className="text-xs text-yellow-800 space-y-1">
          <li>• Steps execute in <strong>reverse order</strong> (last added runs first)</li>
          <li>• Like a cleanup stack - most recent allocations freed first</li>
          <li>• Example: Reserve inventory → Process payment → Cleanup runs: Refund payment → Release inventory</li>
        </ul>
      </div>

      {/* Example */}
      {onCancelSteps.length === 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs font-medium text-blue-900 mb-2">Common Use Cases:</p>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• <strong>ReleaseInventory</strong> - Free reserved stock</li>
            <li>• <strong>RefundPayment</strong> - Reverse payment transactions</li>
            <li>• <strong>CancelExternalOrder</strong> - Notify external systems</li>
            <li>• <strong>SendCancellationEmail</strong> - Inform customers</li>
            <li>• <strong>RollbackDatabase</strong> - Undo database changes</li>
          </ul>
        </div>
      )}
    </div>
  );
}
