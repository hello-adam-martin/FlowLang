import { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import FlowList from './FlowList';
import NewFlowModal from './NewFlowModal';
import { exportProjectToFile } from '../../services/projectPersistence';

interface FlowManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FlowManager({ isOpen, onClose }: FlowManagerProps) {
  const [showNewFlowModal, setShowNewFlowModal] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editProjectName, setEditProjectName] = useState('');

  const {
    project,
    setProjectName,
    createFlow,
    switchFlow,
    renameFlow,
    duplicateFlow,
    deleteFlow,
    exportProject,
    resetProject,
  } = useProjectStore();

  const handleCreateFlow = (name: string, description?: string) => {
    createFlow(name, description);
  };

  const handleExportProject = () => {
    try {
      exportProjectToFile(project);
      setShowProjectMenu(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to export project');
    }
  };

  const handleResetProject = () => {
    if (confirm('Reset project? This will create a new empty project and clear all flows. This cannot be undone.')) {
      resetProject();
      setShowProjectMenu(false);
    }
  };

  const startEditingProjectName = () => {
    setEditProjectName(project.metadata.name);
    setIsEditingProjectName(true);
    setShowProjectMenu(false);
  };

  const handleSaveProjectName = () => {
    if (editProjectName.trim() && editProjectName.trim() !== project.metadata.name) {
      setProjectName(editProjectName.trim());
    }
    setIsEditingProjectName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveProjectName();
    } else if (e.key === 'Escape') {
      setIsEditingProjectName(false);
    }
  };

  // Automatically show new flow modal when there are no flows
  useEffect(() => {
    const flowCount = Object.keys(project.flows).length;
    if (flowCount === 0 && isOpen) {
      setShowNewFlowModal(true);
    }
  }, [project.flows, isOpen]);

  if (!isOpen) return null;

  const flowCount = Object.keys(project.flows).length;

  return (
    <>
      <div className="w-80 h-full bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            {isEditingProjectName ? (
              <input
                type="text"
                value={editProjectName}
                onChange={(e) => setEditProjectName(e.target.value)}
                onBlur={handleSaveProjectName}
                onKeyDown={handleKeyDown}
                className="flex-1 px-2 py-1 text-lg font-bold border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <h2 className="text-lg font-bold text-gray-900 truncate">
                {project.metadata.name}
              </h2>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="ml-2 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
              title="Close Flow Manager"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="text-xs text-gray-500 mb-3">
            {flowCount} {flowCount === 1 ? 'flow' : 'flows'}
          </div>

          {/* New Flow Button */}
          <button
            onClick={() => setShowNewFlowModal(true)}
            className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Flow
          </button>
        </div>

        {/* Flow List */}
        <div className="flex-1 overflow-y-auto p-4">
          <FlowList
            flows={project.flows}
            currentFlowId={project.currentFlowId}
            onSelectFlow={switchFlow}
            onRenameFlow={renameFlow}
            onDuplicateFlow={duplicateFlow}
            onDeleteFlow={deleteFlow}
          />
        </div>

        {/* Footer - Project Actions */}
        <div className="p-4 border-t border-gray-200 relative">
          <button
            onClick={() => setShowProjectMenu(!showProjectMenu)}
            className="w-full px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-md hover:bg-gray-100 flex items-center justify-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Project Actions
          </button>

          {/* Project Menu Dropdown */}
          {showProjectMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowProjectMenu(false)}
              />

              {/* Menu */}
              <div className="absolute bottom-full left-4 right-4 mb-2 z-20 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
                <button
                  onClick={startEditingProjectName}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Rename Project
                </button>

                <button
                  onClick={handleExportProject}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export Project
                </button>

                <div className="border-t border-gray-200" />

                <button
                  onClick={handleResetProject}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Reset Project
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Flow Modal */}
      <NewFlowModal
        isOpen={showNewFlowModal}
        onClose={() => setShowNewFlowModal(false)}
        onCreate={handleCreateFlow}
      />
    </>
  );
}
