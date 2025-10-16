import { useEffect } from 'react';
import { useFlowStore } from '../store/flowStore';
import type { FlowNodeType } from '../types/node';

interface KeyboardShortcutsOptions {
  onCreateNode: (nodeType: FlowNodeType) => void;
  onToggleNodeLibrary: () => void;
  onShowHelp: () => void;
  onExportYaml: () => void;
  onImportYaml: () => void;
  onFitView: () => void;
  onToggleFlowManager?: () => void;
  onNextFlow?: () => void;
  onPreviousFlow?: () => void;
  onNewFlow?: () => void;
  disabled?: boolean;
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions) {
  const {
    onCreateNode,
    onToggleNodeLibrary,
    onShowHelp,
    onExportYaml,
    onImportYaml,
    onFitView,
    onToggleFlowManager,
    onNextFlow,
    onPreviousFlow,
    onNewFlow,
    disabled = false
  } = options;

  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs, textareas, or contenteditable elements
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      // Single key shortcuts (no modifiers)
      if (!event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
        switch (event.key.toLowerCase()) {
          case 't':
            event.preventDefault();
            onCreateNode('task');
            break;
          case 'c':
            event.preventDefault();
            onCreateNode('conditionalContainer');
            break;
          case 'l':
            event.preventDefault();
            onCreateNode('loopContainer');
            break;
          case 'p':
            event.preventDefault();
            onCreateNode('parallelContainer');
            break;
          case 'w':
            event.preventDefault();
            onCreateNode('switchContainer');
            break;
          case 's':
            event.preventDefault();
            onCreateNode('subflow');
            break;
          case 'e':
            event.preventDefault();
            onCreateNode('exit');
            break;
          case 'n':
            event.preventDefault();
            onCreateNode('note');
            break;
          case '?':
            event.preventDefault();
            onShowHelp();
            break;
          case 'escape':
            // Let ReactFlow handle escape for deselection
            break;
        }
      }

      // Cmd/Ctrl + Key shortcuts
      if (cmdOrCtrl && !event.shiftKey) {
        switch (event.key.toLowerCase()) {
          case 'k':
            event.preventDefault();
            onToggleNodeLibrary();
            break;
          case 'e':
            event.preventDefault();
            onExportYaml();
            break;
          case 'i':
            event.preventDefault();
            onImportYaml();
            break;
          case '0':
            event.preventDefault();
            onFitView();
            break;
          case 'b':
            event.preventDefault();
            onToggleFlowManager?.();
            break;
          case 'n':
            event.preventDefault();
            onNewFlow?.();
            break;
          case 'tab':
            event.preventDefault();
            onNextFlow?.();
            break;
        }
      }

      // Cmd/Ctrl + Shift + Key shortcuts
      if (cmdOrCtrl && event.shiftKey) {
        switch (event.key.toLowerCase()) {
          case 'tab':
            event.preventDefault();
            onPreviousFlow?.();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, onCreateNode, onToggleNodeLibrary, onShowHelp, onExportYaml, onImportYaml, onFitView, onToggleFlowManager, onNextFlow, onPreviousFlow, onNewFlow]);
}
