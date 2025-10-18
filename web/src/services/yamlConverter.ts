import yaml from 'js-yaml';
import type { FlowDefinition, Step } from '../types/flow';
import type { FlowNodeData, FlowNodeType } from '../types/node';
import type { Node, Edge } from '@xyflow/react';

/**
 * Convert FlowLang YAML to ReactFlow nodes and edges
 */
export function yamlToFlow(yamlString: string): {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  flowDefinition: FlowDefinition;
} {
  const flowDefinition = yaml.load(yamlString) as FlowDefinition;
  const nodes: Node<FlowNodeData>[] = [];
  const edges: Edge[] = [];

  // Add Start node
  const startNodeId = 'start';
  nodes.push({
    id: startNodeId,
    type: 'start',
    position: { x: 100, y: 200 },
    data: {
      label: 'Start',
      type: 'start',
      validated: true,
    },
  });

  let xPosition = 400; // Start position for first node (more space from Start)
  const yPosition = 200; // Fixed Y position for horizontal flow
  const horizontalGap = 350; // Gap between nodes horizontally
  let nodeCounter = 0;

  // Helper to get next node ID
  const getNextNodeId = (step: Step): string => {
    if (step.id) return step.id;
    return `node_${nodeCounter++}`;
  };

  // Helper to get correct handle IDs based on node type
  const getHandleIds = (nodeType: FlowNodeType): { source: string; target: string } => {
    // Container nodes (Loop, Parallel) use 'left' and 'right'
    if (nodeType === 'loopContainer' || nodeType === 'parallelContainer') {
      return { source: 'right', target: 'left' };
    }
    // Routing nodes (Conditional, Switch) use 'input' for target (no generic source - they have specific handles)
    if (nodeType === 'conditionalContainer' || nodeType === 'switchContainer') {
      return { source: 'output', target: 'input' };  // source won't be used for sequential edges
    }
    // Task, subflow, exit, note nodes use 'input' and 'output'
    return { source: 'output', target: 'input' };
  };

  // Recursive helper to process steps (including nested ones)
  const processSteps = (
    steps: Step[],
    parentId?: string,
    startX?: number,
    startY?: number,
    stepGap?: number,
    isVertical: boolean = false // New param to control layout direction
  ): { lastNodeId: string | null; nextX: number; nextY: number; firstNodeId: string | null } => {
    let currentX = startX ?? xPosition;
    let currentY = startY ?? yPosition;
    let lastNodeId: string | null = null;
    let localFirstNodeId: string | null = null;
    const currentGap = stepGap ?? horizontalGap;

    steps.forEach((step, stepIndex) => {
      const nodeId = getNextNodeId(step);
      const node = stepToNode(step, stepIndex, currentX, currentY, parentId, nodeId);

      if (node) {
        nodes.push(node);

        // Track first node at top level
        if (!parentId && !localFirstNodeId) {
          localFirstNodeId = nodeId;
        }

        // Create edge from previous node (only at same level)
        if (lastNodeId) {
          // Get the source and target nodes to determine handle types
          const sourceNode = nodes.find(n => n.id === lastNodeId);
          const targetNode = node;

          if (sourceNode && targetNode) {
            const sourceHandles = getHandleIds(sourceNode.type as FlowNodeType);
            const targetHandles = getHandleIds(targetNode.type as FlowNodeType);

            edges.push({
              id: `e${lastNodeId}-${nodeId}`,
              source: lastNodeId,
              sourceHandle: sourceHandles.source,
              target: nodeId,
              targetHandle: targetHandles.target,
              type: 'smoothstep',
              style: { stroke: '#94a3b8', strokeWidth: 2 },
              markerEnd: {
                type: 'arrowclosed',
                color: '#94a3b8',
              },
            });
          }
        }

        // Handle Loop container - process 'do' array
        if (step.for_each && step.do && Array.isArray(step.do)) {
          // Position children inside the loop container (vertical stack inside)
          const childX = 40; // Relative X position inside container (accounting for padding)
          const childY = 80; // Start below the header (respecting minimum margin)
          const nodeHeight = 60; // Approximate height of a task node
          const childVerticalGap = nodeHeight + 15; // Node height + 15px gap between nodes

          // Calculate container size based on children (accounting for nested containers)
          const childrenCount = step.do.length;

          // Calculate depth and size more accurately
          const calculateChildSize = (child: Step): { width: number; height: number } => {
            if (child.for_each && child.do) {
              // Loop container - check if it has nested containers
              const hasNestedInLoop = child.do.some(c => c.for_each || c.parallel);
              return {
                width: hasNestedInLoop ? 400 : 250,
                height: hasNestedInLoop ? 450 : 200
              };
            } else if (child.parallel) {
              // Parallel container - check depth
              const hasNestedInParallel = child.parallel.some(c => c.for_each || c.parallel);
              return {
                width: hasNestedInParallel ? 400 : 250,
                height: hasNestedInParallel ? 450 : 200
              };
            }
            // Regular task node
            return { width: 200, height: 60 };
          };

          // Get the maximum child dimensions
          const childSizes = step.do.map(calculateChildSize);
          const maxChildWidth = Math.max(...childSizes.map(s => s.width));
          const maxChildHeight = Math.max(...childSizes.map(s => s.height));
          const totalHeight = childSizes.reduce((sum, s) => sum + s.height, 0);

          const containerWidth = maxChildWidth + 80; // Child width + padding on both sides
          const containerHeight = Math.max(
            150, // Minimum height
            childY + totalHeight + ((childrenCount - 1) * 15) + 30 // Header + all children heights + gaps + bottom padding
          );

          // Update the container node with calculated dimensions
          const containerNode = nodes.find(n => n.id === nodeId);
          if (containerNode) {
            containerNode.style = {
              width: containerWidth,
              height: containerHeight,
            };
            containerNode.width = containerWidth;
            containerNode.height = containerHeight;
            // Set measured dimensions for ReactFlow
            containerNode.measured = {
              width: containerWidth,
              height: containerHeight,
            };
          }

          // Process children with vertical spacing inside container (recursively handles nested containers)
          processSteps(step.do, nodeId, childX, childY, childVerticalGap, true);
        }

        // Handle Parallel container - process 'parallel' array
        if (step.parallel && Array.isArray(step.parallel)) {
          // Position children inside the parallel container (vertical stack inside)
          const childX = 40; // Relative X position inside container
          const childY = 80; // Start below the header
          const nodeHeight = 60; // Approximate height of a task node
          const childVerticalGap = nodeHeight + 15; // Node height + 15px gap between nodes

          // Calculate container size based on children (accounting for nested containers)
          const childrenCount = step.parallel.length;

          // Calculate depth and size more accurately
          const calculateChildSize = (child: Step): { width: number; height: number } => {
            if (child.for_each && child.do) {
              // Loop container - check if it has nested containers
              const hasNestedInLoop = child.do.some(c => c.for_each || c.parallel);
              return {
                width: hasNestedInLoop ? 400 : 250,
                height: hasNestedInLoop ? 450 : 200
              };
            } else if (child.parallel) {
              // Parallel container - check depth
              const hasNestedInParallel = child.parallel.some(c => c.for_each || c.parallel);
              return {
                width: hasNestedInParallel ? 400 : 250,
                height: hasNestedInParallel ? 450 : 200
              };
            }
            // Regular task node
            return { width: 200, height: 60 };
          };

          // Get the maximum child dimensions
          const childSizes = step.parallel.map(calculateChildSize);
          const maxChildWidth = Math.max(...childSizes.map(s => s.width));
          const maxChildHeight = Math.max(...childSizes.map(s => s.height));
          const totalHeight = childSizes.reduce((sum, s) => sum + s.height, 0);

          const containerWidth = maxChildWidth + 80; // Child width + padding on both sides
          const containerHeight = Math.max(
            180, // Minimum height
            childY + totalHeight + ((childrenCount - 1) * 15) + 40 // Header + all children heights + gaps + bottom padding
          );

          // Update the container node with calculated dimensions
          const containerNode = nodes.find(n => n.id === nodeId);
          if (containerNode) {
            containerNode.style = {
              width: containerWidth,
              height: containerHeight,
            };
            containerNode.width = containerWidth;
            containerNode.height = containerHeight;
            // Set measured dimensions for ReactFlow
            containerNode.measured = {
              width: containerWidth,
              height: containerHeight,
            };
          }

          // Process children with vertical spacing inside container (recursively handles nested containers)
          processSteps(step.parallel, nodeId, childX, childY, childVerticalGap, true);
        }

        // Handle Conditional - process 'then' and 'else' chains (routing, not containment)
        if (step.if && (step.then || step.else)) {
          const branchX = currentX + horizontalGap; // Position branches to the right
          let branchY = currentY - 100; // Start branches above the conditional node

          // Process 'then' branch
          if (step.then && Array.isArray(step.then) && step.then.length > 0) {
            const thenResult = processSteps(step.then, undefined, branchX, branchY, horizontalGap, false);

            // Connect conditional to first 'then' node using 'then' handle
            if (thenResult.firstNodeId) {
              const firstThenNode = nodes.find(n => n.id === thenResult.firstNodeId);
              if (firstThenNode) {
                const targetHandles = getHandleIds(firstThenNode.type as FlowNodeType);

                edges.push({
                  id: `e${nodeId}-${thenResult.firstNodeId}-then`,
                  source: nodeId,
                  sourceHandle: 'then', // Use specific 'then' handle
                  target: thenResult.firstNodeId,
                  targetHandle: targetHandles.target,
                  type: 'smoothstep',
                  style: { stroke: '#22c55e', strokeWidth: 2 }, // Green for then
                  markerEnd: {
                    type: 'arrowclosed',
                    color: '#22c55e',
                  },
                  label: 'then',
                });
              }
            }

            branchY = thenResult.nextY + 100; // Position 'else' below 'then'
          }

          // Process 'else' branch
          if (step.else && Array.isArray(step.else) && step.else.length > 0) {
            const elseResult = processSteps(step.else, undefined, branchX, branchY, horizontalGap, false);

            // Connect conditional to first 'else' node using 'else' handle
            if (elseResult.firstNodeId) {
              const firstElseNode = nodes.find(n => n.id === elseResult.firstNodeId);
              if (firstElseNode) {
                const targetHandles = getHandleIds(firstElseNode.type as FlowNodeType);

                edges.push({
                  id: `e${nodeId}-${elseResult.firstNodeId}-else`,
                  source: nodeId,
                  sourceHandle: 'else', // Use specific 'else' handle
                  target: elseResult.firstNodeId,
                  targetHandle: targetHandles.target,
                  type: 'smoothstep',
                  style: { stroke: '#ef4444', strokeWidth: 2 }, // Red for else
                  markerEnd: {
                    type: 'arrowclosed',
                    color: '#ef4444',
                  },
                  label: 'else',
                });
              }
            }
          }
        }

        // Handle Switch - process 'cases' and 'default' chains (routing, not containment)
        if (step.switch && (step.cases || step.default)) {
          const branchX = currentX + horizontalGap; // Position branches to the right
          let branchY = currentY - 100; // Start branches above the switch node

          // Store case information in node data for UI rendering
          const casesData = step.cases?.map((caseExpr, idx) => ({
            id: `case_${idx}`,
            when: caseExpr.when,
          })) || [];

          // Update node data to include cases
          const switchNode = nodes.find(n => n.id === nodeId);
          if (switchNode) {
            switchNode.data.cases = casesData;
          }

          // Process each case branch
          if (step.cases && Array.isArray(step.cases)) {
            step.cases.forEach((caseExpr, caseIndex) => {
              if (caseExpr.do && Array.isArray(caseExpr.do) && caseExpr.do.length > 0) {
                const caseResult = processSteps(caseExpr.do, undefined, branchX, branchY, horizontalGap, false);

                // Connect switch to first case node using case-specific handle
                if (caseResult.firstNodeId) {
                  const firstCaseNode = nodes.find(n => n.id === caseResult.firstNodeId);
                  if (firstCaseNode) {
                    const targetHandles = getHandleIds(firstCaseNode.type as FlowNodeType);
                    const caseId = `case_${caseIndex}`;

                    edges.push({
                      id: `e${nodeId}-${caseResult.firstNodeId}-${caseId}`,
                      source: nodeId,
                      sourceHandle: `case_${caseId}`, // Use case-specific handle (matches SwitchContainerNode)
                      target: caseResult.firstNodeId,
                      targetHandle: targetHandles.target,
                      type: 'smoothstep',
                      style: { stroke: '#3b82f6', strokeWidth: 2 }, // Blue for cases
                      markerEnd: {
                        type: 'arrowclosed',
                        color: '#3b82f6',
                      },
                      label: Array.isArray(caseExpr.when) ? caseExpr.when.join(', ') : String(caseExpr.when),
                    });
                  }
                }

                branchY = caseResult.nextY + 80; // Position next case below current
              }
            });
          }

          // Process 'default' branch
          if (step.default && Array.isArray(step.default) && step.default.length > 0) {
            const defaultResult = processSteps(step.default, undefined, branchX, branchY, horizontalGap, false);

            // Connect switch to first 'default' node using 'default' handle
            if (defaultResult.firstNodeId) {
              const firstDefaultNode = nodes.find(n => n.id === defaultResult.firstNodeId);
              if (firstDefaultNode) {
                const targetHandles = getHandleIds(firstDefaultNode.type as FlowNodeType);

                edges.push({
                  id: `e${nodeId}-${defaultResult.firstNodeId}-default`,
                  source: nodeId,
                  sourceHandle: 'default', // Use specific 'default' handle
                  target: defaultResult.firstNodeId,
                  targetHandle: targetHandles.target,
                  type: 'smoothstep',
                  style: { stroke: '#6b7280', strokeWidth: 2 }, // Gray for default
                  markerEnd: {
                    type: 'arrowclosed',
                    color: '#6b7280',
                  },
                  label: 'default',
                });
              }
            }
          }
        }

        lastNodeId = nodeId;

        // Move to next position based on layout direction
        if (isVertical) {
          currentY += currentGap;
        } else {
          currentX += currentGap;
        }
      }
    });

    return { lastNodeId, nextX: currentX, nextY: currentY, firstNodeId: localFirstNodeId };
  };

  // Convert steps to nodes
  if (flowDefinition.steps) {
    const result = processSteps(flowDefinition.steps);

    // Connect Start node to first step
    if (result.firstNodeId) {
      const firstNode = nodes.find(n => n.id === result.firstNodeId);
      if (firstNode) {
        const targetHandles = getHandleIds(firstNode.type as FlowNodeType);
        edges.push({
          id: `e${startNodeId}-${result.firstNodeId}`,
          source: startNodeId,
          sourceHandle: 'output',
          target: result.firstNodeId,
          targetHandle: targetHandles.target,
          type: 'smoothstep',
          style: { stroke: '#94a3b8', strokeWidth: 2 },
          markerEnd: {
            type: 'arrowclosed',
            color: '#94a3b8',
          },
        });
      }
    }
  }

  return { nodes, edges, flowDefinition };
}

