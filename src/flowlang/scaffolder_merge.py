"""
Smart merge utilities for scaffolder

This module provides AST parsing and merging capabilities to preserve
implemented code when regenerating scaffolded files.
"""

import ast
from typing import Dict, Set, Optional, List, Tuple
from dataclasses import dataclass


@dataclass
class FunctionInfo:
    """Information about a function extracted from AST"""
    name: str
    body: str
    signature: str
    decorators: List[str]
    is_stub: bool  # True if raises NotImplementedTaskError
    lineno: int


class CodeMerger:
    """Handles intelligent merging of scaffolded code files"""

    def __init__(self, source_code: str):
        """
        Initialize merger with existing source code.

        Args:
            source_code: The existing Python file content to analyze
        """
        self.source_code = source_code
        self.source_lines = source_code.split('\n')
        self.tree = ast.parse(source_code)
        self.functions: Dict[str, FunctionInfo] = {}
        self._analyze_functions()

    def _analyze_functions(self):
        """Extract all function definitions from the AST"""
        for node in ast.walk(self.tree):
            if isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
                func_info = self._extract_function_info(node)
                self.functions[func_info.name] = func_info

    def _extract_function_info(self, node) -> FunctionInfo:
        """
        Extract detailed information about a function.

        Args:
            node: AST FunctionDef or AsyncFunctionDef node

        Returns:
            FunctionInfo object with function details
        """
        # Get function name
        name = node.name

        # Extract decorators
        decorators = []
        for decorator in node.decorator_list:
            if isinstance(decorator, ast.Name):
                decorators.append(decorator.id)
            elif isinstance(decorator, ast.Call):
                if isinstance(decorator.func, ast.Attribute):
                    # Handle nested attributes like pytest.mark.asyncio
                    parts = []
                    current = decorator.func
                    while isinstance(current, ast.Attribute):
                        parts.insert(0, current.attr)
                        current = current.value
                    if isinstance(current, ast.Name):
                        parts.insert(0, current.id)
                    decorators.append('.'.join(parts))
                elif isinstance(decorator.func, ast.Name):
                    decorators.append(decorator.func.id)

        # Extract function signature (parameters)
        params = []
        for arg in node.args.args:
            params.append(arg.arg)
        signature = ', '.join(params)

        # Check if this is a stub (raises NotImplementedTaskError)
        is_stub = self._is_stub_function(node)

        # Extract full function body as string, including decorators
        # node.lineno points to the 'def' statement, but decorators come before it
        # So we need to find the first decorator's line number if there are any
        if node.decorator_list:
            # Use the first decorator's line number as the start
            start_line = node.decorator_list[0].lineno - 1  # AST is 1-indexed
        else:
            # No decorators, use the function's line number
            start_line = node.lineno - 1  # AST is 1-indexed

        end_line = node.end_lineno
        body_lines = self.source_lines[start_line:end_line]
        body = '\n'.join(body_lines)

        return FunctionInfo(
            name=name,
            body=body,
            signature=signature,
            decorators=decorators,
            is_stub=is_stub,
            lineno=node.lineno
        )

    def _is_stub_function(self, node) -> bool:
        """
        Check if a function is a stub (raises NotImplementedTaskError).

        Args:
            node: AST FunctionDef node

        Returns:
            True if function raises NotImplementedTaskError
        """
        for stmt in ast.walk(node):
            if isinstance(stmt, ast.Raise):
                if isinstance(stmt.exc, ast.Call):
                    if isinstance(stmt.exc.func, ast.Name):
                        if stmt.exc.func.id == 'NotImplementedTaskError':
                            return True
        return False

    def is_function_implemented(self, func_name: str) -> bool:
        """
        Check if a function is implemented (not a stub).

        Args:
            func_name: Name of the function to check

        Returns:
            True if function exists and is implemented
        """
        if func_name not in self.functions:
            return False
        return not self.functions[func_name].is_stub

    def get_function_body(self, func_name: str) -> Optional[str]:
        """
        Get the complete body of a function.

        Args:
            func_name: Name of the function

        Returns:
            Function body as string, or None if not found
        """
        if func_name not in self.functions:
            return None
        return self.functions[func_name].body

    def get_function_signature(self, func_name: str) -> Optional[str]:
        """
        Get the signature (parameters) of a function.

        Args:
            func_name: Name of the function

        Returns:
            Comma-separated parameter list, or None if not found
        """
        if func_name not in self.functions:
            return None
        return self.functions[func_name].signature

    def get_implemented_functions(self) -> Set[str]:
        """
        Get set of all implemented function names.

        Returns:
            Set of function names that are implemented (not stubs)
        """
        return {
            name for name, info in self.functions.items()
            if not info.is_stub
        }

    def get_stub_functions(self) -> Set[str]:
        """
        Get set of all stub function names.

        Returns:
            Set of function names that are stubs
        """
        return {
            name for name, info in self.functions.items()
            if info.is_stub
        }


class TestMerger(CodeMerger):
    """Specialized merger for test files"""

    def _is_stub_function(self, node) -> bool:
        """
        Check if a test is a stub (uses pytest.raises(NotImplementedTaskError)).

        Args:
            node: AST FunctionDef node

        Returns:
            True if test expects NotImplementedTaskError
        """
        # Look for: with pytest.raises(NotImplementedTaskError):
        for stmt in ast.walk(node):
            if isinstance(stmt, ast.With):
                for item in stmt.items:
                    if isinstance(item.context_expr, ast.Call):
                        if isinstance(item.context_expr.func, ast.Attribute):
                            if (item.context_expr.func.attr == 'raises' and
                                isinstance(item.context_expr.func.value, ast.Name) and
                                item.context_expr.func.value.id == 'pytest'):
                                # Check if it's raising NotImplementedTaskError
                                if item.context_expr.args:
                                    arg = item.context_expr.args[0]
                                    if isinstance(arg, ast.Name) and arg.id == 'NotImplementedTaskError':
                                        return True
        return False


def extract_implementation_status(source_code: str) -> Dict[str, bool]:
    """
    Extract implementation status from get_implementation_status() function.

    Args:
        source_code: Source code containing get_implementation_status()

    Returns:
        Dictionary mapping task names to implementation status
    """
    try:
        tree = ast.parse(source_code)

        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == 'get_implementation_status':
                # Find the tasks dictionary
                for stmt in node.body:
                    if isinstance(stmt, ast.Assign):
                        for target in stmt.targets:
                            if isinstance(target, ast.Name) and target.id == 'tasks':
                                # Extract dictionary
                                if isinstance(stmt.value, ast.Dict):
                                    status = {}
                                    for key, value in zip(stmt.value.keys, stmt.value.values):
                                        if isinstance(key, ast.Constant):
                                            task_name = key.value
                                            if isinstance(value, ast.Constant):
                                                status[task_name] = value.value
                                    return status
    except Exception:
        pass

    return {}
