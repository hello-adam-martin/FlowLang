import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '../types/node';

interface SimulationContext {
  inputs: Record<string, any>;
  variables: Record<string, any>;
  updateNodeState: (nodeId: string, state: any) => void;
  addLog: (nodeId: string, message: string, level?: 'info' | 'warning' | 'error') => void;
  isPaused: () => boolean;
  stepMode: boolean;
}

/**
 * Simulate execution of a flow graph
 * This handles conditionals, loops, parallel execution, etc.
 */
export class FlowSimulator {
  private nodes: Node<FlowNodeData>[];
  private edges: Edge[];
  private context: SimulationContext;
  private cancelled: boolean = false;

  constructor(
    nodes: Node<FlowNodeData>[],
    edges: Edge[],
    context: SimulationContext
  ) {
    this.nodes = nodes;
    this.edges = edges;
    this.context = context;
  }

  /**
   * Cancel the simulation
   */
  cancel() {
    this.cancelled = true;
  }

  /**
   * Wait for resume signal when paused in step mode
   */
  private async waitForResume(): Promise<void> {
    // Poll the pause state every 100ms
    while (this.context.isPaused()) {
      if (this.cancelled) break;
      await this.sleep(100);
    }
  }

  /**
   * Start the simulation from the start node
   */
  async simulate(): Promise<Record<string, any>> {
    const startNode = this.nodes.find(n => n.type === 'start');
    if (!startNode) {
      throw new Error('No start node found');
    }

    // Initialize variables with inputs
    this.context.variables = { ...this.context.inputs };

    // Find nodes connected to start
    const nextNodes = this.getConnectedNodes(startNode.id);

    // Execute the flow
    for (const nodeId of nextNodes) {
      if (this.cancelled) break;
      await this.executeNode(nodeId);
    }

    return this.context.variables;
  }

  /**
   * Execute a single node
   */
  private async executeNode(nodeId: string): Promise<any> {
    if (this.cancelled) return null;

    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return null;

    // In step mode, pause before executing this node
    if (this.context.stepMode) {
      // Mark as pending and wait for user to step forward
      this.context.updateNodeState(nodeId, {
        state: 'pending',
      });
      this.context.addLog(nodeId, `Ready to execute ${node.data.label || nodeId}`, 'info');

      // Pause execution
      // We need to get the pause action from the store dynamically
      const { pauseExecution } = await import('../store/flowStore').then(m => m.useFlowStore.getState());
      pauseExecution();

      // Wait for resume signal
      await this.waitForResume();

      if (this.cancelled) return null;
    }

    // Mark as running
    this.context.updateNodeState(nodeId, {
      state: 'running',
      startTime: Date.now(),
    });

    this.context.addLog(nodeId, `Starting ${node.data.label || nodeId}`, 'info');

    let result: any = null;

    try {
      // Simulate execution time
      await this.sleep(500 + Math.random() * 1000);

      // Handle different node types
      switch (node.type) {
        case 'task':
          result = await this.executeTask(node);
          break;
        case 'conditionalContainer':
          result = await this.executeConditional(node);
          break;
        case 'loopContainer':
          result = await this.executeLoop(node);
          break;
        case 'parallelContainer':
          result = await this.executeParallel(node);
          break;
        case 'switchContainer':
          result = await this.executeSwitch(node);
          break;
        case 'exit':
          result = await this.executeExit(node);
          break;
        default:
          result = { success: true };
      }

      // Mark as completed
      this.context.updateNodeState(nodeId, {
        state: 'completed',
        endTime: Date.now(),
        output: result,
      });

      this.context.addLog(nodeId, `Completed ${node.data.label || nodeId}`, 'info');

      // Store result in variables using node ID
      this.context.variables[nodeId] = result;

      // Continue to next nodes (unless it's an exit node)
      if (node.type !== 'exit') {
        const nextNodes = this.getConnectedNodes(nodeId);
        for (const nextId of nextNodes) {
          if (this.cancelled) break;
          await this.executeNode(nextId);
        }
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.context.updateNodeState(nodeId, {
        state: 'error',
        endTime: Date.now(),
        error: errorMessage,
      });
      this.context.addLog(nodeId, `Error: ${errorMessage}`, 'error');
      throw error;
    }
  }

  /**
   * Execute a task node
   */
  private async executeTask(node: Node<FlowNodeData>): Promise<any> {
    // Resolve input values for this task and track their sources
    const resolvedInputs: Record<string, any> = {};
    const inputSources: Record<string, string> = {};

    if (node.data.step?.inputs) {
      for (const [key, value] of Object.entries(node.data.step.inputs)) {
        resolvedInputs[key] = this.resolveVariable(value);

        // Track source node for variable references
        if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
          const varPath = value.slice(2, -1);
          // Extract the node ID from paths like "node_1.output" or "node_1.field"
          const sourceNodeId = varPath.split('.')[0];

          // Check if this is referencing another node (not inputs)
          if (sourceNodeId !== 'inputs' && this.context.variables[sourceNodeId]) {
            // Find the node to get its label
            const sourceNode = this.nodes.find(n => n.id === sourceNodeId);
            inputSources[key] = sourceNode?.data.label || sourceNodeId;
          }
        }
      }
    }

    // Store resolved inputs and their sources in node state for display
    this.context.updateNodeState(node.id, {
      inputs: resolvedInputs,
      inputSources: Object.keys(inputSources).length > 0 ? inputSources : undefined,
    });

    // Generate mock output based on node configuration
    const outputs: Record<string, any> = {};

    if (node.data.step?.outputs) {
      node.data.step.outputs.forEach((output: any) => {
        const outputName = typeof output === 'string' ? output : output.name;
        // Generate mock data based on output name
        outputs[outputName] = this.generateMockData(outputName);
      });
    }

    return Object.keys(outputs).length > 0 ? outputs : { success: true };
  }