/**
 * Convert a FlowLang step to a ReactFlow node
 */
function stepToNode(
  step: Step,
  index: number,
  x: number,
  y: number,
  parentId?: string,
  nodeId?: string  // Pass in the nodeId from getNextNodeId to ensure consistency
): Node<FlowNodeData> | null {
  let type: FlowNodeType = 'task';
  let label = `Step ${index + 1}`;

  // Determine node type based on step properties
  if (step.task) {
    type = 'task';
    label = step.id || step.task;
  } else if (step.if) {
    type = 'conditionalContainer';
    label = step.id || 'Conditional';
  } else if (step.switch) {
    type = 'switchContainer';
    label = step.id || 'Switch';
  } else if (step.for_each) {
    type = 'loopContainer';
    label = step.id || 'Loop';
  } else if (step.parallel) {
    type = 'parallelContainer';
    label = step.id || 'Parallel';
  } else if (step.exit) {
    type = 'exit';
    label = 'Exit';
  }

  // IMPORTANT: Use the nodeId passed from getNextNodeId to ensure consistency
  // between nodeId (used for edges/parentId) and node.id (actual node ID)
  const finalNodeId = nodeId || step.id || `node_${index}`;

  const node: Node<FlowNodeData> = {
    id: finalNodeId,
    type,
    position: { x, y },
    data: {
      label,
      type,
      step,
      validated: true,
    },
  };

  // Add parentId and extent if this is a child node
  if (parentId) {
    node.parentId = parentId;
    node.extent = 'parent';
  }

  return node;
}

