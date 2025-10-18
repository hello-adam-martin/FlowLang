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

  const codeFiles: CodeFile[] = project ? [
    { name: 'flow.yaml', content: project.flowYaml, language: 'yaml' },
    { name: 'flow.py', content: project.flowPy, language: 'python' },
    { name: 'api.py', content: project.apiPy, language: 'python' },
    { name: 'README.md', content: project.readme, language: 'markdown' },
    { name: 'tests/test_tasks.py', content: project.tests, language: 'python' },
  ] : [];

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
          className="relative bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col"
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
          <div className="flex-1 overflow-hidden px-6 py-4">
            {!project ? (
              // Pre-generation view
              <div className="flex flex-col items-center justify-center h-full space-y-6">
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Ready to Generate Project
                  </h3>
                  <p className="text-sm text-gray-600 max-w-md">
                    Generate a complete FlowLang project including flow.yaml, flow.py with task stubs,
                    FastAPI server, tests, and documentation.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-6 max-w-md">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    What you'll get:
                  </h4>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span><strong>flow.yaml</strong> - Your flow definition</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span><strong>flow.py</strong> - Task implementations (stubs)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span><strong>api.py</strong> - FastAPI server</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span><strong>README.md</strong> - Complete documentation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span><strong>tests/</strong> - Unit test scaffolding</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <span className="flex items-center gap-2">
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
            ) : (
              // Post-generation view
              <div className="flex flex-col h-full space-y-4">
                {/* Success banner */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
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

                {/* Code viewer */}
                <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden">
                  <CodeViewer files={codeFiles} />
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
