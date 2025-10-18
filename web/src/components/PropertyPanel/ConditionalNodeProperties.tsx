import { useState, useEffect } from 'react';
import type { FlowNode } from '../../types/node';
import type { Step } from '../../types/flow';
import VariableSelector from './VariableSelector';
import YAMLPreviewModal from '../YAMLPreviewModal/YAMLPreviewModal';
import { nodeToYaml } from '../../services/yamlConverter';
import { useFlowStore } from '../../store/flowStore';
import ExecutionStatusDisplay from './ExecutionStatusDisplay';
import QuantifiedConditionEditor from './QuantifiedConditionEditor';

interface ConditionalNodePropertiesProps {
  node: FlowNode;
  onUpdate: (nodeId: string, data: any) => void;
}

type ConditionType = 'simple' | 'all' | 'any' | 'none';

export default function ConditionalNodeProperties({ node, onUpdate }: ConditionalNodePropertiesProps) {
  const step = node.data.step || {};
  const execution = useFlowStore((state) => state.execution);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const nodeExecutionState = execution.nodeStates[node.id];

  // Find branch chains
  const getBranchChain = (sourceHandle: string): FlowNode[] => {
    const chain: FlowNode[] = [];
    const visited = new Set<string>();

    let currentEdge = edges.find(e => e.source === node.id && e.sourceHandle === sourceHandle);

    while (currentEdge && !visited.has(currentEdge.target)) {
      visited.add(currentEdge.target);
      const targetNode = nodes.find(n => n.id === currentEdge!.target);
      if (!targetNode) break;

      chain.push(targetNode);

      // Find next edge in the chain (single outgoing edge from this node)
      currentEdge = edges.find(e => e.source === targetNode.id);
    }

    return chain;
  };

  const thenBranch = getBranchChain('then');
  const elseBranch = getBranchChain('else');

  const [label, setLabel] = useState(node.data.label || '');
  const [badge, setBadge] = useState(node.data.badge || '');

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

  const [quantifiedCondition, setQuantifiedCondition] = useState<any>(() => {
    if (typeof step.if === 'object' && step.if !== null) {
      return step.if;
    }
    return { all: [''] };
  });

  const [showYAMLModal, setShowYAMLModal] = useState(false);
  const [branchesExpanded, setBranchesExpanded] = useState(true);

  // Sync state when node changes
  useEffect(() => {
    const newStep = node.data.step || {};
    setLabel(node.data.label || '');
    setBadge(node.data.badge || '');

    if (typeof newStep.if === 'string') {
      setConditionType('simple');
      setSimpleCondition(newStep.if);
    } else if (typeof newStep.if === 'object' && newStep.if !== null) {
      const key = Object.keys(newStep.if)[0] as 'all' | 'any' | 'none';
      setConditionType(key);
      setQuantifiedCondition(newStep.if);
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
      conditionValue = quantifiedCondition;
    }

    const updatedStep: Step = {
      if: conditionValue,
      then: step.then,
      else: step.else,
    };

    onUpdate(node.id, {
      label,
      badge: badge || undefined,
      step: updatedStep,
    });
  }, [label, badge, conditionType, simpleCondition, quantifiedCondition]);

  const handleTypeChange = (newType: ConditionType) => {
    setConditionType(newType);
    if (newType !== 'simple' && !quantifiedCondition) {
      setQuantifiedCondition({ [newType]: [''] });
    }
  };

  return (
    <div className="space-y-4">
      {/* Execution Status */}
      <ExecutionStatusDisplay nodeExecutionState={nodeExecutionState} />

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

      {/* Badge (Count/Variable) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Badge
        </label>
        <VariableSelector
          value={badge}
          onChange={setBadge}
          placeholder="${previous_step.count}"
          currentNodeId={node.id}
          className="font-mono"
        />
        <p className="mt-1 text-xs text-gray-500">
          Optional badge to display next to the label (e.g., item count, status)
        </p>
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
          <QuantifiedConditionEditor
            value={quantifiedCondition}
            onChange={setQuantifiedCondition}
            currentNodeId={node.id}
          />
        </div>
      )}

      {/* Branch Chains */}
      <div>
        <div
          className="flex items-center justify-between mb-2 cursor-pointer"
          onClick={() => setBranchesExpanded(!branchesExpanded)}
        >
          <label className="text-sm font-medium text-gray-700">
            Branch Chains
          </label>
          <button
            type="button"
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setBranchesExpanded(!branchesExpanded);
            }}
          >
            <svg
              className={`w-4 h-4 text-gray-600 transition-transform ${branchesExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {branchesExpanded && (
          <>
            {/* Then Branch */}
            <div className="mb-3">
              <div className="text-xs font-medium text-green-700 mb-1 flex items-center gap-1">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                Then Branch (when true)
              </div>
              {thenBranch.length > 0 ? (
                <div className="border border-green-200 rounded-lg bg-green-50 divide-y divide-green-100">
                  {thenBranch.map((branchNode, index) => {
                    const nodeTypeIcon = branchNode.type === 'task' ? '📋' :
                                         branchNode.type === 'loopContainer' ? '↻' :
                                         branchNode.type === 'parallelContainer' ? '⇉' :
                                         branchNode.type === 'conditionalContainer' ? '?' :
                                         branchNode.type === 'switchContainer' ? '⋮' :
                                         branchNode.type === 'subflow' ? '🔁' : '•';
                    return (
                      <div key={branchNode.id} className="px-3 py-2 flex items-center gap-2">
                        <div className="flex-shrink-0 text-xs text-green-600">
                          {index + 1}.
                        </div>
                        <div className="flex-shrink-0 text-base">
                          {nodeTypeIcon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {branchNode.data.label || 'Untitled'}
                          </div>
                          <div className="text-xs text-gray-500 font-mono truncate">
                            {branchNode.id}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="border border-dashed border-green-300 rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-green-700">
                    No nodes connected to Then branch
                  </p>
                </div>
              )}
            </div>

            {/* Else Branch */}
            <div>
              <div className="text-xs font-medium text-red-700 mb-1 flex items-center gap-1">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                Else Branch (when false)
              </div>
              {elseBranch.length > 0 ? (
                <div className="border border-red-200 rounded-lg bg-red-50 divide-y divide-red-100">
                  {elseBranch.map((branchNode, index) => {
                    const nodeTypeIcon = branchNode.type === 'task' ? '📋' :
                                         branchNode.type === 'loopContainer' ? '↻' :
                                         branchNode.type === 'parallelContainer' ? '⇉' :
                                         branchNode.type === 'conditionalContainer' ? '?' :
                                         branchNode.type === 'switchContainer' ? '⋮' :
                                         branchNode.type === 'subflow' ? '🔁' : '•';
                    return (
                      <div key={branchNode.id} className="px-3 py-2 flex items-center gap-2">
                        <div className="flex-shrink-0 text-xs text-red-600">
                          {index + 1}.
                        </div>
                        <div className="flex-shrink-0 text-base">
                          {nodeTypeIcon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {branchNode.data.label || 'Untitled'}
                          </div>
                          <div className="text-xs text-gray-500 font-mono truncate">
                            {branchNode.id}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="border border-dashed border-red-300 rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-red-700">
                    No nodes connected to Else branch
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

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

      {/* View YAML Button */}
      <div>
        <button
          onClick={() => setShowYAMLModal(true)}
          className="w-full px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          View Node YAML
        </button>
      </div>

      {/* Info about child nodes */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          Drag task nodes into the "Then" or "Else" sections of this container to define what happens when the condition is true or false.
        </p>
      </div>

      {/* YAML Preview Modal */}
      <YAMLPreviewModal
        isOpen={showYAMLModal}
        onClose={() => setShowYAMLModal(false)}
        title="Conditional Container YAML"
        yamlContent={nodeToYaml(node)}
      />
    </div>
  );
}