/**
 * Convert ReactFlow nodes and edges to FlowLang YAML
 */
export function flowToYaml(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  flowDefinition: FlowDefinition
): string {
  // Filter out the Start node - it's only for visual purposes
  const flowNodes = nodes.filter((node) => node.type !== 'start');

  // Build a graph to understand flow structure
  const nodeMap = new Map<string, Node<FlowNodeData>>();
  flowNodes.forEach((node) => nodeMap.set(node.id, node));

  const edgesBySource = new Map<string, Edge[]>();
  edges.forEach((edge) => {
    const existing = edgesBySource.get(edge.source) || [];
    existing.push(edge);
    edgesBySource.set(edge.source, existing);
  });

  // Track which nodes have been processed to avoid duplicates
  const processedNodes = new Set<string>();

  // Helper to follow edges from a node and build steps
  const followEdges = (nodeId: string, handleId?: string): Step[] => {
    const steps: Step[] = [];
    const outgoingEdges = edgesBySource.get(nodeId) || [];

    // Filter edges by handle if specified
    const relevantEdges = handleId
      ? outgoingEdges.filter(e => e.sourceHandle === handleId)
      : outgoingEdges;

    // Sort by target node position (X for horizontal, Y for vertical)
    const sortedEdges = [...relevantEdges].sort((a, b) => {
      const nodeA = nodeMap.get(a.target);
      const nodeB = nodeMap.get(b.target);
      if (!nodeA || !nodeB) return 0;
      return nodeA.position.x - nodeB.position.x;
    });

    sortedEdges.forEach(edge => {
      const targetNode = nodeMap.get(edge.target);
      if (targetNode && !processedNodes.has(targetNode.id)) {
        const step = buildStep(targetNode);
        if (step) {
          steps.push(step);
        }
      }
    });

    return steps;
  };

  // Helper to build a single step (and process its nested structure)
  const buildStep = (node: Node<FlowNodeData>): Step | null => {
    if (processedNodes.has(node.id)) return null;
    processedNodes.add(node.id);

    const step = nodeToStep(node);
    if (!step) return null;

    // Handle container nodes (Loop, Parallel) - use parentId and recursively process children
    if (node.type === 'loopContainer' && step.for_each) {
      const children = flowNodes.filter(n => n.parentId === node.id);
      const sortedChildren = [...children].sort((a, b) => a.position.y - b.position.y);
      step.do = sortedChildren.map(child => {
        // Use buildStep instead of nodeToStep to handle nested containers recursively
        return buildStep(child);
      }).filter(s => s !== null) as Step[];
    } else if (node.type === 'parallelContainer') {
      const children = flowNodes.filter(n => n.parentId === node.id);
      const sortedChildren = [...children].sort((a, b) => a.position.y - b.position.y);
      step.parallel = sortedChildren.map(child => {
        // Use buildStep instead of nodeToStep to handle nested containers recursively
        return buildStep(child);
      }).filter(s => s !== null) as Step[];
    }
    // Handle routing nodes (Conditional, Switch) - follow edges by handle
    else if (node.type === 'conditionalContainer' && step.if) {
      step.then = followBranchChain(node.id, 'then');
      step.else = followBranchChain(node.id, 'else');
    } else if (node.type === 'switchContainer' && step.switch) {
      // Reconstruct cases from node data and follow edges
      const casesData = node.data.cases || [];
      step.cases = casesData.map((caseData: any, idx: number) => {
        const handleId = `case_case_${idx}`;
        return {
          when: caseData.when,
          do: followBranchChain(node.id, handleId)
        };
      }).filter((c: any) => c.do.length > 0);

      step.default = followBranchChain(node.id, 'default');
    }

    return step;
  };

  // Helper to follow an entire branch chain (for conditional/switch branches)
  const followBranchChain = (nodeId: string, handleId: string): Step[] => {
    const steps: Step[] = [];
    const outgoingEdges = edgesBySource.get(nodeId) || [];

    // Find the edge with the specific handle
    const branchEdge = outgoingEdges.find(e => e.sourceHandle === handleId);
    if (!branchEdge) return steps;

    // Start following the chain from the first node
    let currentNodeId: string | null = branchEdge.target;

    while (currentNodeId) {
      const currentNode = nodeMap.get(currentNodeId);
      if (!currentNode || processedNodes.has(currentNodeId)) break;

      const step = buildStep(currentNode);
      if (step) {
        steps.push(step);
      }

      // Find the next node in the chain (follow 'output' handle for tasks)
      const nextEdges = edgesBySource.get(currentNodeId) || [];
      const nextEdge = nextEdges.find(e =>
        e.sourceHandle === 'output' || e.sourceHandle === 'right'
      );

      currentNodeId = nextEdge ? nextEdge.target : null;

      // Stop if we hit another routing node or container (they'll be processed separately)
      if (currentNodeId) {
        const nextNode = nodeMap.get(currentNodeId);
        if (nextNode && (
          nextNode.type === 'conditionalContainer' ||
          nextNode.type === 'switchContainer' ||
          nextNode.type === 'loopContainer' ||
          nextNode.type === 'parallelContainer'
        )) {
          break;
        }
      }
    }

    return steps;
  };

  // Helper function to recursively build steps with nested children
  const buildStepsRecursively = (parentId: string | null): Step[] => {
    // Get nodes at this level (children of parentId, or top-level if parentId is null)
    const nodesAtLevel = flowNodes.filter((node) =>
      parentId === null ? !node.parentId : node.parentId === parentId
    );

    // Sort by position (X for top-level horizontal, Y for nested vertical)
    const sortedNodes = [...nodesAtLevel].sort((a, b) => {
      if (parentId === null) {
        return a.position.x - b.position.x; // Horizontal for top level
      }
      return a.position.y - b.position.y; // Vertical for nested
    });

    const steps: Step[] = [];

    sortedNodes.forEach((node) => {
      const step = buildStep(node);
      if (step) {
        steps.push(step);
      }
    });

    return steps;
  };

  // Convert nodes to steps, starting from top level (parentId = null)
  const steps = buildStepsRecursively(null);

  const sortedNodes = [...flowNodes].sort((a, b) => a.position.y - b.position.y);

  // Build output definition with proper field order (canonical FlowLang order):
  // flow, description, inputs, connections, triggers, steps, outputs, on_cancel
  const outputDefinition: any = {};

  if (flowDefinition.flow) outputDefinition.flow = flowDefinition.flow;
  if (flowDefinition.description) outputDefinition.description = flowDefinition.description;
  if (flowDefinition.inputs) outputDefinition.inputs = flowDefinition.inputs;
  if (flowDefinition.connections) outputDefinition.connections = flowDefinition.connections;
  if (flowDefinition.triggers) outputDefinition.triggers = flowDefinition.triggers;

  // Steps come before outputs in FlowLang
  outputDefinition.steps = steps;

  if (flowDefinition.outputs) outputDefinition.outputs = flowDefinition.outputs;
  if (flowDefinition.on_cancel) outputDefinition.on_cancel = flowDefinition.on_cancel;

  return buildYamlWithComments(outputDefinition, sortedNodes);
}

