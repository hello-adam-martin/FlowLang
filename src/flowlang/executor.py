"""
FlowExecutor - The main execution engine for FlowLang
"""
import asyncio
import yaml
from typing import Any, Dict, List, Optional, Union, Callable, Awaitable
import inspect
import time
from datetime import datetime, timezone

from .context import FlowContext
from .registry import TaskRegistry
from .exceptions import (
    FlowValidationError,
    FlowExecutionError,
    MaxRetriesExceededError,
    FlowTerminationException,
)


class FlowExecutor:
    """
    Executes FlowLang flows from YAML definitions.

    Handles:
    - Sequential and parallel execution
    - Conditional branching (if/then/else, switch/case)
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
        self._event_callback: Optional[Callable[[str, Dict[str, Any]], Awaitable[None]]] = None
        self._flow_start_time: float = 0.0
        self._flow_silent: bool = False  # Flow-level silent flag

    async def _emit_event(self, event_type: str, event_data: Dict[str, Any]):
        """Emit an event if callback is configured"""
        if self._event_callback:
            # Add timestamp to all events
            event_data['timestamp'] = datetime.now(timezone.utc).isoformat()
            await self._event_callback(event_type, event_data)

    async def execute_flow(
        self,
        flow_yaml: Union[str, Dict],
        inputs: Optional[Dict[str, Any]] = None,
        event_callback: Optional[Callable[[str, Dict[str, Any]], Awaitable[None]]] = None
    ) -> Dict[str, Any]:
        """
        Execute a flow from YAML definition.

        Args:
            flow_yaml: Either a YAML string or a parsed dictionary
            inputs: Input variables for the flow
            event_callback: Optional async callback for execution events.
                           Called with (event_type: str, event_data: dict)

        Returns:
            Dictionary containing:
            - success: bool
            - outputs: Any outputs from the flow
            - error: Error message if failed
        """
        # Store callback and start time
        self._event_callback = event_callback
        self._flow_start_time = time.time()

        # Parse YAML if needed
        if isinstance(flow_yaml, str):
            flow_def = yaml.safe_load(flow_yaml)
        else:
            flow_def = flow_yaml

        # Validate flow definition
        self._validate_flow(flow_def)

        # Store flow-level silent flag
        self._flow_silent = flow_def.get('silent', False)

        flow_name = flow_def.get('flow', 'UnnamedFlow')

        # Emit flow_started event
        await self._emit_event('flow_started', {
            'flow': flow_name,
            'inputs': inputs or {}
        })

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

            # Emit flow_completed event
            execution_time_ms = (time.time() - self._flow_start_time) * 1000
            await self._emit_event('flow_completed', {
                'flow': flow_name,
                'success': True,
                'outputs': outputs,
                'duration_ms': execution_time_ms
            })

            return {
                'success': True,
                'outputs': outputs,
            }

        except FlowTerminationException as e:
            # Flow terminated intentionally via exit step
            # This is NOT an error - it's a controlled termination
            execution_time_ms = (time.time() - self._flow_start_time) * 1000

            # The flow_terminated event was already emitted in _execute_exit_step()
            # Now emit flow_completed with termination info
            await self._emit_event('flow_completed', {
                'flow': flow_name,
                'success': True,
                'terminated': True,
                'termination_reason': e.reason,
                'outputs': e.outputs,
                'duration_ms': execution_time_ms
            })

            return {
                'success': True,
                'terminated': True,
                'reason': e.reason,
                'outputs': e.outputs,
            }

        except Exception as e:
            # Emit flow_failed event
            execution_time_ms = (time.time() - self._flow_start_time) * 1000
            await self._emit_event('flow_failed', {
                'flow': flow_name,
                'success': False,
                'error': str(e),
                'error_type': type(e).__name__,
                'duration_ms': execution_time_ms
            })

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
        elif 'switch' in step:
            await self._execute_switch_step(step, context)
        elif 'for_each' in step:
            await self._execute_loop_step(step, context)
        elif 'subflow' in step:
            await self._execute_subflow_step(step, context)
        elif 'exit' in step:
            await self._execute_exit_step(step, context)
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

        # Check if events should be emitted for this step
        # Task-level silent overrides flow-level silent
        # If 'silent' is explicitly set at task level, use that value
        # Otherwise, use flow-level silent setting
        if 'silent' in step:
            silent = step['silent']
        else:
            silent = self._flow_silent

        # Emit step_started event (unless silent)
        step_start_time = time.time()
        if not silent:
            await self._emit_event('step_started', {
                'step_id': step_id,
                'task': task_name,
                'inputs': task_inputs
            })

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

                # Emit step_completed event (unless silent)
                if not silent:
                    step_duration_ms = (time.time() - step_start_time) * 1000
                    await self._emit_event('step_completed', {
                        'step_id': step_id,
                        'task': task_name,
                        'outputs': result,
                        'duration_ms': step_duration_ms
                    })

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
                    # Emit step_failed event (unless silent)
                    if not silent:
                        step_duration_ms = (time.time() - step_start_time) * 1000
                        await self._emit_event('step_failed', {
                            'step_id': step_id,
                            'task': task_name,
                            'error': str(e),
                            'error_type': type(e).__name__,
                            'duration_ms': step_duration_ms
                        })

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

    async def _execute_switch_step(
        self,
        step: Dict,
        context: FlowContext
    ):
        """
        Execute multi-way switch/case branching.

        Supports:
        - switch: ${expression}
          cases:
            - when: value
              do: [steps]
            - when: [value1, value2]  # Multiple values
              do: [steps]
            - default:
                [steps]
        """
        switch_expr = step['switch']

        # Resolve the switch expression
        switch_value = context.resolve_value(switch_expr)

        # Get cases
        cases = step.get('cases', [])

        # Track if any case matched
        matched = False

        for case in cases:
            # Handle default case
            if 'default' in case:
                # Execute default steps if no previous case matched
                if not matched:
                    await self._execute_steps(case['default'], context)
                return

            # Get the when condition(s)
            when_value = case.get('when')

            if when_value is None:
                continue

            # Resolve the when value
            when_resolved = context.resolve_value(when_value)

            # Support both single value and list of values
            if isinstance(when_resolved, list):
                # Multiple values - match any
                case_matches = switch_value in when_resolved
            else:
                # Single value - direct comparison
                case_matches = switch_value == when_resolved

            # If case matches, execute its steps and stop
            if case_matches:
                do_steps = case.get('do', [])
                await self._execute_steps(do_steps, context)
                matched = True
                break

        # If no case matched and no default was provided, that's ok - do nothing

    def _evaluate_condition(
        self,
        condition: Union[str, Dict],
        context: FlowContext
    ) -> bool:
        """
        Evaluate a condition expression.

        Supports:
        - Simple comparisons: "${var} == value"
        - Quantified conditions (dict):
          - any: [conditions]  # True if any condition is true
          - all: [conditions]  # True if all conditions are true
          - none: [conditions] # True if no conditions are true
        """
        # If condition is a dict, it's a quantified condition
        if isinstance(condition, dict):
            return self._evaluate_quantified_condition(condition, context)

        # Otherwise, it's a string comparison (existing logic)
        # Parse comparison operators before resolving
        operators = ['==', '!=', '>=', '<=', '>', '<']
        for op in operators:
            if op in condition:
                parts = condition.split(op, 1)  # Split only on first occurrence
                if len(parts) == 2:
                    left_expr = parts[0].strip()
                    right_expr = parts[1].strip()

                    # Resolve both sides
                    left = context.resolve_value(left_expr)
                    right = context.resolve_value(right_expr)

                    # Convert string "true"/"false" to boolean
                    if isinstance(right, str):
                        if right.lower() == 'true':
                            right = True
                        elif right.lower() == 'false':
                            right = False

                    # Try to convert to numbers if possible (for numeric comparisons)
                    if not isinstance(left, bool) and not isinstance(right, bool):
                        try:
                            left = float(left)
                            right = float(right)
                        except (ValueError, TypeError):
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

        # If no operator found, resolve the whole condition
        resolved = context.resolve_value(condition)

        # If it's a simple variable reference that resolved to a boolean
        if isinstance(resolved, bool):
            return resolved

        # If we can't parse it, treat it as truthy
        return bool(resolved)

    def _evaluate_quantified_condition(
        self,
        condition: Dict,
        context: FlowContext
    ) -> bool:
        """
        Evaluate quantified conditions (any/all/none).

        Args:
            condition: Dict with 'any', 'all', or 'none' key containing list of conditions
            context: FlowContext for variable resolution

        Returns:
            Boolean result of quantified evaluation

        Examples:
            {'any': ["${x} > 5", "${y} == true"]}  # True if any is true
            {'all': ["${x} > 5", "${y} == true"]}  # True if all are true
            {'none': ["${x} > 5", "${y} == true"]} # True if none are true
        """
        # Check for 'any' quantifier
        if 'any' in condition:
            sub_conditions = condition['any']
            if not isinstance(sub_conditions, list):
                raise FlowValidationError("'any' must contain a list of conditions")

            # Return True if ANY sub-condition is true
            for sub_cond in sub_conditions:
                if self._evaluate_condition(sub_cond, context):
                    return True
            return False

        # Check for 'all' quantifier
        elif 'all' in condition:
            sub_conditions = condition['all']
            if not isinstance(sub_conditions, list):
                raise FlowValidationError("'all' must contain a list of conditions")

            # Return True if ALL sub-conditions are true
            for sub_cond in sub_conditions:
                if not self._evaluate_condition(sub_cond, context):
                    return False
            return True

        # Check for 'none' quantifier
        elif 'none' in condition:
            sub_conditions = condition['none']
            if not isinstance(sub_conditions, list):
                raise FlowValidationError("'none' must contain a list of conditions")

            # Return True if NONE of the sub-conditions are true
            for sub_cond in sub_conditions:
                if self._evaluate_condition(sub_cond, context):
                    return False
            return True

        else:
            raise FlowValidationError(
                f"Quantified condition must have 'any', 'all', or 'none' key. Got: {list(condition.keys())}"
            )

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

    async def _execute_exit_step(
        self,
        step: Dict,
        context: FlowContext
    ):
        """
        Execute an exit step to terminate flow execution.

        Syntax:
            - exit                              # Simple exit
            - exit:                             # Exit with reason
                reason: "Application rejected"
            - exit:                             # Exit with outputs
                outputs:
                  status: "rejected"
                  reason: "Ineligible"
        """
        # Extract reason and outputs
        exit_config = step.get('exit', {})

        # Handle both simple form (exit: true) and detailed form (exit: {...})
        if isinstance(exit_config, dict):
            reason = exit_config.get('reason')
            outputs = exit_config.get('outputs', {})

            # Resolve output values
            if outputs:
                outputs = context.resolve_value(outputs)
        else:
            reason = None
            outputs = {}

        # Emit termination event
        await self._emit_event('flow_terminated', {
            'reason': reason or "Exit step executed",
            'outputs': outputs
        })

        # Raise FlowTerminationException to stop execution
        raise FlowTerminationException(reason=reason, outputs=outputs)

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
