import type { AirtableConnectionConfig } from '../../types/flow';

interface AirtableConnectionEditorProps {
  connection: AirtableConnectionConfig;
  onChange: (connection: AirtableConnectionConfig) => void;
  onDelete: () => void;
}

export default function AirtableConnectionEditor({ connection, onChange, onDelete }: AirtableConnectionEditorProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-yellow-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">📊</span>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">Airtable Connection</div>
            <div className="text-xs text-gray-500">aiohttp-based async API client</div>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 text-sm font-medium"
        >
          Delete
        </button>
      </div>

      {/* API Key */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          API Key <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={connection.api_key || ''}
          onChange={(e) => onChange({ ...connection, api_key: e.target.value || undefined })}
          className="w-full px-2 py-1.5 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
          placeholder="${env.AIRTABLE_API_KEY}"
          required
        />
        <p className="mt-0.5 text-xs text-gray-500">
          Get your API key from <a href="https://airtable.com/account" target="_blank" rel="noopener noreferrer" className="text-yellow-600 hover:underline">Airtable Account</a>
        </p>
        <p className="mt-1 text-xs text-yellow-600">
          💡 Use ${'{'}env.AIRTABLE_API_KEY{'}'} for environment variables
        </p>
      </div>

      {/* Base ID */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Base ID <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={connection.base_id || ''}
          onChange={(e) => onChange({ ...connection, base_id: e.target.value || undefined })}
          className="w-full px-2 py-1.5 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
          placeholder="appXXXXXXXXXXXXXX or ${env.AIRTABLE_BASE_ID}"
          required
        />
        <p className="mt-0.5 text-xs text-gray-500">
          Find Base ID in your base's API documentation
        </p>
      </div>

      {/* Built-in Tasks Info */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <div className="text-xs font-medium text-yellow-900 mb-1">Built-in Tasks</div>
            <div className="text-xs text-yellow-700 space-y-1">
              <div><strong>airtable_list_bases</strong> - List available bases</div>
              <div><strong>airtable_list_tables</strong> - List tables in base</div>
              <div><strong>airtable_get_table_schema</strong> - Get table schema</div>
              <div><strong>airtable_list</strong> - List records from table</div>
              <div><strong>airtable_get</strong> - Get single record</div>
              <div><strong>airtable_create</strong> - Create new records</div>
              <div><strong>airtable_update</strong> - Update records</div>
              <div><strong>airtable_delete</strong> - Delete records</div>
              <div><strong>airtable_find</strong> - Find records by filter formula</div>
              <div><strong>airtable_batch</strong> - Batch operations</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