/**
 * Smart YAML value serialization that minimizes unnecessary quotes
 */
function serializeYamlValue(value: any): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value.toString();
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  if (typeof value === 'string') {
    // Don't quote variable references like ${inputs.var}
    if (value.match(/^\$\{.+\}$/)) {
      return value;
    }

    // Don't quote simple strings (alphanumeric, underscores, hyphens, dots)
    // This handles cases like: done, success, error, step_1, category-name
    if (value.match(/^[a-zA-Z0-9_\-\.]+$/)) {
      return value;
    }

    // Don't quote strings that are safe in YAML without quotes
    // Quote only if the string contains problematic YAML sequences
    const needsQuoting =
      value.match(/^[\s\-\[\{]/) || // Starts with space, hyphen, or bracket
      value.match(/:\s/) ||          // Contains colon followed by space (looks like key: value)
      value.match(/[{}[\]]/) ||      // Contains braces or brackets
      value.match(/^(true|false|null|yes|no|on|off)$/i) || // YAML boolean/null keywords
      value.match(/^\d+$/) ||        // Pure numbers (would be parsed as numbers)
      value.trim() !== value;        // Has leading or trailing whitespace

    if (!needsQuoting) {
      return value;
    }

    // Otherwise use JSON.stringify for proper escaping
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return JSON.stringify(value);
}

/**
 * Helper function to render a single step with proper indentation
 */
function renderStep(step: Step, _index: number, indentLevel: number): string[] {
  const indent = '  '.repeat(indentLevel);
  const lines: string[] = [];

  // Handle different step types
  if ('task' in step) {
    lines.push(`${indent}- task: ${step.task || 'TODO'}`);
    if (step.id) {
      lines.push(`${indent}  id: ${step.id}`);
    }
    if (step.inputs && Object.keys(step.inputs).length > 0) {
      lines.push(`${indent}  inputs:`);
      Object.entries(step.inputs).forEach(([key, value]) => {
        lines.push(`${indent}    ${key}: ${serializeYamlValue(value)}`);
      });
    }
    if (step.outputs && step.outputs.length > 0) {
      lines.push(`${indent}  outputs:`);
      step.outputs.forEach((output) => {
        lines.push(`${indent}    - ${output}`);
      });
    }
  } else if (step.for_each) {
    lines.push(`${indent}- for_each: ${step.for_each}`);
    if (step.id) {
      lines.push(`${indent}  id: ${step.id}`);
    }
    lines.push(`${indent}  as: ${step.as || 'item'}`);
    lines.push(`${indent}  do:`);
    if (step.do && step.do.length > 0) {
      step.do.forEach((childStep, childIndex) => {
        const childLines = renderStep(childStep, childIndex, indentLevel + 2);
        lines.push(...childLines);
      });
    }
  } else if (step.parallel) {
    lines.push(`${indent}- parallel:`);
    if (step.id) {
      lines.push(`${indent}  id: ${step.id}`);
    }
    if (step.parallel && step.parallel.length > 0) {
      step.parallel.forEach((childStep, childIndex) => {
        const childLines = renderStep(childStep, childIndex, indentLevel + 2);
        lines.push(...childLines);
      });
    }
  } else if (step.if) {
    if (typeof step.if === 'string') {
      lines.push(`${indent}- if: ${step.if}`);
    } else if (typeof step.if === 'object') {
      lines.push(`${indent}- if:`);
      Object.entries(step.if).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          lines.push(`${indent}    ${key}:`);
          value.forEach((condition) => {
            lines.push(`${indent}      - ${condition}`);
          });
        } else {
          lines.push(`${indent}    ${key}: ${serializeYamlValue(value)}`);
        }
      });
    }
    if (step.id) {
      lines.push(`${indent}  id: ${step.id}`);
    }
    lines.push(`${indent}  then:`);
    if (step.then && step.then.length > 0) {
      step.then.forEach((childStep, childIndex) => {
        const childLines = renderStep(childStep, childIndex, indentLevel + 2);
        lines.push(...childLines);
      });
    }
    if (step.else) {
      lines.push(`${indent}  else:`);
      if (step.else.length > 0) {
        step.else.forEach((childStep, childIndex) => {
          const childLines = renderStep(childStep, childIndex, indentLevel + 2);
          lines.push(...childLines);
        });
      }
    }
  } else if (step.switch) {
    lines.push(`${indent}- switch: ${step.switch}`);
    if (step.id) {
      lines.push(`${indent}  id: ${step.id}`);
    }
    if (step.cases && step.cases.length > 0) {
      lines.push(`${indent}  cases:`);
      step.cases.forEach((caseExpr) => {
        const whenValue = Array.isArray(caseExpr.when)
          ? caseExpr.when.map(v => serializeYamlValue(v)).join(', ')
          : serializeYamlValue(caseExpr.when);
        lines.push(`${indent}    - when: ${whenValue}`);
        lines.push(`${indent}      do:`);
        if (caseExpr.do && caseExpr.do.length > 0) {
          caseExpr.do.forEach((childStep, childIndex) => {
            const childLines = renderStep(childStep, childIndex, indentLevel + 4);
            lines.push(...childLines);
          });
        }
      });
    }
    if (step.default && step.default.length > 0) {
      lines.push(`${indent}  default:`);
      step.default.forEach((childStep, childIndex) => {
        const childLines = renderStep(childStep, childIndex, indentLevel + 2);
        lines.push(...childLines);
      });
    }
  } else if (step.exit) {
    lines.push(`${indent}- exit: ${typeof step.exit === 'object' ? '' : 'true'}`);
    if (typeof step.exit === 'object') {
      if (step.exit.reason) {
        lines.push(`${indent}    reason: ${serializeYamlValue(step.exit.reason)}`);
      }
      if (step.exit.outputs) {
        lines.push(`${indent}    outputs:`);
        Object.entries(step.exit.outputs).forEach(([key, value]) => {
          lines.push(`${indent}      ${key}: ${serializeYamlValue(value)}`);
        });
      }
    }
  }

  return lines;
}

