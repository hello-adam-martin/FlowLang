import { useFlowStore } from '../../store/flowStore';
import { flowToYaml, yamlToFlow, validateYaml } from '../../services/yamlConverter';
import { useRef, useState } from 'react';
import FlowSettingsModal from '../FlowSettings/FlowSettingsModal';
import YAMLPreviewModal from '../YAMLPreviewModal/YAMLPreviewModal';
import ExecutionResultsPanel from '../ExecutionResultsPanel/ExecutionResultsPanel';

interface FlowToolbarProps {
  onShowKeyboardHelp?: () => void;
  onToggleFlowManager?: () => void;
  showFlowManager?: boolean;
}

export default function FlowToolbar({ onShowKeyboardHelp, onToggleFlowManager, showFlowManager }: FlowToolbarProps) {
  const { flowDefinition, reset, nodes, edges, setNodes, setEdges, setFlowDefinition, execution } = useFlowStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showYAMLModal, setShowYAMLModal] = useState(false);
  const [showResultsPanel, setShowResultsPanel] = useState(false);
  const [showYAMLMenu, setShowYAMLMenu] = useState(false);

  const handleNew = () => {
    if (confirm('Create new flow? Current progress will be lost.')) {
      reset();
    }
  };

  const handleExport = () => {
    try {
      const yamlString = flowToYaml(nodes, edges, flowDefinition);

      // Create a download link
      const blob = new Blob([yamlString], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${flowDefinition.flow || 'flow'}.yaml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();

      // Validate YAML
      const validation = validateYaml(text);
      if (!validation.valid) {
        alert(`Invalid YAML:\n${validation.errors.join('\n')}`);
        return;
      }

      // Convert to flow
      const { nodes: newNodes, edges: newEdges, flowDefinition: newFlowDef } = yamlToFlow(text);

      setNodes(newNodes);
      setEdges(newEdges);
      setFlowDefinition(newFlowDef);
    } catch (error) {
      alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    // TODO: Implement save to server
    alert('Save to server coming soon!');
  };

  const handleCopyYAML = () => {
    try {
      const yamlString = flowToYaml(nodes, edges, flowDefinition);
      navigator.clipboard.writeText(yamlString);
      // Could add a toast notification here
      alert('YAML copied to clipboard!');
      setShowYAMLMenu(false);
    } catch (error) {
      alert(`Copy failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };


  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">
              FlowLang Designer
            </h1>

            {/* Flow Manager Toggle */}
            {onToggleFlowManager && (
              <button
                onClick={onToggleFlowManager}
                className={`p-1.5 rounded-md transition-colors ${
                  showFlowManager
                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
                title="Toggle Flow Manager"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
          </div>

          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
            title="Flow Settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {flowDefinition.flow}
          </button>

          {/* Trigger Summary */}
          {flowDefinition.triggers && flowDefinition.triggers.length > 0 && (
            <div className="flex items-center gap-2">
              {(() => {
                const webhookCount = flowDefinition.triggers.filter(t => t.type === 'webhook').length;
                const scheduleCount = flowDefinition.triggers.filter(t => t.type === 'schedule').length;

                return (
                  <>
                    {webhookCount > 0 && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 border border-blue-200 rounded-md">
                        <span className="text-blue-600 text-xs font-bold">🌐</span>
                        <span className="text-xs font-medium text-blue-700">
                          {webhookCount} webhook{webhookCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    {scheduleCount > 0 && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 border border-purple-200 rounded-md">
                        <span className="text-purple-600 text-xs font-bold">⏰</span>
                        <span className="text-xs font-medium text-purple-700">
                          {scheduleCount} schedule{scheduleCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Connection Summary */}
          {flowDefinition.connections && Object.keys(flowDefinition.connections).length > 0 && (
            <div className="flex items-center gap-2">
              {(() => {
                const connections = flowDefinition.connections;
                const postgresCount = Object.values(connections).filter(c => c.type === 'postgres').length;
                const mysqlCount = Object.values(connections).filter(c => c.type === 'mysql').length;
                const mongodbCount = Object.values(connections).filter(c => c.type === 'mongodb').length;
                const redisCount = Object.values(connections).filter(c => c.type === 'redis').length;
                const sqliteCount = Object.values(connections).filter(c => c.type === 'sqlite').length;
                const airtableCount = Object.values(connections).filter(c => c.type === 'airtable').length;

                return (
                  <>
                    {postgresCount > 0 && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 border border-blue-200 rounded-md">
                        <span className="text-blue-600 text-xs font-bold">🗄️</span>
                        <span className="text-xs font-medium text-blue-700">
                          {postgresCount} PostgreSQL
                        </span>
                      </div>
                    )}
                    {mysqlCount > 0 && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-50 border border-orange-200 rounded-md">
                        <span className="text-orange-600 text-xs font-bold">🗄️</span>
                        <span className="text-xs font-medium text-orange-700">
                          {mysqlCount} MySQL
                        </span>
                      </div>
                    )}
                    {mongodbCount > 0 && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 border border-green-200 rounded-md">
                        <span className="text-green-600 text-xs font-bold">📄</span>
                        <span className="text-xs font-medium text-green-700">
                          {mongodbCount} MongoDB
                        </span>
                      </div>
                    )}
                    {redisCount > 0 && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 border border-red-200 rounded-md">
                        <span className="text-red-600 text-xs font-bold">🔴</span>
                        <span className="text-xs font-medium text-red-700">
                          {redisCount} Redis
                        </span>
                      </div>
                    )}
                    {sqliteCount > 0 && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 border border-purple-200 rounded-md">
                        <span className="text-purple-600 text-xs font-bold">💾</span>
                        <span className="text-xs font-medium text-purple-700">
                          {sqliteCount} SQLite
                        </span>
                      </div>
                    )}
                    {airtableCount > 0 && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-50 border border-yellow-200 rounded-md">
                        <span className="text-yellow-600 text-xs font-bold">📊</span>
                        <span className="text-xs font-medium text-yellow-700">
                          {airtableCount} Airtable
                        </span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Cleanup Summary */}
          {flowDefinition.on_cancel && flowDefinition.on_cancel.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-50 border border-orange-200 rounded-md">
                <span className="text-orange-600 text-xs font-bold">🧹</span>
                <span className="text-xs font-medium text-orange-700">
                  {flowDefinition.on_cancel.length} cleanup{flowDefinition.on_cancel.length !== 1 ? ' steps' : ' step'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onShowKeyboardHelp && (
            <button
              onClick={onShowKeyboardHelp}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5"
              title="Keyboard shortcuts (press ?)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded">?</kbd>
            </button>
          )}
          {/* YAML Actions - Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setShowYAMLMenu(!showYAMLMenu)}
              className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 flex items-center gap-2 transition-colors"
              disabled={nodes.length === 0}
              title="YAML Actions"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span>YAML</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showYAMLMenu && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowYAMLMenu(false)}
                />

                {/* Menu */}
                <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
                  <button
                    onClick={() => {
                      setShowYAMLModal(true);
                      setShowYAMLMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <div className="flex-1">
                      <div className="font-medium">View YAML</div>
                      <div className="text-xs text-gray-500">Preview in modal</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      handleCopyYAML();
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <div className="flex-1">
                      <div className="font-medium">Copy to Clipboard</div>
                      <div className="text-xs text-gray-500">Quick copy</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      handleExport();
                      setShowYAMLMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <div className="flex-1">
                      <div className="font-medium">Download File</div>
                      <div className="text-xs text-gray-500">Export as .yaml</div>
                    </div>
                  </button>

                  <div className="border-t border-gray-200" />

                  <button
                    onClick={() => {
                      handleImport();
                      setShowYAMLMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L9 8m4-4v12" />
                    </svg>
                    <div className="flex-1">
                      <div className="font-medium">Import from File</div>
                      <div className="text-xs text-gray-500">Replace current flow</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* View Results Button - shows when execution has started */}
          {execution.status !== 'idle' && (
            <>
              <div className="h-6 w-px bg-gray-300" />
              <button
                onClick={() => setShowResultsPanel(true)}
                className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 flex items-center gap-1.5"
                title="View execution results"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Results
              </button>
            </>
          )}

          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>

      {/* Flow Settings Modal */}
      <FlowSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* YAML Preview Modal */}
      <YAMLPreviewModal
        isOpen={showYAMLModal}
        onClose={() => setShowYAMLModal(false)}
        title="Complete Flow YAML"
        yamlContent={flowToYaml(nodes, edges, flowDefinition)}
      />

      {/* Execution Results Panel */}
      <ExecutionResultsPanel
        isOpen={showResultsPanel}
        onClose={() => setShowResultsPanel(false)}
      />
    </div>
  );
}
