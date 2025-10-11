"""
FlowContext - Tracks execution state and resolves variables
"""
import re
from typing import Any, Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .cancellation import CancellationToken


class FlowContext:
    """
    Manages the execution context for a flow, including inputs,
    step outputs, and variable resolution.
    """

    def __init__(
        self,
        inputs: Optional[Dict[str, Any]] = None,
        cancellation_token: Optional["CancellationToken"] = None
    ):
        """
        Initialize flow context with inputs.

        Args:
            inputs: Dictionary of input variables for the flow
            cancellation_token: Optional token for cancellation support
        """
        self.inputs = inputs or {}
        self.outputs = {}  # Maps step_id -> output data
        self.metadata = {}  # Additional context metadata
        self.cancellation_token = cancellation_token  # Cancellation token

    def set_step_output(self, step_id: str, output: Any):
        """Store the output from a step"""
        self.outputs[step_id] = output

    def get_step_output(self, step_id: str) -> Any:
        """Retrieve the output from a step"""
        return self.outputs.get(step_id)

    def resolve_value(self, value: Any) -> Any:
        """
        Recursively resolve variables in values.

        Supports:
        - ${inputs.var_name}
        - ${step_id.output}
        - ${step_id.output.nested.field}

        Args:
            value: The value to resolve (can be string, dict, list, or primitive)

        Returns:
            The resolved value with all variables replaced
        """
        if isinstance(value, str):
            return self._resolve_string(value)
        elif isinstance(value, dict):
            return {k: self.resolve_value(v) for k, v in value.items()}
        elif isinstance(value, list):
            return [self.resolve_value(item) for item in value]
        else:
            return value

    def _resolve_string(self, text: str) -> Any:
        """
        Resolve variable references in a string.

        Examples:
            "${inputs.user_name}" -> value from inputs
            "${step1.output}" -> output from step1
            "${step1.output.name}" -> nested field access
            "Hello ${inputs.name}!" -> string interpolation
        """
        # Pattern to match ${...}
        pattern = r'\$\{([^}]+)\}'

        # Find all variable references
        matches = list(re.finditer(pattern, text))

        if not matches:
            return text

        # If the entire string is a single variable reference, return the actual value
        if len(matches) == 1 and matches[0].group(0) == text:
            var_path = matches[0].group(1)
            return self._resolve_variable_path(var_path)

        # Otherwise, do string interpolation
        result = text
        for match in reversed(matches):  # Reverse to maintain positions
            var_path = match.group(1)
            value = self._resolve_variable_path(var_path)
            # Convert to string for interpolation
            result = result[:match.start()] + str(value) + result[match.end():]

        return result

    def _resolve_variable_path(self, var_path: str) -> Any:
        """
        Resolve a variable path like 'inputs.name' or 'step1.output.data'

        Args:
            var_path: Dot-separated path to the variable

        Returns:
            The resolved value

        Raises:
            KeyError: If the path cannot be resolved
        """
        parts = var_path.split('.')

        # Get the root object
        if parts[0] == 'inputs':
            current = self.inputs
            parts = parts[1:]  # Remove 'inputs' from path
        elif parts[0] in self.outputs:
            # This is a step output reference
            current = self.outputs[parts[0]]
            parts = parts[1:]  # Remove step_id from path
        else:
            raise KeyError(f"Unknown variable root: {parts[0]}")

        # Navigate the path
        for part in parts:
            if isinstance(current, dict):
                current = current[part]
            elif hasattr(current, part):
                current = getattr(current, part)
            else:
                raise KeyError(f"Cannot resolve path: {var_path}")

        return current

    def check_cancellation(self):
        """
        Check if cancellation has been requested and raise exception if so.

        Raises:
            CancellationError: If cancellation has been requested
        """
        if self.cancellation_token:
            self.cancellation_token.check_cancelled()

    def is_cancelled(self) -> bool:
        """Check if cancellation has been requested."""
        if self.cancellation_token:
            return self.cancellation_token.is_cancelled()
        return False

    def add_cleanup_handler(self, handler):
        """
        Add a cleanup handler to be called on cancellation.

        Args:
            handler: Async or sync callable to execute on cleanup
        """
        if self.cancellation_token:
            self.cancellation_token.add_cleanup_handler(handler)

    def __repr__(self):
        return f"FlowContext(inputs={self.inputs}, outputs={list(self.outputs.keys())})"
