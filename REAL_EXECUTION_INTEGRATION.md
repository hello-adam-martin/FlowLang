# Real FlowLang Execution Integration

## Overview

This document outlines the plan to integrate real Python-based FlowLang execution into the web designer, enabling users to generate complete FlowLang projects and execute flows using the actual Python backend rather than just the TypeScript simulation.

### Vision

Users can design flows visually in the web UI, then:
1. **Generate** a complete FlowLang project (flow.yaml, flow.py, api.py, tests, etc.)
2. **View** the generated Python code in the UI
3. **Execute** flows using the real Python FlowLang engine
4. **See** actual execution results (not mock data)

This bridges the gap between visual design and production-ready code.

### Goals

- **Dual Execution Modes**: Keep simulation for quick prototyping, add real execution for production validation
- **Zero Config**: Auto-start Python server, auto-generate projects
- **Developer Experience**: See generated code, understand what's implemented vs stubbed
- **Production Path**: Clear path from design → implementation → deployment

### Non-Goals (Out of Scope)

- ❌ In-app code editing (users edit flow.py manually in their IDE)
- ❌ Full IDE replacement (focus on generation and execution)
- ❌ Complex deployment features (that's for later)

## Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                         Web Designer (React)                     │
│                                                                   │
│  ┌──────────────┐                           ┌─────────────────┐ │
│  │   Canvas     │                           │  Execution Mode │ │
│  │  (ReactFlow) │                           │    Selector     │ │
│  └──────────────┘                           └────────┬────────┘ │
│                                                       │          │
│                         ┌─────────────────────────────┴────────┐ │
│                         │                                      │ │
│                    ┌────▼─────┐                    ┌──────────▼┐ │
│                    │Simulation│                    │   Real    │ │
│                    │  Modal   │                    │Execution  │ │
│                    │          │                    │  Modal    │ │
│                    │ (Mock    │                    │           │ │
│                    │  Data)   │                    └─────┬─────┘ │
│                    └──────────┘                          │       │
│                                                           │       │
└───────────────────────────────────────────────────────────┼───────┘
                                                            │
                    ┌───────────────────────────────────────▼────────┐
                    │         Backend Services (TypeScript)          │
                    │                                                 │
                    │  ┌──────────────┐        ┌──────────────────┐ │
                    │  │  Project     │        │   Server         │ │
                    │  │  Generator   │        │   Manager        │ │
                    │  └──────┬───────┘        └────────┬─────────┘ │
                    │         │                         │           │
                    │         │    ┌────────────────────┘           │
                    │         │    │                                │
                    └─────────┼────┼────────────────────────────────┘
                              │    │
                    ┌─────────▼────▼────────────────────────────────┐
                    │      Python Subprocess (FlowLang Server)       │
                    │                                                 │
                    │  ┌──────────────┐        ┌──────────────────┐ │
                    │  │  Scaffolder  │        │   FlowServer     │ │
                    │  │  (Generate)  │        │   (Execute)      │ │
                    │  └──────────────┘        └──────────────────┘ │
                    │                                                 │
                    │  Generated Project:                             │
                    │  - flow.yaml                                    │
                    │  - flow.py (task stubs)                         │
                    │  - api.py                                       │
                    │  - tests/                                       │
                    └─────────────────────────────────────────────────┘
```

### Component Overview

| Component | Type | Purpose |
|-----------|------|---------|
| **RealExecutionModal** | React Component | UI for real execution with project generation |
| **CodeViewer** | React Component | Display generated Python code (Monaco editor) |
| **projectGenerator** | Service | Generate FlowLang projects via scaffolder |
| **serverManager** | Service | Start/stop Python server subprocess |
| **backendService** | Service | HTTP client for FlowLang API |
| **FlowStore** | State | Add backend execution state |

## User Workflows

### Workflow 1: Quick Execution (Simulation)

**Use Case**: Rapid prototyping, testing flow logic

```
1. User designs flow in canvas
2. User clicks "Run Simulation"
3. SimulationModal opens with mock data inputs
4. User enters test values
5. Simulation runs (TypeScript flowSimulator.ts)
6. Results shown immediately
7. No Python required
```

**Pros**: Fast, no setup, great for prototyping
**Cons**: Mock data only, doesn't validate real implementation

### Workflow 2: Real Execution (First Time)

**Use Case**: Validate flow works with real Python backend

```
1. User designs flow in canvas
2. User clicks "Run Real Execution"
3. RealExecutionModal opens
4. System detects no project generated yet
5. User clicks "Generate Project"
   → Shows loading spinner
   → Calls Python scaffolder
   → Generates flow.yaml, flow.py, api.py, tests
6. CodeViewer shows generated flow.py
   → User sees task stubs with NotImplementedTaskError
7. User clicks "Start Server"
   → Spawns Python server subprocess
   → Health check polls until ready
   → Status indicator turns green 🟢
8. User enters input values
9. User clicks "Execute Flow"
   → POST to /flows/{name}/execute
   → Returns: success=false, pending_tasks=[...], progress="0/5"
10. Modal shows warning: "5 tasks need implementation"
11. User sees generated code, understands what to implement
```

### Workflow 3: Real Execution (After Implementation)

**Use Case**: Test flow with implemented tasks

```
1. User has implemented some tasks in flow.py (in their IDE)
2. User clicks "Run Real Execution"
3. RealExecutionModal opens
4. Server already running (green status)
5. User clicks "Refresh Status"
   → GET /flows/{name}/tasks
   → Shows: "3/5 tasks implemented (60%)"
6. User enters input values
7. User clicks "Execute Flow"
8. If all required tasks implemented:
   → Flow executes successfully
   → Returns: success=true, outputs={...}, execution_time_ms=245
   → Results displayed with actual data
9. If some tasks still stubbed:
   → Returns: success=false, error="NotImplementedTaskError: TaskName"
   → Shows which task failed
```

### Workflow 4: Iterative Development

**Use Case**: Design → Implement → Test cycle

```
1. Design flow in UI
2. Generate project
3. Download project ZIP
4. Open in VS Code
5. Implement tasks in flow.py
6. Save changes
7. Return to web UI
8. Click "Execute Flow" (server auto-reloads with hot reload)
9. See real results
10. Iterate: modify flow in UI → regenerate → implement → test
```

## Implementation Phases

### Phase 1: Project Generation (2-3 days)

**Goal**: Generate complete FlowLang projects from the web designer

#### Tasks

##### 1.1. Create Project Generator Service (~4 hours)

**File**: `web/src/services/projectGenerator.ts`

**Features**:
- Export flow to YAML string
- Call Python scaffolder to generate project
- Return generated file contents
- Handle errors (invalid YAML, scaffolder failures)

**API**:
```typescript
export interface GeneratedProject {
  flowYaml: string;
  flowPy: string;
  apiPy: string;
  readme: string;
  tests: string;
  projectPath: string;
  taskCount: number;
  implementedCount: number;
}

export async function generateProject(
  flowYaml: string,
  outputDir: string
): Promise<GeneratedProject> {
  // Call Python scaffolder via subprocess or HTTP
  // Return generated file contents
}
```

**Implementation Options**:

Option A: Direct subprocess call
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function generateProject(
  flowYaml: string,
  outputDir: string
): Promise<GeneratedProject> {
  // Write YAML to temp file
  const tempYaml = path.join(tmpdir(), 'flow.yaml');
  await fs.writeFile(tempYaml, flowYaml);

  // Run scaffolder
  const cmd = `python -m flowlang.scaffolder scaffold ${tempYaml} -o ${outputDir}`;
  const { stdout, stderr } = await execAsync(cmd);

  // Read generated files
  const flowPy = await fs.readFile(path.join(outputDir, 'flow.py'), 'utf-8');
  const apiPy = await fs.readFile(path.join(outputDir, 'api.py'), 'utf-8');
  // ... etc

  return {
    flowYaml,
    flowPy,
    apiPy,
    // ...
  };
}
```

Option B: HTTP API (if we add scaffolder endpoint to Python server)
```typescript
export async function generateProject(
  flowYaml: string,
  outputDir: string
): Promise<GeneratedProject> {
  const response = await fetch('http://localhost:8000/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flow_yaml: flowYaml, output_dir: outputDir })
  });

  if (!response.ok) {
    throw new Error(`Generation failed: ${response.statusText}`);
  }

  return await response.json();
}
```

**Recommendation**: Start with Option A (subprocess) - simpler, no Python changes needed.

##### 1.2. Create Code Viewer Component (~6 hours)

**File**: `web/src/components/CodeViewer/CodeViewer.tsx`

**Features**:
- Monaco editor for syntax highlighting
- Multiple file tabs (flow.yaml, flow.py, api.py, README.md)
- Read-only mode
- Copy to clipboard button
- Download project as ZIP button
- Line numbers
- Minimap

**Dependencies**:
```bash
npm install @monaco-editor/react
npm install jszip file-saver @types/file-saver
```

**Component API**:
```typescript
interface CodeViewerProps {
  files: {
    name: string;
    content: string;
    language: string;
  }[];
  onDownload?: () => void;
}

export default function CodeViewer({ files, onDownload }: CodeViewerProps) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="code-viewer">
      {/* File tabs */}
      <div className="tabs">
        {files.map((file, idx) => (
          <button
            key={idx}
            className={activeTab === idx ? 'active' : ''}
            onClick={() => setActiveTab(idx)}
          >
            {file.name}
          </button>
        ))}
      </div>

      {/* Editor */}
      <Editor
        height="600px"
        language={files[activeTab].language}
        value={files[activeTab].content}
        options={{
          readOnly: true,
          minimap: { enabled: true },
          lineNumbers: 'on',
        }}
      />

      {/* Actions */}
      <div className="actions">
        <button onClick={() => copyToClipboard(files[activeTab].content)}>
          📋 Copy
        </button>
        <button onClick={onDownload}>
          ⬇️ Download Project
        </button>
      </div>
    </div>
  );
}
```

##### 1.3. Add "Generate Project" UI (~4 hours)

**File**: `web/src/components/ToolBar/ToolBar.tsx` (modified)

Add button to toolbar:
```typescript
<button
  onClick={handleGenerateProject}
  className="toolbar-button"
  title="Generate FlowLang project"
>
  📦 Generate Project
</button>
```

**Modal Flow**:
1. User clicks "Generate Project"
2. Modal opens: `GenerateProjectModal.tsx`
3. Shows project settings:
   - Output directory picker
   - Flow name
   - Description
4. User clicks "Generate"
5. Loading spinner while scaffolder runs
6. CodeViewer displays generated files
7. Download button saves as ZIP

**File**: `web/src/components/GenerateProjectModal/GenerateProjectModal.tsx` (new)

```typescript
export default function GenerateProjectModal({ isOpen, onClose }) {
  const [generating, setGenerating] = useState(false);
  const [project, setProject] = useState<GeneratedProject | null>(null);
  const [outputDir, setOutputDir] = useState('~/flowlang-projects/MyFlow');

  const flowDefinition = useFlowStore(state => state.flowDefinition);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // Export flow to YAML
      const yaml = flowToYaml(nodes, edges, flowDefinition);

      // Generate project
      const result = await generateProject(yaml, outputDir);

      setProject(result);
    } catch (error) {
      alert(`Generation failed: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!project) return;

    // Create ZIP with JSZip
    const zip = new JSZip();
    zip.file('flow.yaml', project.flowYaml);
    zip.file('flow.py', project.flowPy);
    zip.file('api.py', project.apiPy);
    zip.file('README.md', project.readme);
    zip.file('tests/test_tasks.py', project.tests);

    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `${flowDefinition.name || 'flow'}.zip`);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2>Generate FlowLang Project</h2>

      {!project ? (
        // Settings form
        <div>
          <label>
            Output Directory:
            <input
              type="text"
              value={outputDir}
              onChange={e => setOutputDir(e.target.value)}
            />
          </label>

          <button onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generating...' : '✨ Generate Project'}
          </button>
        </div>
      ) : (
        // Show generated code
        <div>
          <p>✅ Project generated successfully!</p>
          <p>📊 {project.implementedCount}/{project.taskCount} tasks implemented</p>

          <CodeViewer
            files={[
              { name: 'flow.yaml', content: project.flowYaml, language: 'yaml' },
              { name: 'flow.py', content: project.flowPy, language: 'python' },
              { name: 'api.py', content: project.apiPy, language: 'python' },
              { name: 'README.md', content: project.readme, language: 'markdown' },
            ]}
            onDownload={handleDownload}
          />
        </div>
      )}
    </Modal>
  );
}
```

##### 1.4. Testing

**Test Criteria**:
- ✅ Click "Generate Project" button
- ✅ Modal opens with settings
- ✅ Generate button calls scaffolder
- ✅ Loading state shows during generation
- ✅ CodeViewer displays flow.yaml correctly
- ✅ CodeViewer displays flow.py with task stubs
- ✅ Tab switching works (flow.yaml, flow.py, api.py, README.md)
- ✅ Copy button copies code to clipboard
- ✅ Download button creates valid ZIP file
- ✅ ZIP contains all expected files
- ✅ Generated flow.py matches scaffolder output
- ✅ Error handling shows meaningful messages

---

### Phase 2: Backend Server Management (3-4 days)

**Goal**: Auto-start and manage Python FlowLang server

#### Tasks

##### 2.1. Create Server Manager Service (~8 hours)

**File**: `web/src/services/serverManager.ts`

**Features**:
- Spawn Python server as subprocess
- Monitor server health (poll /health endpoint)
- Detect startup completion
- Graceful shutdown
- Port conflict handling
- Server logs capture

**API**:
```typescript
export interface ServerConfig {
  projectDir: string;
  port: number;
  pythonPath?: string; // default: 'python'
  enableHotReload?: boolean; // default: true
}

