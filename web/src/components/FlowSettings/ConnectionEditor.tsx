import { useState } from 'react';
import type { ConnectionConfig, ConnectionType } from '../../types/flow';
import PostgresConnectionEditor from './PostgresConnectionEditor';
import MySQLConnectionEditor from './MySQLConnectionEditor';
import MongoDBConnectionEditor from './MongoDBConnectionEditor';
import RedisConnectionEditor from './RedisConnectionEditor';
import SQLiteConnectionEditor from './SQLiteConnectionEditor';
import AirtableConnectionEditor from './AirtableConnectionEditor';

interface ConnectionEditorProps {
  connections: Record<string, ConnectionConfig>;
  onChange: (connections: Record<string, ConnectionConfig>) => void;
}

type ConnectionTypeOption = {
  value: ConnectionType;
  label: string;
  icon: string;
  description: string;
};

const CONNECTION_TYPES: ConnectionTypeOption[] = [
  { value: 'postgres', label: 'PostgreSQL', icon: '🗄️', description: 'asyncpg-based connection with pooling' },
  { value: 'mysql', label: 'MySQL', icon: '🗄️', description: 'aiomysql-based connection with pooling' },
  { value: 'mongodb', label: 'MongoDB', icon: '📄', description: 'Motor-based async connection' },
  { value: 'redis', label: 'Redis', icon: '🔴', description: 'redis-py async connection with pooling' },
  { value: 'sqlite', label: 'SQLite', icon: '💾', description: 'aiosqlite file-based database' },
  { value: 'airtable', label: 'Airtable', icon: '📊', description: 'aiohttp-based async API client' },
];

export default function ConnectionEditor({ connections, onChange }: ConnectionEditorProps) {
  const [addingType, setAddingType] = useState<ConnectionType | null>(null);
  const [newConnectionName, setNewConnectionName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);

  const handleSelectType = (type: ConnectionType) => {
    setAddingType(type);
    setShowNameInput(true);
    // Suggest a default name
    const defaultNames: Record<ConnectionType, string> = {
      postgres: 'db',
      mysql: 'db',
      mongodb: 'db',
      redis: 'cache',
      sqlite: 'db',
      airtable: 'airtable',
    };
    setNewConnectionName(defaultNames[type]);
  };

  const handleAddConnection = () => {
    if (!addingType || !newConnectionName.trim()) return;

    // Check for duplicate names
    if (connections[newConnectionName]) {
      alert(`Connection name "${newConnectionName}" already exists. Please choose a different name.`);
      return;
    }

    // Create new connection based on type
    const newConnection: ConnectionConfig = {
      type: addingType,
    } as ConnectionConfig;

    onChange({
      ...connections,
      [newConnectionName]: newConnection,
    });

    // Reset state
    setAddingType(null);
    setNewConnectionName('');
    setShowNameInput(false);
  };

  const handleUpdateConnection = (name: string, updatedConnection: ConnectionConfig) => {
    onChange({
      ...connections,
      [name]: updatedConnection,
    });
  };

  const handleDeleteConnection = (name: string) => {
    if (confirm(`Delete connection "${name}"?`)) {
      const newConnections = { ...connections };
      delete newConnections[name];
      onChange(newConnections);
    }
  };

  const handleCancelAdd = () => {
    setAddingType(null);
    setNewConnectionName('');
    setShowNameInput(false);
  };

  const connectionEntries = Object.entries(connections);

  return (
    <div className="space-y-4">
      {/* Existing Connections */}
      {connectionEntries.length > 0 ? (
        <div className="space-y-3">
          {connectionEntries.map(([name, config]) => (
            <div key={name}>
              {config.type === 'postgres' && (
                <PostgresConnectionEditor
                  connection={config}
                  onChange={(updated) => handleUpdateConnection(name, updated)}
                  onDelete={() => handleDeleteConnection(name)}
                />
              )}
              {config.type === 'mysql' && (
                <MySQLConnectionEditor
                  connection={config}
                  onChange={(updated) => handleUpdateConnection(name, updated)}
                  onDelete={() => handleDeleteConnection(name)}
                />
              )}
              {config.type === 'mongodb' && (
                <MongoDBConnectionEditor
                  connection={config}
                  onChange={(updated) => handleUpdateConnection(name, updated)}
                  onDelete={() => handleDeleteConnection(name)}
                />
              )}
              {config.type === 'redis' && (
                <RedisConnectionEditor
                  connection={config}
                  onChange={(updated) => handleUpdateConnection(name, updated)}
                  onDelete={() => handleDeleteConnection(name)}
                />
              )}
              {config.type === 'sqlite' && (
                <SQLiteConnectionEditor
                  connection={config}
                  onChange={(updated) => handleUpdateConnection(name, updated)}
                  onDelete={() => handleDeleteConnection(name)}
                />
              )}
              {config.type === 'airtable' && (
                <AirtableConnectionEditor
                  connection={config}
                  onChange={(updated) => handleUpdateConnection(name, updated)}
                  onDelete={() => handleDeleteConnection(name)}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <div className="text-sm text-gray-500 mb-2">No connections configured</div>
          <div className="text-xs text-gray-400">
            Add a database or service connection to enable built-in tasks
          </div>
        </div>
      )}

      {/* Add Connection Section */}
      {!showNameInput ? (
        <div>
          <div className="text-xs font-medium text-gray-700 mb-2">Add Connection</div>
          <div className="grid grid-cols-2 gap-2">
            {CONNECTION_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => handleSelectType(type.value)}
                className="flex items-start gap-2 px-3 py-2 text-left text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <span className="text-lg">{type.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{type.label}</div>
                  <div className="text-xs text-gray-500">{type.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50">
          <div className="text-sm font-medium text-gray-900 mb-3">
            Configure {CONNECTION_TYPES.find(t => t.value === addingType)?.label} Connection
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Connection Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newConnectionName}
              onChange={(e) => setNewConnectionName(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="db, cache, etc."
              autoFocus
            />
            <p className="mt-0.5 text-xs text-gray-500">
              This name will be used to reference the connection in your tasks
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAddConnection}
              disabled={!newConnectionName.trim()}
              className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Add Connection
            </button>
            <button
              onClick={handleCancelAdd}
              className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <div className="text-xs font-medium text-blue-900 mb-1">About Connections</div>
            <div className="text-xs text-blue-700 space-y-1">
              <div>Connections enable built-in database and service tasks in your flows</div>
              <div>Each connection type provides specific tasks (e.g., pg_query, mongo_find)</div>
              <div>Use environment variables like ${'{'}env.DATABASE_URL{'}'} for credentials</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
