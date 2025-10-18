/**
 * FileTree Component
 *
 * Displays a file tree structure for navigating generated project files.
 * Used in the GenerateProjectModal to show project structure.
 */

import { useState } from 'react';

export interface FileTreeFile {
  name: string;
  path: string;
}

interface FileTreeProps {
  files: FileTreeFile[];
  selectedPath: string;
  onFileSelect: (path: string) => void;
}

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

/**
 * Build a tree structure from flat file list
 */
function buildTree(files: FileTreeFile[]): FileNode[] {
  const root: FileNode[] = [];
  const map = new Map<string, FileNode>();

  files.forEach(file => {
    const parts = file.path.split('/');
    let currentPath = '';

    parts.forEach((part, index) => {
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!map.has(currentPath)) {
        const isDirectory = index < parts.length - 1;
        const node: FileNode = {
          name: part,
          path: currentPath,
          isDirectory,
          children: isDirectory ? [] : undefined,
        };

        map.set(currentPath, node);

        if (parentPath) {
          const parent = map.get(parentPath);
          if (parent?.children) {
            parent.children.push(node);
          }
        } else {
          root.push(node);
        }
      }
    });
  });

  return root;
}

/**
 * FileTreeNode - Recursive component for tree nodes
 */
function FileTreeNode({
  node,
  selectedPath,
  onFileSelect,
  depth = 0
}: {
  node: FileNode;
  selectedPath: string;
  onFileSelect: (path: string) => void;
  depth?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isSelected = node.path === selectedPath;
  const isFile = !node.isDirectory;

  const handleClick = () => {
    if (isFile) {
      onFileSelect(node.path);
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded text-sm transition-colors ${
          isSelected
            ? 'bg-amber-100 text-amber-900 font-medium'
            : 'hover:bg-gray-100 text-gray-700'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {/* Folder icon or expand/collapse arrow */}
        {node.isDirectory && (
          <svg
            className={`w-3 h-3 text-gray-500 transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}

        {/* File/folder icon */}
        {isFile ? (
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        )}

        {/* File/folder name */}
        <span className="truncate">{node.name}</span>
      </div>

      {/* Children */}
      {node.isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child, index) => (
            <FileTreeNode
              key={index}
              node={child}
              selectedPath={selectedPath}
              onFileSelect={onFileSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * FileTree Component
 */
export default function FileTree({ files, selectedPath, onFileSelect }: FileTreeProps) {
  const tree = buildTree(files);

  return (
    <div className="flex flex-col h-full bg-gray-50 border-r border-gray-200">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-100">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <span className="text-xs font-medium text-gray-700 uppercase">Files</span>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {tree.map((node, index) => (
          <FileTreeNode
            key={index}
            node={node}
            selectedPath={selectedPath}
            onFileSelect={onFileSelect}
          />
        ))}
      </div>
    </div>
  );
}