/**
 * Build YAML string with helpful comments based on node information
 */
function buildYamlWithComments(
  definition: any,
  nodes: Node<FlowNodeData>[]
): string {
  const lines: string[] = [];

  // Flow name
  if (definition.flow) {
    lines.push(`flow: ${definition.flow}`);
  }

  // Description
  if (definition.description) {
    lines.push(`description: ${serializeYamlValue(definition.description)}`);
  }

  // Inputs
  if (definition.inputs && definition.inputs.length > 0) {
    lines.push('');
    lines.push('# Flow inputs');
    lines.push('inputs:');
    definition.inputs.forEach((input: any) => {
      const required = input.required ? ' (required)' : ' (optional)';
      lines.push(`  - name: ${input.name}  # ${input.type}${required}`);
      lines.push(`    type: ${input.type}`);
      if (input.required !== undefined) {
        lines.push(`    required: ${input.required}`);
      }
      if (input.default !== undefined) {
        lines.push(`    default: ${serializeYamlValue(input.default)}`);
      }
    });
  }

  // Connections
  if (definition.connections && Object.keys(definition.connections).length > 0) {
    lines.push('');
    lines.push('# Database and service connections');
    lines.push('connections:');
    Object.entries(definition.connections).forEach(([name, conn]: [string, any]) => {
      lines.push(`  ${name}:  # ${conn.type}`);
      Object.entries(conn).forEach(([key, value]) => {
        if (key !== 'type') {
          lines.push(`    ${key}: ${serializeYamlValue(value)}`);
        } else {
          lines.push(`    type: ${value}`);
        }
      });
    });
  }

  // Triggers
  if (definition.triggers && definition.triggers.length > 0) {
    lines.push('');
    lines.push('# Event triggers');
    lines.push('triggers:');
    definition.triggers.forEach((trigger: any, index: number) => {
      const triggerType = trigger.type || 'webhook';
      const method = trigger.method || 'POST';
      lines.push(`  - type: ${triggerType}  # ${method} ${trigger.path || ''}`);
      Object.entries(trigger).forEach(([key, value]) => {
        if (key !== 'type') {
          if (typeof value === 'object' && value !== null) {
            lines.push(`    ${key}:`);
            Object.entries(value).forEach(([subKey, subValue]) => {
              lines.push(`      ${subKey}: ${serializeYamlValue(subValue)}`);
            });
          } else {
            lines.push(`    ${key}: ${serializeYamlValue(value)}`);
          }
        }
      });
      if (index < definition.triggers.length - 1) {
        lines.push('');
      }
    });
  }

  // Steps (before outputs in canonical FlowLang order)
  if (definition.steps && definition.steps.length > 0) {
    lines.push('');
    lines.push('# Workflow steps');
    lines.push('steps:');

    definition.steps.forEach((step: Step, index: number) => {
      // Use the recursive renderStep function for all steps
      const stepLines = renderStep(step, index, 1); // indent level 1 for top-level steps
      lines.push(...stepLines);

      // Add blank line between steps
      if (index < definition.steps.length - 1) {
        lines.push('');
      }
    });
  }

  // Outputs (after steps in canonical FlowLang order)
  if (definition.outputs && definition.outputs.length > 0) {
    lines.push('');
    lines.push('# Flow outputs');
    lines.push('outputs:');
    definition.outputs.forEach((output: any) => {
      lines.push(`  - name: ${output.name}`);
      lines.push(`    value: ${output.value}`);
    });
  }

  // Cleanup handlers (on_cancel) - last
  if (definition.on_cancel && definition.on_cancel.length > 0) {
    lines.push('');
    lines.push('# Cleanup steps (execute in LIFO order when flow is cancelled)');
    lines.push('on_cancel:');
    definition.on_cancel.forEach((step: Step, index: number) => {
      const stepNum = definition.on_cancel.length - index;
      const description = step.description ? ` - ${step.description}` : '';
      lines.push(`  - task: ${step.task}  # Step ${stepNum}${description}`);
      if (step.id) {
        lines.push(`    id: ${step.id}`);
      }
      if (step.inputs && Object.keys(step.inputs).length > 0) {
        lines.push(`    inputs:`);
        Object.entries(step.inputs).forEach(([key, value]) => {
          lines.push(`      ${key}: ${serializeYamlValue(value)}`);
        });
      }
      if (index < definition.on_cancel.length - 1) {
        lines.push('');
      }
    });
  }

  return lines.join('\n') + '\n';
}

