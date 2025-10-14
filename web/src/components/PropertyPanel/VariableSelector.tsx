import { useState, useRef, useEffect, useMemo } from 'react';
import { useFlowStore } from '../../store/flowStore';

interface VariableSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  currentNodeId?: string; // Exclude this node from suggestions
}

interface Variable {
  label: string;
  value: string;
  type: 'input' | 'step';
  description?: string;
}

export default function VariableSelector({
  value,
  onChange,
  placeholder = '${inputs.name} or ${step_id.output}',
  className = '',
  currentNodeId,
}: VariableSelectorProps) {
  const { flowDefinition, nodes } = useFlowStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredVars, setFilteredVars] = useState<Variable[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when currentNodeId changes (switching between nodes)
  useEffect(() => {
    setShowDropdown(false);
  }, [currentNodeId]);

  // Build list of available variables - memoize to avoid recreating on every render
  const availableVariables = useMemo(() => {
    const vars: Variable[] = [
      // Flow inputs
      ...(flowDefinition.inputs || []).map((input) => ({
        label: `inputs.${input.name}`,
        value: `\${inputs.${input.name}}`,
        type: 'input' as const,
        description: input.description || `${input.type} input`,
      })),
      // Step outputs
      ...nodes
        .filter((node) => node.id !== currentNodeId && node.data.step?.id)
        .flatMap((node) => {
          const stepId = node.data.step!.id!;
          const outputs = node.data.step!.outputs || [];
          const nodeLabel = node.data.label || node.data.step!.task || 'step';

          // If the step has specific outputs defined, create variables for each
          if (outputs.length > 0) {
            return outputs.map((outputName) => ({
              label: `${stepId}.${outputName}`,
              value: `\${${stepId}.${outputName}}`,
              type: 'step' as const,
              description: `${nodeLabel} - ${outputName}`,
            }));
          }

          // Otherwise, create a generic ".output" variable
          return [{
            label: `${stepId}.output`,
            value: `\${${stepId}.output}`,
            type: 'step' as const,
            description: nodeLabel,
          }];
        }),
    ];

    return vars;
  }, [flowDefinition, nodes, currentNodeId]);

  // Filter variables based on input
  useEffect(() => {
    if (!showDropdown) return;

    const searchText = value.toLowerCase();
    const filtered = availableVariables.filter(
      (v) =>
        v.label.toLowerCase().includes(searchText) ||
        v.description?.toLowerCase().includes(searchText)
    );
    setFilteredVars(filtered);
  }, [value, showDropdown, availableVariables]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputFocus = () => {
    setShowDropdown(true);
    setFilteredVars(availableVariables);
  };

  const handleSelectVariable = (variable: Variable) => {
    onChange(variable.value);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    if (!showDropdown) {
      setShowDropdown(true);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          className={`w-full px-2 py-1 pr-8 text-xs font-mono border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
          title="Show available variables"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
        >
          {filteredVars.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500 italic">
              {availableVariables.length === 0
                ? 'No variables available. Add flow inputs or other steps first.'
                : 'No matching variables found.'}
            </div>
          ) : (
            <div className="py-1">
              {filteredVars.map((variable, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelectVariable(variable)}
                  className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    {/* Type Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {variable.type === 'input' ? (
                        <div className="w-4 h-4 rounded bg-blue-100 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded bg-green-100 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Variable Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono font-medium text-gray-900 truncate">
                        ${'{'}
                        {variable.label}
                        {'}'}
                      </div>
                      {variable.description && (
                        <div className="text-[10px] text-gray-600 truncate">
                          {variable.description}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Helper text */}
      <div className="mt-1 text-[10px] text-gray-500">
        Type or select a variable. Use ${'{'}variable{'}'} syntax.
      </div>
    </div>
  );
}
