"""
FlowLang Flow Validator

Validates flow definitions for:
- Reachable variable references
- Valid conditional structures
- Task existence
- Output accessibility
"""

from typing import Dict, List, Set, Any, Optional, Tuple
from dataclasses import dataclass
import yaml


@dataclass
class ValidationError:
    """Represents a validation error"""
    severity: str  # 'error' or 'warning'
    message: str
    location: str  # e.g., "step:3", "output:user_profile"
    context: Optional[str] = None


@dataclass
class ValidationResult:
    """Result of flow validation"""
    valid: bool
    errors: List[ValidationError]
    warnings: List[ValidationError]

    def __str__(self):
        lines = []
        if self.errors:
            lines.append(f"\n❌ {len(self.errors)} Error(s):")
            for err in self.errors:
                lines.append(f"  [{err.location}] {err.message}")
                if err.context:
                    lines.append(f"    Context: {err.context}")

        if self.warnings:
            lines.append(f"\n⚠️  {len(self.warnings)} Warning(s):")
            for warn in self.warnings:
                lines.append(f"  [{warn.location}] {warn.message}")
                if warn.context:
                    lines.append(f"    Context: {warn.context}")

        if self.valid:
            lines.append("\n✅ Flow validation passed!")
        else:
            lines.append("\n❌ Flow validation failed!")

        return '\n'.join(lines)


