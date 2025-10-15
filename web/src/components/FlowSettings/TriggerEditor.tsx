import { useState } from 'react';
import WebhookTriggerEditor from './WebhookTriggerEditor';
import ScheduleTriggerEditor from './ScheduleTriggerEditor';
import type { TriggerConfig } from '../../types/flow';

interface TriggerEditorProps {
  triggers: TriggerConfig[];
  onChange: (triggers: TriggerConfig[]) => void;
}

type TriggerType = 'webhook' | 'schedule';

export default function TriggerEditor({ triggers, onChange }: TriggerEditorProps) {
  const [addingType, setAddingType] = useState<TriggerType | null>(null);

  const handleAddTrigger = (type: TriggerType) => {
    const newTrigger: TriggerConfig = type === 'webhook'
      ? {
          type: 'webhook',
          path: '/webhooks/new-webhook',
          method: 'POST',
        }
      : {
          type: 'schedule',
          cron: '0 * * * *',
          timezone: 'UTC',
        };

    onChange([...triggers, newTrigger]);
    setAddingType(null);
  };

  const handleUpdateTrigger = (index: number, updatedTrigger: TriggerConfig) => {
    const newTriggers = [...triggers];
    newTriggers[index] = updatedTrigger;
    onChange(newTriggers);
  };

  const handleDeleteTrigger = (index: number) => {
    const newTriggers = triggers.filter((_, i) => i !== index);
    onChange(newTriggers);
  };

  return (
    <div className="space-y-4">
      {/* Existing Triggers */}
      {triggers.length > 0 ? (
        <div className="space-y-3">
          {triggers.map((trigger, index) => (
            <div key={index}>
              {trigger.type === 'webhook' ? (
                <WebhookTriggerEditor
                  trigger={trigger as any}
                  onChange={(updated) => handleUpdateTrigger(index, updated)}
                  onDelete={() => handleDeleteTrigger(index)}
                />
              ) : trigger.type === 'schedule' ? (
                <ScheduleTriggerEditor
                  trigger={trigger as any}
                  onChange={(updated) => handleUpdateTrigger(index, updated)}
                  onDelete={() => handleDeleteTrigger(index)}
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <div className="text-sm text-gray-500 mb-2">No triggers configured</div>
          <div className="text-xs text-gray-400">
            Add a webhook or schedule trigger to enable event-driven execution
          </div>
        </div>
      )}

      {/* Add Trigger Section */}
      {addingType === null ? (
        <div className="flex gap-2">
          <button
            onClick={() => setAddingType('webhook')}
            className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
          >
            + Add Webhook Trigger
          </button>
          <button
            onClick={() => setAddingType('schedule')}
            className="flex-1 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100 transition-colors"
          >
            + Add Schedule Trigger
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 bg-gray-100 border border-gray-300 rounded-md">
          <span className="text-sm text-gray-700">
            Add {addingType === 'webhook' ? 'Webhook' : 'Schedule'} Trigger?
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handleAddTrigger(addingType)}
              className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setAddingType(null)}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
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
            <div className="text-xs font-medium text-blue-900 mb-1">About Triggers</div>
            <div className="text-xs text-blue-700 space-y-1">
              <div><strong>Webhook triggers</strong> execute flows via HTTP requests (events, API calls)</div>
              <div><strong>Schedule triggers</strong> execute flows automatically on a cron schedule</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
