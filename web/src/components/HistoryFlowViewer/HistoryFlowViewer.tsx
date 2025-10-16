import { useCallback, useRef, useState, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  type ReactFlowInstance,
  type Node,
  type Edge,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { ExecutionHistoryEntry } from '../../types/execution';
import type { FlowNodeData } from '../../types/node';
import type { NodeExecutionData } from '../../types/project';
import ExecutionNodeOverlay from '../ExecutionNodeOverlay/ExecutionNodeOverlay';

// Import custom node types
import StartNode from '../nodes/StartNode';
import TaskNode from '../nodes/TaskNode';
import LoopContainerNode from '../nodes/LoopContainerNode';
import ConditionalContainerNode from '../nodes/ConditionalContainerNode';
import SwitchContainerNode from '../nodes/SwitchContainerNode';
import ParallelContainerNode from '../nodes/ParallelContainerNode';
import SubflowNode from '../nodes/SubflowNode';
import ExitNode from '../nodes/ExitNode';
import NoteNode from '../nodes/NoteNode';

const nodeTypes = {
  start: StartNode,
  task: TaskNode,
  loopContainer: LoopContainerNode,
  conditionalContainer: ConditionalContainerNode,
  switchContainer: SwitchContainerNode,
  parallelContainer: ParallelContainerNode,
  subflow: SubflowNode,
  exit: ExitNode,
  note: NoteNode,
};

interface HistoryFlowViewerProps {
  execution: ExecutionHistoryEntry;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
}

export default function HistoryFlowViewer({ execution, nodes, edges }: HistoryFlowViewerProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isReactFlowReady, setIsReactFlowReady] = useState(false); // Track when ReactFlow is initialized
  const hasCalledFitViewRef = useRef<string | null>(null); // Track execution ID for which we've called fitView

  // Replay state
  const [isReplaying, setIsReplaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1); // 1x, 2x, 4x
  const [replayTime, setReplayTime] = useState(0); // Current replay time in ms
  const replayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Build execution timeline sorted by start time
  const executionTimeline = Object.entries(execution.nodeStates)
    .filter(([_, state]) => state.startTime)
    .sort(([, a], [, b]) => (a.startTime || 0) - (b.startTime || 0))
    .map(([nodeId, state]) => ({
      nodeId,
      startTime: (state.startTime || 0) - execution.timestamp, // Relative to execution start
      endTime: state.endTime ? (state.endTime - execution.timestamp) : null,
      state: state.state,
    }));

  const maxReplayTime = execution.duration || 0;


  // Replay timer effect
  useEffect(() => {
    if (isReplaying && replayTime < maxReplayTime) {
      replayTimerRef.current = setTimeout(() => {
        setReplayTime(prev => Math.min(prev + (50 * replaySpeed), maxReplayTime));
      }, 50); // Update every 50ms
    } else if (replayTime >= maxReplayTime && isReplaying) {
      setIsReplaying(false);
    }

    return () => {
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current);
      }
    };
  }, [isReplaying, replayTime, maxReplayTime, replaySpeed]);

  // Reset replay when execution changes
  useEffect(() => {
    setReplayTime(0);
    setIsReplaying(false);
    // Reset fitView tracking for new execution
    hasCalledFitViewRef.current = null;
  }, [execution.id]);

  // Call fitView when ReactFlow is ready
  useEffect(() => {
    if (
      isReactFlowReady &&
      reactFlowInstance.current &&
      nodes.length > 0 &&
      hasCalledFitViewRef.current !== execution.id
    ) {
      // Use requestAnimationFrame to ensure DOM is fully updated
      const rafId = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Get node IDs to fit
          const nodeIds = nodes.map(n => n.id);

          reactFlowInstance.current?.fitView({
            padding: 0.2,
            duration: 300,
            maxZoom: 1,
            minZoom: 0.1,
            includeHiddenNodes: false,
            nodes: nodeIds.map(id => ({ id })),
          });

          hasCalledFitViewRef.current = execution.id;
        });
      });

      return () => {
        cancelAnimationFrame(rafId);
      };
    }
  }, [execution.id, nodes, isReactFlowReady]);

  // Get node state at current replay time with progress
  const getNodeStateAtTime = (nodeId: string): { state: NodeExecutionData; progress: number } | null => {
    const nodeState = execution.nodeStates[nodeId];
    if (!nodeState || !nodeState.startTime) return null;

    const relativeStart = nodeState.startTime - execution.timestamp;
    const relativeEnd = nodeState.endTime ? nodeState.endTime - execution.timestamp : null;

    // If replay is active or scrubbing, show progressive state
    if (isReplaying || replayTime > 0) {
      if (replayTime < relativeStart) {
        return null; // Not started yet
      } else if (relativeEnd && replayTime >= relativeEnd) {
        return { state: { ...nodeState }, progress: 100 }; // Completed
      } else {
        // Currently running - calculate progress
        const nodeDuration = relativeEnd ? relativeEnd - relativeStart : 1000;
        const elapsed = replayTime - relativeStart;
        const progress = Math.min(100, Math.max(0, (elapsed / nodeDuration) * 100));

        return {
          state: { ...nodeState, state: 'running' as const },
          progress
        };
      }
    }

    // Default: show full state
    return { state: nodeState, progress: 100 };
  };

  // Add execution overlay to nodes - memoized based on replay time
  const nodesWithOverlay = nodes.map(node => {
    const result = getNodeStateAtTime(node.id);
    const nodeState = result?.state;

    // Add execution state class for highlighting
    let className = 'history-node';
    if (nodeState) {
      className += ` executed-${nodeState.state}`;
    }

    return {
      ...node,
      className,
      data: {
        ...node.data,
        // Pass execution state for custom rendering if needed
        executionState: nodeState,
        // Store progress for overlay rendering
        executionProgress: result?.progress || 100,
        // Add replayTime as key to force updates
        replayKey: `${node.id}-${replayTime}-${isReplaying}`,
      },
      // Make nodes non-interactive in history mode
      draggable: false,
      connectable: false,
      deletable: false,
      selectable: true,
    };
  });

  // Highlight edges that were traversed during execution
  const edgesWithHighlight = edges.map(edge => {
    const sourceResult = getNodeStateAtTime(edge.source);
    const targetResult = getNodeStateAtTime(edge.target);
    const sourceState = sourceResult?.state;
    const targetState = targetResult?.state;

    // Edge was traversed if both source and target were executed
    const wasTraversed = sourceState && targetState &&
                         (sourceState.state === 'completed' || sourceState.state === 'error') &&
                         (targetState.state !== 'pending');

    if (wasTraversed) {
      return {
        ...edge,
        animated: true,
        style: {
          stroke: sourceState.state === 'error' ? '#ef4444' : '#10b981',
          strokeWidth: 2.5
        },
        markerEnd: {
          type: 'arrowclosed' as const,
          color: sourceState.state === 'error' ? '#ef4444' : '#10b981',
        },
      };
    }

    // Check if edge is currently being traversed (source complete, target running)
    const isTraversing = sourceState && targetState &&
                        (sourceState.state === 'completed' || sourceState.state === 'error') &&
                        targetState.state === 'running';

    if (isTraversing) {
      return {
        ...edge,
        animated: true,
        style: {
          stroke: '#3b82f6',
          strokeWidth: 2.5
        },
        markerEnd: {
          type: 'arrowclosed' as const,
          color: '#3b82f6',
        },
      };
    }

    return {
      ...edge,
      style: { stroke: '#e5e7eb', strokeWidth: 1.5 },
      markerEnd: {
        type: 'arrowclosed' as const,
        color: '#e5e7eb',
      },
    };
  });

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: any) => {
      setSelectedNodeId(node.id);
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const handlePlayPause = () => {
    if (replayTime >= maxReplayTime) {
      // Restart from beginning
      setReplayTime(0);
      setIsReplaying(true);
    } else {
      setIsReplaying(!isReplaying);
    }
  };

  const handleReset = () => {
    setReplayTime(0);
    setIsReplaying(false);
  };

  const handleSpeedChange = () => {
    const speeds = [1, 2, 4];
    const currentIndex = speeds.indexOf(replaySpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    setReplaySpeed(speeds[nextIndex]);
  };

  return (
    <div className="relative w-full h-full bg-gray-50">
      <div className="w-full h-full" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodesWithOverlay}
          edges={edgesWithHighlight}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onInit={(instance) => {
            reactFlowInstance.current = instance as any;
            setIsReactFlowReady(true);
            // Immediately call fitView on init
            setTimeout(() => {
              instance.fitView({
                padding: 0.2,
                duration: 0,
                maxZoom: 1,
                minZoom: 0.1,
              });
            }, 0);
          }}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{
            padding: 0.2,
            maxZoom: 1,
            minZoom: 0.1,
          }}
          panOnDrag={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          panOnScroll={false}
          preventScrolling={true}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          selectNodesOnDrag={false}
          snapToGrid={true}
          snapGrid={[15, 15]}
          attributionPosition="bottom-left"
        >
          <Controls position="bottom-right" />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          <MiniMap position="bottom-left" />
        </ReactFlow>
      </div>

      {/* Render execution overlays on top of nodes */}
      {Object.entries(execution.nodeStates).map(([nodeId]) => {
        const node = nodes.find(n => n.id === nodeId);
        const result = getNodeStateAtTime(nodeId);

        if (!node || !reactFlowInstance.current || !result) return null;

        // Get node position in viewport coordinates
        const nodeElement = document.querySelector(`[data-id="${nodeId}"]`);
        if (!nodeElement) return null;

        return (
          <div
            key={`${nodeId}-${replayTime}`}
            style={{
              position: 'absolute',
              pointerEvents: 'none',
            }}
          >
            <ExecutionNodeOverlay
              nodeState={result.state}
              compact={true}
              progressPercent={result.progress}
            />
          </div>
        );
      })}

      {/* Node details popover when selected */}
      {selectedNodeId && execution.nodeStates[selectedNodeId] && (
        <div className="absolute bottom-4 left-4 right-4 max-w-2xl bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-10">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {nodes.find(n => n.id === selectedNodeId)?.data.label || selectedNodeId}
              </h3>
              <p className="text-xs text-gray-500 font-mono">{selectedNodeId}</p>
            </div>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {(() => {
            const nodeState = execution.nodeStates[selectedNodeId];
            const duration = nodeState.startTime && nodeState.endTime
              ? ((nodeState.endTime - nodeState.startTime) / 1000).toFixed(2)
              : null;

            return (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`px-2 py-1 rounded font-medium ${
                    nodeState.state === 'completed' ? 'bg-green-100 text-green-700' :
                    nodeState.state === 'error' ? 'bg-red-100 text-red-700' :
                    nodeState.state === 'skipped' ? 'bg-gray-100 text-gray-600' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {nodeState.state}
                  </span>
                  {duration && (
                    <span className="text-gray-600">Duration: {duration}s</span>
                  )}
                </div>

                {nodeState.inputs && Object.keys(nodeState.inputs).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Inputs
                    </h4>
                    <div className="text-xs font-mono bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto max-h-40">
                      <pre className="inline">{`{`}</pre>
                      {Object.entries(nodeState.inputs).map(([key, value], index, arr) => (
                        <div key={key} className="ml-4">
                          <pre className="inline">{`"${key}": `}</pre>
                          <pre className="inline">{JSON.stringify(value)}</pre>
                          {nodeState.inputSources?.[key] && (
                            <span className="text-gray-400 ml-2">{`// from ${nodeState.inputSources[key]}`}</span>
                          )}
                          {index < arr.length - 1 && <pre className="inline">,</pre>}
                        </div>
                      ))}
                      <pre className="inline">{`}`}</pre>
                    </div>
                  </div>
                )}

                {nodeState.output && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Output
                    </h4>
                    <pre className="text-xs font-mono bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto max-h-40">
                      {JSON.stringify(nodeState.output, null, 2)}
                    </pre>
                  </div>
                )}

                {nodeState.error && (
                  <div>
                    <h4 className="text-xs font-semibold text-red-700 mb-1">Error</h4>
                    <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                      {nodeState.error}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Empty state hint */}
      {Object.keys(execution.nodeStates).length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-400">
            <p className="text-sm font-medium">No nodes were executed</p>
          </div>
        </div>
      )}

      {/* Replay Controls */}
      {executionTimeline.length > 0 && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-xl border border-gray-200 p-3 z-20">
          <div className="flex items-center gap-3">
            {/* Play/Pause Button */}
            <button
              onClick={handlePlayPause}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title={isReplaying ? 'Pause' : replayTime >= maxReplayTime ? 'Replay' : 'Play'}
            >
              {isReplaying ? (
                <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Reset Button */}
            <button
              onClick={handleReset}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Reset"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Progress Bar */}
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max={maxReplayTime}
                  value={replayTime}
                  onChange={(e) => {
                    setReplayTime(Number(e.target.value));
                    setIsReplaying(false);
                  }}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(replayTime / maxReplayTime) * 100}%, #e5e7eb ${(replayTime / maxReplayTime) * 100}%, #e5e7eb 100%)`
                  }}
                />
                <span className="text-xs text-gray-600 font-mono min-w-[80px] text-right">
                  {(replayTime / 1000).toFixed(1)}s / {(maxReplayTime / 1000).toFixed(1)}s
                </span>
              </div>
            </div>

            {/* Speed Control */}
            <button
              onClick={handleSpeedChange}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              title="Change speed"
            >
              {replaySpeed}x
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
