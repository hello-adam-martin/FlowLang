import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../types/node';

function NoteNode({ data, selected }: NodeProps<FlowNodeData>) {
  const [isEditing, setIsEditing] = useState(false);
  const [noteText, setNoteText] = useState(data.config?.text || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    // Update data.config with new text
    if (data.config) {
      data.config.text = noteText;
    } else {
      data.config = { text: noteText };
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setNoteText(data.config?.text || '');
    }
    // Don't stop editing on Enter - allow multi-line notes
  };

  return (
    <div
      className={`rounded-lg border-2 border-dashed transition-all shadow-sm ${
        selected
          ? 'border-yellow-500 ring-2 ring-yellow-300 shadow-md bg-yellow-50'
          : 'border-yellow-400 bg-yellow-50'
      }`}
      style={{ minWidth: '200px', minHeight: '100px' }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Note icon header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-yellow-300 bg-yellow-100">
        <svg
          className="w-4 h-4 text-yellow-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
          />
        </svg>
        <span className="text-xs font-semibold text-yellow-800 uppercase tracking-wide">
          Note
        </span>
      </div>

      {/* Note content */}
      <div className="p-3">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full h-20 px-2 py-1 text-sm text-gray-700 bg-white border border-yellow-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
            placeholder="Add your note here..."
          />
        ) : (
          <div
            className="min-h-[80px] text-sm text-gray-700 whitespace-pre-wrap cursor-text hover:bg-yellow-100 rounded p-2 transition-colors"
            style={{ wordBreak: 'break-word' }}
          >
            {noteText || (
              <span className="text-gray-400 italic">Double-click to add note...</span>
            )}
          </div>
        )}
      </div>

      {/* Instruction hint */}
      {!isEditing && (
        <div className="px-3 pb-2 text-xs text-yellow-600 italic">
          Double-click to edit
        </div>
      )}
    </div>
  );
}

export default memo(NoteNode);
