import { useState } from 'react';
import VariableSelector from './VariableSelector';

interface KeyValueEditorProps {
  label: string;
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  placeholder?: {
    key: string;
    value: string;
  };
  allowVariables?: boolean;
  currentNodeId?: string;
  disabled?: boolean;
}

export default function KeyValueEditor({
  label,
  value,
  onChange,
  placeholder = { key: 'key', value: 'value' },
  allowVariables = true,
  currentNodeId,
  disabled = false,
}: KeyValueEditorProps) {
  const entries = Object.entries(value || {});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    if (newKey.trim()) {
      onChange({
        ...value,
        [newKey.trim()]: newValue,
      });
      setNewKey('');
      setNewValue('');
    }
  };

  const handleUpdate = (oldKey: string, newKeyValue: string, newValueValue: string) => {
    const updated = { ...value };
    if (oldKey !== newKeyValue && newKeyValue.trim()) {
      delete updated[oldKey];
    }
    if (newKeyValue.trim()) {
      updated[newKeyValue] = newValueValue;
    }
    onChange(updated);
  };

  const handleDelete = (key: string) => {
    const updated = { ...value };
    delete updated[key];
    onChange(updated);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>

      {/* Existing entries */}
      <div className="space-y-2 mb-2">
        {entries.map(([key, val]) => (
          <div key={key} className="flex gap-2 items-start">
            <input
              type="text"
              value={key}
              onChange={(e) => handleUpdate(key, e.target.value, val)}
              disabled={disabled}
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100"
              placeholder={placeholder.key}
            />
            <div className="flex-[2]">
              {allowVariables ? (
                <VariableSelector
                  value={val}
                  onChange={(newVal) => handleUpdate(key, key, newVal)}
                  placeholder={placeholder.value}
                  currentNodeId={currentNodeId}
                  disabled={disabled}
                />
              ) : (
                <input
                  type="text"
                  value={val}
                  onChange={(e) => handleUpdate(key, key, e.target.value)}
                  disabled={disabled}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100"
                  placeholder={placeholder.value}
                />
              )}
            </div>
            <button
              onClick={() => handleDelete(key)}
              disabled={disabled}
              className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded text-sm transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Remove"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Add new entry */}
      {!disabled && (
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              placeholder={placeholder.key}
            />
          </div>
          <div className="flex-[2]">
            {allowVariables ? (
              <VariableSelector
                value={newValue}
                onChange={setNewValue}
                placeholder={placeholder.value}
                currentNodeId={currentNodeId}
              />
            ) : (
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono"
                placeholder={placeholder.value}
              />
            )}
          </div>
          <button
            onClick={handleAdd}
            disabled={!newKey.trim()}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded text-sm transition-colors flex-shrink-0 mt-0"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