/**
 * Convert a ReactFlow node back to a FlowLang step
 */
function nodeToStep(node: Node<FlowNodeData>): Step | null {
  // If node already has a step definition, use it
  if (node.data.step) {
    const step = { ...node.data.step };

    // For tasks, always ensure ID is present (required by schema)
    if (node.data.type === 'task') {
      step.id = node.id;
    } else {
      // For containers, only include ID if it was explicitly in the original YAML
      // Remove auto-generated IDs (node_0, node_1, etc.)
      if (step.id && step.id.match(/^node_\d+$/)) {
        delete step.id;
      }
      // Otherwise preserve the original ID if it exists
    }

    return step;
  }

  // Otherwise create a basic step based on type
  const baseStep: any = {};

  // Only include ID for tasks (required by schema)
  if (node.data.type === 'task') {
    baseStep.id = node.id;
  }

  switch (node.data.type) {
    case 'task':
      return {
        ...baseStep,
        task: node.data.label,
        inputs: {},
        outputs: ['output'],
      };

    case 'conditionalContainer':
      return {
        ...baseStep,
        if: 'condition',
        then: [],
        else: [],
      };

    case 'switchContainer':
      return {
        ...baseStep,
        switch: 'expression',
        cases: [],
        default: [],
      };

    case 'loopContainer':
      return {
        ...baseStep,
        for_each: 'items',
        as: 'item',
        do: [],
      };

    case 'parallelContainer':
      return {
        ...baseStep,
        parallel: [],
      };

    case 'exit':
      return {
        exit: true,
      };

    default:
      return { ...baseStep };
  }
}

/**
 * Convert a single node to YAML string
 */
export function nodeToYaml(node: Node<FlowNodeData>): string {
  const step = nodeToStep(node);
  if (!step) {
    return '# No step data available';
  }

  return yaml.dump(step, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });
}

/**
 * Validate YAML structure
 */
export function validateYaml(yamlString: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    const flowDefinition = yaml.load(yamlString) as FlowDefinition;

    if (!flowDefinition.flow) {
      errors.push('Missing required field: flow');
    }

    if (!flowDefinition.steps || flowDefinition.steps.length === 0) {
      errors.push('Flow must have at least one step');
    }

    // Additional validation can be added here

    return { valid: errors.length === 0, errors };
  } catch (error) {
    return {
      valid: false,
      errors: [`Invalid YAML: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}
