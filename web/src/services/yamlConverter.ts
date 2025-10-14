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

  let yPosition = 100;
  const xPosition = 400;
  const verticalGap = 150;

  // Convert steps to nodes
  if (flowDefinition.steps) {
    flowDefinition.steps.forEach((step, index) => {
      const node = stepToNode(step, index, xPosition, yPosition);
      if (node) {
        nodes.push(node);
        yPosition += verticalGap;

        // Create edge from previous node
        if (index > 0 && nodes.length > 1) {
          edges.push({
            id: `e${nodes[nodes.length - 2].id}-${node.id}`,
            source: nodes[nodes.length - 2].id,
            target: node.id,
          });
        }
      }
    });
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
  y: number
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

  return {
    id: step.id || `node_${index}`,
    type,
    position: { x, y },
    data: {
      label,
      type,
      step,
      validated: true,
    },
  };
}

/**
 * Convert ReactFlow nodes and edges to FlowLang YAML
 */
export function flowToYaml(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  flowDefinition: FlowDefinition
): string {
  // Build a graph to understand flow structure
  const nodeMap = new Map<string, Node<FlowNodeData>>();
  nodes.forEach((node) => nodeMap.set(node.id, node));

  const edgesBySource = new Map<string, Edge[]>();
  edges.forEach((edge) => {
    const existing = edgesBySource.get(edge.source) || [];
    existing.push(edge);
    edgesBySource.set(edge.source, existing);
  });

  // Convert nodes to steps (simplified - sequential flow for now)
  const steps: Step[] = [];

  // Sort nodes by Y position to maintain visual order
  const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);

  sortedNodes.forEach((node) => {
    const step = nodeToStep(node);
    if (step) {
      steps.push(step);
    }
  });

  const outputDefinition: FlowDefinition = {
    ...flowDefinition,
    steps,
  };

  return yaml.dump(outputDefinition, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });
}

/**
 * Convert a ReactFlow node back to a FlowLang step
 */
function nodeToStep(node: Node<FlowNodeData>): Step | null {
  // If node already has a step definition, use it
  if (node.data.step) {
    return {
      ...node.data.step,
      id: node.id,
    };
  }

  // Otherwise create a basic step based on type
  const baseStep: Step = {
    id: node.id,
  };

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
      return baseStep;
  }
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
