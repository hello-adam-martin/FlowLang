import { useState } from 'react';
import type { MySQLConnectionConfig } from '../../types/flow';

interface MySQLConnectionEditorProps {
  connection: MySQLConnectionConfig;
  onChange: (connection: MySQLConnectionConfig) => void;
  onDelete: () => void;
}

export default function MySQLConnectionEditor({ connection, onChange, onDelete }: MySQLConnectionEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-orange-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">🗄️</span>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">MySQL Connection</div>
            <div className="text-xs text-gray-500">aiomysql-based connection with pooling</div>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 text-sm font-medium"
        >
          Delete
        </button>
      </div>

      {/* Basic Configuration */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Host <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={connection.host || ''}
              onChange={(e) => onChange({ ...connection, host: e.target.value || undefined })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="localhost or ${env.MYSQL_HOST}"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Port
            </label>
            <input
              type="number"
              value={connection.port || 3306}
              onChange={(e) => onChange({ ...connection, port: e.target.value ? parseInt(e.target.value) : 3306 })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="3306"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Database <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={connection.database || ''}
            onChange={(e) => onChange({ ...connection, database: e.target.value || undefined })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="mydb or ${env.MYSQL_DATABASE}"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              User <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={connection.user || ''}
              onChange={(e) => onChange({ ...connection, user: e.target.value || undefined })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="${env.MYSQL_USER}"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={connection.password || ''}
              onChange={(e) => onChange({ ...connection, password: e.target.value || undefined })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="${env.MYSQL_PASSWORD}"
              required
            />
          </div>
        </div>
      </div>

      {/* Advanced Settings Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-sm text-orange-600 hover:text-orange-700 font-medium"
      >
        {showAdvanced ? '− Hide' : '+ Show'} Advanced Settings
      </button>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="space-y-3 pt-2 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Pool Size
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={connection.pool_size || 10}
                onChange={(e) => onChange({ ...connection, pool_size: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <p className="mt-0.5 text-xs text-gray-500">Max connections</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Charset
              </label>
              <input
                type="text"
                value={connection.charset || 'utf8mb4'}
                onChange={(e) => onChange({ ...connection, charset: e.target.value || undefined })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <p className="mt-0.5 text-xs text-gray-500">Character set</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Timeout (seconds)
              </label>
              <input
                type="number"
                min="1"
                max="300"
                value={connection.timeout || 30}
                onChange={(e) => onChange({ ...connection, timeout: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <p className="mt-0.5 text-xs text-gray-500">Command timeout</p>
            </div>
          </div>
        </div>
      )}

      {/* Built-in Tasks Info */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-orange-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <div className="text-xs font-medium text-orange-900 mb-1">Built-in Tasks</div>
            <div className="text-xs text-orange-700 space-y-1">
              <div><strong>mysql_query</strong> - Execute SELECT queries</div>
              <div><strong>mysql_execute</strong> - INSERT/UPDATE/DELETE operations</div>
              <div><strong>mysql_transaction</strong> - Atomic multi-query transactions</div>
              <div><strong>mysql_batch_insert</strong> - Bulk insert operations</div>
              <div><strong>mysql_batch_update</strong> - Bulk update operations</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
