import { memo } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';
import type { HandleProps } from '@xyflow/react';

interface QuickConnectHandleProps extends Omit<HandleProps, 'type'> {
  nodeId: string;
}

const QuickConnectHandle = memo(({ nodeId, position, id, ...props }: QuickConnectHandleProps) => {
  // Check if this handle is connected
  const isConnected = useStore((state) => {
    return state.edges.some(
      (edge) => edge.source === nodeId && edge.sourceHandle === id
    );
  });

  return (
    <>
      <Handle
        type="source"
        position={position}
        id={id}
        {...props}
        className="!bg-gray-300 !w-3 !h-3 !border-2 !border-white hover:!bg-gray-400 transition-all"
      />

      {/* Connection line and + button - only show when NOT connected */}
      {!isConnected && position === Position.Right && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: 'calc(100% + 6px)',
            top: 'calc(50% - 1px)',
            transform: 'translateY(-50%)',
            zIndex: 1000,
          }}
        >
          {/* Connection Line */}
          <div
            className="bg-gray-300"
            style={{
              width: '40px',
              height: '2px',
            }}
          />

          {/* Plus Button at end of line */}
          <button
            className="absolute bg-gray-300 hover:bg-gray-400 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-lg transition-all border-2 border-white pointer-events-auto"
            style={{
              left: '40px',
              top: '50%',
              transform: 'translateY(-50%)',
            }}
            title="Add next step"
          >
            +
          </button>
        </div>
      )}
    </>
  );
});

QuickConnectHandle.displayName = 'QuickConnectHandle';

export default QuickConnectHandle;