  /**
   * Execute a conditional container
   */
  private async executeConditional(node: Node<FlowNodeData>): Promise<any> {
    // Evaluate condition (simplified - would need proper expression evaluation)
    const condition = node.data.step?.if;
    const conditionResult = this.evaluateCondition(condition);

    this.context.addLog(node.id, `Condition evaluated to: ${conditionResult}`, 'info');

    // Find child nodes in then/else branches
    const childEdges = this.edges.filter(e => e.source === node.id);

    // Execute appropriate branch
    for (const edge of childEdges) {
      const childNode = this.nodes.find(n => n.id === edge.target);
      if (!childNode) continue;

      const section = childNode.data.section;
      if ((conditionResult && section === 'then') || (!conditionResult && section === 'else')) {
        await this.executeNode(childNode.id);
      } else {
        // Skip nodes in non-executed branch
        this.context.updateNodeState(childNode.id, {
          state: 'skipped',
          startTime: Date.now(),
          endTime: Date.now(),
        });
      }
    }

    return { conditionResult };
  }

  /**
   * Execute a loop container
   */
  private async executeLoop(node: Node<FlowNodeData>): Promise<any> {
    const loopData = node.data.step;
    const items = this.resolveVariable(loopData?.for_each) || [];
    const itemVar = loopData?.as || 'item';

    this.context.addLog(node.id, `Looping over ${items.length} items`, 'info');

    const results: any[] = [];

    // Find child nodes
    const childEdges = this.edges.filter(e => e.source === node.id);

    for (let i = 0; i < items.length; i++) {
      if (this.cancelled) break;

      // Set loop variable
      this.context.variables[itemVar] = items[i];
      this.context.variables[`${itemVar}_index`] = i;

      this.context.addLog(node.id, `Iteration ${i + 1}/${items.length}`, 'info');

      // Execute child nodes
      for (const edge of childEdges) {
        await this.executeNode(edge.target!);
      }

      results.push({ index: i, item: items[i] });
    }

    return { iterations: results.length, results };
  }

  /**
   * Execute a parallel container
   */
  private async executeParallel(node: Node<FlowNodeData>): Promise<any> {
    const tracks = node.data.tracks || [];

    this.context.addLog(node.id, `Executing ${tracks.length} parallel tracks`, 'info');

    // Find child nodes by track
    const childEdges = this.edges.filter(e => e.source === node.id);
    const trackPromises: Promise<any>[] = [];

    for (const track of tracks) {
      const trackNodes = childEdges
        .map(e => this.nodes.find(n => n.id === e.target && n.data.trackId === track.id))
        .filter(Boolean);

      // Execute all nodes in this track in parallel
      const trackPromise = Promise.all(
        trackNodes.map(n => this.executeNode(n!.id))
      );

      trackPromises.push(trackPromise);
    }

    const results = await Promise.all(trackPromises);

    return { tracks: results.length, results };
  }

