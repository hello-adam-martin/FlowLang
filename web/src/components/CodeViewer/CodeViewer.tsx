/**
 * CodeViewer Component
 *
 * Displays generated project files with syntax highlighting using Monaco editor.
 * Features:
 * - Multiple file tabs
 * - Read-only Monaco editor
 * - Syntax highlighting (Python, YAML, Markdown)
 * - Copy to clipboard
 * - Line numbers and minimap
 */

import { useState } from 'react';
import Editor from '@monaco-editor/react';

export interface CodeFile {
  name: string;
  content: string;
  language: string;
}

interface CodeViewerProps {
  files: CodeFile[];
  className?: string;
  /** Optional: Show only a single file (no tabs) */
  selectedFile?: string;
  /** Optional: Show tabs (default: true) */
  showTabs?: boolean;
}

export default function CodeViewer({
  files,
  className = '',
  selectedFile,
  showTabs = true
}: CodeViewerProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);

  if (files.length === 0) {
    return (
      <div className="code-viewer-empty flex items-center justify-center h-full">
        <p className="text-gray-500 text-sm">No files to display</p>
      </div>
    );
  }

  // Determine current file based on selectedFile prop or active tab
  let currentFile: CodeFile;
  if (selectedFile) {
    const found = files.find(f => f.name === selectedFile);
    currentFile = found || files[0];
  } else {
    currentFile = files[activeTab];
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy to clipboard');
    }
  };

  return (
    <div className={`code-viewer flex flex-col h-full ${className}`}>
      {/* File Tabs (optional) */}
      {showTabs && (
        <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
          {files.map((file, idx) => (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === idx
                  ? 'bg-white border-b-2 border-amber-500 text-amber-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {file.name}
            </button>
          ))}
        </div>
      )}

      {/* Editor Actions */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {currentFile.language.toUpperCase()}
          </span>
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs text-gray-500">
            {currentFile.content.split('\n').length} lines
          </span>
        </div>

        <button
          onClick={handleCopy}
          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
            copied
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title="Copy to clipboard"
        >
          {copied ? '✓ Copied!' : '📋 Copy'}
        </button>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={currentFile.language}
          value={currentFile.content}
          theme="vs-light"
          options={{
            readOnly: true,
            minimap: { enabled: true },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            fontSize: 13,
            wordWrap: 'on',
            renderWhitespace: 'selection',
            folding: true,
            renderLineHighlight: 'line',
          }}
        />
      </div>

      {/* File Info Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{currentFile.name}</span>
          <span>
            {(currentFile.content.length / 1024).toFixed(1)} KB
          </span>
        </div>
      </div>
    </div>
  );
}
