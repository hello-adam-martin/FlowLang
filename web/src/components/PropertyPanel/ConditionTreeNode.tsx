import type { ConditionNode, SimpleConditionNode, QuantifierConditionNode } from './conditionTreeTypes';
import VariableSelector from './VariableSelector';

interface ConditionTreeNodeProps {
  node: ConditionNode;
  depth: number;
  currentNodeId: string;
  onUpdate: (nodeId: string, updater: (node: ConditionNode) => ConditionNode) => void;
  onDelete: (nodeId: string) => void;
  onAddChild: (parentId: string, type: 'simple' | 'quantifier') => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export default function ConditionTreeNode({
  node,
  depth,
  currentNodeId,
  onUpdate,
  onDelete,
  onAddChild,
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false
}: ConditionTreeNodeProps) {
  // Color coding by depth
  const bgColors = [
    'bg-amber-50',      // depth 0
    'bg-blue-50',       // depth 1
    'bg-green-50',      // depth 2
    'bg-red-50'         // depth 3+ (warning)
  ];
  const borderColors = [
    'border-amber-200',
    'border-blue-200',
    'border-green-200',
    'border-red-200'
  ];

  const bgColor = bgColors[Math.min(depth, 3)];
  const borderColor = borderColors[Math.min(depth, 3)];

  // Simple condition node
  if (node.type === 'simple') {
    return (
      <div
        className={`flex items-start gap-2 p-2 rounded border ${borderColor} ${bgColor}`}
        style={{ marginLeft: `${depth * 20}px` }}
      >
        <span className="text-sm mt-2">📋</span>

        <div className="flex-1">
          <VariableSelector
            value={node.value}
            onChange={(value) => onUpdate(node.id, (n) => ({ ...n, value } as SimpleConditionNode))}
            placeholder="${inputs.value} == 'expected'"
            currentNodeId={currentNodeId}
            className="font-mono text-sm"
          />
        </div>

        <div className="flex gap-1 flex-shrink-0">
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-white rounded disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move up"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-white rounded disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move down"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          <button
            onClick={() => onDelete(node.id)}
            className="p-1 text-red-500 hover:text-red-700 hover:bg-white rounded"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Quantifier node
  const quantifierIcons = {
    all: '🔗',
    any: '🔀',
    none: '🚫'
  };

  const quantifierLabels = {
    all: 'ALL must be true',
    any: 'ANY must be true',
    none: 'NONE must be true'
  };

  const handleMoveChild = (childIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? childIndex - 1 : childIndex + 1;
    if (targetIndex < 0 || targetIndex >= node.children.length) return;

    onUpdate(node.id, (n) => {
      if (n.type !== 'quantifier') return n;

      const newChildren = [...n.children];
      [newChildren[childIndex], newChildren[targetIndex]] = [newChildren[targetIndex], newChildren[childIndex]];

      return { ...n, children: newChildren };
    });
  };

  return (
    <div style={{ marginLeft: `${depth * 20}px` }}>
      <div className={`p-3 rounded border ${borderColor} ${bgColor} space-y-3`}>
        {/* Quantifier header */}
        <div className="flex items-center gap-2">
          <span className="text-base">{quantifierIcons[node.quantifier]}</span>

          <select
            value={node.quantifier}
            onChange={(e) => onUpdate(node.id, (n) => ({
              ...n,
              quantifier: e.target.value as 'all' | 'any' | 'none'
            } as QuantifierConditionNode))}
            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">ALL must be true (AND)</option>
            <option value="any">ANY must be true (OR)</option>
            <option value="none">NONE must be true (NOT)</option>
          </select>

          {depth > 0 && (
            <div className="flex gap-1">
              {onMoveUp && (
                <button
                  onClick={onMoveUp}
                  disabled={isFirst}
                  className="p-1 text-gray-500 hover:text-gray-700 hover:bg-white rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
              )}
              {onMoveDown && (
                <button
                  onClick={onMoveDown}
                  disabled={isLast}
                  className="p-1 text-gray-500 hover:text-gray-700 hover:bg-white rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => onDelete(node.id)}
                className="p-1 text-red-500 hover:text-red-700 hover:bg-white rounded"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Children */}
        <div className="space-y-2 ml-4">
          {node.children.map((child, index) => (
            <ConditionTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              currentNodeId={currentNodeId}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onMoveUp={() => handleMoveChild(index, 'up')}
              onMoveDown={() => handleMoveChild(index, 'down')}
              isFirst={index === 0}
              isLast={index === node.children.length - 1}
            />
          ))}

          {/* Validation: show warning if no children */}
          {node.children.length === 0 && (
            <div className="text-xs text-red-600 px-2 py-1 bg-red-50 rounded border border-red-200">
              ⚠️ Quantifier must have at least one condition
            </div>
          )}
        </div>

        {/* Add buttons */}
        <div className="flex gap-2 ml-4">
          <button
            onClick={() => onAddChild(node.id, 'simple')}
            className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded text-xs transition-colors"
          >
            + Add Condition
          </button>
          <button
            onClick={() => onAddChild(node.id, 'quantifier')}
            className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded text-xs transition-colors"
          >
            + Add Nested
          </button>
        </div>

        {/* Depth warning */}
        {depth >= 2 && (
          <div className="text-xs text-orange-600 px-2 py-1 bg-orange-50 rounded border border-orange-200 ml-4">
            ⚠️ Deep nesting (level {depth + 1}) may be hard to understand
          </div>
        )}
      </div>
    </div>
  );
}