  /**
   * Execute a switch container
   */
  private async executeSwitch(node: Node<FlowNodeData>): Promise<any> {
    const switchValue = this.resolveVariable(node.data.step?.switch);
    const cases = node.data.cases || [];

    this.context.addLog(node.id, `Switch value: ${JSON.stringify(switchValue)}`, 'info');

    // Find matching case
    let matchedCase: any = null;
    for (const caseData of cases) {
      const whenValue = caseData.when;
      if (Array.isArray(whenValue)) {
        if (whenValue.includes(switchValue)) {
          matchedCase = caseData;
          break;
        }
      } else if (whenValue === switchValue) {
        matchedCase = caseData;
        break;
      }
    }

    if (matchedCase) {
      this.context.addLog(node.id, `Matched case: ${matchedCase.id}`, 'info');

      // Execute nodes in matched case
      const childEdges = this.edges.filter(e => e.source === node.id);
      for (const edge of childEdges) {
        const childNode = this.nodes.find(n => n.id === edge.target);
        if (childNode && childNode.data.caseId === matchedCase.id) {
          await this.executeNode(childNode.id);
        } else if (childNode) {
          // Skip nodes in other cases
          this.context.updateNodeState(childNode.id, {
            state: 'skipped',
            startTime: Date.now(),
            endTime: Date.now(),
          });
        }
      }
    } else {
      this.context.addLog(node.id, 'No case matched, executing default', 'warning');

      // Execute default case nodes
      const childEdges = this.edges.filter(e => e.source === node.id);
      for (const edge of childEdges) {
        const childNode = this.nodes.find(n => n.id === edge.target);
        if (childNode && childNode.data.caseId === 'default') {
          await this.executeNode(childNode.id);
        }
      }
    }

    return { matchedCase: matchedCase?.id || 'default' };
  }

  /**
   * Execute an exit node
   */
  private async executeExit(node: Node<FlowNodeData>): Promise<any> {
    this.context.addLog(node.id, 'Flow terminated by exit node', 'info');
    this.cancelled = true;

    return {
      terminated: true,
      reason: node.data.step?.reason || 'Exit node reached',
    };
  }

  /**
   * Get nodes connected from a given node
   */
  private getConnectedNodes(nodeId: string): string[] {
    return this.edges
      .filter(e => e.source === nodeId)
      .map(e => e.target)
      .filter(Boolean) as string[];
  }

  /**
   * Evaluate a condition (simplified)
   */
  private evaluateCondition(condition: any): boolean {
    if (typeof condition === 'boolean') return condition;
    if (typeof condition === 'string') {
      // Simple variable lookup
      const value = this.resolveVariable(condition);
      return Boolean(value);
    }
    if (typeof condition === 'object') {
      // Handle quantified conditions (any/all/none)
      if (condition.any) {
        return condition.any.some((c: any) => this.evaluateCondition(c));
      }
      if (condition.all) {
        return condition.all.every((c: any) => this.evaluateCondition(c));
      }
      if (condition.none) {
        return !condition.none.some((c: any) => this.evaluateCondition(c));
      }
    }
    // Default to true for simulation
    return true;
  }

  /**
   * Resolve a variable reference
   */
  private resolveVariable(ref: any): any {
    if (typeof ref !== 'string') return ref;

    // Handle ${variable} syntax
    if (ref.startsWith('${') && ref.endsWith('}')) {
      const varPath = ref.slice(2, -1);

      // Handle nested paths like "step_id.output" or "step_id.field_name"
      if (varPath.includes('.')) {
        const parts = varPath.split('.');
        let value = this.context.variables[parts[0]];

        // Traverse the nested path
        for (let i = 1; i < parts.length && value !== undefined; i++) {
          value = value[parts[i]];
        }

        return value;
      }

      return this.context.variables[varPath];
    }

    return ref;
  }

  /**
   * Generate mock data based on field name
   */
  private generateMockData(fieldName: string): any {
    const lower = fieldName.toLowerCase();

    if (lower.includes('id')) return `mock_id_${Math.random().toString(36).substr(2, 9)}`;
    if (lower.includes('name')) return `Mock Name ${Math.floor(Math.random() * 100)}`;
    if (lower.includes('email')) return `user${Math.floor(Math.random() * 100)}@example.com`;
    if (lower.includes('count') || lower.includes('number')) return Math.floor(Math.random() * 100);
    if (lower.includes('status')) return ['active', 'pending', 'completed'][Math.floor(Math.random() * 3)];
    if (lower.includes('list') || lower.includes('items')) return ['item1', 'item2', 'item3'];

    return `mock_${fieldName}_value`;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
