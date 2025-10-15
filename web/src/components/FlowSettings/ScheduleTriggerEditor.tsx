import { useState } from 'react';

interface ScheduleTriggerConfig {
  type: 'schedule';
  id?: string;
  cron: string;
  timezone?: string;
  max_instances?: number;
  enabled?: boolean;
}

interface ScheduleTriggerEditorProps {
  trigger: ScheduleTriggerConfig;
  onChange: (trigger: ScheduleTriggerConfig) => void;
  onDelete: () => void;
}

const CRON_PRESETS = [
  { label: 'Every minute', value: '* * * * *', description: 'Runs every minute' },
  { label: 'Every 5 minutes', value: '*/5 * * * *', description: 'Runs every 5 minutes' },
  { label: 'Every 15 minutes', value: '*/15 * * * *', description: 'Runs every 15 minutes' },
  { label: 'Every 30 minutes', value: '*/30 * * * *', description: 'Runs every 30 minutes' },
  { label: 'Every hour', value: '0 * * * *', description: 'Runs at minute 0 of every hour' },
  { label: 'Every day at 9 AM', value: '0 9 * * *', description: 'Runs at 9:00 AM daily' },
  { label: 'Every weekday at 9 AM', value: '0 9 * * 1-5', description: 'Runs at 9:00 AM Mon-Fri' },
  { label: 'Every Monday at midnight', value: '0 0 * * 1', description: 'Runs at 00:00 on Mondays' },
  { label: 'First day of month at noon', value: '0 12 1 * *', description: 'Runs at 12:00 on 1st of month' },
  { label: 'Custom', value: '', description: 'Enter your own cron expression' },
];

const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New York (EST/EDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'America/Denver (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST/PDT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEDT/AEST)' },
];

export default function ScheduleTriggerEditor({ trigger, onChange, onDelete }: ScheduleTriggerEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(() => {
    const preset = CRON_PRESETS.find((p) => p.value === trigger.cron);
    return preset?.value || '';
  });

  const handleCronChange = (cron: string) => {
    onChange({ ...trigger, cron });
  };

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    if (preset && preset !== '') {
      handleCronChange(preset);
    }
  };

  const handleTimezoneChange = (timezone: string) => {
    onChange({ ...trigger, timezone });
  };

  const handleMaxInstancesChange = (max_instances: number) => {
    onChange({ ...trigger, max_instances });
  };

  const handleEnabledChange = (enabled: boolean) => {
    onChange({ ...trigger, enabled });
  };

  const handleIdChange = (id: string) => {
    onChange({ ...trigger, id: id || undefined });
  };

  const currentPreset = CRON_PRESETS.find((p) => p.value === trigger.cron);

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-purple-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">⏰</span>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">Schedule Trigger</div>
            <div className="text-xs text-gray-500">Cron-based time trigger</div>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 text-sm font-medium"
        >
          Delete
        </button>
      </div>

      {/* Cron Preset */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Schedule Preset
        </label>
        <select
          value={selectedPreset}
          onChange={(e) => handlePresetChange(e.target.value)}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          {CRON_PRESETS.map((preset) => (
            <option key={preset.label} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>
        {currentPreset && (
          <p className="mt-0.5 text-xs text-gray-500">{currentPreset.description}</p>
        )}
      </div>

      {/* Custom Cron Expression */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Cron Expression <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={trigger.cron || ''}
          onChange={(e) => {
            handleCronChange(e.target.value);
            setSelectedPreset('');
          }}
          className="w-full px-2 py-1.5 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="* * * * *"
          required
        />
        <p className="mt-0.5 text-xs text-gray-500">
          Format: minute hour day month weekday (e.g., "0 9 * * 1-5" = weekdays at 9 AM)
        </p>
      </div>

      {/* Timezone */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Timezone
        </label>
        <select
          value={trigger.timezone || 'UTC'}
          onChange={(e) => handleTimezoneChange(e.target.value)}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
        <p className="mt-0.5 text-xs text-gray-500">
          Schedule times are interpreted in this timezone
        </p>
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
          {/* Trigger ID */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Trigger ID (Optional)
            </label>
            <input
              type="text"
              value={trigger.id || ''}
              onChange={(e) => handleIdChange(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="hourly-report"
            />
            <p className="mt-0.5 text-xs text-gray-500">Unique identifier for this trigger</p>
          </div>

          {/* Max Instances */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Max Concurrent Instances
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={trigger.max_instances || 1}
              onChange={(e) => handleMaxInstancesChange(parseInt(e.target.value))}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="mt-0.5 text-xs text-gray-500">
              Maximum number of concurrent executions (1 = prevent overlap)
            </p>
          </div>

          {/* Enabled Toggle */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={trigger.enabled !== false}
                onChange={(e) => handleEnabledChange(e.target.checked)}
                className="rounded text-purple-600"
              />
              <span className="text-sm text-gray-700">Enabled</span>
            </label>
            <p className="mt-0.5 text-xs text-gray-500 ml-6">
              Uncheck to temporarily disable this trigger
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
