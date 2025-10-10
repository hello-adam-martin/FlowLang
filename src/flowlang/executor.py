"""
FlowExecutor - The main execution engine for FlowLang
"""
import asyncio
import yaml
from typing import Any, Dict, List, Optional, Union
import inspect
import time

from .context import FlowContext
from .registry import TaskRegistry
from .exceptions import (
    FlowValidationError,
    FlowExecutionError,
    MaxRetriesExceededError,
)


class FlowExecutor:
    """
    Executes FlowLang flows from YAML definitions.

    Handles:
    - Sequential and parallel execution
    - Conditional branching (if/then/else)
    - Loops (for_each)
    - Error handling and retries
    - Variable resolution
    - Subflow execution
    """

    def __init__(self, registry: TaskRegistry):
        """
        Initialize the flow executor.

        Args:
            registry: TaskRegistry containing task implementations
        """
        self.registry = registry

    async def execute_flow(
        self,
        flow_yaml: Union[str, Dict],
        inputs: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute a flow from YAML definition.

        Args:
            flow_yaml: Either a YAML string or a parsed dictionary
            inputs: Input variables for the flow

        Returns:
            Dictionary containing:
            - success: bool
            - outputs: Any outputs from the flow
            - error: Error message if failed
        """
        # Parse YAML if needed
        if isinstance(flow_yaml, str):
            flow_def = yaml.safe_load(flow_yaml)
        else:
            flow_def = flow_yaml

        # Validate flow definition
        self._validate_flow(flow_def)

        # Create execution context
        context = FlowContext(inputs)

        try:
            # Validate inputs
            if 'inputs' in flow_def:
                self._validate_inputs(flow_def['inputs'], inputs or {})

            # Execute steps
            steps = flow_def.get('steps', [])
            await self._execute_steps(steps, context)

            # Collect outputs
            outputs = {}
            if 'outputs' in flow_def:
                for output_def in flow_def['outputs']:
                    if isinstance(output_def, dict):
                        name = output_def['name']
                        source = output_def.get('value', f"${{{name}}}")
                    else:
                        name = output_def
                        source = f"${{{name}}}"

                    outputs[name] = context.resolve_value(source)

            return {
                'success': True,
                'outputs': outputs,
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'error_type': type(e).__name__,
            }

    def _validate_flow(self, flow_def: Dict):
        """Validate flow definition structure"""
        if 'flow' not in flow_def:
            raise FlowValidationError("Flow definition must have a 'flow' name")

        if 'steps' not in flow_def:
            raise FlowValidationError("Flow definition must have 'steps'")

        if not isinstance(flow_def['steps'], list):
            raise FlowValidationError("'steps' must be a list")

    def _validate_inputs(self, input_defs: List[Dict], inputs: Dict):
        """Validate that required inputs are provided"""
        for input_def in input_defs:
            name = input_def['name']
            required = input_def.get('required', True)

            if required and name not in inputs:
                raise FlowValidationError(
                    f"Required input '{name}' not provided"
                )

    async def _execute_steps(
        self,
        steps: List[Dict],
        context: FlowContext
    ):
        """Execute a list of steps sequentially"""
        for step in steps:
            await self._execute_step(step, context)

    async def _execute_step(
        self,
        step: Dict,
        context: FlowContext
    ):
        """Execute a single step"""
        # Handle different step types
        if 'task' in step:
            await self._execute_task_step(step, context)
        elif 'parallel' in step:
            await self._execute_parallel_step(step, context)
        elif 'if' in step:
            await self._execute_conditional_step(step, context)
        elif 'for_each' in step:
            await self._execute_loop_step(step, context)
        elif 'subflow' in step:
            await self._execute_subflow_step(step, context)
        else:
            raise FlowValidationError(
                f"Unknown step type: {list(step.keys())}"
            )

    async def _execute_task_step(
        self,
        step: Dict,
        context: FlowContext
    ):
        """Execute a task step with error handling and retries"""
        task_name = step['task']
        step_id = step.get('id', task_name)

        # Check dependencies
        depends_on = step.get('depends_on', [])
        if isinstance(depends_on, str):
            depends_on = [depends_on]

        for dep in depends_on:
            if dep not in context.outputs:
                raise FlowExecutionError(
                    f"Step '{step_id}' depends on '{dep}' which hasn't executed"
                )

        # Resolve inputs
        task_inputs = {}
        if 'inputs' in step:
            task_inputs = context.resolve_value(step['inputs'])

        # Get retry configuration
        retry_config = step.get('retry', {})
        max_attempts = retry_config.get('max_attempts', 1)
        backoff = retry_config.get('backoff', 1)

        # Execute with retries
        last_error = None
        for attempt in range(max_attempts):
            try:
                # Get and execute the task
                task_func = self.registry.get_task(task_name)

                if inspect.iscoroutinefunction(task_func):
                    result = await task_func(**task_inputs)
                else:
                    result = task_func(**task_inputs)

                # Store output
                if step.get('id'):
                    context.set_step_output(step_id, result)

                # Success - break retry loop
                return

            except Exception as e:
                last_error = e

                # Check if we should retry
                if attempt < max_attempts - 1:
                    # Exponential backoff
                    wait_time = backoff * (2 ** attempt)
                    await asyncio.sleep(wait_time)
                else:
                    # Handle error or raise
                    if 'on_error' in step:
                        await self._execute_error_handler(
                            step['on_error'],
                            context,
                            e
                        )
                        return
                    else:
                        raise MaxRetriesExceededError(task_name, max_attempts)

    async def _execute_parallel_step(
        self,
        step: Dict,
        context: FlowContext
    ):
        """Execute multiple steps in parallel"""
        parallel_steps = step['parallel']

        # Create tasks for all parallel steps
        tasks = [
            self._execute_step(parallel_step, context)
            for parallel_step in parallel_steps
        ]

        # Execute all in parallel
        await asyncio.gather(*tasks)

    async def _execute_conditional_step(
        self,
        step: Dict,
        context: FlowContext
    ):
        """Execute conditional if/then/else logic"""
        condition = step['if']

        # Resolve condition
        condition_result = self._evaluate_condition(condition, context)

        if condition_result:
            # Execute 'then' steps
            if 'then' in step:
                await self._execute_steps(step['then'], context)
        else:
            # Execute 'else' steps if present
            if 'else' in step:
                await self._execute_steps(step['else'], context)

    def _evaluate_condition(
        self,
        condition: str,
        context: FlowContext
    ) -> bool:
        """
        Evaluate a condition expression.

        Supports:
        - ${var} == value
        - ${var} != value
        - ${var} > value
        - ${var} < value
        - ${var} >= value
        - ${var} <= value
        """
        # Resolve variables in condition
        resolved = context.resolve_value(condition)

        # If it's a simple variable reference that resolved to a boolean
        if isinstance(resolved, bool):
            return resolved

        # Parse comparison operators
        operators = ['==', '!=', '>=', '<=', '>', '<']
        for op in operators:
            if op in str(resolved):
                parts = str(resolved).split(op)
                if len(parts) == 2:
                    left = parts[0].strip()
                    right = parts[1].strip()

                    # Try to convert to numbers if possible
                    try:
                        left = float(left)
                        right = float(right)
                    except ValueError:
                        pass

                    # Evaluate comparison
                    if op == '==':
                        return left == right
                    elif op == '!=':
                        return left != right
                    elif op == '>':
                        return left > right
                    elif op == '<':
                        return left < right
                    elif op == '>=':
                        return left >= right
                    elif op == '<=':
                        return left <= right

        # If we can't parse it, treat it as truthy
        return bool(resolved)

    async def _execute_loop_step(
        self,
        step: Dict,
        context: FlowContext
    ):
        """Execute a for_each loop"""
        items_ref = step['for_each']
        items = context.resolve_value(items_ref)

        if not isinstance(items, list):
            raise FlowExecutionError(
                f"for_each requires a list, got {type(items)}"
            )

        # Execute steps for each item
        loop_steps = step.get('do', [])
        item_var = step.get('as', 'item')

        for item in items:
            # Create a new context with the loop variable
            # Store the item in a way it can be referenced
            original_inputs = context.inputs.copy()
            context.inputs[item_var] = item

            try:
                await self._execute_steps(loop_steps, context)
            finally:
                # Restore original inputs
                context.inputs = original_inputs

    async def _execute_subflow_step(
        self,
        step: Dict,
        context: FlowContext
    ):
        """Execute a subflow"""
        subflow_name = step['subflow']

        # Resolve inputs for the subflow
        subflow_inputs = {}
        if 'inputs' in step:
            subflow_inputs = context.resolve_value(step['inputs'])

        # Load the subflow definition (would need to be passed in or loaded)
        # For now, raise an error
        raise NotImplementedError(
            "Subflow execution requires a flow loader to be implemented"
        )

    async def _execute_error_handler(
        self,
        error_handler: Dict,
        context: FlowContext,
        error: Exception
    ):
        """Execute error handler steps"""
        # Store error information in context
        context.metadata['last_error'] = {
            'type': type(error).__name__,
            'message': str(error),
        }

        # Execute error handler steps
        if isinstance(error_handler, list):
            await self._execute_steps(error_handler, context)
        elif isinstance(error_handler, dict) and 'steps' in error_handler:
            await self._execute_steps(error_handler['steps'], context)
