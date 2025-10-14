import { useState, useEffect } from 'react';
import type { FlowNode } from '../../types/node';
import type { Step } from '../../types/flow';
import VariableSelector from './VariableSelector';

interface ConditionalNodePropertiesProps {
  node: FlowNode;
  onUpdate: (nodeId: string, data: any) => void;
}

type ConditionType = 'simple' | 'all' | 'any' | 'none';

export default function ConditionalNodeProperties({ node, onUpdate }: ConditionalNodePropertiesProps) {
  const step = node.data.step || {};

  const [label, setLabel] = useState(node.data.label || '');

  // Determine condition type and value
  const [conditionType, setConditionType] = useState<ConditionType>(() => {
    if (typeof step.if === 'string') return 'simple';
    if (typeof step.if === 'object' && step.if !== null) {
      if ('all' in step.if) return 'all';
      if ('any' in step.if) return 'any';
      if ('none' in step.if) return 'none';
    }
    return 'simple';
  });

  const [simpleCondition, setSimpleCondition] = useState(() =>
    typeof step.if === 'string' ? step.if : ''
  );

  const [quantifiedConditions, setQuantifiedConditions] = useState<string[]>(() => {
    if (typeof step.if === 'object' && step.if !== null) {
      const key = Object.keys(step.if)[0] as 'all' | 'any' | 'none';
      return Array.isArray(step.if[key]) ? step.if[key] : [];
    }
    return [''];
  });

  // Sync state when node changes
  useEffect(() => {
    const newStep = node.data.step || {};
    setLabel(node.data.label || '');

    if (typeof newStep.if === 'string') {
      setConditionType('simple');
      setSimpleCondition(newStep.if);
    } else if (typeof newStep.if === 'object' && newStep.if !== null) {
      if ('all' in newStep.if) {
        setConditionType('all');
        setQuantifiedConditions(Array.isArray(newStep.if.all) ? newStep.if.all : ['']);
      } else if ('any' in newStep.if) {
        setConditionType('any');
        setQuantifiedConditions(Array.isArray(newStep.if.any) ? newStep.if.any : ['']);
      } else if ('none' in newStep.if) {
        setConditionType('none');
        setQuantifiedConditions(Array.isArray(newStep.if.none) ? newStep.if.none : ['']);
      }
    } else {
      setConditionType('simple');
      setSimpleCondition('');
    }
  }, [node.id]);

  // Update node when any field changes
  useEffect(() => {
    let conditionValue: any;

    if (conditionType === 'simple') {
      conditionValue = simpleCondition || undefined;
    } else {
      const filteredConditions = quantifiedConditions.filter(c => c.trim());
      if (filteredConditions.length > 0) {
        conditionValue = { [conditionType]: filteredConditions };
      }
    }

    const updatedStep: Step = {
      if: conditionValue,
      then: step.then,
      else: step.else,
    };

    onUpdate(node.id, {
      label,
      step: updatedStep,
    });
  }, [label, conditionType, simpleCondition, quantifiedConditions]);

  const handleAddCondition = () => {
    setQuantifiedConditions([...quantifiedConditions, '']);
  };

  const handleRemoveCondition = (index: number) => {
    setQuantifiedConditions(quantifiedConditions.filter((_, i) => i !== index));
  };

  const handleConditionChange = (index: number, value: string) => {
    const updated = [...quantifiedConditions];
    updated[index] = value;
    setQuantifiedConditions(updated);
  };

  const handleTypeChange = (newType: ConditionType) => {
    setConditionType(newType);
    if (newType !== 'simple' && quantifiedConditions.length === 0) {
      setQuantifiedConditions(['']);
    }
  };

  return (
    <div className="space-y-4">
      {/* Node Label */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Label
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          placeholder="Enter node label"
        />
      </div>

      {/* Condition Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Condition Type <span className="text-red-500">*</span>
        </label>
        <select
          value={conditionType}
          onChange={(e) => handleTypeChange(e.target.value as ConditionType)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        >
          <option value="simple">Simple (single condition)</option>
          <option value="all">All (all conditions must be true)</option>
          <option value="any">Any (at least one condition must be true)</option>
          <option value="none">None (no conditions must be true)</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          {conditionType === 'simple' && 'Single boolean expression'}
          {conditionType === 'all' && 'ALL conditions must evaluate to true'}
          {conditionType === 'any' && 'At least ONE condition must evaluate to true'}
          {conditionType === 'none' && 'NO conditions must evaluate to true (all must be false)'}
        </p>
      </div>

      {/* Simple Condition */}
      {conditionType === 'simple' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Condition <span className="text-red-500">*</span>
          </label>
          <VariableSelector
            value={simpleCondition}
            onChange={setSimpleCondition}
            placeholder="${inputs.value} == 'expected'"
            currentNodeId={node.id}
            className="font-mono"
          />
          <p className="mt-1 text-xs text-gray-500">
            Boolean expression to evaluate (supports ==, !=, &lt;, &gt;, &lt;=, &gt;=)
          </p>
        </div>
      )}

      {/* Quantified Conditions */}
      {conditionType !== 'simple' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Conditions <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            {quantifiedConditions.map((cond, index) => (
              <div key={index} className="flex gap-2">
                <div className="flex-1">
                  <VariableSelector
                    value={cond}
                    onChange={(val) => handleConditionChange(index, val)}
                    placeholder="${inputs.value} == 'expected'"
                    currentNodeId={node.id}
                    className="font-mono"
                  />
                </div>
                <button
                  onClick={() => handleRemoveCondition(index)}
                  className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-sm transition-colors flex-shrink-0"
                  title="Remove condition"
                  disabled={quantifiedConditions.length === 1}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={handleAddCondition}
            className="mt-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm transition-colors"
          >
            + Add Condition
          </button>
        </div>
      )}

      {/* Examples */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs font-medium text-amber-900 mb-2">Examples:</p>
        {conditionType === 'simple' && (
          <ul className="text-xs text-amber-800 space-y-1 font-mono">
            <li>• <code>$&#123;step_id.status&#125; == "success"</code></li>
            <li>• <code>$&#123;inputs.age&#125; &gt;= 18</code></li>
            <li>• <code>$&#123;validate.is_valid&#125; == true</code></li>
          </ul>
        )}
        {conditionType === 'all' && (
          <div className="text-xs text-amber-800 font-mono">
            <p className="mb-1">All conditions must be true:</p>
            <code className="block ml-2">$&#123;user.age&#125; &gt;= 18</code>
            <code className="block ml-2">$&#123;user.verified&#125; == true</code>
            <code className="block ml-2">$&#123;account.active&#125; == true</code>
          </div>
        )}
        {conditionType === 'any' && (
          <div className="text-xs text-amber-800 font-mono">
            <p className="mb-1">At least one condition must be true:</p>
            <code className="block ml-2">$&#123;user.is_admin&#125; == true</code>
            <code className="block ml-2">$&#123;user.is_moderator&#125; == true</code>
          </div>
        )}
        {conditionType === 'none' && (
          <div className="text-xs text-amber-800 font-mono">
            <p className="mb-1">No conditions must be true (guard clauses):</p>
            <code className="block ml-2">$&#123;checks.has_fraud_alert&#125; == true</code>
            <code className="block ml-2">$&#123;checks.has_disputes&#125; == true</code>
            <code className="block ml-2">$&#123;checks.account_locked&#125; == true</code>
          </div>
        )}
      </div>

      {/* Node ID (read-only) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Node ID
        </label>
        <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded border border-gray-200 font-mono">
          {node.id}
        </div>
      </div>

      {/* Info about child nodes */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          Drag task nodes into the "Then" or "Else" sections of this container to define what happens when the condition is true or false.
        </p>
      </div>
    </div>
  );
}
