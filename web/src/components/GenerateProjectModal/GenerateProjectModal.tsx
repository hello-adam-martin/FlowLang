/**
 * Generate Project Modal
 *
 * Modal for generating complete FlowLang projects from visual flows.
 * Shows generated code and allows downloading as ZIP.
 */

import { useState } from 'react';
import { useFlowStore } from '../../store/flowStore';
import { generateProject, createProjectZip, type GeneratedProject } from '../../services/projectGenerator';
import CodeViewer, { type CodeFile } from '../CodeViewer/CodeViewer';
import FileTree, { type FileTreeFile } from '../FileTree/FileTree';
import { saveAs } from 'file-saver';

interface GenerateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GenerateProjectModal({ isOpen, onClose }: GenerateProjectModalProps) {
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const flowDefinition = useFlowStore((state) => state.flowDefinition);

  const [generating, setGenerating] = useState(false);
  const [project, setProject] = useState<GeneratedProject | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string>('flow.yaml');

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateProject(nodes, edges, flowDefinition);
      setProject(result);
    } catch (error) {
      console.error('Generation failed:', error);
      alert(`Failed to generate project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!project) return;

    setDownloading(true);
    try {
      const zipBlob = await createProjectZip(project);
      const fileName = `${project.flowName.replace(/[^a-z0-9]/gi, '_')}.zip`;
      saveAs(zipBlob, fileName);
    } catch (error) {
      console.error('Download failed:', error);
      alert(`Failed to download project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleClose = () => {
    setProject(null);
    onClose();
  };

  // Prepare files for display
  const codeFiles: CodeFile[] = project ? [
    { name: 'flow.yaml', content: project.flowYaml, language: 'yaml' },
    { name: 'flow.py', content: project.flowPy, language: 'python' },
    { name: 'api.py', content: project.apiPy, language: 'python' },
    { name: 'tools/start_server.sh', content: project.startServerSh, language: 'shell' },
    { name: 'README.md', content: project.readme, language: 'markdown' },
    { name: 'tests/test_tasks.py', content: project.tests, language: 'python' },
  ] : [];

  // Prepare file tree structure
  const fileTreeFiles: FileTreeFile[] = codeFiles.map(f => ({
    name: f.name,
    path: f.name
  }));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Generate FlowLang Project
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Create a complete, production-ready FlowLang project
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto px-6 py-4">
            {!project ? (
              // Pre-generation view - 2 column layout
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-full py-4">
                {/* Left Column: What you'll get + Generate button */}
                <div className="flex flex-col space-y-6">
                  {/* Header */}
                  <div className="text-center lg:text-left">
                    <div className="w-16 h-16 mx-auto lg:mx-0 mb-3 bg-amber-100 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Ready to Generate Project
                    </h3>
                    <p className="text-sm text-gray-600">
                      Create a complete, production-ready FlowLang project
                    </p>
                  </div>

                  {/* What you'll get */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 flex-1">
                    <h4 className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      What you'll get
                    </h4>
                    <ul className="space-y-2 text-sm text-amber-900">
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600 mt-0.5">✓</span>
                        <span><strong>flow.yaml</strong> - Flow definition</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600 mt-0.5">✓</span>
                        <span><strong>flow.py</strong> - Task stubs to implement</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600 mt-0.5">✓</span>
                        <span><strong>api.py</strong> - FastAPI server</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600 mt-0.5">✓</span>
                        <span><strong>tools/start_server.sh</strong> - Helper script</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600 mt-0.5">✓</span>
                        <span><strong>README.md</strong> - Documentation</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600 mt-0.5">✓</span>
                        <span><strong>tests/test_tasks.py</strong> - Unit tests</span>
                      </li>
                    </ul>
                  </div>

                  {/* Generate button */}
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="w-full px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed shadow-sm"
                  >
                    {generating ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Generating...
                      </span>
                    ) : (
                      '✨ Generate Project'
                    )}
                  </button>
                </div>

                {/* Right Column: Next steps, Requirements, Status */}
                <div className="flex flex-col space-y-4">
                  {/* Next Steps */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                    <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      Next steps after generation
                    </h4>
                    <ol className="space-y-2 text-sm text-blue-900">
                      <li className="flex items-start gap-2">
                        <span className="font-semibold min-w-[1.5rem]">1.</span>
                        <span>Download ZIP file</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-semibold min-w-[1.5rem]">2.</span>
                        <span>Extract to your workspace</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-semibold min-w-[1.5rem]">3.</span>
                        <span>Create virtual environment</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-semibold min-w-[1.5rem]">4.</span>
                        <span>Install FlowLang (<code className="text-xs bg-blue-100 px-1 rounded">pip install flowlang</code>)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-semibold min-w-[1.5rem]">5.</span>
                        <span>Implement task stubs in flow.py</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-semibold min-w-[1.5rem]">6.</span>
                        <span>Run tests (<code className="text-xs bg-blue-100 px-1 rounded">pytest tests/</code>)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-semibold min-w-[1.5rem]">7.</span>
                        <span>Start server (<code className="text-xs bg-blue-100 px-1 rounded">./tools/start_server.sh</code>)</span>
                      </li>
                    </ol>
                  </div>

                  {/* Technical Requirements */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Technical requirements
                    </h4>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400">•</span>
                        <span>Python 3.8 or higher</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400">•</span>
                        <span>FlowLang package</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400">•</span>
                        <span>Virtual environment (recommended)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-400">•</span>
                        <span>Dependencies: FastAPI, uvicorn, pyyaml</span>
                      </li>
                    </ul>
                  </div>

                  {/* Implementation Status Preview */}
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-5">
                    <h4 className="text-sm font-semibold text-orange-900 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Implementation status
                    </h4>
                    <div className="text-sm text-orange-900 space-y-2">
                      <p>All tasks will be generated as stubs:</p>
                      <div className="bg-orange-100 rounded px-3 py-2 font-mono text-xs">
                        <div>Tasks: {nodes.filter(n => n.data?.step?.task).length}</div>
                        <div>Implemented: 0 (0%)</div>
                        <div className="text-orange-700 mt-1">⚠️ Ready for implementation</div>
                      </div>
                      <p className="text-xs">Each task will raise <code className="bg-orange-100 px-1 rounded">NotImplementedTaskError</code> until you add your code.</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Post-generation view - Split layout with file tree
              <div className="flex flex-col h-full">
                {/* Success banner */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex-shrink-0">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-green-900">
                        Project Generated Successfully!
                      </h3>
                      <div className="mt-2 text-sm text-green-800">
                        <p className="mb-1">
                          <strong>{project.flowName}</strong> - {project.taskCount} task{project.taskCount !== 1 ? 's' : ''} defined
                        </p>
                        <p className="text-xs">
                          📊 Implementation Status: {project.implementedCount}/{project.taskCount} ({project.implementedCount === 0 ? 'All tasks are stubs' : `${Math.round((project.implementedCount / project.taskCount) * 100)}% complete`})
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Split layout: File tree + Code viewer */}
                <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden flex">
                  {/* Left: File tree */}
                  <div className="w-64 flex-shrink-0">
                    <FileTree
                      files={fileTreeFiles}
                      selectedPath={selectedFile}
                      onFileSelect={setSelectedFile}
                    />
                  </div>

                  {/* Right: Code viewer */}
                  <div className="flex-1">
                    <CodeViewer
                      files={codeFiles}
                      selectedFile={selectedFile}
                      showTabs={false}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              {project && (
                <span>
                  Ready to download and implement tasks
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Close
              </button>
              {project && (
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {downloading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Downloading...
                    </>
                  ) : (
                    <>
                      ⬇️ Download ZIP
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
