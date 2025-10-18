import { useState, useEffect } from 'react';
import ConditionTreeNode from './ConditionTreeNode';
import type { ConditionNode, SimpleConditionNode, QuantifierConditionNode } from './conditionTreeTypes';

interface QuantifiedConditionEditorProps {
  value: any; // The condition value from step.if
  onChange: (value: any) => void;
  currentNodeId: string;
}

// Helper to generate unique IDs
let idCounter = 0;
function generateId(): string {
  return `cond_${Date.now()}_${idCounter++}`;
}

// Convert flat quantified condition to tree structure
function flatToTree(condition: any): QuantifierConditionNode | null {
  if (!condition || typeof condition !== 'object') return null;

  const quantifier = Object.keys(condition)[0] as 'all' | 'any' | 'none';
  const items = condition[quantifier];

  if (!Array.isArray(items)) return null;

  const children: ConditionNode[] = items.map(item => {
    // Check if item is a nested quantifier (object with all/any/none key)
    if (typeof item === 'object' && item !== null) {
      const nestedTree = flatToTree(item);
      if (nestedTree) return nestedTree;
    }

    // Otherwise it's a simple condition (string)
    return {
      type: 'simple',
      id: generateId(),
      value: typeof item === 'string' ? item : ''
    } as SimpleConditionNode;
  });

  return {
    type: 'quantifier',
    id: generateId(),
    quantifier,
    children
  };
}

// Convert tree structure to YAML-compatible format
function treeToYaml(node: ConditionNode): any {
  if (node.type === 'simple') {
    return node.value;
  }

  return {
    [node.quantifier]: node.children.map(child => treeToYaml(child))
  };
}

export default function QuantifiedConditionEditor({ value, onChange, currentNodeId }: QuantifiedConditionEditorProps) {
  const [tree, setTree] = useState<QuantifierConditionNode | null>(() => flatToTree(value));

  // Helper to update tree and notify parent
  const updateTree = (newTree: QuantifierConditionNode) => {
    setTree(newTree);
    const yamlValue = treeToYaml(newTree);
    onChange(yamlValue);
  };

  const handleQuantifierChange = (newQuantifier: 'all' | 'any' | 'none') => {
    if (tree) {
      updateTree({ ...tree, quantifier: newQuantifier });
    }
  };

  const updateNode = (nodeId: string, updater: (node: ConditionNode) => ConditionNode) => {
    if (!tree) return;

    const updateInTree = (node: ConditionNode): ConditionNode => {
      if (node.id === nodeId) {
        return updater(node);
      }

      if (node.type === 'quantifier') {
        return {
          ...node,
          children: node.children.map(child => updateInTree(child))
        };
      }

      return node;
    };

    updateTree(updateInTree(tree) as QuantifierConditionNode);
  };

  const deleteNode = (nodeId: string) => {
    if (!tree) return;

    const deleteFromTree = (node: ConditionNode): ConditionNode | null => {
      if (node.type === 'quantifier') {
        const newChildren = node.children
          .map(child => deleteFromTree(child))
          .filter((child): child is ConditionNode => child !== null);

        return {
          ...node,
          children: newChildren
        };
      }

      return node;
    };

    // Don't allow deleting root
    if (tree.id === nodeId) return;

    // Delete from children
    const updated = deleteFromTree(tree) as QuantifierConditionNode;
    updateTree(updated);
  };

  const addConditionToParent = (parentId: string, type: 'simple' | 'quantifier') => {
    if (!tree) return;

    const newNode: ConditionNode = type === 'simple'
      ? {
          type: 'simple',
          id: generateId(),
          value: ''
        }
      : {
          type: 'quantifier',
          id: generateId(),
          quantifier: 'all',
          children: [{
            type: 'simple',
            id: generateId(),
            value: ''
          }]
        };

    updateNode(parentId, (node) => {
      if (node.type === 'quantifier') {
        return {
          ...node,
          children: [...node.children, newNode]
        };
      }
      return node;
    });
  };

  if (!tree) {
    return (
      <div className="text-sm text-gray-500">
        Invalid quantified condition
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Root quantifier type selector */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Condition Type
        </label>
        <select
          value={tree.quantifier}
          onChange={(e) => handleQuantifierChange(e.target.value as 'all' | 'any' | 'none')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        >
          <option value="all">ALL must be true (AND)</option>
          <option value="any">ANY must be true (OR)</option>
          <option value="none">NONE must be true (NOT)</option>
        </select>
      </div>

      {/* Render tree */}
      <div className="space-y-2">
        {tree.children.map((child, index) => (
          <ConditionTreeNode
            key={child.id}
            node={child}
            depth={0}
            currentNodeId={currentNodeId}
            onUpdate={updateNode}
            onDelete={deleteNode}
            onAddChild={addConditionToParent}
            onMoveUp={() => {
              if (index > 0) {
                const newChildren = [...tree.children];
                [newChildren[index], newChildren[index - 1]] = [newChildren[index - 1], newChildren[index]];
                updateTree({ ...tree, children: newChildren });
              }
            }}
            onMoveDown={() => {
              if (index < tree.children.length - 1) {
                const newChildren = [...tree.children];
                [newChildren[index], newChildren[index + 1]] = [newChildren[index + 1], newChildren[index]];
                updateTree({ ...tree, children: newChildren });
              }
            }}
            isFirst={index === 0}
            isLast={index === tree.children.length - 1}
          />
        ))}

        {/* Validation: show warning if no children */}
        {tree.children.length === 0 && (
          <div className="text-xs text-red-600 px-2 py-1 bg-red-50 rounded border border-red-200">
            ⚠️ Quantifier must have at least one condition
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => addConditionToParent(tree.id, 'simple')}
          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs transition-colors"
        >
          + Add Condition
        </button>
        <button
          onClick={() => addConditionToParent(tree.id, 'quantifier')}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs transition-colors"
        >
          + Add Nested
        </button>
      </div>
    </div>
  );
}
