"""
SubflowLoader - Discovers and loads subflows for composition

Provides flow discovery from:
1. Same directory as parent flow
2. Sibling directories in project
3. Explicit paths
4. Project-level flow registry
"""

import yaml
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from .exceptions import FlowValidationError, FlowExecutionError


class SubflowLoader:
    """
    Loads subflows for execution within parent flows.

    Supports multiple discovery strategies:
    - Local: Flows in the same directory
    - Project: Flows in sibling directories
    - Absolute: Explicit file paths
    """

    def __init__(self, base_path: Optional[Path] = None):
        """
        Initialize subflow loader.

        Args:
            base_path: Base directory for relative subflow discovery.
                      Typically the directory containing the parent flow.
        """
        self.base_path = Path(base_path) if base_path else Path.cwd()
        self._flow_cache: Dict[str, Tuple[str, Dict[str, Any]]] = {}  # name -> (yaml_str, flow_def)
        self._call_stack: List[str] = []  # Track execution stack for circular dependency detection

    def load_subflow(self, subflow_name: str) -> Tuple[str, Dict[str, Any]]:
        """
        Load a subflow by name.

        Discovery order:
        1. Check cache
        2. Look for flow.yaml in subdirectory with matching name
        3. Look for {name}.yaml in base directory
        4. Look for {name}/flow.yaml in parent directories

        Args:
            subflow_name: Name of the subflow to load

        Returns:
            Tuple of (yaml_string, flow_definition_dict)

        Raises:
            FlowExecutionError: If subflow cannot be found
            FlowValidationError: If subflow YAML is invalid
        """
        # Check cache first
        if subflow_name in self._flow_cache:
            return self._flow_cache[subflow_name]

        # Try to find the subflow
        flow_path = self._discover_subflow(subflow_name)

        if not flow_path:
            raise FlowExecutionError(
                f"Subflow '{subflow_name}' not found. "
                f"Searched in: {self.base_path} and subdirectories"
            )

        # Load and parse the subflow
        try:
            with open(flow_path, 'r') as f:
                flow_yaml = f.read()

            flow_def = yaml.safe_load(flow_yaml)

            # Validate it's a proper flow
            if not isinstance(flow_def, dict) or 'flow' not in flow_def:
                raise FlowValidationError(
                    f"Invalid subflow at {flow_path}: must have 'flow' key"
                )

            # Cache the loaded subflow
            self._flow_cache[subflow_name] = (flow_yaml, flow_def)

            return flow_yaml, flow_def

        except yaml.YAMLError as e:
            raise FlowValidationError(
                f"Invalid YAML in subflow '{subflow_name}' at {flow_path}: {e}"
            )
        except FileNotFoundError:
            raise FlowExecutionError(
                f"Subflow file not found: {flow_path}"
            )

    def _discover_subflow(self, subflow_name: str) -> Optional[Path]:
        """
        Discover the path to a subflow by name.

        Search order:
        1. {base_path}/{subflow_name}/flow.yaml
        2. {base_path}/{subflow_name}.yaml
        3. {base_path}/../{subflow_name}/flow.yaml  (sibling directories)
        4. Recursive search in parent directories

        Args:
            subflow_name: Name of the subflow

        Returns:
            Path to the flow.yaml file, or None if not found
        """
        candidates = []

        # Strategy 1: Subdirectory with flow.yaml
        subdir_flow = self.base_path / subflow_name / "flow.yaml"
        candidates.append(subdir_flow)

        # Strategy 2: Direct YAML file
        direct_flow = self.base_path / f"{subflow_name}.yaml"
        candidates.append(direct_flow)

        # Strategy 3: Sibling directory
        if self.base_path.parent != self.base_path:  # Not at filesystem root
            sibling_flow = self.base_path.parent / subflow_name / "flow.yaml"
            candidates.append(sibling_flow)

        # Strategy 4: Search parent directories (up to 3 levels)
        current = self.base_path
        for _ in range(3):
            if current.parent == current:  # Reached filesystem root
                break
            current = current.parent
            parent_flow = current / subflow_name / "flow.yaml"
            candidates.append(parent_flow)

        # Return first existing candidate
        for candidate in candidates:
            if candidate.exists() and candidate.is_file():
                return candidate

        return None

    def enter_subflow(self, subflow_name: str):
        """
        Mark entry into a subflow for circular dependency detection.

        Args:
            subflow_name: Name of the subflow being entered

        Raises:
            FlowExecutionError: If circular dependency detected
        """
        if subflow_name in self._call_stack:
            cycle_path = " -> ".join(self._call_stack + [subflow_name])
            raise FlowExecutionError(
                f"Circular subflow dependency detected: {cycle_path}"
            )

        self._call_stack.append(subflow_name)

    def exit_subflow(self, subflow_name: str):
        """
        Mark exit from a subflow.

        Args:
            subflow_name: Name of the subflow being exited
        """
        if self._call_stack and self._call_stack[-1] == subflow_name:
            self._call_stack.pop()

    def get_call_stack(self) -> List[str]:
        """Get the current subflow call stack."""
        return self._call_stack.copy()

    def clear_cache(self):
        """Clear the subflow cache."""
        self._flow_cache.clear()

    def list_available_subflows(self) -> List[str]:
        """
        List all available subflows in the base path.

        Returns:
            List of subflow names that can be loaded
        """
        subflows = []

        # Find all flow.yaml files in subdirectories
        if self.base_path.exists():
            for subdir in self.base_path.iterdir():
                if subdir.is_dir():
                    flow_file = subdir / "flow.yaml"
                    if flow_file.exists():
                        subflows.append(subdir.name)

            # Find all *.yaml files in base directory
            for yaml_file in self.base_path.glob("*.yaml"):
                if yaml_file.stem != "flow":  # Exclude the parent flow.yaml
                    subflows.append(yaml_file.stem)

        return sorted(subflows)

    def __repr__(self):
        return f"SubflowLoader(base_path={self.base_path}, cached={len(self._flow_cache)}, stack_depth={len(self._call_stack)})"
