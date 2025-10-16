import FlowListItem from './FlowListItem';
import type { FlowData } from '../../types/project';

interface FlowListProps {
  flows: Record<string, FlowData>;
  currentFlowId: string | null;
  onSelectFlow: (flowId: string) => void;
  onRenameFlow: (flowId: string, newName: string) => void;
  onDuplicateFlow: (flowId: string) => void;
  onDeleteFlow: (flowId: string) => void;
}

export default function FlowList({
  flows,
  currentFlowId,
  onSelectFlow,
  onRenameFlow,
  onDuplicateFlow,
  onDeleteFlow,
}: FlowListProps) {
  // Sort flows by modified date (most recent first)
  const sortedFlowIds = Object.keys(flows).sort((a, b) => {
    return flows[b].metadata.modified - flows[a].metadata.modified;
  });

  if (sortedFlowIds.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        <p>No flows yet</p>
        <p className="text-xs mt-1">Click "New Flow" to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sortedFlowIds.map((flowId) => (
        <FlowListItem
          key={flowId}
          flow={flows[flowId]}
          isActive={flowId === currentFlowId}
          onSelect={() => onSelectFlow(flowId)}
          onRename={(newName) => onRenameFlow(flowId, newName)}
          onDuplicate={() => onDuplicateFlow(flowId)}
          onDelete={() => onDeleteFlow(flowId)}
        />
      ))}
    </div>
  );
}
