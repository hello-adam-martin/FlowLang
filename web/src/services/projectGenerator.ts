/**
 * Project Generator Service
 *
 * Generates complete FlowLang projects from visual flows.
 * This creates flow.yaml, flow.py, api.py, README.md, and tests.
 *
 * Note: This is a TypeScript implementation that mimics the Python scaffolder.
 * For full Python scaffolder integration, see REAL_EXECUTION_INTEGRATION.md Phase 2.
 */

import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '../types/node';
import type { FlowDefinition } from '../types/flow';
import { flowToYaml } from './yamlConverter';

export interface GeneratedProject {
  flowYaml: string;
  flowPy: string;
  apiPy: string;
  readme: string;
  tests: string;
  startServerSh: string;
  flowName: string;
  taskCount: number;
  implementedCount: number; // Always 0 for generated stubs
}

export interface TaskInfo {
  name: string;
  usageCount: number;
}

/**
 * Extract all unique tasks from the flow
 */
function extractTasks(nodes: Node<FlowNodeData>[]): TaskInfo[] {
  const taskCounts = new Map<string, number>();

  nodes.forEach(node => {
    const data = node.data;
    if (data?.step?.task) {
      const taskName = data.step.task;
      taskCounts.set(taskName, (taskCounts.get(taskName) || 0) + 1);
    }
  });

  return Array.from(taskCounts.entries())
    .map(([name, usageCount]) => ({ name, usageCount }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Generate flow.py with task stubs
 */
function generateFlowPy(flowName: string, tasks: TaskInfo[]): string {
  const lines: string[] = [];

  // Header
  lines.push(`"""
${flowName} - FlowLang Task Implementations

This file contains task implementations for the ${flowName} flow.
Auto-generated from visual flow designer.

To implement a task:
1. Find the task function below
2. Remove the NotImplementedTaskError
3. Add your implementation
4. Run tests: pytest tests/test_tasks.py
"""

import asyncio
from typing import Dict, Any
from pathlib import Path
import sys

# Add FlowLang to path (if installed via pip, this isn't needed)
# sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from flowlang import TaskRegistry
from flowlang.exceptions import NotImplementedTaskError


def create_task_registry() -> TaskRegistry:
    """Create and populate the task registry with all tasks"""
    registry = TaskRegistry()

    # ========================================================================
    # TASK IMPLEMENTATIONS
    # Total: ${tasks.length} tasks
    # Status: 0 implemented, ${tasks.length} pending
    # ========================================================================
    `);

  // Generate task stubs
  tasks.forEach(task => {
    lines.push(`
    @registry.register('${task.name}', description='TODO: Describe ${task.name}')
    async def ${task.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}(**inputs):
        """
        ${task.name} task implementation.

        Used ${task.usageCount} time${task.usageCount > 1 ? 's' : ''} in this flow.

        Args:
            **inputs: Input parameters from the flow

        Returns:
            Dict[str, Any]: Task outputs

        Raises:
            NotImplementedTaskError: This task is not yet implemented
        """
        raise NotImplementedTaskError('${task.name}')

        # TODO: Implement ${task.name}
        # Example:
        # result = await some_async_operation(inputs)
        # return {'output': result}
`);
  });

  lines.push(`
    return registry


# ========================================================================
# IMPLEMENTATION TRACKER
# ========================================================================

def get_implementation_status() -> Dict[str, Any]:
    """
    Get status of task implementations.

    Update this as you implement tasks:
    Change False to True for each completed task.
    """
    tasks = {`);

  tasks.forEach(task => {
    lines.push(`        '${task.name}': False,  # TODO: Set to True when implemented`);
  });

  lines.push(`    }

    implemented = sum(1 for v in tasks.values() if v)
    total = len(tasks)

    return {
        'total': total,
        'implemented': implemented,
        'pending': total - implemented,
        'progress': f'{implemented}/{total}',
        'percentage': (implemented / total * 100) if total > 0 else 0,
        'tasks': tasks
    }


def print_status():
    """Print implementation status to console"""
    status = get_implementation_status()
    print("="*60)
    print(f"📊 ${flowName} - Task Implementation Status")
    print("="*60)
    print(f"Total Tasks: {status['total']}")
    print(f"Implemented: {status['implemented']} ✅")
    print(f"Pending: {status['pending']} ⚠️")
    print(f"Progress: {status['progress']} ({status['percentage']:.1f}%)")
    print("="*60)

    if status['pending'] > 0:
        print("\\n⚠️  Pending Tasks:")
        for task, implemented in sorted(status['tasks'].items()):
            if not implemented:
                print(f"  [ ] {task}")

    if status['implemented'] > 0:
        print("\\n✅ Implemented Tasks:")
        for task, implemented in sorted(status['tasks'].items()):
            if implemented:
                print(f"  [✓] {task}")

    print()


if __name__ == '__main__':
    print_status()
`);

  return lines.join('\n');
}

/**
 * Generate api.py for FastAPI server
 */
function generateApiPy(flowName: string): string {
  return `"""
${flowName} FlowLang API

FastAPI server that exposes the ${flowName} flow as REST endpoints.
Auto-generated from visual flow designer.

Usage:
    # Development (with hot reload):
    uvicorn api:app --reload --host 0.0.0.0 --port 8000

    # Production:
    uvicorn api:app --host 0.0.0.0 --port 8000 --workers 4
"""

from flowlang.server import FlowServer

# Create FlowLang server from this project directory
server = FlowServer(
    project_dir=".",
    flow_file="flow.yaml",
    tasks_file="flow.py",
    title="${flowName} API",
    version="1.0.0",
    enable_hot_reload=True  # Auto-reload on file changes
)

# Export FastAPI app
app = server.app

# The server automatically provides these endpoints:
# - GET  /                           API overview
# - GET  /health                     Health check
# - GET  /flows                      List flows
# - GET  /flows/{name}               Flow information
# - POST /flows/{name}/execute       Execute flow
# - GET  /flows/{name}/execute/stream Execute with SSE streaming
# - GET  /flows/{name}/tasks         Task implementation status
# - GET  /flows/{name}/visualize     Mermaid diagram
# - GET  /docs                       Interactive API docs (Swagger UI)
# - GET  /redoc                      Alternative API docs (ReDoc)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
`;
}

/**
 * Generate README.md
 */
function generateReadme(flowName: string, description: string | undefined, tasks: TaskInfo[], flowYaml: string): string {
  return `# ${flowName}

${description || 'Auto-generated FlowLang project from visual flow designer.'}

## Overview

This project contains a FlowLang workflow with ${tasks.length} task${tasks.length !== 1 ? 's' : ''}:

${tasks.map(t => `- **${t.name}** (used ${t.usageCount} time${t.usageCount > 1 ? 's' : ''})`).join('\n')}

## Project Structure

\`\`\`
${flowName}/
├── flow.yaml              # Flow definition
├── flow.py                # Task implementations
├── api.py                 # FastAPI server
├── README.md              # This file
└── tests/
    └── test_tasks.py      # Unit tests
\`\`\`

## Setup

### Prerequisites

- Python 3.8+
- FlowLang installed: \`pip install flowlang\`

### Installation

\`\`\`bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate

# Install FlowLang
pip install flowlang

# Install additional dependencies (if any)
# pip install -r requirements.txt
\`\`\`

## Implementation Status

**Current**: 0/${tasks.length} tasks implemented (0%)

All tasks are currently stubs that raise \`NotImplementedTaskError\`.

To check implementation status:

\`\`\`bash
python flow.py
\`\`\`

## Implementing Tasks

Edit \`flow.py\` and implement each task:

1. Find the task function (e.g., \`@registry.register('TaskName')\`)
2. Remove the \`raise NotImplementedTaskError(...)\` line
3. Add your implementation
4. Update \`get_implementation_status()\` to mark task as implemented
5. Run tests to verify

Example:

\`\`\`python
@registry.register('FetchData', description='Fetch data from API')
async def fetch_data(**inputs):
    url = inputs.get('url')
    # Your implementation here
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        return {'data': response.json()}
\`\`\`

## Running the Flow

### Option 1: Via API Server (Recommended)

\`\`\`bash
# Start the server
uvicorn api:app --reload --host 0.0.0.0 --port 8000

# In another terminal, execute the flow
curl -X POST http://localhost:8000/flows/${flowName}/execute \\
  -H "Content-Type: application/json" \\
  -d '{"inputs": {"key": "value"}}'

# Or visit http://localhost:8000/docs for interactive API docs
\`\`\`

### Option 2: Direct Execution

\`\`\`python
import asyncio
from flowlang import FlowExecutor
from flow import create_task_registry

async def main():
    # Load flow
    with open('flow.yaml') as f:
        flow_yaml = f.read()

    # Create executor
    registry = create_task_registry()
    executor = FlowExecutor(registry)

    # Execute
    result = await executor.execute_flow(
        flow_yaml,
        inputs={'key': 'value'}
    )

    print(f"Success: {result['success']}")
    print(f"Outputs: {result['outputs']}")

if __name__ == '__main__':
    asyncio.run(main())
\`\`\`

## Testing

Run the test suite:

\`\`\`bash
pytest tests/test_tasks.py -v
\`\`\`

## Deployment

Once all tasks are implemented, you can deploy this flow:

### Docker

\`\`\`dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY . /app

RUN pip install flowlang uvicorn

EXPOSE 8000
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
\`\`\`

### Cloud Functions / Lambda

The flow can be deployed as a serverless function. See FlowLang documentation for details.

## Flow Definition

<details>
<summary>View flow.yaml</summary>

\`\`\`yaml
${flowYaml}
\`\`\`

</details>

## Development

### Hot Reload

The API server supports hot reload - changes to \`flow.py\` or \`flow.yaml\` are automatically detected.

### Watch Mode

For interactive development:

\`\`\`bash
python -m flowlang watch flow.yaml --test-inputs inputs.json
\`\`\`

## Next Steps

1. ✅ Project generated
2. ⏳ Implement tasks in \`flow.py\`
3. ⏳ Run tests
4. ⏳ Start API server
5. ⏳ Deploy to production

---

Generated with [FlowLang Visual Designer](https://github.com/anthropics/flowlang)
`;
}

/**
 * Generate test file
 */
function generateTests(flowName: string, tasks: TaskInfo[]): string {
  return `"""
Unit tests for ${flowName} tasks

Auto-generated test scaffolding.
Customize these tests based on your task implementations.
"""

import pytest
import asyncio
from flow import create_task_registry


class TestTasks:
    """Test suite for ${flowName} tasks"""

    @pytest.fixture
    def registry(self):
        """Create task registry fixture"""
        return create_task_registry()

${tasks.map(task => `    @pytest.mark.asyncio
    async def test_${task.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}(self, registry):
        """Test ${task.name} task"""
        # TODO: Implement test for ${task.name}
        # Example:
        # result = await registry.execute('${task.name}', input_param='test')
        # assert result['output'] == 'expected'

        # For now, just verify task is registered
        assert '${task.name}' in registry.tasks

`).join('\n')}

class TestFlow:
    """Integration tests for complete flow"""

    @pytest.mark.asyncio
    async def test_flow_execution(self):
        """Test complete flow execution"""
        # TODO: Add integration test
        # This should test the entire flow end-to-end
        pass

    def test_implementation_status(self):
        """Verify implementation status tracking"""
        from flow import get_implementation_status

        status = get_implementation_status()
        assert status['total'] == ${tasks.length}
        assert 'implemented' in status
        assert 'pending' in status
        assert 'progress' in status
`;
}

/**
 * Generate tools/start_server.sh script
 */
function generateStartServerSh(flowName: string): string {
  return `#!/bin/bash
# Start ${flowName} API Server
# Usage: ./start_server.sh [--reload]

cd "$(dirname "$0")/.."  # Move to project root

echo "========================================"
echo "Starting ${flowName} API Server..."
echo "========================================"
echo ""

# Activate virtual environment if it exists
# Check common locations: ../../myenv (FlowLang root), ../myenv, ./myenv
VENV_ACTIVATED=false
if [ -d "../../myenv" ]; then
    echo "🐍 Activating virtual environment: ../../myenv"
    source ../../myenv/bin/activate
    VENV_ACTIVATED=true
elif [ -d "../myenv" ]; then
    echo "🐍 Activating virtual environment: ../myenv"
    source ../myenv/bin/activate
    VENV_ACTIVATED=true
elif [ -d "myenv" ]; then
    echo "🐍 Activating virtual environment: ./myenv"
    source myenv/bin/activate
    VENV_ACTIVATED=true
else
    echo "⚠️  No virtual environment found"
    echo "   Checked: ../../myenv, ../myenv, ./myenv"
    echo "   Continuing without virtual environment..."
fi

# Check if dependencies are installed
if ! python -c "import fastapi" 2>/dev/null; then
    echo "❌ FastAPI not installed. Installing dependencies..."
    pip install -r ../../requirements.txt 2>/dev/null || pip install -r ../requirements.txt 2>/dev/null || pip install fastapi uvicorn pyyaml
fi

echo ""
echo "Starting server with uvicorn..."
echo "📖 API Docs: http://localhost:8000/docs"
echo "🔍 Health: http://localhost:8000/health"
echo "Press Ctrl+C to stop"
echo ""

# Check if --reload flag is passed
if [ "$1" = "--reload" ]; then
    echo "🔄 Auto-reload enabled"
    uvicorn api:app --host 0.0.0.0 --port 8000 --reload
else
    uvicorn api:app --host 0.0.0.0 --port 8000
fi
`;
}

/**
 * Generate a complete FlowLang project from visual flow
 */
export async function generateProject(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  flowDefinition: FlowDefinition
): Promise<GeneratedProject> {
  // Generate YAML from visual flow
  const flowYaml = flowToYaml(nodes, edges, flowDefinition);

  // Extract tasks
  const tasks = extractTasks(nodes);

  // Get flow name
  const flowName = flowDefinition.flow || 'UnnamedFlow';

  // Generate files
  const flowPy = generateFlowPy(flowName, tasks);
  const apiPy = generateApiPy(flowName);
  const readme = generateReadme(flowName, flowDefinition.description, tasks, flowYaml);
  const tests = generateTests(flowName, tasks);
  const startServerSh = generateStartServerSh(flowName);

  return {
    flowYaml,
    flowPy,
    apiPy,
    readme,
    tests,
    startServerSh,
    flowName,
    taskCount: tasks.length,
    implementedCount: 0, // All generated tasks are stubs
  };
}

/**
 * Create a downloadable ZIP file from the generated project
 */
export async function createProjectZip(project: GeneratedProject): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  // Add files to ZIP
  zip.file('flow.yaml', project.flowYaml);
  zip.file('flow.py', project.flowPy);
  zip.file('api.py', project.apiPy);
  zip.file('README.md', project.readme);
  zip.file('tests/test_tasks.py', project.tests);
  zip.file('tools/start_server.sh', project.startServerSh);

  // Generate ZIP blob
  return await zip.generateAsync({ type: 'blob' });
}
