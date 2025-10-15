import { useState } from 'react';
import type { RedisConnectionConfig } from '../../types/flow';

interface RedisConnectionEditorProps {
  connection: RedisConnectionConfig;
  onChange: (connection: RedisConnectionConfig) => void;
  onDelete: () => void;
}

export default function RedisConnectionEditor({ connection, onChange, onDelete }: RedisConnectionEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-red-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">🔴</span>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">Redis Connection</div>
            <div className="text-xs text-gray-500">redis-py async connection with pooling</div>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 text-sm font-medium"
        >
          Delete
        </button>
      </div>

      {/* Redis URL */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Redis URL <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={connection.url || ''}
          onChange={(e) => onChange({ ...connection, url: e.target.value || undefined })}
          className="w-full px-2 py-1.5 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
          placeholder="redis://localhost:6379/0"
          required
        />
        <p className="mt-0.5 text-xs text-gray-500">
          Format: redis://host:port/db or rediss://... (SSL)
        </p>
        <p className="mt-1 text-xs text-red-600">
          💡 Use ${'{'}env.REDIS_URL{'}'} for environment variables
        </p>
      </div>

      {/* Advanced Settings Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-sm text-red-600 hover:text-red-700 font-medium"
      >
        {showAdvanced ? '− Hide' : '+ Show'} Advanced Settings
      </button>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="space-y-3 pt-2 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Max Connections
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={connection.max_connections || 50}
                onChange={(e) => onChange({ ...connection, max_connections: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <p className="mt-0.5 text-xs text-gray-500">Pool size</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Socket Timeout (seconds)
              </label>
              <input
                type="number"
                min="1"
                max="300"
                step="0.1"
                value={connection.socket_timeout || 5.0}
                onChange={(e) => onChange({ ...connection, socket_timeout: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <p className="mt-0.5 text-xs text-gray-500">Connection timeout</p>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={connection.decode_responses !== false}
                onChange={(e) => onChange({ ...connection, decode_responses: e.target.checked })}
                className="rounded text-red-600"
              />
              <span className="text-sm text-gray-700">Decode Responses</span>
            </label>
            <p className="mt-0.5 text-xs text-gray-500 ml-6">
              Automatically decode byte strings to UTF-8
            </p>
          </div>
        </div>
      )}

      {/* Built-in Tasks Info */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-red-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <div className="text-xs font-medium text-red-900 mb-1">Built-in Tasks</div>
            <div className="text-xs text-red-700 space-y-1">
              <div><strong>redis_get</strong> - Get value by key</div>
              <div><strong>redis_set</strong> - Set key-value pair (with TTL)</div>
              <div><strong>redis_delete</strong> - Delete keys</div>
              <div><strong>redis_exists</strong> - Check if keys exist</div>
              <div><strong>redis_expire</strong> - Set key expiration</div>
              <div><strong>redis_incr</strong> - Increment counter</div>
              <div><strong>redis_hgetall</strong> - Get all hash fields</div>
              <div><strong>redis_hset</strong> - Set multiple hash fields</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
