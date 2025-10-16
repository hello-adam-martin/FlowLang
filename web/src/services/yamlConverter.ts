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

  // Convert nodes to steps (simplified - sequential flow for now)
  const steps: Step[] = [];

  // Sort nodes by Y position to maintain visual order
  const sortedNodes = [...flowNodes].sort((a, b) => a.position.y - b.position.y);

  sortedNodes.forEach((node) => {
    const step = nodeToStep(node);
    if (step) {
      steps.push(step);
    }
  });

  // Build output definition with proper field order:
  // flow, description, inputs, outputs, connections, triggers, on_cancel, steps (last)
  const outputDefinition: any = {};

  if (flowDefinition.flow) outputDefinition.flow = flowDefinition.flow;
  if (flowDefinition.description) outputDefinition.description = flowDefinition.description;
  if (flowDefinition.inputs) outputDefinition.inputs = flowDefinition.inputs;
  if (flowDefinition.outputs) outputDefinition.outputs = flowDefinition.outputs;
  if (flowDefinition.connections) outputDefinition.connections = flowDefinition.connections;
  if (flowDefinition.triggers) outputDefinition.triggers = flowDefinition.triggers;
  if (flowDefinition.on_cancel) outputDefinition.on_cancel = flowDefinition.on_cancel;

  // Steps always last
  outputDefinition.steps = steps;

  return buildYamlWithComments(outputDefinition, sortedNodes);
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
    lines.push(`description: ${JSON.stringify(definition.description)}`);
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
        lines.push(`    default: ${JSON.stringify(input.default)}`);
      }
    });
  }

  // Outputs
  if (definition.outputs && definition.outputs.length > 0) {
    lines.push('');
    lines.push('# Flow outputs');
    lines.push('outputs:');
    definition.outputs.forEach((output: any) => {
      lines.push(`  - name: ${output.name}`);
      lines.push(`    value: ${output.value}`);
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
          lines.push(`    ${key}: ${JSON.stringify(value)}`);
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
              lines.push(`      ${subKey}: ${JSON.stringify(subValue)}`);
            });
          } else {
            lines.push(`    ${key}: ${JSON.stringify(value)}`);
          }
        }
      });
      if (index < definition.triggers.length - 1) {
        lines.push('');
      }
    });
  }

  // Cleanup handlers (on_cancel)
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
          lines.push(`      ${key}: ${JSON.stringify(value)}`);
        });
      }
      if (index < definition.on_cancel.length - 1) {
        lines.push('');
      }
    });
  }

  // Steps
  if (definition.steps && definition.steps.length > 0) {
    lines.push('');
    lines.push('# Workflow steps');
    lines.push('steps:');

    definition.steps.forEach((step: Step, index: number) => {
      const node = nodes[index];
      const nodeLabel = node?.data?.label || '';
      const stepDescription = step.description || nodeLabel;

      // Add comment with step number and description
      if (stepDescription) {
        lines.push(`  # Step ${index + 1}: ${stepDescription}`);
      }

      // Handle different step types
      if ('task' in step) {
        // Task node - show even if task name is empty or undefined
        lines.push(`  - task: ${step.task || 'TODO'}`);
        if (step.id) {
          lines.push(`    id: ${step.id}`);
        }
        if (step.description && step.description !== stepDescription) {
          lines.push(`    description: ${JSON.stringify(step.description)}`);
        }
        if (step.inputs && Object.keys(step.inputs).length > 0) {
          lines.push(`    inputs:`);
          Object.entries(step.inputs).forEach(([key, value]) => {
            lines.push(`      ${key}: ${JSON.stringify(value)}`);
          });
        }
        if (step.outputs && step.outputs.length > 0) {
          lines.push(`    outputs:`);
          step.outputs.forEach((output) => {
            lines.push(`      - ${output}`);
          });
        }
      } else if (step.if) {
        // Handle condition - can be string or object (quantified: any, all, none)
        if (typeof step.if === 'string') {
          lines.push(`  - if: ${step.if}`);
        } else if (typeof step.if === 'object') {
          lines.push(`  - if:`);
          Object.entries(step.if).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              lines.push(`      ${key}:`);
              value.forEach((condition) => {
                lines.push(`        - ${condition}`);
              });
            } else {
              lines.push(`      ${key}: ${JSON.stringify(value)}`);
            }
          });
        }
        if (step.id) {
          lines.push(`    id: ${step.id}`);
        }
        lines.push(`    then:`);
        lines.push(`      # TODO: Add conditional steps`);
        if (step.else) {
          lines.push(`    else:`);
          lines.push(`      # TODO: Add else steps`);
        }
      } else if (step.for_each) {
        lines.push(`  - for_each: ${step.for_each}`);
        if (step.id) {
          lines.push(`    id: ${step.id}`);
        }
        lines.push(`    as: ${step.as || 'item'}`);
        lines.push(`    do:`);
        lines.push(`      # TODO: Add loop steps`);
      } else if (step.parallel) {
        lines.push(`  - parallel:`);
        if (step.id) {
          lines.push(`    id: ${step.id}`);
        }
        lines.push(`      # TODO: Add parallel steps`);
      } else if (step.exit) {
        lines.push(`  - exit: ${typeof step.exit === 'object' ? '' : 'true'}`);
        if (typeof step.exit === 'object') {
          if (step.exit.reason) {
            lines.push(`      reason: ${JSON.stringify(step.exit.reason)}`);
          }
          if (step.exit.outputs) {
            lines.push(`      outputs:`);
            Object.entries(step.exit.outputs).forEach(([key, value]) => {
              lines.push(`        ${key}: ${JSON.stringify(value)}`);
            });
          }
        }
      }

      // Add blank line between steps
      if (index < definition.steps.length - 1) {
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
