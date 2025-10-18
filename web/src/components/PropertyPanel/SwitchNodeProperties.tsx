import { useState, useEffect } from 'react';
import type { FlowNode, SwitchCase } from '../../types/node';
import type { Step } from '../../types/flow';
import VariableSelector from './VariableSelector';
import YAMLPreviewModal from '../YAMLPreviewModal/YAMLPreviewModal';
import { nodeToYaml } from '../../services/yamlConverter';
import { useFlowStore } from '../../store/flowStore';
import ExecutionStatusDisplay from './ExecutionStatusDisplay';

interface SwitchNodePropertiesProps {
  node: FlowNode;
  onUpdate: (nodeId: string, data: any) => void;
}

export default function SwitchNodeProperties({ node, onUpdate }: SwitchNodePropertiesProps) {
  const step = node.data.step || {};
  const cases = node.data.cases || [];
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

  const defaultBranch = getBranchChain('default');

  const [label, setLabel] = useState(node.data.label || '');
  const [badge, setBadge] = useState(node.data.badge || '');
  const [switchExpression, setSwitchExpression] = useState(step.switch || '');
  const [showYAMLModal, setShowYAMLModal] = useState(false);
  const [branchesExpanded, setBranchesExpanded] = useState(true);

  // Sync state when node changes
  useEffect(() => {
    const newStep = node.data.step || {};
    setLabel(node.data.label || '');
    setBadge(node.data.badge || '');
    setSwitchExpression(newStep.switch || '');
  }, [node.id]);

  // Update node when any field changes
  useEffect(() => {
    const updatedStep: Step = {
      switch: switchExpression || undefined,
      cases: step.cases,
      default: step.default,
    };

    onUpdate(node.id, {
      label,
      badge: badge || undefined,
      step: updatedStep,
      cases: node.data.cases, // Keep cases data
    });
  }, [label, badge, switchExpression]);

  const handleCaseWhenChange = (caseId: string, value: string) => {
    const updatedCases = cases.map((c: SwitchCase) =>
      c.id === caseId ? { ...c, when: value } : c
    );
    onUpdate(node.id, {
      ...node.data,
      cases: updatedCases,
    });
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
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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

      {/* Switch Expression */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Switch Expression <span className="text-red-500">*</span>
        </label>
        <VariableSelector
          value={switchExpression}
          onChange={setSwitchExpression}
          placeholder="${inputs.order_type}"
          currentNodeId={node.id}
          className="font-mono"
        />
        <p className="mt-1 text-xs text-gray-500">
          Expression to evaluate and match against cases
        </p>
      </div>

      {/* Case Configuration */}
      {cases.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Case Values
          </label>
          <div className="space-y-2">
            {cases.map((switchCase: SwitchCase, index: number) => (
              <div key={switchCase.id}>
                <label className="block text-xs text-gray-600 mb-1">
                  Case {index + 1}
                </label>
                <input
                  type="text"
                  value={Array.isArray(switchCase.when) ? switchCase.when.join(', ') : String(switchCase.when)}
                  onChange={(e) => handleCaseWhenChange(switchCase.id, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder={`"value" or "val1", "val2"`}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Enter single value or comma-separated list for multiple matches
          </p>
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
            {/* Case Branches */}
            {cases.map((switchCase: SwitchCase, index: number) => {
              const caseHandle = `case_${switchCase.id}`;
              const caseBranch = getBranchChain(caseHandle);
              const caseValue = Array.isArray(switchCase.when) ? switchCase.when.join(', ') : String(switchCase.when || '');

              return (
                <div key={switchCase.id} className="mb-3">
                  <div className="text-xs font-medium text-orange-700 mb-1 flex items-center gap-1">
                    <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                    Case {index + 1}: {caseValue || '(not set)'}
                  </div>
                  {caseBranch.length > 0 ? (
                    <div className="border border-orange-200 rounded-lg bg-orange-50 divide-y divide-orange-100">
                      {caseBranch.map((branchNode, nodeIndex) => {
                        const nodeTypeIcon = branchNode.type === 'task' ? '📋' :
                                             branchNode.type === 'loopContainer' ? '↻' :
                                             branchNode.type === 'parallelContainer' ? '⇉' :
                                             branchNode.type === 'conditionalContainer' ? '?' :
                                             branchNode.type === 'switchContainer' ? '⋮' :
                                             branchNode.type === 'subflow' ? '🔁' : '•';
                        return (
                          <div key={branchNode.id} className="px-3 py-2 flex items-center gap-2">
                            <div className="flex-shrink-0 text-xs text-orange-600">
                              {nodeIndex + 1}.
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
                    <div className="border border-dashed border-orange-300 rounded-lg px-3 py-2 text-center">
                      <p className="text-xs text-orange-700">
                        No nodes connected to this case
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

        {/* Default Branch */}
        <div>
          <div className="text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
            <span className="w-3 h-3 bg-gray-500 rounded-full"></span>
            Default (fallback)
          </div>
          {defaultBranch.length > 0 ? (
            <div className="border border-gray-200 rounded-lg bg-gray-50 divide-y divide-gray-100">
              {defaultBranch.map((branchNode, index) => {
                const nodeTypeIcon = branchNode.type === 'task' ? '📋' :
                                     branchNode.type === 'loopContainer' ? '↻' :
                                     branchNode.type === 'parallelContainer' ? '⇉' :
                                     branchNode.type === 'conditionalContainer' ? '?' :
                                     branchNode.type === 'switchContainer' ? '⋮' :
                                     branchNode.type === 'subflow' ? '🔁' : '•';
                return (
                  <div key={branchNode.id} className="px-3 py-2 flex items-center gap-2">
                    <div className="flex-shrink-0 text-xs text-gray-600">
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
            <div className="border border-dashed border-gray-300 rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-gray-700">
                No nodes connected to default branch
              </p>
            </div>
          )}
        </div>
          </>
        )}
      </div>

      {/* Examples */}
      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
        <p className="text-xs font-medium text-orange-900 mb-2">Example:</p>
        <div className="text-xs text-orange-800 font-mono space-y-1">
          <div><strong>Switch:</strong> <code>$&#123;inputs.order_type&#125;</code></div>
          <div><strong>Case 1:</strong> <code>"standard"</code></div>
          <div><strong>Case 2:</strong> <code>"express", "overnight"</code></div>
          <div><strong>Case 3:</strong> <code>"international"</code></div>
          <div className="mt-2 text-orange-700">
            Default case handles unmatched values
          </div>
        </div>
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
          Drag task nodes into case sections to define what happens for each match. The default section handles unmatched values.
        </p>
      </div>

      {/* YAML Preview Modal */}
      <YAMLPreviewModal
        isOpen={showYAMLModal}
        onClose={() => setShowYAMLModal(false)}
        title="Switch Container YAML"
        yamlContent={nodeToYaml(node)}
      />
    </div>
  );
}
