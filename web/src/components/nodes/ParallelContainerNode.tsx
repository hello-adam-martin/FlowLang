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
        color="#9ca3af"
        isVisible={selected}
        minWidth={450}
        minHeight={150}
        keepAspectRatio={false}
      />
      <div
        ref={containerRef}
        className={`relative bg-white/90 rounded-2xl border-2 transition-all group ${
          selected
            ? 'border-gray-400 shadow-xl ring-2 ring-gray-200'
            : 'border-gray-200 shadow-lg hover:shadow-xl hover:border-gray-300'
        } w-full h-full`}
        onDragOver={onDragOver}
      >
      {/* Delete button - shows on hover */}
      <button
        onClick={handleDelete}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center shadow-sm transition-all z-10 opacity-0 group-hover:opacity-100 cursor-pointer"
        title="Delete container"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      {/* Handles - left (input square) and right (output circle) like task node */}
      <Handle type="target" position={Position.Left} id="left" className="!w-3 !h-3 !border-2 !border-white !bg-gray-300 !rounded-sm hover:!bg-gray-400 transition-all" />
      <Handle type="source" position={Position.Right} id="right" className="!w-3 !h-3 !border-2 !border-white !bg-gray-300 !rounded-full hover:!bg-gray-400 transition-all" />

      {/* Header with subtle gradient */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200 px-4 py-[15px] rounded-t-2xl relative">
        {/* Badge - positioned absolute in top right */}
        {nodeData.badge && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono text-gray-800">
            {nodeData.badge}
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-bold">⇉</span>
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm text-gray-900">{nodeData.label || 'Parallel Execution'}</div>
            <div className="text-xs text-gray-700">
              {trackCount > 0 ? `${trackCount} parallel track${trackCount !== 1 ? 's' : ''}` : 'All tasks execute concurrently'}
            </div>
          </div>
          <button
            onClick={handleAddTrack}
            className="flex-shrink-0 w-6 h-6 bg-gray-500 hover:bg-gray-600 text-white rounded flex items-center justify-center shadow-sm transition-all"
            title="Add new track"
          >
            <span className="text-sm font-bold">+</span>
          </button>
        </div>
      </div>

      {/* Droppable body area */}
      <div className="p-[15px] min-h-[200px] relative overflow-visible" data-dropzone="true">
        {/* Render track lanes - these are visual guides, child nodes render automatically by ReactFlow */}
        {tracks.map((track, index) => {
          // Check if this track has a task assigned
          const trackHasTask = childNodes.some((node) => (node.data as FlowNodeData).trackId === track.id);

          const topPosition = 15 + (index * 60); // 15px initial offset + 60px per track (40px height + 20px gap)

          return (
            <div
              key={track.id}
              className="absolute w-full"
              style={{ left: '0', top: `${topPosition}px`, right: '0' }}
              data-track-id={track.id}
            >
              {/* Track background lane */}
              <div className="mx-[15px] h-[40px] rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/10 flex items-start justify-between px-2 py-1 relative group">
                {/* Track label badge - positioned absolute to not block */}
                <div className="absolute top-1 left-2 text-[10px] font-semibold text-gray-700 bg-gray-100/80 px-1.5 py-0.5 rounded z-10">
                  Track {index + 1}
                </div>

                {/* Empty state hint - only when no task assigned */}
                {!trackHasTask && (
                  <div className="flex items-center justify-center w-full h-full text-gray-400 text-xs pointer-events-none">
                    Drop task here
                  </div>
                )}

                {/* Delete track button - shows on hover */}
                <button
                  onClick={(e) => handleRemoveTrack(e, track.id)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-sm transition-all opacity-0 group-hover:opacity-100 z-10"
                  title="Remove track"
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Child nodes with trackId render here automatically by ReactFlow */}
            </div>
          );
        })}
      </div>
      </div>
    </>
  );
}

export default memo(ParallelContainerNode);
