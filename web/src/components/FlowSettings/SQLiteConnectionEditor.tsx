import { useState } from 'react';
import type { SQLiteConnectionConfig } from '../../types/flow';

interface SQLiteConnectionEditorProps {
  connection: SQLiteConnectionConfig;
  onChange: (connection: SQLiteConnectionConfig) => void;
  onDelete: () => void;
}

export default function SQLiteConnectionEditor({ connection, onChange, onDelete }: SQLiteConnectionEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-purple-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">💾</span>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">SQLite Connection</div>
            <div className="text-xs text-gray-500">aiosqlite file-based database</div>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 text-sm font-medium"
        >
          Delete
        </button>
      </div>

      {/* Database Path */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Database Path <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={connection.database}
          onChange={(e) => onChange({ ...connection, database: e.target.value })}
          className="w-full px-2 py-1.5 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="./data/app.db or :memory:"
          required
        />
        <p className="mt-0.5 text-xs text-gray-500">
          File path or <code className="bg-gray-200 px-1 rounded">:memory:</code> for in-memory database
        </p>
      </div>

      {/* Quick Options */}
      <div className="flex gap-2">
        <button
          onClick={() => onChange({ ...connection, database: ':memory:' })}
          className="flex-1 px-3 py-2 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100 transition-colors"
        >
          Use In-Memory
        </button>
        <button
          onClick={() => onChange({ ...connection, database: './data/app.db' })}
          className="flex-1 px-3 py-2 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100 transition-colors"
        >
          Use ./data/app.db
        </button>
      </div>

      {/* Advanced Settings Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-sm text-purple-600 hover:text-purple-700 font-medium"
      >
        {showAdvanced ? '− Hide' : '+ Show'} Advanced Settings
      </button>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="space-y-3 pt-2 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Timeout (seconds)
              </label>
              <input
                type="number"
                min="1"
                max="300"
                step="0.1"
                value={connection.timeout || 5.0}
                onChange={(e) => onChange({ ...connection, timeout: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="mt-0.5 text-xs text-gray-500">Command timeout</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Isolation Level
              </label>
              <select
                value={connection.isolation_level || 'null'}
                onChange={(e) => onChange({ ...connection, isolation_level: e.target.value === 'null' ? undefined : e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="null">Default (null)</option>
                <option value="DEFERRED">DEFERRED</option>
                <option value="IMMEDIATE">IMMEDIATE</option>
                <option value="EXCLUSIVE">EXCLUSIVE</option>
              </select>
              <p className="mt-0.5 text-xs text-gray-500">Transaction isolation</p>
            </div>
          </div>
        </div>
      )}

      {/* Built-in Tasks Info */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-purple-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <div className="text-xs font-medium text-purple-900 mb-1">Built-in Tasks</div>
            <div className="text-xs text-purple-700 space-y-1">
              <div><strong>sqlite_query</strong> - Execute SELECT queries</div>
              <div><strong>sqlite_execute</strong> - INSERT/UPDATE/DELETE operations</div>
              <div><strong>sqlite_transaction</strong> - Atomic multi-query transactions</div>
              <div><strong>sqlite_batch_insert</strong> - Bulk insert operations</div>
              <div><strong>sqlite_batch_update</strong> - Bulk update operations</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