class FlowValidator:
    """Validates FlowLang flow definitions"""

    def __init__(self, registry=None):
        """
        Initialize validator.

        Args:
            registry: Optional TaskRegistry to validate task existence
        """
        self.registry = registry
        self.errors: List[ValidationError] = []
        self.warnings: List[ValidationError] = []

    def validate(self, flow_yaml: str) -> ValidationResult:
        """
        Validate a flow definition.

        Args:
            flow_yaml: YAML string or dict

        Returns:
            ValidationResult with errors and warnings
        """
        self.errors = []
        self.warnings = []

        # Parse YAML
        if isinstance(flow_yaml, str):
            try:
                flow_def = yaml.safe_load(flow_yaml)
            except yaml.YAMLError as e:
                self.errors.append(ValidationError(
                    severity='error',
                    message=f"Invalid YAML: {str(e)}",
                    location='parse'
                ))
                return ValidationResult(False, self.errors, self.warnings)
        else:
            flow_def = flow_yaml

        # Basic structure validation
        self._validate_structure(flow_def)

        # Validate steps and track available variables
        if 'steps' in flow_def:
            available_vars = self._get_input_vars(flow_def.get('inputs', []))
            self._validate_steps(flow_def['steps'], available_vars, 'steps')

        # Validate outputs
        if 'outputs' in flow_def and 'steps' in flow_def:
            # Get variables guaranteed to exist (unconditional)
            guaranteed_vars = self._get_input_vars(flow_def.get('inputs', []))
            guaranteed_vars.update(self._collect_guaranteed_outputs(flow_def['steps']))

            # Get variables that might exist (conditional)
            all_possible_vars = self._get_input_vars(flow_def.get('inputs', []))
            all_possible_vars.update(self._collect_all_step_outputs(flow_def['steps']))

            self._validate_outputs(flow_def['outputs'], guaranteed_vars, all_possible_vars)

        valid = len(self.errors) == 0
        return ValidationResult(valid, self.errors, self.warnings)

    def _validate_structure(self, flow_def: Dict):
        """Validate basic flow structure"""
        if 'flow' not in flow_def:
            self.errors.append(ValidationError(
                severity='error',
                message="Flow must have a 'flow' name",
                location='root'
            ))

        if 'steps' not in flow_def:
            self.errors.append(ValidationError(
                severity='error',
                message="Flow must have 'steps'",
                location='root'
            ))
        elif not isinstance(flow_def['steps'], list):
            self.errors.append(ValidationError(
                severity='error',
                message="'steps' must be a list",
                location='steps'
            ))

    def _get_input_vars(self, inputs: List[Dict]) -> Set[str]:
        """Get set of input variable names"""
        vars = set()
        for inp in inputs:
            if isinstance(inp, dict) and 'name' in inp:
                vars.add(f"inputs.{inp['name']}")
        return vars

    def _validate_steps(self, steps: List[Dict], available_vars: Set[str], location: str) -> Set[str]:
        """
        Validate steps and return variables they produce.

        Args:
            steps: List of step definitions
            available_vars: Variables available at this point
            location: Current location string for error reporting

        Returns:
            Set of variable names produced by these steps
        """
        produced_vars = set()

        for i, step in enumerate(steps):
            step_location = f"{location}[{i}]"

            if 'task' in step:
                # Validate task step
                task_name = step['task']
                step_id = step.get('id', task_name)

                # Check if task exists in registry
                if self.registry and not self.registry.has_task(task_name):
                    self.errors.append(ValidationError(
                        severity='error',
                        message=f"Task '{task_name}' not found in registry",
                        location=step_location
                    ))

                # Validate inputs are available
                if 'inputs' in step:
                    self._validate_variable_refs(
                        step['inputs'],
                        available_vars,
                        f"{step_location}.inputs"
                    )

                # Track outputs
                if 'id' in step:
                    # Add step output to available vars
                    produced_vars.add(step_id)
                    available_vars.add(step_id)

                    # If outputs are specified, add those too
                    if 'outputs' in step:
                        for output in step['outputs']:
                            produced_vars.add(f"{step_id}.{output}")
                            available_vars.add(f"{step_id}.{output}")

            elif 'if' in step:
                # Validate conditional step
                self._validate_conditional(step, available_vars, step_location)
                # Note: We don't add conditional outputs to available_vars for subsequent steps
                # because they may not always execute
                # However, we collect them for the all_possible_vars set

            elif 'switch' in step:
                # Validate switch/case step
                self._validate_switch(step, available_vars, step_location)
                # Note: Same as conditionals - outputs are not guaranteed

            elif 'parallel' in step:
                # Validate parallel steps
                parallel_vars = self._validate_steps(
                    step['parallel'],
                    available_vars.copy(),
                    f"{step_location}.parallel"
                )
                produced_vars.update(parallel_vars)
                available_vars.update(parallel_vars)

            elif 'for_each' in step:
                # Validate loop step
                items_ref = step['for_each']
                self._validate_variable_refs(
                    items_ref,
                    available_vars,
                    f"{step_location}.for_each"
                )

                # Validate loop body
                if 'do' in step:
                    loop_vars = available_vars.copy()
                    item_var = step.get('as', 'item')
                    loop_vars.add(f"inputs.{item_var}")
                    self._validate_steps(step['do'], loop_vars, f"{step_location}.do")

            elif 'subflow' in step:
                # Validate subflow step
                if 'inputs' in step:
                    self._validate_variable_refs(
                        step['inputs'],
                        available_vars,
                        f"{step_location}.inputs"
                    )

        return produced_vars

    def _validate_conditional(self, step: Dict, available_vars: Set[str], location: str):
        """Validate conditional step"""
        # Validate condition expression
        condition = step['if']
        self._validate_variable_refs(condition, available_vars, f"{location}.if")

        # Validate 'then' branch
        if 'then' in step:
            then_vars = self._validate_steps(
                step['then'],
                available_vars.copy(),
                f"{location}.then"
            )
            # Don't add then_vars to available_vars as they're conditional

        # Validate 'else' branch
        if 'else' in step:
            else_vars = self._validate_steps(
                step['else'],
                available_vars.copy(),
                f"{location}.else"
            )
            # Don't add else_vars to available_vars as they're conditional

    def _validate_switch(self, step: Dict, available_vars: Set[str], location: str):
        """Validate switch/case step"""
        # Validate switch expression
        switch_expr = step['switch']
        self._validate_variable_refs(switch_expr, available_vars, f"{location}.switch")

        # Validate cases
        cases = step.get('cases', [])
        if not cases:
            self.warnings.append(ValidationError(
                severity='warning',
                message="Switch statement has no cases",
                location=location
            ))
            return

        for i, case in enumerate(cases):
            case_location = f"{location}.cases[{i}]"

            # Handle default case
            if 'default' in case:
                # Validate default steps
                default_steps = case['default']
                if isinstance(default_steps, list):
                    self._validate_steps(
                        default_steps,
                        available_vars.copy(),
                        f"{case_location}.default"
                    )
                continue

            # Validate 'when' value
            if 'when' in case:
                when_value = case['when']
                # 'when' can be a value or list of values
                # We don't validate the values themselves (they could be literals)
                # but we validate variable references if present
                self._validate_variable_refs(when_value, available_vars, f"{case_location}.when")
            else:
                self.errors.append(ValidationError(
                    severity='error',
                    message="Case must have 'when' or 'default'",
                    location=case_location
                ))
                continue

            # Validate 'do' steps
            if 'do' in case:
                do_steps = case['do']
                if isinstance(do_steps, list):
                    self._validate_steps(
                        do_steps,
                        available_vars.copy(),
                        f"{case_location}.do"
                    )
            else:
                self.warnings.append(ValidationError(
                    severity='warning',
                    message="Case has no 'do' steps",
                    location=case_location
                ))

    def _collect_guaranteed_outputs(self, steps: List[Dict]) -> Set[str]:
        """Collect only guaranteed (unconditional) step outputs"""
        guaranteed = set()

        for step in steps:
            # Only add if it's a direct task (not in conditional)
            if 'id' in step and 'task' in step:
                step_id = step['id']
                guaranteed.add(step_id)
                if 'outputs' in step:
                    for output in step['outputs']:
                        guaranteed.add(f"{step_id}.{output}")

            # Parallel steps are guaranteed if all tasks in them complete
            if 'parallel' in step:
                guaranteed.update(self._collect_guaranteed_outputs(step['parallel']))

            # Skip conditional branches - those are NOT guaranteed
            # Skip loops - those are NOT guaranteed (might be empty)

        return guaranteed

    def _collect_all_step_outputs(self, steps: List[Dict]) -> Set[str]:
        """Collect all possible step outputs from all paths"""
        all_vars = set()

        for step in steps:
            if 'id' in step:
                step_id = step['id']
                all_vars.add(step_id)
                if 'outputs' in step:
                    for output in step['outputs']:
                        all_vars.add(f"{step_id}.{output}")

            if 'then' in step:
                all_vars.update(self._collect_all_step_outputs(step['then']))

            if 'else' in step:
                all_vars.update(self._collect_all_step_outputs(step['else']))

            if 'parallel' in step:
                all_vars.update(self._collect_all_step_outputs(step['parallel']))

            if 'do' in step:
                all_vars.update(self._collect_all_step_outputs(step['do']))

            # Collect outputs from switch cases
            if 'cases' in step:
                for case in step['cases']:
                    # Collect from 'do' steps in each case
                    if 'do' in case and isinstance(case['do'], list):
                        all_vars.update(self._collect_all_step_outputs(case['do']))

                    # Collect from 'default' case
                    if 'default' in case and isinstance(case['default'], list):
                        all_vars.update(self._collect_all_step_outputs(case['default']))

        return all_vars

    def _validate_outputs(self, outputs: List, guaranteed_vars: Set[str], all_possible_vars: Set[str]):
        """Validate flow outputs"""
        for i, output_def in enumerate(outputs):
            if isinstance(output_def, dict):
                name = output_def.get('name')
                value = output_def.get('value')

                if not name:
                    self.errors.append(ValidationError(
                        severity='error',
                        message="Output must have a 'name'",
                        location=f"outputs[{i}]"
                    ))
                    continue

                if value:
                    # Check if the value references variables from specific paths
                    self._validate_output_reference(value, guaranteed_vars, all_possible_vars, f"outputs.{name}")

    def _validate_output_reference(self, value: Any, guaranteed_vars: Set[str], all_possible_vars: Set[str], location: str):
        """Validate that an output reference is accessible"""
        if isinstance(value, str) and '${' in value:
            # Extract variable references
            import re
            refs = re.findall(r'\$\{([^}]+)\}', value)

            for ref in refs:
                # Check if this variable exists
                base_ref = ref.split('.')[0]

                # First check if it's guaranteed (unconditional)
                guaranteed = False
                for var in guaranteed_vars:
                    if var == ref or var.startswith(f"{base_ref}.") or var == base_ref:
                        guaranteed = True
                        break

                if guaranteed:
                    # Variable is guaranteed - all good
                    continue

                # Check if it exists in ANY path (conditional)
                found_conditional = False
                for var in all_possible_vars:
                    if var == ref or var.startswith(f"{base_ref}.") or var == base_ref:
                        found_conditional = True
                        break

                if found_conditional:
                    # Variable exists but only in some paths - WARNING
                    self.warnings.append(ValidationError(
                        severity='warning',
                        message=f"Variable '${{{ref}}}' may not exist in all execution paths",
                        location=location,
                        context="This variable is only available in some conditional branches. "
                               "Consider making the output conditional or using a default value."
                    ))
                else:
                    # Variable not found in any path - ERROR
                    self.errors.append(ValidationError(
                        severity='error',
                        message=f"Variable '${{{ref}}}' is not defined anywhere in this flow",
                        location=location,
                        context=f"Available variables: {', '.join(sorted(all_possible_vars))}"
                    ))

    def _validate_variable_refs(self, value: Any, available_vars: Set[str], location: str):
        """Validate variable references in a value"""
        if isinstance(value, str):
            # Check for variable references
            import re
            refs = re.findall(r'\$\{([^}]+)\}', value)

            for ref in refs:
                # Check if variable is available
                base_ref = ref.split('.')[0]

                # Check exact match or prefix match
                found = False
                for var in available_vars:
                    if var == ref or var.startswith(f"{base_ref}.") or var == base_ref:
                        found = True
                        break

                if not found:
                    self.errors.append(ValidationError(
                        severity='error',
                        message=f"Variable '${{{ref}}}' is not available at this point",
                        location=location,
                        context=f"Available variables: {', '.join(sorted(available_vars))}"
                    ))

        elif isinstance(value, dict):
            for k, v in value.items():
                self._validate_variable_refs(v, available_vars, f"{location}.{k}")

        elif isinstance(value, list):
            for i, item in enumerate(value):
                self._validate_variable_refs(item, available_vars, f"{location}[{i}]")


def validate_flow(flow_yaml: str, registry=None) -> ValidationResult:
    """
    Convenience function to validate a flow.

    Args:
        flow_yaml: YAML string or dict
        registry: Optional TaskRegistry

    Returns:
        ValidationResult
    """
    validator = FlowValidator(registry)
    return validator.validate(flow_yaml)
