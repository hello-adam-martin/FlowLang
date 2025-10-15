import { useState } from 'react';
import type { MongoDBConnectionConfig } from '../../types/flow';

interface MongoDBConnectionEditorProps {
  connection: MongoDBConnectionConfig;
  onChange: (connection: MongoDBConnectionConfig) => void;
  onDelete: () => void;
}

export default function MongoDBConnectionEditor({ connection, onChange, onDelete }: MongoDBConnectionEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-green-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">📄</span>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">MongoDB Connection</div>
            <div className="text-xs text-gray-500">Motor-based async connection</div>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 text-sm font-medium"
        >
          Delete
        </button>
      </div>

      {/* MongoDB URL */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          MongoDB URL <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={connection.url || ''}
          onChange={(e) => onChange({ ...connection, url: e.target.value || undefined })}
          className="w-full px-2 py-1.5 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="mongodb://localhost:27017 or mongodb+srv://..."
          required
        />
        <p className="mt-0.5 text-xs text-gray-500">
          Format: mongodb://host:port or mongodb+srv://cluster.mongodb.net
        </p>
        <p className="mt-1 text-xs text-green-600">
          💡 Use ${'{'}env.MONGODB_URL{'}'} for environment variables
        </p>
      </div>

      {/* Database */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Database <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={connection.database || ''}
          onChange={(e) => onChange({ ...connection, database: e.target.value || undefined })}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="mydb or ${env.MONGODB_DATABASE}"
          required
        />
        <p className="mt-0.5 text-xs text-gray-500">Database name to use</p>
      </div>

      {/* Advanced Settings Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-sm text-green-600 hover:text-green-700 font-medium"
      >
        {showAdvanced ? '− Hide' : '+ Show'} Advanced Settings
      </button>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="space-y-3 pt-2 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Max Pool Size
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={connection.max_pool_size || 100}
                onChange={(e) => onChange({ ...connection, max_pool_size: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
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
                max="100"
                value={connection.min_pool_size || 0}
                onChange={(e) => onChange({ ...connection, min_pool_size: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="mt-0.5 text-xs text-gray-500">Min to maintain</p>
            </div>
          </div>
        </div>
      )}

      {/* Built-in Tasks Info */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <div className="text-xs font-medium text-green-900 mb-1">Built-in Tasks</div>
            <div className="text-xs text-green-700 space-y-1">
              <div><strong>mongo_find</strong> - Find multiple documents</div>
              <div><strong>mongo_find_one</strong> - Find single document</div>
              <div><strong>mongo_insert</strong> - Insert documents</div>
              <div><strong>mongo_update</strong> - Update documents</div>
              <div><strong>mongo_delete</strong> - Delete documents</div>
              <div><strong>mongo_count</strong> - Count documents</div>
              <div><strong>mongo_aggregate</strong> - Run aggregation pipelines</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
