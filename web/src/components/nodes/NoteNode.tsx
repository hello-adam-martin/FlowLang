import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps, NodeResizer } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';
import { useFlowStore } from '../../store/flowStore';

type NoteType = 'info' | 'warning' | 'error' | 'success';

const NOTE_STYLES: Record<NoteType, {
  border: string;
  borderSelected: string;
  bg: string;
  headerBg: string;
  headerBorder: string;
  textColor: string;
  icon: string;
  label: string;
}> = {
  info: {
    border: 'border-blue-400',
    borderSelected: 'border-blue-500',
    bg: 'bg-blue-50',
    headerBg: 'bg-blue-100',
    headerBorder: 'border-blue-300',
    textColor: 'text-blue-800',
    icon: 'ℹ️',
    label: 'Info',
  },
  warning: {
    border: 'border-yellow-400',
    borderSelected: 'border-yellow-500',
    bg: 'bg-yellow-50',
    headerBg: 'bg-yellow-100',
    headerBorder: 'border-yellow-300',
    textColor: 'text-yellow-800',
    icon: '⚠️',
    label: 'Warning',
  },
  error: {
    border: 'border-red-400',
    borderSelected: 'border-red-500',
    bg: 'bg-red-50',
    headerBg: 'bg-red-100',
    headerBorder: 'border-red-300',
    textColor: 'text-red-800',
    icon: '❌',
    label: 'Error',
  },
  success: {
    border: 'border-green-400',
    borderSelected: 'border-green-500',
    bg: 'bg-green-50',
    headerBg: 'bg-green-100',
    headerBorder: 'border-green-300',
    textColor: 'text-green-800',
    icon: '✓',
    label: 'Success',
  },
};

function NoteNode({ data, selected, id }: NodeProps<FlowNodeData>) {
  const [isEditing, setIsEditing] = useState(false);
  const [noteText, setNoteText] = useState(data.config?.text || '');
  const [noteType, setNoteType] = useState<NoteType>(data.config?.noteType || 'info');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const removeNode = useFlowStore((state) => state.removeNode);
  const updateNode = useFlowStore((state) => state.updateNode);

  const styles = NOTE_STYLES[noteType];

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    // Update node data
    updateNode(id, {
      ...data,
      config: { text: noteText, noteType },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setNoteText(data.config?.text || '');
    }
    // Don't stop editing on Enter - allow multi-line notes
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  };

  const handleTypeChange = (type: NoteType) => {
    setNoteType(type);
    setShowTypeMenu(false);
    updateNode(id, {
      ...data,
      config: { text: noteText, noteType: type },
    });
  };

  return (
    <div
      className={`rounded-lg border-2 border-dashed transition-all shadow-sm relative flex flex-col ${
        selected
          ? `${styles.borderSelected} ring-2 ring-opacity-30 shadow-md ${styles.bg}`
          : `${styles.border} ${styles.bg}`
      }`}
      style={{ width: '100%', height: '100%', minWidth: '150px', minHeight: '80px' }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Node Resizer - shows when selected */}
      {selected && (
        <NodeResizer
          minWidth={150}
          minHeight={80}
          isVisible={selected}
          lineClassName={`${styles.border} border-2`}
          handleClassName={`${styles.bg} ${styles.border} border-2`}
        />
      )}

      {/* Delete button - shows when selected */}
      {selected && (
        <button
          onClick={handleDelete}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center shadow-sm transition-all z-10 opacity-90 hover:opacity-100"
          title="Delete note"
        >
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}

      {/* Note icon header with type dropdown */}
      <div className={`flex items-center justify-between px-2 py-1.5 border-b ${styles.headerBorder} ${styles.headerBg} relative`}>
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{styles.icon}</span>
          <span className={`text-[10px] font-semibold ${styles.textColor} uppercase tracking-wide`}>
            {styles.label}
          </span>
        </div>

        {/* Type selector button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowTypeMenu(!showTypeMenu);
          }}
          className={`text-xs ${styles.textColor} hover:opacity-70 transition-opacity`}
          title="Change note type"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Type dropdown menu */}
        {showTypeMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowTypeMenu(false)}
            />
            <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-20 min-w-[100px]">
              {(Object.keys(NOTE_STYLES) as NoteType[]).map((type) => (
                <button
                  key={type}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTypeChange(type);
                  }}
                  className={`w-full px-2 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center gap-1.5 ${
                    noteType === type ? 'bg-gray-100' : ''
                  }`}
                >
                  <span>{NOTE_STYLES[type].icon}</span>
                  <span>{NOTE_STYLES[type].label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Note content */}
      <div className="p-3 flex-1 overflow-hidden">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={`w-full h-full px-2 py-1 text-sm text-gray-700 bg-white border rounded resize-none focus:outline-none focus:ring-2 ${styles.border} ${styles.borderSelected.replace('border-', 'focus:ring-')}`}
            placeholder="Add your note here..."
          />
        ) : (
          <div
            className={`h-full text-sm text-gray-700 whitespace-pre-wrap cursor-text rounded p-2 transition-colors hover:opacity-80 overflow-auto`}
            style={{ wordBreak: 'break-word' }}
          >
            {noteText || (
              <span className="text-gray-400 italic">Double-click to add note...</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(NoteNode);
