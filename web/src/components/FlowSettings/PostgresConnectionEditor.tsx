import { useState } from 'react';
import type { PostgresConnectionConfig } from '../../types/flow';

interface PostgresConnectionEditorProps {
  connection: PostgresConnectionConfig;
  onChange: (connection: PostgresConnectionConfig) => void;
  onDelete: () => void;
}

export default function PostgresConnectionEditor({ connection, onChange, onDelete }: PostgresConnectionEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useManualConfig, setUseManualConfig] = useState(!connection.url);

  const handleUrlChange = (url: string) => {
    onChange({ ...connection, url: url || undefined });
  };

  const handleHostChange = (host: string) => {
    onChange({ ...connection, host: host || undefined });
  };

  const handlePortChange = (port: string) => {
    onChange({ ...connection, port: port ? parseInt(port) : undefined });
  };

  const handleDatabaseChange = (database: string) => {
    onChange({ ...connection, database: database || undefined });
  };

  const handleUserChange = (user: string) => {
    onChange({ ...connection, user: user || undefined });
  };

  const handlePasswordChange = (password: string) => {
    onChange({ ...connection, password: password || undefined });
  };

  const handlePoolSizeChange = (pool_size: string) => {
    onChange({ ...connection, pool_size: pool_size ? parseInt(pool_size) : undefined });
  };

  const handleMinPoolSizeChange = (min_pool_size: string) => {
    onChange({ ...connection, min_pool_size: min_pool_size ? parseInt(min_pool_size) : undefined });
  };

  const handleTimeoutChange = (timeout: string) => {
    onChange({ ...connection, timeout: timeout ? parseInt(timeout) : undefined });
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">🗄️</span>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">PostgreSQL Connection</div>
            <div className="text-xs text-gray-500">asyncpg-based connection with pooling</div>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 text-sm font-medium"
        >
          Delete
        </button>
      </div>

      {/* Configuration Mode Toggle */}
      <div className="flex gap-3">
        <button
          onClick={() => setUseManualConfig(false)}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            !useManualConfig
              ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Connection URL
        </button>
        <button
          onClick={() => setUseManualConfig(true)}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            useManualConfig
              ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Manual Config
        </button>
      </div>

      {/* Connection URL Mode */}
      {!useManualConfig && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Connection URL <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={connection.url || ''}
            onChange={(e) => handleUrlChange(e.target.value)}
            className="w-full px-2 py-1.5 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="postgresql://user:pass@localhost:5432/mydb"
            required
          />
          <p className="mt-0.5 text-xs text-gray-500">
            Format: postgresql://user:password@host:port/database
          </p>
          <p className="mt-1 text-xs text-blue-600">
            💡 Use ${'{'}env.DATABASE_URL{'}'} for environment variables
          </p>
        </div>
      )}

      {/* Manual Configuration Mode */}
      {useManualConfig && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Host
              </label>
              <input
                type="text"
                value={connection.host || ''}
                onChange={(e) => handleHostChange(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="localhost"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Port
              </label>
              <input
                type="number"
                value={connection.port || ''}
                onChange={(e) => handlePortChange(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="5432"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Database
            </label>
            <input
              type="text"
              value={connection.database || ''}
              onChange={(e) => handleDatabaseChange(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="mydb"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                User
              </label>
              <input
                type="text"
                value={connection.user || ''}
                onChange={(e) => handleUserChange(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="${env.DB_USER}"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={connection.password || ''}
                onChange={(e) => handlePasswordChange(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="${env.DB_PASSWORD}"
              />
            </div>
          </div>
        </div>
      )}

      {/* Advanced Settings Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
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
                onChange={(e) => handlePoolSizeChange(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-0.5 text-xs text-gray-500">Max connections</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Min Pool Size
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={connection.min_pool_size || 1}
                onChange={(e) => handleMinPoolSizeChange(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-0.5 text-xs text-gray-500">Min to maintain</p>
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
                onChange={(e) => handleTimeoutChange(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-0.5 text-xs text-gray-500">Command timeout</p>
            </div>
          </div>
        </div>
      )}

      {/* Built-in Tasks Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <div className="text-xs font-medium text-blue-900 mb-1">Built-in Tasks</div>
            <div className="text-xs text-blue-700 space-y-1">
              <div><strong>pg_query</strong> - Execute SELECT queries</div>
              <div><strong>pg_execute</strong> - INSERT/UPDATE/DELETE operations</div>
              <div><strong>pg_transaction</strong> - Atomic multi-query transactions</div>
              <div><strong>pg_batch_insert</strong> - Bulk insert (10-30x faster)</div>
              <div><strong>pg_batch_update</strong> - Bulk update operations</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
