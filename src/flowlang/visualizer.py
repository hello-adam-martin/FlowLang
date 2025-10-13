"""
FlowVisualizer - Generate visual diagrams from FlowLang definitions
"""
import yaml
from typing import Dict, List, Any, Optional, Set
from pathlib import Path


class FlowVisualizer:
    """
    Generate Mermaid diagrams from FlowLang flow definitions.

    Supports:
    - Sequential steps
    - Parallel execution
    - Conditional branching (if/then/else)
    - Loops (for_each)
    - Task steps with conditions
    """

    def __init__(self, flow_def: Dict[str, Any]):
        """
        Initialize visualizer with a flow definition.

        Args:
            flow_def: Parsed flow definition dictionary
        """
        self.flow_def = flow_def
        self.node_counter = 0
        self.nodes = []
        self.edges = []
        self.node_ids = {}  # Map step IDs to node IDs

    def generate_mermaid(self) -> str:
        """
        Generate a Mermaid flowchart diagram.

        Returns:
            Mermaid diagram as a string
        """
        # Reset state
        self.node_counter = 0
        self.nodes = []
        self.edges = []
        self.node_ids = {}

        # Add start node
        start_id = self._add_node("Start", shape="circle")

        # Process inputs
        input_id = None
        if self.flow_def.get('inputs'):
            input_labels = [inp['name'] for inp in self.flow_def['inputs']]
            input_text = "Inputs:<br/>" + "<br/>".join(input_labels)
            input_id = self._add_node(input_text, shape="parallelogram")
            self._add_edge(start_id, input_id)
        else:
            input_id = start_id

        # Process steps
        steps = self.flow_def.get('steps', [])
        last_node = self._process_steps(steps, input_id)

        # Process outputs
        if self.flow_def.get('outputs'):
            output_labels = [out['name'] if isinstance(out, dict) else out
                           for out in self.flow_def['outputs']]
            output_text = "Outputs:<br/>" + "<br/>".join(output_labels)
            output_id = self._add_node(output_text, shape="parallelogram")
            if isinstance(last_node, list):
                for node in last_node:
                    self._add_edge(node, output_id)
            else:
                self._add_edge(last_node, output_id)
            last_node = output_id

        # Add end node
        end_id = self._add_node("End", shape="circle")
        if isinstance(last_node, list):
            for node in last_node:
                self._add_edge(node, end_id)
        else:
            self._add_edge(last_node, end_id)

        # Build Mermaid diagram
        flow_name = self.flow_def.get('flow', 'Flow')
        lines = [
            "```mermaid",
            f"flowchart TD",
        ]

        # Add nodes
        for node in self.nodes:
            lines.append(f"    {node}")

        # Add edges
        for edge in self.edges:
            lines.append(f"    {edge}")

        lines.append("```")

        return "\n".join(lines)

    def _add_node(self, label: str, shape: str = "rect", style: Optional[str] = None) -> str:
        """
        Add a node to the diagram.

        Args:
            label: Node label text
            shape: Node shape (rect, circle, diamond, parallelogram, etc.)
            style: Optional CSS style class

        Returns:
            Node ID
        """
        node_id = f"node{self.node_counter}"
        self.node_counter += 1

        # Escape special characters in label for Mermaid
        # For diamond shapes, we need to keep the label shorter and clearer
        label_display = label.replace('\n', '<br/>')

        # Format node based on shape
        if shape == "circle":
            label_escaped = label_display.replace('"', '&quot;')
            node_def = f'{node_id}(("{label_escaped}"))'
        elif shape == "diamond":
            # For diamonds, escape quotes differently to work with Mermaid syntax
            label_escaped = label_display.replace('"', "'")
            node_def = f'{node_id}{{{{"{label_escaped}"}}}}'
        elif shape == "parallelogram":
            label_escaped = label_display.replace('"', '&quot;')
            node_def = f'{node_id}[/"{label_escaped}"/]'
        elif shape == "rect":
            label_escaped = label_display.replace('"', '&quot;')
            node_def = f'{node_id}["{label_escaped}"]'
        else:
            label_escaped = label_display.replace('"', '&quot;')
            node_def = f'{node_id}["{label_escaped}"]'

        self.nodes.append(node_def)
        return node_id

    def _add_edge(self, from_id: str, to_id: str, label: Optional[str] = None):
        """
        Add an edge between two nodes.

        Args:
            from_id: Source node ID
            to_id: Target node ID
            label: Optional edge label
        """
        if label:
            label = label.replace('"', '&quot;')
            edge = f'{from_id} -->|"{label}"| {to_id}'
        else:
            edge = f'{from_id} --> {to_id}'

        self.edges.append(edge)

    def _process_steps(self, steps: List[Dict], prev_node: str) -> str:
        """
        Process a list of steps and connect them to the diagram.

        Args:
            steps: List of step definitions
            prev_node: Previous node ID to connect from

        Returns:
            Last node ID (or list of node IDs for parallel/branching)
        """
        current_node = prev_node

        for step in steps:
            current_node = self._process_step(step, current_node)

        return current_node

    def _process_step(self, step: Dict, prev_node: str) -> str:
        """
        Process a single step.

        Args:
            step: Step definition
            prev_node: Previous node ID

        Returns:
            Node ID of this step (or list for parallel/branching)
        """
        # Handle different step types
        if 'task' in step:
            return self._process_task_step(step, prev_node)
        elif 'parallel' in step:
            return self._process_parallel_step(step, prev_node)
        elif 'if' in step:
            return self._process_conditional_step(step, prev_node)
        elif 'for_each' in step:
            return self._process_loop_step(step, prev_node)
        else:
            # Unknown step type, add as generic
            node_id = self._add_node(f"Unknown: {list(step.keys())[0]}")
            self._add_edge(prev_node, node_id)
            return node_id

    def _process_task_step(self, step: Dict, prev_node: str) -> str:
        """Process a task step."""
        task_name = step['task']
        step_id = step.get('id', task_name)

        # Build label
        label = task_name
        if step.get('if'):
            # Add condition indicator
            label = f"{task_name}<br/>[if condition]"

        # Add node
        node_id = self._add_node(label, shape="rect")
        self.node_ids[step_id] = node_id

        # Connect edge
        if step.get('if'):
            condition = self._format_condition(step['if'])
            self._add_edge(prev_node, node_id, label=condition)
        else:
            self._add_edge(prev_node, node_id)

        return node_id

    def _process_parallel_step(self, step: Dict, prev_node: str) -> str:
        """Process parallel execution step."""
        parallel_steps = step['parallel']

        # Add fork node
        fork_id = self._add_node("Fork: Run in Parallel", shape="diamond")
        self._add_edge(prev_node, fork_id)

        # Process each parallel branch
        branch_ends = []
        for i, parallel_step in enumerate(parallel_steps):
            branch_end = self._process_step(parallel_step, fork_id)
            branch_ends.append(branch_end)

        # Add join node
        join_id = self._add_node("Join: Wait for All", shape="diamond")
        for branch_end in branch_ends:
            self._add_edge(branch_end, join_id)

        return join_id

    def _process_conditional_step(self, step: Dict, prev_node: str) -> str:
        """Process conditional if/then/else step."""
        condition = step['if']

        # Add decision node with "If:" prefix and question format
        decision_label = f"If: {self._format_condition_as_question(condition)}"
        decision_id = self._add_node(decision_label, shape="diamond")
        self._add_edge(prev_node, decision_id)

        # Process 'then' branch
        then_steps = step.get('then', [])
        then_end = decision_id
        if then_steps:
            then_end = self._process_steps(then_steps, decision_id)
            # Label the edge
            self.edges[-len(then_steps)] = self.edges[-len(then_steps)].replace(
                f"{decision_id} -->",
                f'{decision_id} -->|"true"|'
            )

        # Process 'else' branch
        else_steps = step.get('else', [])
        else_end = decision_id
        if else_steps:
            else_end = self._process_steps(else_steps, decision_id)
            # Label the edge
            if else_steps:
                for i, edge in enumerate(self.edges):
                    if edge.startswith(f"{decision_id} -->") and "true" not in edge:
                        self.edges[i] = edge.replace(
                            f"{decision_id} -->",
                            f'{decision_id} -->|"false"|'
                        )
                        break

        # Add merge node
        merge_id = self._add_node("End If", shape="diamond")

        # Connect both branches to merge
        if isinstance(then_end, list):
            for node in then_end:
                self._add_edge(node, merge_id)
        else:
            self._add_edge(then_end, merge_id)

        if isinstance(else_end, list):
            for node in else_end:
                self._add_edge(node, merge_id)
        elif else_end != decision_id:
            self._add_edge(else_end, merge_id)
        else:
            # No else branch, connect decision directly to merge
            self._add_edge(decision_id, merge_id, label="false")

        return merge_id

    def _process_loop_step(self, step: Dict, prev_node: str) -> str:
        """Process for_each loop step."""
        items_ref = step['for_each']
        item_var = step.get('as', 'item')
        loop_steps = step.get('do', [])

        # Add loop start node
        loop_label = f"Loop: for each {item_var}"
        loop_start_id = self._add_node(loop_label, shape="diamond")
        self._add_edge(prev_node, loop_start_id)

        # Process loop body
        if loop_steps:
            loop_body_end = self._process_steps(loop_steps, loop_start_id)

            # Add back edge to loop start
            self._add_edge(loop_body_end, loop_start_id, label="next")

        # Add loop exit
        loop_end_id = self._add_node("End Loop", shape="diamond")
        self._add_edge(loop_start_id, loop_end_id, label="done")

        return loop_end_id

    def _format_condition(self, condition: str) -> str:
        """
        Format a condition string for display.

        Args:
            condition: Condition expression (string or dict for quantified conditions)

        Returns:
            Formatted condition string
        """
        import re

        # Handle quantified conditions (dict with 'any', 'all', 'none')
        if isinstance(condition, dict):
            # Extract the quantifier and conditions
            if 'any' in condition:
                quantifier = "any"
                conditions = condition['any']
            elif 'all' in condition:
                quantifier = "all"
                conditions = condition['all']
            elif 'none' in condition:
                quantifier = "none"
                conditions = condition['none']
            else:
                return str(condition)[:40]

            # Count conditions
            count = len(conditions) if isinstance(conditions, list) else 1

            # For visualization, just show the quantifier and count
            return f"{quantifier} of {count} conditions"

        # Handle simple string conditions
        condition = str(condition)

        # Replace ${...} with just the variable name for readability
        condition = re.sub(r'\$\{([^}]+)\}', r'\1', condition)

        # Truncate if too long
        if len(condition) > 40:
            condition = condition[:37] + "..."

        return condition

    def _format_condition_as_question(self, condition: str) -> str:
        """
        Format a condition as a natural language question.

        Args:
            condition: Condition expression (string or dict for quantified)

        Returns:
            Question-formatted condition string
        """
        import re

        # Handle quantified conditions - they already come formatted from _format_condition
        if isinstance(condition, dict):
            formatted = self._format_condition(condition)
            # Convert to question: "any of 3 conditions" -> "any of 3 met?"
            if formatted.endswith('conditions'):
                return formatted.replace('conditions', 'met?')
            return formatted + '?'

        # First apply standard formatting
        condition = self._format_condition(condition)

        # Convert common patterns to questions
        # Pattern: something == true
        condition = re.sub(r'(.+?)\s*==\s*[Tt]rue', r'\1?', condition)

        # Pattern: something == false (make it "not something?")
        condition = re.sub(r'(.+?)\s*==\s*[Ff]alse', r'not \1?', condition)

        # Pattern: something != true (make it "not something?")
        condition = re.sub(r'(.+?)\s*!=\s*[Tt]rue', r'not \1?', condition)

        # Pattern: something != false
        condition = re.sub(r'(.+?)\s*!=\s*[Ff]alse', r'\1?', condition)

        # If no patterns matched, just add ? at the end if not already there
        if not condition.endswith('?'):
            condition += '?'

        return condition


