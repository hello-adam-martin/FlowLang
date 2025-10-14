import { useState } from 'react';
import FlowDesigner from './components/FlowDesigner/FlowDesigner';
import NodeLibrary from './components/NodeLibrary/NodeLibrary';
import PropertyPanel from './components/PropertyPanel/PropertyPanel';
import FlowToolbar from './components/FlowToolbar/FlowToolbar';
import { useFlowStore } from './store/flowStore';
import './index.css';

function App() {
  const [showNodeLibrary, setShowNodeLibrary] = useState(false);
  const selectedNode = useFlowStore((state) => state.selectedNode);

  // Show properties panel when a node is selected
  const showProperties = selectedNode !== null;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Toolbar */}
      <FlowToolbar />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Add Node Button */}
        <button
          onClick={() => setShowNodeLibrary(!showNodeLibrary)}
          className="absolute top-4 right-4 z-10 w-14 h-14 bg-white rounded-lg shadow-lg border border-gray-200 flex items-center justify-center hover:bg-blue-50 hover:border-blue-400 transition-all"
          title="Add Node"
        >
          <span className="text-2xl font-semibold text-gray-700">+</span>
        </button>

        {/* Sliding Node Library Panel - Right Side */}
        <div
          className={`absolute top-0 right-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl z-20 transform transition-transform duration-300 ease-in-out ${
            showNodeLibrary ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">What happens next?</h2>
            <button
              onClick={() => setShowNodeLibrary(false)}
              className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            >
              ×
            </button>
          </div>
          <div className="overflow-y-auto h-[calc(100%-4rem)]">
            <NodeLibrary />
          </div>
        </div>

        {/* Center - Flow Designer */}
        <div className="flex-1">
          <FlowDesigner onNodeCreated={() => setShowNodeLibrary(false)} />
        </div>

        {/* Right sidebar - Property Panel (hidden by default) */}
        {showProperties && (
          <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
            <PropertyPanel />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
