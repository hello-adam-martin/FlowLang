import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';
import { useFlowStore } from '../../store/flowStore';

const StartNode = memo(({ id, data, selected }: NodeProps<FlowNodeData>) => {
  const flowDefinition = useFlowStore((state) => state.flowDefinition);
  const execution = useFlowStore((state) => state.execution);
  const setShowSimulationModal = useFlowStore((state) => state.setShowSimulationModal);
  const triggers = flowDefinition.triggers || [];

  const handleSimulate = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Open simulation modal
    setShowSimulationModal(true);
  };

  // Determine button state based on execution status
  const getButtonState = () => {
    switch (execution.status) {
      case 'running':
        return {
          label: 'Running...',
          icon: '⟳',
          bgColor: 'bg-yellow-500',
          hoverColor: 'hover:bg-yellow-600',
          disabled: true,
        };
      case 'paused':
        return {
          label: 'Paused',
          icon: '⏸',
          bgColor: 'bg-purple-500',
          hoverColor: 'hover:bg-purple-600',
          disabled: true,
        };
      case 'completed':
        return {
          label: 'Simulate',
          icon: '▶',
          bgColor: 'bg-green-500',
          hoverColor: 'hover:bg-green-600',
          disabled: false,
        };
      case 'error':
        return {
          label: 'Simulate',
          icon: '▶',
          bgColor: 'bg-green-500',
          hoverColor: 'hover:bg-green-600',
          disabled: false,
        };
      default: // idle
        return {
          label: 'Simulate',
          icon: '▶',
          bgColor: 'bg-green-500',
          hoverColor: 'hover:bg-green-600',
          disabled: false,
        };
    }
  };

  const buttonState = getButtonState();

  return (
    <>
      <div
        className={`rounded-xl border transition-all shadow-sm bg-white overflow-hidden ${
          selected ? 'border-blue-500 ring-2 ring-blue-300 shadow-md' : 'border-gray-200'
        }`}
        style={{ minWidth: '180px' }}
      >
        {/* Output handle (right side) - circle shape */}
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className="!w-3 !h-3 !border-2 !border-white !bg-gray-300 !rounded-full hover:!bg-gray-400 transition-all"
        />

        {/* Start Section - at top */}
        <div className="px-3 py-2 bg-gray-50">
          <div className="flex items-center justify-center">
            <span className="text-xs font-medium text-gray-700">Start</span>
          </div>
        </div>

        {/* Triggers Section - only show if triggers are configured */}
        {triggers.length > 0 && (
          <div className="px-3 py-2 border-t border-gray-200 bg-blue-50">
            <div className="flex items-start gap-2">
              <span className="text-xs text-blue-600">🌐</span>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium text-blue-900 mb-0.5">
                  {triggers.length} trigger{triggers.length !== 1 ? 's' : ''} active
                </div>
                <div className="text-[9px] text-blue-700 space-y-0.5">
                  {triggers.slice(0, 2).map((trigger, idx) => (
                    <div key={idx} className="truncate">
                      • {trigger.type}
                      {trigger.type === 'webhook' && trigger.path ? ` ${trigger.path}` : ''}
                    </div>
                  ))}
                  {triggers.length > 2 && (
                    <div className="text-blue-600">
                      +{triggers.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Simulate Button Section - at bottom */}
        <button
          onClick={handleSimulate}
          disabled={buttonState.disabled}
          className={`w-full px-3 py-2 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all border-t border-gray-200 ${buttonState.bgColor} ${buttonState.hoverColor} disabled:opacity-70 disabled:cursor-not-allowed`}
        >
          <span className="text-sm">{buttonState.icon}</span>
          <span>{buttonState.label}</span>
        </button>
      </div>
    </>
  );
});

StartNode.displayName = 'StartNode';

export default StartNode;