def visualize_flow(flow_path: str, output_path: Optional[str] = None) -> str:
    """
    Generate a Mermaid diagram from a flow YAML file.

    Args:
        flow_path: Path to flow.yaml file
        output_path: Optional path to save diagram (otherwise returns string)

    Returns:
        Mermaid diagram string
    """
    # Load flow definition
    with open(flow_path, 'r') as f:
        flow_def = yaml.safe_load(f)

    # Generate diagram
    visualizer = FlowVisualizer(flow_def)
    diagram = visualizer.generate_mermaid()

    # Save to file if requested
    if output_path:
        with open(output_path, 'w') as f:
            f.write(diagram)

    return diagram


# CLI support
if __name__ == '__main__':
    import argparse
    import sys

    parser = argparse.ArgumentParser(
        description='Generate visual diagrams from FlowLang flow definitions'
    )
    parser.add_argument(
        'flow_file',
        help='Path to flow.yaml file'
    )
    parser.add_argument(
        '-o', '--output',
        help='Output file path (prints to stdout if not specified)'
    )
    parser.add_argument(
        '--format',
        choices=['mermaid'],
        default='mermaid',
        help='Output format (currently only mermaid supported)'
    )

    args = parser.parse_args()

    # Check file exists
    if not Path(args.flow_file).exists():
        print(f"Error: File not found: {args.flow_file}", file=sys.stderr)
        sys.exit(1)

    # Generate diagram
    try:
        diagram = visualize_flow(args.flow_file, args.output)

        if args.output:
            print(f"Diagram saved to: {args.output}")
        else:
            print(diagram)

    except Exception as e:
        print(f"Error generating diagram: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
