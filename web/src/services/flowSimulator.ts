import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '../types/node';
import type { MockDataConfig } from '../store/flowStore';

interface SimulationContext {
  inputs: Record<string, any>;
  variables: Record<string, any>;
  mockData?: MockDataConfig;
  updateNodeState: (nodeId: string, state: any) => void;
  getNodeState: (nodeId: string) => any;
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

    // Initialize variables with inputs, then override with mock data if available
    const mergedInputs = {
      ...this.context.inputs,
      ...(this.context.mockData?.inputs || {}), // Override with mock inputs
    };

    this.context.variables = {
      inputs: mergedInputs,  // Nest under 'inputs' for ${inputs.value} references
      ...mergedInputs,       // Also keep at root level for backward compatibility
    };

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

      // Continue to next nodes (only for task nodes, NOT containers)
      // Containers (loop, parallel, conditional, switch) handle their own children
      if (node.type !== 'exit' &&
          node.type !== 'conditionalContainer' &&
          node.type !== 'switchContainer' &&
          node.type !== 'loopContainer' &&
          node.type !== 'parallelContainer') {
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

    // Check if mock outputs are configured for this task
    if (this.context.mockData?.taskOutputs?.[node.id]) {
      this.context.addLog(node.id, 'Using mock output data', 'info');
      return this.context.mockData.taskOutputs[node.id];
    }

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
   * Execute a conditional container (routing node)
   */
  private async executeConditional(node: Node<FlowNodeData>): Promise<any> {
    // Evaluate condition (simplified - would need proper expression evaluation)
    const condition = node.data.step?.if;
    const conditionResult = this.evaluateCondition(condition);

    this.context.addLog(node.id, `Condition evaluated to: ${conditionResult}`, 'info');

    // Find edges from this conditional
    const outgoingEdges = this.edges.filter(e => e.source === node.id);

    // Determine which handle to follow
    const handleToFollow = conditionResult ? 'then' : 'else';
    const activeBranch: 'then' | 'else' = conditionResult ? 'then' : 'else';

    // Update conditional container state with branch information
    this.context.updateNodeState(node.id, {
      state: 'running',
      containerMeta: {
        activeBranch,
        conditionResult,
      }
    });

    // Find the edge with the correct sourceHandle
    const branchEdge = outgoingEdges.find(e => e.sourceHandle === handleToFollow);

    if (branchEdge && branchEdge.target) {
      this.context.addLog(node.id, `Following '${handleToFollow}' branch`, 'info');
      // Follow the entire chain starting from the first node in the branch
      await this.executeChain(branchEdge.target);
    }

    // Mark skipped branches
    const skippedHandle = conditionResult ? 'else' : 'then';
    const skippedEdge = outgoingEdges.find(e => e.sourceHandle === skippedHandle);
    if (skippedEdge && skippedEdge.target) {
      this.context.addLog(node.id, `Skipping '${skippedHandle}' branch`, 'info');
      await this.markChainAsSkipped(skippedEdge.target);
    }

    // Mark conditional as completed and clear metadata
    this.context.updateNodeState(node.id, {
      state: 'completed',
      containerMeta: undefined,
    });

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

    // Find child nodes (nodes with parentId = this loop's id)
    const childNodes = this.nodes.filter(n => n.parentId === node.id);

    // Sort children by position (Y coordinate) for execution order
    const sortedChildren = childNodes.sort((a, b) => a.position.y - b.position.y);

    for (let i = 0; i < items.length; i++) {
      if (this.cancelled) break;

      // Set loop variable
      this.context.variables[itemVar] = items[i];
      this.context.variables[`${itemVar}_index`] = i;

      // Update loop container state with current iteration metadata
      this.context.updateNodeState(node.id, {
        state: 'running',
        containerMeta: {
          currentIteration: i + 1,
          totalIterations: items.length,
          currentItem: items[i],
        }
      });

      this.context.addLog(node.id, `Iteration ${i + 1}/${items.length}`, 'info');

      // Execute all child nodes in order
      for (const child of sortedChildren) {
        await this.executeNode(child.id);
      }

      results.push({ index: i, item: items[i] });
    }

    // Mark loop as completed and clear metadata
    this.context.updateNodeState(node.id, {
      state: 'completed',
      containerMeta: undefined,
    });

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

    // Collect all child node IDs across all tracks
    const allChildNodeIds: string[] = [];
    for (const track of tracks) {
      const trackNodeIds = childEdges
        .filter(e => {
          const targetNode = this.nodes.find(n => n.id === e.target);
          return targetNode && targetNode.data.trackId === track.id;
        })
        .map(e => e.target);
      allChildNodeIds.push(...trackNodeIds);
    }

    // Initialize parallel container state - all children start as active
    this.context.updateNodeState(node.id, {
      state: 'running',
      containerMeta: {
        activeChildren: [...allChildNodeIds],
        completedChildren: [],
      }
    });

    const trackPromises: Promise<any>[] = [];

    for (const track of tracks) {
      const trackNodes = childEdges
        .map(e => this.nodes.find(n => n.id === e.target && n.data.trackId === track.id))
        .filter(Boolean);

      // Execute all nodes in this track in parallel, tracking completion
      const trackPromise = Promise.all(
        trackNodes.map(async (n) => {
          const result = await this.executeNode(n!.id);

          // Update container state: move this child from active to completed
          const currentMeta = this.context.getNodeState(node.id)?.containerMeta;
          if (currentMeta) {
            const activeChildren = currentMeta.activeChildren?.filter(id => id !== n!.id) || [];
            const completedChildren = [...(currentMeta.completedChildren || []), n!.id];

            this.context.updateNodeState(node.id, {
              state: 'running',
              containerMeta: {
                activeChildren,
                completedChildren,
              }
            });
          }

          return result;
        })
      );

      trackPromises.push(trackPromise);
    }

    const results = await Promise.all(trackPromises);

    // Mark parallel container as completed and clear metadata
    this.context.updateNodeState(node.id, {
      state: 'completed',
      containerMeta: undefined,
    });

    return { tracks: results.length, results };
  }

  /**
   * Execute a switch container (routing node)
   */
  private async executeSwitch(node: Node<FlowNodeData>): Promise<any> {
    const switchValue = this.resolveVariable(node.data.step?.switch);
    const cases = node.data.cases || [];

    this.context.addLog(node.id, `Switch value: ${JSON.stringify(switchValue)}`, 'info');

    // Find matching case
    let matchedCaseId: string | null = null;
    let matchedCaseIndex: number | undefined = undefined;

    for (let i = 0; i < cases.length; i++) {
      const caseData = cases[i];
      const whenValue = caseData.when;
      if (Array.isArray(whenValue)) {
        if (whenValue.includes(switchValue)) {
          matchedCaseId = caseData.id;
          matchedCaseIndex = i;
          break;
        }
      } else if (whenValue === switchValue) {
        matchedCaseId = caseData.id;
        matchedCaseIndex = i;
        break;
      }
    }

    // Determine which handle to follow
    const handleToFollow = matchedCaseId ? `case_${matchedCaseId}` : 'default';
    this.context.addLog(node.id, `Following handle: ${handleToFollow}`, 'info');

    // Update switch container state with matched case information
    this.context.updateNodeState(node.id, {
      state: 'running',
      containerMeta: {
        matchedCase: matchedCaseId || 'default',
        matchedCaseIndex,
      }
    });

    // Find edges from this switch
    const outgoingEdges = this.edges.filter(e => e.source === node.id);

    // Find the edge with the matching handle
    const branchEdge = outgoingEdges.find(e => e.sourceHandle === handleToFollow);

    if (branchEdge && branchEdge.target) {
      // Follow the entire chain starting from the first node in the branch
      await this.executeChain(branchEdge.target);
    }

    // Mark other branches as skipped
    const skippedEdges = outgoingEdges.filter(e => e.sourceHandle !== handleToFollow);
    for (const edge of skippedEdges) {
      if (edge.target) {
        await this.markChainAsSkipped(edge.target);
      }
    }

    // Mark switch as completed and clear metadata
    this.context.updateNodeState(node.id, {
      state: 'completed',
      containerMeta: undefined,
    });

    return { matchedCase: matchedCaseId || 'default' };
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
   * Execute a chain of nodes (for routing branches)
   * Follows edges until hitting another routing/container node
   */
  private async executeChain(startNodeId: string): Promise<void> {
    let currentNodeId: string | null = startNodeId;

    while (currentNodeId && !this.cancelled) {
      const node = this.nodes.find(n => n.id === currentNodeId);
      if (!node) break;

      // Execute the current node
      await this.executeNode(currentNodeId);

      // Check if this is a routing or container node - stop the chain
      if (node.type === 'conditionalContainer' ||
          node.type === 'switchContainer' ||
          node.type === 'loopContainer' ||
          node.type === 'parallelContainer') {
        break;
      }

      // Find next node in chain (follow 'output' or 'right' handle)
      const nextEdge = this.edges.find(e =>
        e.source === currentNodeId &&
        (e.sourceHandle === 'output' || e.sourceHandle === 'right')
      );

      currentNodeId = nextEdge?.target || null;
    }
  }

  /**
   * Mark an entire chain as skipped
   */
  private async markChainAsSkipped(startNodeId: string): Promise<void> {
    let currentNodeId: string | null = startNodeId;

    while (currentNodeId) {
      const node = this.nodes.find(n => n.id === currentNodeId);
      if (!node) break;

      this.context.updateNodeState(currentNodeId, {
        state: 'skipped',
        startTime: Date.now(),
        endTime: Date.now(),
      });

      // Stop at routing/container nodes
      if (node.type === 'conditionalContainer' ||
          node.type === 'switchContainer' ||
          node.type === 'loopContainer' ||
          node.type === 'parallelContainer') {
        break;
      }

      // Find next node in chain
      const nextEdge = this.edges.find(e =>
        e.source === currentNodeId &&
        (e.sourceHandle === 'output' || e.sourceHandle === 'right')
      );

      currentNodeId = nextEdge?.target || null;
    }
  }

  /**
   * Evaluate a condition with support for comparison operators
   */
  private evaluateCondition(condition: any): boolean {
    if (typeof condition === 'boolean') return condition;

    if (typeof condition === 'string') {
      // Check for comparison operators in the string
      const comparisonRegex = /(.+?)\s*(==|!=|<=|>=|<|>)\s*(.+)/;
      const match = condition.match(comparisonRegex);

      if (match) {
        const [, leftExpr, operator, rightExpr] = match;
        const leftValue = this.resolveVariable(leftExpr.trim());
        const rightValue = this.resolveVariable(rightExpr.trim());

        // Perform comparison based on operator
        switch (operator) {
          case '==':
            return leftValue == rightValue;
          case '!=':
            return leftValue != rightValue;
          case '<':
            return leftValue < rightValue;
          case '>':
            return leftValue > rightValue;
          case '<=':
            return leftValue <= rightValue;
          case '>=':
            return leftValue >= rightValue;
          default:
            return false;
        }
      }

      // No comparison operator - simple variable lookup
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

    // Parse literal boolean values
    if (ref === 'true') return true;
    if (ref === 'false') return false;

    // Parse literal numbers
    const num = Number(ref);
    if (!isNaN(num) && ref.trim() !== '') return num;

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