export interface ServerStatus {
  running: boolean;
  port: number;
  pid?: number;
  startTime?: number;
  health: 'healthy' | 'unhealthy' | 'unknown';
  flowName?: string;
  implementationStatus?: {
    implemented: number;
    total: number;
    progress: string;
  };
}

export class ServerManager {
  private process: ChildProcess | null = null;
  private config: ServerConfig;
  private status: ServerStatus;
  private logs: string[] = [];

  async start(config: ServerConfig): Promise<void> {
    // Start Python server subprocess
  }

  async stop(): Promise<void> {
    // Gracefully stop server
  }

  async getStatus(): Promise<ServerStatus> {
    // Return current server status
  }

  getLogs(): string[] {
    // Return captured stdout/stderr
  }

  onLog(callback: (log: string) => void): void {
    // Subscribe to log events
  }
}
```

**Implementation**:
```typescript
import { spawn, ChildProcess } from 'child_process';

export class ServerManager {
  private process: ChildProcess | null = null;
  private config: ServerConfig;
  private status: ServerStatus = {
    running: false,
    port: 8000,
    health: 'unknown',
  };
  private logs: string[] = [];
  private logCallbacks: Array<(log: string) => void> = [];

  async start(config: ServerConfig): Promise<void> {
    if (this.process) {
      throw new Error('Server already running');
    }

    this.config = config;
    this.status.port = config.port;

    // Build command
    const pythonPath = config.pythonPath || 'python';
    const args = [
      '-m', 'flowlang.server',
      '--project', config.projectDir,
      '--port', config.port.toString(),
    ];

    if (config.enableHotReload) {
      args.push('--reload');
    }

    // Spawn process
    this.process = spawn(pythonPath, args, {
      cwd: config.projectDir,
      env: { ...process.env },
    });

    this.status.pid = this.process.pid;
    this.status.startTime = Date.now();

    // Capture logs
    this.process.stdout?.on('data', (data) => {
      const log = data.toString();
      this.logs.push(log);
      this.logCallbacks.forEach(cb => cb(log));

      // Detect startup completion
      if (log.includes('Application startup complete')) {
        this.status.running = true;
        this.checkHealth();
      }
    });

    this.process.stderr?.on('data', (data) => {
      const log = `[ERROR] ${data.toString()}`;
      this.logs.push(log);
      this.logCallbacks.forEach(cb => cb(log));
    });

    this.process.on('exit', (code) => {
      this.logs.push(`Server exited with code ${code}`);
      this.status.running = false;
      this.status.health = 'unknown';
      this.process = null;
    });

    // Wait for startup (poll health endpoint)
    await this.waitForStartup();
  }

  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    this.process.kill('SIGTERM');
    this.process = null;
    this.status.running = false;
    this.status.health = 'unknown';
  }

  async getStatus(): Promise<ServerStatus> {
    if (this.status.running) {
      await this.checkHealth();
    }
    return { ...this.status };
  }

  private async waitForStartup(timeout: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const healthy = await this.checkHealth();
        if (healthy) {
          return;
        }
      } catch (error) {
        // Server not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error('Server failed to start within timeout');
  }

  private async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(
        `http://localhost:${this.config.port}/health`,
        { signal: AbortSignal.timeout(2000) }
      );

      if (response.ok) {
        const data = await response.json();
        this.status.health = 'healthy';
        this.status.flowName = data.flow_name;

        if (data.implementation_status) {
          this.status.implementationStatus = {
            implemented: data.implementation_status.implemented,
            total: data.implementation_status.total,
            progress: data.implementation_status.progress,
          };
        }

        return true;
      }
    } catch (error) {
      this.status.health = 'unhealthy';
    }

    return false;
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  onLog(callback: (log: string) => void): void {
    this.logCallbacks.push(callback);
  }
}

