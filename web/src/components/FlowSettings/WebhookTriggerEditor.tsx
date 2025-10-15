import { useState } from 'react';

interface WebhookTriggerConfig {
  type: 'webhook';
  id?: string;
  path: string;
  method?: string;
  auth?: {
    type: string;
    header?: string;
    key?: string;
  };
  async?: boolean;
  input_mapping?: string;
  enabled?: boolean;
}

interface WebhookTriggerEditorProps {
  trigger: WebhookTriggerConfig;
  onChange: (trigger: WebhookTriggerConfig) => void;
  onDelete: () => void;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const INPUT_MAPPINGS = [
  { value: 'body', label: 'Body (JSON)', description: 'Extract from request body' },
  { value: 'query', label: 'Query Parameters', description: 'Extract from URL query string' },
  { value: 'headers', label: 'Headers', description: 'Extract from request headers' },
  { value: 'path', label: 'Path Parameters', description: 'Extract from URL path' },
  { value: 'all', label: 'All Sources', description: 'Combine body, query, headers, path' },
];

const AUTH_TYPES = [
  { value: 'none', label: 'No Authentication' },
  { value: 'api_key', label: 'API Key' },
  { value: 'bearer', label: 'Bearer Token' },
];

export default function WebhookTriggerEditor({ trigger, onChange, onDelete }: WebhookTriggerEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const authType = trigger.auth?.type || 'none';

  const handlePathChange = (path: string) => {
    onChange({ ...trigger, path });
  };

  const handleMethodChange = (method: string) => {
    onChange({ ...trigger, method });
  };

  const handleAuthTypeChange = (type: string) => {
    if (type === 'none') {
      const { auth, ...rest } = trigger;
      onChange(rest as WebhookTriggerConfig);
    } else {
      onChange({
        ...trigger,
        auth: {
          type,
          header: type === 'api_key' ? 'X-API-Key' : undefined,
          key: '',
        },
      });
    }
  };

  const handleAuthHeaderChange = (header: string) => {
    if (trigger.auth) {
      onChange({
        ...trigger,
        auth: { ...trigger.auth, header },
      });
    }
  };

  const handleAuthKeyChange = (key: string) => {
    if (trigger.auth) {
      onChange({
        ...trigger,
        auth: { ...trigger.auth, key },
      });
    }
  };

  const handleInputMappingChange = (input_mapping: string) => {
    onChange({ ...trigger, input_mapping });
  };

  const handleAsyncChange = (async: boolean) => {
    onChange({ ...trigger, async });
  };

  const handleIdChange = (id: string) => {
    onChange({ ...trigger, id: id || undefined });
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-blue-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">🌐</span>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">Webhook Trigger</div>
            <div className="text-xs text-gray-500">HTTP endpoint trigger</div>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 text-sm font-medium"
        >
          Delete
        </button>
      </div>

      {/* Path and Method */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Path <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={trigger.path || ''}
            onChange={(e) => handlePathChange(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="/webhooks/my-flow"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            HTTP Method
          </label>
          <select
            value={trigger.method || 'POST'}
            onChange={(e) => handleMethodChange(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {HTTP_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Authentication */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Authentication
        </label>
        <select
          value={authType}
          onChange={(e) => handleAuthTypeChange(e.target.value)}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {AUTH_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Auth Details (API Key) */}
      {authType === 'api_key' && trigger.auth && (
        <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-blue-200">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Header Name
            </label>
            <input
              type="text"
              value={trigger.auth.header || ''}
              onChange={(e) => handleAuthHeaderChange(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="X-API-Key"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Key Value
            </label>
            <input
              type="text"
              value={trigger.auth.key || ''}
              onChange={(e) => handleAuthKeyChange(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="${SECRET_KEY}"
            />
            <p className="mt-0.5 text-xs text-gray-500">Use ${'{'}VAR{'}'} for env vars</p>
          </div>
        </div>
      )}

      {/* Auth Details (Bearer) */}
      {authType === 'bearer' && trigger.auth && (
        <div className="pl-4 border-l-2 border-blue-200">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Bearer Token
          </label>
          <input
            type="text"
            value={trigger.auth.key || ''}
            onChange={(e) => handleAuthKeyChange(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="${SECRET_TOKEN}"
          />
          <p className="mt-0.5 text-xs text-gray-500">Use ${'{'}VAR{'}'} for env vars</p>
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
          {/* Trigger ID */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Trigger ID (Optional)
            </label>
            <input
              type="text"
              value={trigger.id || ''}
              onChange={(e) => handleIdChange(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="my-webhook"
            />
            <p className="mt-0.5 text-xs text-gray-500">Unique identifier for this trigger</p>
          </div>

          {/* Input Mapping */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Input Mapping
            </label>
            <select
              value={trigger.input_mapping || 'body'}
              onChange={(e) => handleInputMappingChange(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {INPUT_MAPPINGS.map((mapping) => (
                <option key={mapping.value} value={mapping.value}>
                  {mapping.label}
                </option>
              ))}
            </select>
            <p className="mt-0.5 text-xs text-gray-500">
              {INPUT_MAPPINGS.find((m) => m.value === (trigger.input_mapping || 'body'))?.description}
            </p>
          </div>

          {/* Execution Mode */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Execution Mode
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={trigger.async !== false}
                  onChange={() => handleAsyncChange(true)}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">Async (202 response, background execution)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={trigger.async === false}
                  onChange={() => handleAsyncChange(false)}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">Sync (wait for completion)</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
