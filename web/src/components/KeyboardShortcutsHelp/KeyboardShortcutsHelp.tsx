import { useEffect } from 'react';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutSection {
  title: string;
  shortcuts: {
    keys: string[];
    description: string;
  }[];
}

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? '⌘' : 'Ctrl';

const shortcutSections: ShortcutSection[] = [
  {
    title: 'Create Nodes',
    shortcuts: [
      { keys: ['T'], description: 'Create Task node' },
      { keys: ['C'], description: 'Create Conditional node' },
      { keys: ['L'], description: 'Create Loop node' },
      { keys: ['P'], description: 'Create Parallel node' },
      { keys: ['W'], description: 'Create Switch node' },
      { keys: ['S'], description: 'Create Subflow node' },
      { keys: ['E'], description: 'Create Exit node' },
    ],
  },
  {
    title: 'Flow Actions',
    shortcuts: [
      { keys: [modKey, 'D'], description: 'Duplicate selected node' },
      { keys: ['Delete'], description: 'Delete selected node(s)' },
      { keys: [modKey, 'Z'], description: 'Undo' },
      { keys: [modKey, 'Shift', 'Z'], description: 'Redo' },
      { keys: [modKey, 'A'], description: 'Select all nodes' },
      { keys: ['Esc'], description: 'Deselect all' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Space', 'Drag'], description: 'Pan canvas' },
      { keys: [modKey, '0'], description: 'Fit view to all nodes' },
      { keys: ['+'], description: 'Zoom in' },
      { keys: ['-'], description: 'Zoom out' },
    ],
  },
  {
    title: 'Panels & Actions',
    shortcuts: [
      { keys: [modKey, 'K'], description: 'Toggle node library' },
      { keys: [modKey, 'E'], description: 'Export to YAML' },
      { keys: [modKey, 'I'], description: 'Import from YAML' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
    ],
  },
];

export default function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Keyboard Shortcuts</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {shortcutSections.map((section) => (
                <div key={section.title}>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                    {section.title}
                  </h3>
                  <div className="space-y-2">
                    {section.shortcuts.map((shortcut, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between gap-4"
                      >
                        <span className="text-sm text-gray-600">{shortcut.description}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {shortcut.keys.map((key, keyIndex) => (
                            <span key={keyIndex} className="flex items-center gap-1">
                              <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded shadow-sm">
                                {key}
                              </kbd>
                              {keyIndex < shortcut.keys.length - 1 && (
                                <span className="text-gray-400 text-xs">+</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              Press <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-white border border-gray-300 rounded shadow-sm">?</kbd> to toggle this help
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