// Singleton instance
export const serverManager = new ServerManager();
```

##### 2.2. Create Backend Service (~4 hours)

**File**: `web/src/services/backendService.ts`

**Features**:
- HTTP client for FlowLang API
- Health checks
- Flow execution
- Implementation status queries
- Error handling

**API**:
```typescript
export interface ExecutionRequest {
  inputs: Record<string, any>;
}

export interface ExecutionResult {
  success: boolean;
  outputs?: Record<string, any>;
  error?: string;
  error_details?: string;
  execution_time_ms?: number;
  flow: string;
  pending_tasks?: string[];
  implementation_progress?: string;
}

export interface ImplementationStatus {
  total: number;
  implemented: number;
  pending: number;
  progress: string;
  percentage: number;
  tasks: Record<string, boolean>;
}

export class BackendService {
  constructor(private baseUrl: string) {}

  async checkHealth(): Promise<boolean> {
    // GET /health
  }

  async executeFlow(
    flowName: string,
    inputs: Record<string, any>
  ): Promise<ExecutionResult> {
    // POST /flows/{flowName}/execute
  }

  async getImplementationStatus(flowName: string): Promise<ImplementationStatus> {
    // GET /flows/{flowName}/tasks
  }

  async listFlows(): Promise<string[]> {
    // GET /flows
  }
}
```

**Implementation**:
```typescript
export class BackendService {
  constructor(private baseUrl: string) {
    // Normalize URL (remove trailing slash)
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async executeFlow(
    flowName: string,
    inputs: Record<string, any>
  ): Promise<ExecutionResult> {
    const response = await fetch(
      `${this.baseUrl}/flows/${flowName}/execute`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Execution failed: ${error}`);
    }

    return await response.json();
  }

  async getImplementationStatus(flowName: string): Promise<ImplementationStatus> {
    const response = await fetch(`${this.baseUrl}/flows/${flowName}/tasks`);

    if (!response.ok) {
      throw new Error('Failed to get implementation status');
    }

    const data = await response.json();
    return {
      total: data.total,
      implemented: data.implemented,
      pending: data.total - data.implemented,
      progress: `${data.implemented}/${data.total}`,
      percentage: (data.implemented / data.total) * 100,
      tasks: data.tasks,
    };
  }

  async listFlows(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/flows`);
    if (!response.ok) {
      throw new Error('Failed to list flows');
    }
    const data = await response.json();
    return data.flows || [];
  }
}
```

##### 2.3. Add Server Status UI (~6 hours)

**File**: `web/src/components/ServerStatus/ServerStatus.tsx` (new)

**Features**:
- Status indicator (🟢 Running, 🔴 Stopped, 🟡 Starting)
- Port display
- Implementation status badge
- Start/Stop buttons
- Server logs viewer (collapsible)
- Connection mode toggle (auto-start vs manual)

**Component**:
```typescript
export default function ServerStatus() {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [connectionMode, setConnectionMode] = useState<'auto' | 'manual'>('auto');
  const [manualUrl, setManualUrl] = useState('http://localhost:8000');

  useEffect(() => {
    // Poll server status every 2 seconds
    const interval = setInterval(async () => {
      const currentStatus = await serverManager.getStatus();
      setStatus(currentStatus);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    try {
      await serverManager.start({
        projectDir: './generated-project', // TODO: get from state
        port: 8000,
        enableHotReload: true,
      });
    } catch (error) {
      alert(`Failed to start server: ${error.message}`);
    }
  };

  const handleStop = async () => {
    await serverManager.stop();
  };

  const statusIcon = status?.running
    ? '🟢'
    : status?.health === 'unhealthy'
    ? '🔴'
    : '⚪';

  const statusText = status?.running
    ? 'Running'
    : 'Stopped';

  return (
    <div className="server-status-panel">
      <div className="status-header">
        <span className="status-icon">{statusIcon}</span>
        <span className="status-text">{statusText}</span>
        {status?.port && <span className="port">:{status.port}</span>}
      </div>

      {status?.implementationStatus && (
        <div className="implementation-status">
          <span className="badge">
            {status.implementationStatus.progress} tasks implemented
          </span>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${(status.implementationStatus.implemented / status.implementationStatus.total) * 100}%`
              }}
            />
          </div>
        </div>
      )}

      <div className="actions">
        {!status?.running ? (
          <button onClick={handleStart} className="btn-start">
            ▶️ Start Server
          </button>
        ) : (
          <button onClick={handleStop} className="btn-stop">
            ⏹️ Stop Server
          </button>
        )}
      </div>

      <div className="connection-mode">
        <label>
          <input
            type="radio"
            checked={connectionMode === 'auto'}
            onChange={() => setConnectionMode('auto')}
          />
          Auto-start
        </label>
        <label>
          <input
            type="radio"
            checked={connectionMode === 'manual'}
            onChange={() => setConnectionMode('manual')}
          />
          Manual connection
        </label>
      </div>

      {connectionMode === 'manual' && (
        <div className="manual-connection">
          <input
            type="text"
            value={manualUrl}
            onChange={e => setManualUrl(e.target.value)}
            placeholder="http://localhost:8000"
          />
          <button>Connect</button>
        </div>
      )}

      <div className="logs-section">
        <button onClick={() => setShowLogs(!showLogs)}>
          {showLogs ? '▼' : '▶'} Server Logs
        </button>
        {showLogs && (
          <div className="logs">
            {logs.map((log, i) => (
              <div key={i} className="log-line">{log}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

##### 2.4. Testing

**Test Criteria**:
- ✅ Can start Python server from UI
- ✅ Status indicator shows "Starting" (🟡) during startup
- ✅ Status indicator shows "Running" (🟢) when healthy
- ✅ Port number displays correctly
- ✅ Can stop server gracefully
- ✅ Server logs appear in UI
- ✅ Logs update in real-time
- ✅ Implementation status badge shows X/Y tasks
- ✅ Can switch between auto-start and manual mode
- ✅ Manual mode accepts custom URL
- ✅ Manual mode connects to externally-started server
- ✅ Handles port conflicts (suggests alternate port)
- ✅ Shows error if Python not found
- ✅ Shows error if project directory invalid

---

### Phase 3: Real Execution Integration (2-3 days)

**Goal**: Execute flows via Python backend and display results

#### Tasks

##### 3.1. Create Real Execution Modal (~8 hours)

**File**: `web/src/components/ExecutionModal/RealExecutionModal.tsx` (new)

**Features**:
- Input form (similar to SimulationModal)
- Server connection status
- Project generation status
- Execute button
- Results display (outputs, errors, timing)
- Implementation status warnings
- Link to generated code

**Component**:
```typescript
interface RealExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RealExecutionModal({ isOpen, onClose }: RealExecutionModalProps) {
  const flowDefinition = useFlowStore(state => state.flowDefinition);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [projectGenerated, setProjectGenerated] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [inputs, setInputs] = useState<Record<string, any>>({});

  const backendService = useMemo(
    () => new BackendService(`http://localhost:${serverStatus?.port || 8000}`),
    [serverStatus]
  );

  // Check server status on mount
  useEffect(() => {
    const checkStatus = async () => {
      const status = await serverManager.getStatus();
      setServerStatus(status);
    };

    checkStatus();
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleGenerateProject = async () => {
    const yaml = flowToYaml(nodes, edges, flowDefinition);
    const project = await generateProject(yaml, './generated-project');
    setProjectGenerated(true);
  };

  const handleStartServer = async () => {
    await serverManager.start({
      projectDir: './generated-project',
      port: 8000,
      enableHotReload: true,
    });
  };

  const handleExecute = async () => {
    setExecuting(true);
    setResult(null);

    try {
      const result = await backendService.executeFlow(
        flowDefinition.name || 'UnnamedFlow',
        inputs
      );
      setResult(result);
    } catch (error) {
      setResult({
        success: false,
        error: error.message,
        flow: flowDefinition.name || 'UnnamedFlow',
      });
    } finally {
      setExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="large">
      <h2>Real Flow Execution</h2>

      {/* Step 1: Generate Project */}
      <section className="step">
        <h3>1. Generate Project</h3>
        {!projectGenerated ? (
          <button onClick={handleGenerateProject} className="btn-primary">
            📦 Generate FlowLang Project
          </button>
        ) : (
          <div className="success">✅ Project generated</div>
        )}
      </section>

      {/* Step 2: Start Server */}
      <section className="step">
        <h3>2. Start Server</h3>
        <ServerStatus />
      </section>

      {/* Step 3: Input Values */}
      {serverStatus?.running && (
        <section className="step">
          <h3>3. Input Values</h3>
          <div className="inputs-form">
            {flowDefinition.inputs?.map(input => (
              <div key={input.name} className="input-field">
                <label>
                  {input.name}
                  {input.required && <span className="required">*</span>}
                </label>
                <input
                  type={input.type === 'number' ? 'number' : 'text'}
                  value={inputs[input.name] || ''}
                  onChange={e => setInputs({
                    ...inputs,
                    [input.name]: e.target.value
                  })}
                  placeholder={input.description}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Step 4: Execute */}
      {serverStatus?.running && (
        <section className="step">
          <h3>4. Execute Flow</h3>

          {serverStatus.implementationStatus && (
            <div className="implementation-warning">
              ⚠️ {serverStatus.implementationStatus.progress} tasks implemented
              {serverStatus.implementationStatus.implemented < serverStatus.implementationStatus.total && (
                <span> - Some tasks are stubs and will fail</span>
              )}
            </div>
          )}

          <button
            onClick={handleExecute}
            disabled={executing}
            className="btn-execute"
          >
            {executing ? '⏳ Executing...' : '▶️ Execute Flow'}
          </button>
        </section>
      )}

      {/* Results */}
      {result && (
        <section className="results">
          <h3>Results</h3>
          {result.success ? (
            <div className="success-result">
              <div className="result-header">
                ✅ Success ({result.execution_time_ms}ms)
              </div>
              <div className="outputs">
                <h4>Outputs:</h4>
                <pre>{JSON.stringify(result.outputs, null, 2)}</pre>
              </div>
            </div>
          ) : (
            <div className="error-result">
              <div className="result-header">
                ❌ Error
              </div>
              <div className="error-message">{result.error}</div>
              {result.error_details && (
                <details>
                  <summary>Error Details</summary>
                  <pre>{result.error_details}</pre>
                </details>
              )}
              {result.pending_tasks && (
                <div className="pending-tasks">
                  <h4>Unimplemented Tasks:</h4>
                  <ul>
                    {result.pending_tasks.map(task => (
                      <li key={task}>{task}</li>
                    ))}
                  </ul>
                  <p>
                    Implement these tasks in flow.py to execute the flow.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </Modal>
  );
}
```

##### 3.2. Add Execution Mode Selector (~3 hours)

**File**: `web/src/components/ToolBar/ToolBar.tsx` (modified)

Add toggle for execution mode:

```typescript
export default function ToolBar() {
  const [executionMode, setExecutionMode] = useState<'simulation' | 'real'>('simulation');
  const [showSimulationModal, setShowSimulationModal] = useState(false);
  const [showRealExecutionModal, setShowRealExecutionModal] = useState(false);

  const handleExecute = () => {
    if (executionMode === 'simulation') {
      setShowSimulationModal(true);
    } else {
      setShowRealExecutionModal(true);
    }
  };

  return (
    <div className="toolbar">
      {/* Existing buttons */}

      {/* Execution Mode Selector */}
      <div className="execution-mode-selector">
        <label>Execution Mode:</label>
        <select
          value={executionMode}
          onChange={e => setExecutionMode(e.target.value as 'simulation' | 'real')}
        >
          <option value="simulation">🎭 Simulation (Mock Data)</option>
          <option value="real">🐍 Real Execution (Python)</option>
        </select>
      </div>

      {/* Execute Button */}
      <button onClick={handleExecute} className="btn-execute">
        ▶️ Run Flow
      </button>

      {/* Modals */}
      <SimulationModal
        isOpen={showSimulationModal}
        onClose={() => setShowSimulationModal(false)}
      />
      <RealExecutionModal
        isOpen={showRealExecutionModal}
        onClose={() => setShowRealExecutionModal(false)}
      />
    </div>
  );
}
```

##### 3.3. Update Flow Store (~2 hours)

**File**: `web/src/store/flowStore.ts` (modified)

Add backend execution state:

```typescript
interface FlowStore {
  // ... existing state ...

  // Backend execution
  backendExecution: {
    mode: 'simulation' | 'real';
    projectGenerated: boolean;
    projectPath: string | null;
    serverRunning: boolean;
    lastExecutionResult: ExecutionResult | null;
  };

  // Actions
  setExecutionMode: (mode: 'simulation' | 'real') => void;
  setProjectGenerated: (path: string) => void;
  setServerRunning: (running: boolean) => void;
  setBackendExecutionResult: (result: ExecutionResult) => void;
}

export const useFlowStore = create<FlowStore>((set) => ({
  // ... existing state ...

  backendExecution: {
    mode: 'simulation',
    projectGenerated: false,
    projectPath: null,
    serverRunning: false,
    lastExecutionResult: null,
  },

  setExecutionMode: (mode) => set((state) => ({
    backendExecution: { ...state.backendExecution, mode }
  })),

  setProjectGenerated: (path) => set((state) => ({
    backendExecution: {
      ...state.backendExecution,
      projectGenerated: true,
      projectPath: path,
    }
  })),

  setServerRunning: (running) => set((state) => ({
    backendExecution: { ...state.backendExecution, serverRunning: running }
  })),

  setBackendExecutionResult: (result) => set((state) => ({
    backendExecution: { ...state.backendExecution, lastExecutionResult: result }
  })),
}));
```

##### 3.4. Testing

**Test Criteria**:
- ✅ Can select "Real Execution" mode from dropdown
- ✅ Run button opens RealExecutionModal (not SimulationModal)
- ✅ Can generate project from modal
- ✅ Can start server from modal
- ✅ Can enter input values
- ✅ Execute button calls Python API
- ✅ Results display for successful execution
- ✅ Outputs shown in formatted JSON
- ✅ Execution time displayed
- ✅ Error messages shown for failed execution
- ✅ Pending tasks listed when tasks not implemented
- ✅ Implementation status warning appears
- ✅ Can switch back to simulation mode
- ✅ Mode selection persists in localStorage

---

### Phase 4: Polish & Production-Ready (1-2 days)

**Goal**: Error handling, UX polish, settings

#### Tasks

##### 4.1. Error Handling (~4 hours)

**Areas to cover**:

1. **Server Startup Errors**
   - Python not found
   - Port already in use
   - Invalid project directory
   - Permission errors

2. **Generation Errors**
   - Invalid YAML
   - Scaffolder failures
   - Disk write errors

3. **Execution Errors**
   - Server not responding
   - Timeout errors
   - Task implementation errors
   - Invalid inputs

**Implementation**:
```typescript
// Custom error types
export class ServerError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ServerError';
  }
}

export class GenerationError extends Error {
  constructor(message: string, public details?: string) {
    super(message);
    this.name = 'GenerationError';
  }
}

// Error boundary component
export class ExecutionErrorBoundary extends React.Component<Props, State> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Error toast notifications
export function showErrorToast(error: Error) {
  if (error instanceof ServerError) {
    if (error.code === 'PORT_IN_USE') {
      toast.error('Port already in use. Try a different port or stop the conflicting process.');
    } else if (error.code === 'PYTHON_NOT_FOUND') {
      toast.error('Python not found. Please install Python 3.8+ and try again.');
    }
  } else if (error instanceof GenerationError) {
    toast.error(`Generation failed: ${error.message}`, {
      description: error.details,
    });
  } else {
    toast.error(`Error: ${error.message}`);
  }
}
```

##### 4.2. Project Persistence (~3 hours)

**Features**:
- Remember last generated project path
- Auto-regenerate when flow changes
- Detect file changes (user edited flow.py)
- Reload server on changes

**Implementation**:
```typescript
// Store project metadata
interface ProjectMetadata {
  path: string;
  flowYamlHash: string; // SHA-256 hash
  generatedAt: number;
  lastModified: number;
}

export class ProjectManager {
  private metadata: ProjectMetadata | null = null;

  async generate(flowYaml: string, outputDir: string): Promise<void> {
    const hash = await this.hashYaml(flowYaml);

    // Check if regeneration needed
    if (this.metadata && this.metadata.flowYamlHash === hash) {
      console.log('Project up to date, skipping generation');
      return;
    }

    // Generate project
    await generateProject(flowYaml, outputDir);

    // Update metadata
    this.metadata = {
      path: outputDir,
      flowYamlHash: hash,
      generatedAt: Date.now(),
      lastModified: Date.now(),
    };

    // Persist to localStorage
    localStorage.setItem('project_metadata', JSON.stringify(this.metadata));
  }

  async checkForChanges(): Promise<boolean> {
    if (!this.metadata) return false;

    // Check file modification times
    const flowPyPath = path.join(this.metadata.path, 'flow.py');
    const stats = await fs.stat(flowPyPath);

    return stats.mtimeMs > this.metadata.lastModified;
  }

  private async hashYaml(yaml: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(yaml);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
```

##### 4.3. Settings Panel (~3 hours)

**File**: `web/src/components/Settings/ExecutionSettings.tsx` (new)

**Settings**:
- Python executable path
- Default server port
- Auto-start server toggle
- Project output directory
- Enable hot reload
- Server timeout

**Component**:
```typescript
export default function ExecutionSettings() {
  const [settings, setSettings] = useState({
    pythonPath: 'python',
    defaultPort: 8000,
    autoStart: true,
    outputDir: '~/flowlang-projects',
    enableHotReload: true,
    serverTimeout: 30000,
  });

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('execution_settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('execution_settings', JSON.stringify(settings));
    toast.success('Settings saved');
  };

  return (
    <div className="settings-panel">
      <h3>Execution Settings</h3>

      <div className="setting">
        <label>Python Executable Path:</label>
        <input
          type="text"
          value={settings.pythonPath}
          onChange={e => setSettings({ ...settings, pythonPath: e.target.value })}
          placeholder="python"
        />
        <small>Path to Python 3.8+ executable</small>
      </div>

      <div className="setting">
        <label>Default Server Port:</label>
        <input
          type="number"
          value={settings.defaultPort}
          onChange={e => setSettings({ ...settings, defaultPort: parseInt(e.target.value) })}
        />
      </div>

      <div className="setting">
        <label>
          <input
            type="checkbox"
            checked={settings.autoStart}
            onChange={e => setSettings({ ...settings, autoStart: e.target.checked })}
          />
          Auto-start server on execution
        </label>
      </div>

      <div className="setting">
        <label>Project Output Directory:</label>
        <input
          type="text"
          value={settings.outputDir}
          onChange={e => setSettings({ ...settings, outputDir: e.target.value })}
        />
        <small>Where generated projects will be saved</small>
      </div>

      <div className="setting">
        <label>
          <input
            type="checkbox"
            checked={settings.enableHotReload}
            onChange={e => setSettings({ ...settings, enableHotReload: e.target.checked })}
          />
          Enable hot reload (auto-reload on file changes)
        </label>
      </div>

      <div className="setting">
        <label>Server Timeout (ms):</label>
        <input
          type="number"
          value={settings.serverTimeout}
          onChange={e => setSettings({ ...settings, serverTimeout: parseInt(e.target.value) })}
        />
        <small>Maximum time to wait for server startup</small>
      </div>

      <button onClick={handleSave} className="btn-primary">
        Save Settings
      </button>
    </div>
  );
}
```

##### 4.4. Documentation (~2 hours)

Create help modal:

**File**: `web/src/components/Help/ExecutionHelp.tsx`

```typescript
export default function ExecutionHelp() {
  return (
    <div className="help-modal">
      <h2>Real Execution Help</h2>

      <section>
        <h3>What is Real Execution?</h3>
        <p>
          Real Execution runs your flow using the actual Python FlowLang engine,
          not mock data. This validates your flow works with real task implementations.
        </p>
      </section>

      <section>
        <h3>How It Works</h3>
        <ol>
          <li>Design your flow visually in the canvas</li>
          <li>Click "Generate Project" to create flow.yaml and flow.py</li>
          <li>The system starts a Python FlowLang server</li>
          <li>Click "Execute Flow" to run via the Python backend</li>
          <li>See real results from implemented tasks</li>
        </ol>
      </section>

      <section>
        <h3>Simulation vs Real Execution</h3>
        <table>
          <thead>
            <tr>
              <th>Feature</th>
              <th>Simulation</th>
              <th>Real Execution</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Speed</td>
              <td>⚡ Instant</td>
              <td>🐍 Actual timing</td>
            </tr>
            <tr>
              <td>Data</td>
              <td>🎭 Mock</td>
              <td>✅ Real</td>
            </tr>
            <tr>
              <td>Tasks</td>
              <td>Simulated</td>
              <td>Must be implemented</td>
            </tr>
            <tr>
              <td>Setup</td>
              <td>None</td>
              <td>Python + Project</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h3>Implementing Tasks</h3>
        <p>
          When you first execute a flow, all tasks are stubs (NotImplementedTaskError).
          To implement a task:
        </p>
        <ol>
          <li>Download the generated project ZIP</li>
          <li>Open flow.py in your code editor</li>
          <li>Find the task function</li>
          <li>Replace the NotImplementedTaskError with your implementation</li>
          <li>Save the file</li>
          <li>The server will auto-reload (if hot reload enabled)</li>
          <li>Execute again to see real results</li>
        </ol>
      </section>

      <section>
        <h3>Troubleshooting</h3>

        <h4>Server won't start</h4>
        <ul>
          <li>Check Python is installed: <code>python --version</code></li>
          <li>Check FlowLang is installed: <code>pip list | grep flowlang</code></li>
          <li>Try a different port if port is in use</li>
        </ul>

        <h4>Execution fails with "NotImplementedTaskError"</h4>
        <ul>
          <li>This means the task is still a stub</li>
          <li>Implement the task in flow.py</li>
          <li>Check implementation status badge</li>
        </ul>

        <h4>Server logs show errors</h4>
        <ul>
          <li>Check the Server Logs section for details</li>
          <li>Common issues: missing dependencies, syntax errors in flow.py</li>
        </ul>
      </section>
    </div>
  );
}
```

##### 4.5. Testing

**Test Criteria**:
- ✅ All error cases show meaningful messages
- ✅ Port conflict suggests alternate port
- ✅ Python not found shows installation instructions
- ✅ Invalid YAML shows validation errors
- ✅ Project regenerates when flow changes
- ✅ Settings persist across sessions
- ✅ Help documentation is comprehensive
- ✅ Tooltips explain all features
- ✅ Error toasts appear for failures
- ✅ Server logs helpful for debugging

## Technical Specifications

### API Endpoints

The web app will interact with these FlowLang server endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Check server health and status |
| `/flows` | GET | List available flows |
| `/flows/{name}` | GET | Get flow information |
| `/flows/{name}/execute` | POST | Execute flow with inputs |
| `/flows/{name}/tasks` | GET | Get implementation status |

### Data Structures

#### ExecutionResult
```typescript
interface ExecutionResult {
  success: boolean;
  outputs?: Record<string, any>;
  error?: string;
  error_details?: string;
  execution_time_ms?: number;
  flow: string;
  pending_tasks?: string[];
  implementation_progress?: string;
}
```

#### ServerStatus
```typescript
interface ServerStatus {
  running: boolean;
  port: number;
  pid?: number;
  startTime?: number;
  health: 'healthy' | 'unhealthy' | 'unknown';
  flowName?: string;
  implementationStatus?: {
    implemented: number;
    total: number;
    progress: string;
  };
}
```

#### GeneratedProject
```typescript
interface GeneratedProject {
  flowYaml: string;
  flowPy: string;
  apiPy: string;
  readme: string;
  tests: string;
  projectPath: string;
  taskCount: number;
  implementedCount: number;
}
```

### File Structure

```
FlowLang/
├── web/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CodeViewer/
│   │   │   │   ├── CodeViewer.tsx              (new - Monaco editor)
│   │   │   │   └── CodeViewer.css
│   │   │   ├── ExecutionModal/
│   │   │   │   ├── SimulationModal.tsx         (existing)
│   │   │   │   ├── RealExecutionModal.tsx      (new - Python execution)
│   │   │   │   └── ExecutionModal.css
│   │   │   ├── ServerStatus/
│   │   │   │   ├── ServerStatus.tsx            (new - server indicator)
│   │   │   │   └── ServerStatus.css
│   │   │   ├── GenerateProjectModal/
│   │   │   │   ├── GenerateProjectModal.tsx    (new)
│   │   │   │   └── GenerateProjectModal.css
│   │   │   ├── Settings/
│   │   │   │   ├── ExecutionSettings.tsx       (new)
│   │   │   │   └── Settings.css
│   │   │   ├── Help/
│   │   │   │   ├── ExecutionHelp.tsx           (new)
│   │   │   │   └── Help.css
│   │   │   └── ToolBar/
│   │   │       └── ToolBar.tsx                 (modified - add execution mode)
│   │   ├── services/
│   │   │   ├── flowSimulator.ts                (existing)
│   │   │   ├── yamlConverter.ts                (existing)
│   │   │   ├── projectGenerator.ts             (new - generate projects)
│   │   │   ├── serverManager.ts                (new - manage Python server)
│   │   │   └── backendService.ts               (new - HTTP client)
│   │   ├── store/
│   │   │   └── flowStore.ts                    (modified - add backend state)
│   │   └── types/
│   │       ├── execution.ts                    (modified - add backend types)
│   │       └── backend.ts                      (new - backend-specific types)
│   ├── package.json                            (modified - add Monaco, JSZip)
│   └── vite.config.ts
│
├── src/flowlang/                                (existing - no changes)
│   ├── server.py
│   ├── scaffolder.py
│   └── ...
│
└── generated-projects/                          (new - output directory)
    └── {flow-name}/
        ├── flow.yaml
        ├── flow.py
        ├── api.py
        ├── README.md
        └── tests/
```

### State Management

Add to FlowStore:

```typescript
interface FlowStore {
  // ... existing state ...

  // Backend execution state
  backendExecution: {
    mode: 'simulation' | 'real';
    projectGenerated: boolean;
    projectPath: string | null;
    serverRunning: boolean;
    serverStatus: ServerStatus | null;
    lastExecutionResult: ExecutionResult | null;
    settings: ExecutionSettings;
  };

  // Actions
  setExecutionMode: (mode: 'simulation' | 'real') => void;
  setProjectGenerated: (path: string) => void;
  setServerStatus: (status: ServerStatus) => void;
  setBackendExecutionResult: (result: ExecutionResult) => void;
  updateExecutionSettings: (settings: Partial<ExecutionSettings>) => void;
}
```

## Integration Points

### Existing Code Integration

#### 1. YAML Export (yamlConverter.ts)
- Already exists: `flowToYaml(nodes, edges, flowDefinition)`
- Use this to export flow before generation
- No changes needed

#### 2. Flow Store (flowStore.ts)
- Add backend execution state
- Maintain backward compatibility
- Simulation continues to work unchanged

#### 3. Toolbar (ToolBar.tsx)
- Add execution mode selector
- Modify run button to check mode
- Open appropriate modal based on selection

#### 4. Existing Modals
- Keep SimulationModal unchanged
- Add RealExecutionModal as alternative
- Both use same input definitions from flowDefinition

## Testing Strategy

### Unit Tests

```typescript
// projectGenerator.test.ts
describe('ProjectGenerator', () => {
  test('generates valid YAML', async () => {
    const yaml = await generateYaml(flow);
    expect(yaml).toContain('flow: TestFlow');
  });

  test('calls scaffolder correctly', async () => {
    const project = await generateProject(yaml, './output');
    expect(project.flowPy).toContain('create_task_registry');
  });

  test('handles invalid YAML', async () => {
    await expect(generateProject('invalid', './out'))
      .rejects.toThrow(GenerationError);
  });
});

// serverManager.test.ts
describe('ServerManager', () => {
  test('starts server successfully', async () => {
    await serverManager.start({ projectDir: './test', port: 8001 });
    const status = await serverManager.getStatus();
    expect(status.running).toBe(true);
  });

  test('handles port conflict', async () => {
    // Start first server
    await serverManager.start({ projectDir: './test', port: 8002 });

    // Try to start second on same port
    await expect(serverManager.start({ projectDir: './test2', port: 8002 }))
      .rejects.toThrow(ServerError);
  });

  test('captures server logs', async () => {
    await serverManager.start({ projectDir: './test', port: 8003 });
    const logs = serverManager.getLogs();
    expect(logs.some(log => log.includes('Application startup complete'))).toBe(true);
  });
});

// backendService.test.ts
describe('BackendService', () => {
  const service = new BackendService('http://localhost:8000');

  test('checks health successfully', async () => {
    const healthy = await service.checkHealth();
    expect(healthy).toBe(true);
  });

  test('executes flow', async () => {
    const result = await service.executeFlow('TestFlow', { input: 'test' });
    expect(result.success).toBeDefined();
  });

  test('gets implementation status', async () => {
    const status = await service.getImplementationStatus('TestFlow');
    expect(status.total).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```typescript
// realExecution.integration.test.ts
describe('Real Execution Flow', () => {
  test('end-to-end: generate → start → execute', async () => {
    // 1. Generate project
    const yaml = flowToYaml(testNodes, testEdges, testDefinition);
    const project = await generateProject(yaml, './test-output');
    expect(project.flowPy).toBeTruthy();

    // 2. Start server
    await serverManager.start({
      projectDir: './test-output',
      port: 8004,
    });

    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for startup

    // 3. Execute flow
    const service = new BackendService('http://localhost:8004');
    const result = await service.executeFlow('TestFlow', { test: 'value' });

    // 4. Verify result
    expect(result.success).toBeDefined();

    // 5. Cleanup
    await serverManager.stop();
  });
});
```

### Manual Test Checklist

**Phase 1 Tests**:
- [ ] Generate project from simple flow
- [ ] View generated flow.yaml
- [ ] View generated flow.py with stubs
- [ ] Download project as ZIP
- [ ] Unzip and verify structure
- [ ] Test with nested flow (conditionals, loops)
- [ ] Test with complex quantified conditions

**Phase 2 Tests**:
- [ ] Start server automatically
- [ ] Server indicator shows green when healthy
- [ ] Stop server gracefully
- [ ] Start server on custom port
- [ ] Handle port conflict
- [ ] Connect to manually-started server
- [ ] Server logs update in real-time
- [ ] Implementation status badge shows correctly

**Phase 3 Tests**:
- [ ] Switch to Real Execution mode
- [ ] Generate project from modal
- [ ] Start server from modal
- [ ] Enter input values
- [ ] Execute flow (with stubs)
- [ ] See "NotImplementedTaskError" result
- [ ] Implement a task manually
- [ ] Execute again, see partial success
- [ ] Implement all tasks
- [ ] Execute and see full success
- [ ] Switch back to Simulation mode

**Phase 4 Tests**:
- [ ] Test all error scenarios
- [ ] Settings persist after reload
- [ ] Help modal is comprehensive
- [ ] Project regenerates on flow change
- [ ] Hot reload works (edit flow.py, auto-reload)

## Timeline & Estimates

### Detailed Timeline

**Week 1: Foundation**
- Days 1-2: Phase 1 (Project Generation)
  - Day 1: projectGenerator service + CodeViewer
  - Day 2: GenerateProjectModal + integration + testing
- Days 3-5: Phase 2 (Server Management)
  - Day 3: serverManager service
  - Day 4: backendService + ServerStatus UI
  - Day 5: Integration + testing

**Week 2: Execution & Polish**
- Days 1-2: Phase 3 (Real Execution)
  - Day 1: RealExecutionModal + execution flow
  - Day 2: FlowStore integration + testing
- Days 3-4: Phase 4 (Polish)
  - Day 3: Error handling + project persistence
  - Day 4: Settings + documentation + final testing

**Total**: 9-10 working days (2 weeks)

### Resource Requirements

- **Developer**: 1 full-stack developer (TypeScript + Python)
- **Designer**: 0.5 designer (UI mockups for new modals)
- **QA**: 0.5 tester (manual testing of execution flows)

### Dependencies

- Python FlowLang must be installed
- FlowLang scaffolder must work correctly
- FlowLang server must support hot reload
- Node.js child_process support (for subprocess)

## Success Criteria

### Phase 1 Complete
- ✅ Can click "Generate Project" and get complete FlowLang project
- ✅ Generated code matches scaffolder output exactly
- ✅ Can view flow.py in Monaco editor with syntax highlighting
- ✅ Can download project as ZIP
- ✅ ZIP contains: flow.yaml, flow.py, api.py, README.md, tests/
- ✅ Works with complex flows (nested containers, quantified conditions)

### Phase 2 Complete
- ✅ Can start Python server from web UI
- ✅ Server starts within 30 seconds
- ✅ Health indicator updates automatically
- ✅ Can stop server gracefully
- ✅ Server logs visible in UI
- ✅ Implementation status badge accurate
- ✅ Can connect to manual server
- ✅ Port conflicts handled gracefully

### Phase 3 Complete
- ✅ Can execute flows via Python backend
- ✅ Results display correctly (outputs, errors, timing)
- ✅ NotImplementedTaskError shows for stubbed tasks
- ✅ Can switch between Simulation and Real modes
- ✅ Mode selection persists
- ✅ Execution with all implemented tasks succeeds

### Phase 4 Complete
- ✅ All error scenarios handled with clear messages
- ✅ Settings persist across sessions
- ✅ Help documentation complete
- ✅ Project regenerates on flow changes
- ✅ Hot reload works (server auto-reloads on file changes)
- ✅ Production-ready UX

### Overall Success
- ✅ Users can design flows visually
- ✅ Users can generate complete projects
- ✅ Users can execute flows with real Python backend
- ✅ Users understand what tasks need implementation
- ✅ Clear path from design → implementation → deployment

## Open Questions

### 1. Electron vs Web App?
**Question**: Should we package this as an Electron app with bundled Python?

**Options**:
- **A**: Pure web app (current plan) - users install Python separately
- **B**: Electron app with bundled Python - zero external dependencies
- **C**: Hybrid - web app + optional Electron build

**Recommendation**: Start with A (pure web), consider B later if demand exists.

### 2. Project Storage Location?
**Question**: Where should generated projects be saved?

**Options**:
- **A**: User's home directory (`~/flowlang-projects/`)
- **B**: Temp directory (cleaned on exit)
- **C**: User chooses (file picker)
- **D**: In-memory only (no disk writes)

**Recommendation**: A by default, C as option in settings.

### 3. Code Editing in Web UI?
**Question**: Should we allow editing flow.py directly in the web UI?

**Pros**:
- Convenience - no need to switch to IDE
- Integrated workflow
- Beginner-friendly

**Cons**:
- Complex feature (LSP, autocomplete, linting)
- Users prefer their own IDE
- Maintenance burden

**Recommendation**: NOT in scope for initial release. Focus on generation + execution. Consider for Phase 5.

### 4. Multi-Flow Projects?
**Question**: Should we support projects with multiple flows?

**Current**: One flow per project (aligned with scaffolder)

**Future**: Multi-flow support would require:
- Server changes (MultiFlowServer)
- UI to select which flow to execute
- Project structure changes

**Recommendation**: Single flow for now, multi-flow in future.

### 5. Server Lifecycle?
**Question**: Should server stay running between executions?

**Options**:
- **A**: Start on first execution, keep running
- **B**: Start/stop per execution
- **C**: User controls manually

**Recommendation**: A (keep running) with auto-shutdown after 1 hour idle.

### 6. Terminal View?
**Question**: Should we show a terminal view with server output?

**Pros**:
- Developers like seeing raw output
- Debugging easier

**Cons**:
- Cluttered UI
- Logs section already exists

**Recommendation**: Collapsible logs section (current plan) is sufficient. Full terminal view optional for Phase 5.

## Future Enhancements (Phase 5+)

### 1. In-App Code Editor
Edit flow.py directly in the web UI with:
- Monaco editor with Python LSP
- Autocomplete for FlowLang APIs
- Inline error detection
- Save to disk
- Git integration

**Effort**: 2-3 weeks

### 2. Task Implementation Wizard
Guided wizard to implement tasks:
- Select task from list
- Choose implementation template (HTTP, DB, File, etc.)
- Fill in parameters
- Generate code
- Test immediately

**Effort**: 1-2 weeks

### 3. Debugger Integration
Step-through debugger for flows:
- Breakpoints on nodes
- Inspect variables
- Step into tasks
- Watch expressions

**Effort**: 3-4 weeks

### 4. Deployment Automation
One-click deployment:
- Package as Docker image
- Deploy to cloud (AWS Lambda, Google Cloud Run, etc.)
- Generate Kubernetes manifests
- CI/CD pipeline generation

**Effort**: 2-3 weeks

### 5. Collaborative Editing
Multiple users editing same flow:
- WebSocket sync
- Conflict resolution
- Presence indicators
- Comments/annotations

**Effort**: 4-5 weeks

### 6. Task Library/Marketplace
Pre-built task implementations:
- HTTP clients (REST, GraphQL)
- Database operations (SQL, NoSQL)
- File operations
- Email/SMS notifications
- Data transformations
- AI/ML integrations

**Effort**: Ongoing

### 7. Performance Monitoring
Real-time flow performance:
- Execution time tracking
- Task-level profiling
- Resource usage (CPU, memory)
- Error rates
- Alerts on failures

**Effort**: 2-3 weeks

### 8. Version Control Integration
Git integration for flows:
- Commit flows to git
- Branch management
- Diff viewer
- Pull request creation
- Flow history

**Effort**: 1-2 weeks

### 9. Testing Framework
UI for creating tests:
- Define test cases
- Mock task outputs
- Assertions
- Test coverage
- Regression testing

**Effort**: 2-3 weeks

### 10. Multi-Flow Projects
Support multiple related flows:
- Project-level organization
- Shared tasks/connections
- Flow dependencies
- Subflow references

**Effort**: 1-2 weeks

## Conclusion

This integration will bridge the gap between visual flow design and production-ready Python code, enabling users to:

1. **Design** flows visually with full nested container support
2. **Generate** complete FlowLang projects with one click
3. **Execute** flows using the real Python backend
4. **Iterate** quickly with hot reload and instant feedback
5. **Deploy** confidently knowing flows work in production

The phased approach ensures we can deliver value incrementally while maintaining code quality and user experience.

**Next Steps**:
1. Review and approve this plan
2. Set up development environment
3. Begin Phase 1: Project Generation
4. Iterate based on user feedback

---

**Document Version**: 1.0
**Last Updated**: 2025-10-18
**Author**: Claude (Assistant)
**Status**: Approved for Implementation
