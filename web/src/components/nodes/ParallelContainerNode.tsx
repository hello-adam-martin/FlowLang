import { memo, useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { Handle, Position, type NodeProps, useReactFlow, NodeResizer } from '@xyflow/react';
import { useFlowStore } from '../../store/flowStore';
import type { FlowNodeData } from '../../types/node';

function ParallelContainerNode({ selected, id, data }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const { getNodes, getNode } = useReactFlow();
  const removeNode = useFlowStore((state) => state.removeNode);
  const updateNode = useFlowStore((state) => state.updateNode);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find child nodes - use useMemo to recalculate when nodes change
  const childNodes = useMemo(() => {
    return getNodes().filter((n) => n.parentId === id);
  }, [nodes, id, getNodes]);

  // Get tracks from node data
  const tracks = nodeData.tracks || [];
  const trackCount = tracks.length;

  // Auto-adjust container height based on number of tracks
  useEffect(() => {
    const currentNode = getNode(id);
    if (!currentNode) return;

    // Calculate required height: header (60px) + padding + tracks
    // Each track needs 60px (40px height + 20px gap)
    const headerHeight = 60;
    const padding = 40; // 20px top + 20px bottom
    const minBodyHeight = 35; // Minimum body height
    const trackHeight = 60; // Height per track

    const requiredBodyHeight = Math.max(minBodyHeight, (tracks.length * trackHeight) - 25);
    const requiredHeight = headerHeight + padding + requiredBodyHeight;

    // Only update if height needs to change
    const currentHeight = currentNode.style?.height || currentNode.measured?.height || 195;
    if (typeof currentHeight === 'number' && Math.abs(currentHeight - requiredHeight) > 5) {
      // Update node style to set new height
      const updatedNode = {
        ...currentNode,
        style: {
          ...currentNode.style,
          height: requiredHeight,
        },
      };

      // Use onNodesChange to update the node
      const onNodesChange = useFlowStore.getState().onNodesChange;
      onNodesChange([
        { type: 'remove', id },
        { type: 'add', item: updatedNode },
      ]);
    }
  }, [tracks.length, id, getNode]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    // Don't stop propagation - allow parent to handle drag-over detection
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  };

  // Add a new track
  const handleAddTrack = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newTrackId = `track_${Date.now()}`;
    const newTracks = [...tracks, { id: newTrackId }];
    updateNode(id, { tracks: newTracks });
  };

  // Remove a track
  const handleRemoveTrack = (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();
    const newTracks = tracks.filter((t) => t.id !== trackId);
    updateNode(id, { tracks: newTracks });
  };

  return (
    <>
      <NodeResizer
        color="#22c55e"
        isVisible={selected}
        minWidth={450}
        minHeight={140}
        keepAspectRatio={false}
      />
      <div
        ref={containerRef}
        className={`relative bg-white/90 rounded-2xl border-2 transition-all ${
          selected
            ? 'border-green-400 shadow-xl ring-2 ring-green-200'
            : 'border-green-200 shadow-lg hover:shadow-xl hover:border-green-300'
        } w-full h-full`}
        onDragOver={onDragOver}
      >
      {/* Delete button - shows when selected */}
      {selected && (
        <button
          onClick={handleDelete}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center shadow-sm transition-all z-10 opacity-90 hover:opacity-100"
          title="Delete container"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}

      {/* Handles - left (input) and right (output) only */}
      <Handle type="source" position={Position.Left} id="left" className="w-2.5 h-2.5 bg-green-500 border-2 border-white shadow-sm" />
      <Handle type="source" position={Position.Right} id="right" className="w-2.5 h-2.5 bg-green-500 border-2 border-white shadow-sm" />

      {/* Header with subtle gradient */}
      <div className="bg-gradient-to-r from-green-50 to-green-100 border-b-2 border-green-200 px-4 py-3 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-bold">⇉</span>
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm text-gray-900">Parallel Execution</div>
            <div className="text-xs text-green-700">
              {trackCount > 0 ? `${trackCount} parallel track${trackCount !== 1 ? 's' : ''}` : 'All tasks execute concurrently'}
            </div>
          </div>
          <button
            onClick={handleAddTrack}
            className="flex-shrink-0 w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded flex items-center justify-center shadow-sm transition-all"
            title="Add new track"
          >
            <span className="text-sm font-bold">+</span>
          </button>
        </div>
      </div>

      {/* Droppable body area */}
      <div className="p-5 min-h-[200px] relative" data-dropzone="true">
        {/* Render ghost nodes for each track that doesn't have a task */}
        {tracks.map((track, index) => {
          // Check if this track has a task assigned
          const trackHasTask = childNodes.some((node) => (node.data as FlowNodeData).trackId === track.id);

          if (trackHasTask) return null;

          const topPosition = 15 + (index * 60); // 15px initial offset + 60px per track (40px height + 20px gap)

          return (
            <div
              key={track.id}
              className="absolute pointer-events-auto"
              style={{ left: '45px', top: `${topPosition}px` }}
              data-track-id={track.id}
            >
              <div className="w-[140px] h-[40px] rounded-xl border-2 border-dashed border-green-300 bg-green-50/40 flex items-center justify-center relative group">
                <span className="text-xs text-green-500">Track {index + 1}</span>
                {/* Delete button - shows on hover */}
                <button
                  onClick={(e) => handleRemoveTrack(e, track.id)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-sm transition-all opacity-0 group-hover:opacity-100"
                  title="Remove track"
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </>
  );
}

export default memo(ParallelContainerNode);
