"""
FlowLang Scaffolder - Automatically generate task stubs from flow definitions

This tool implements a TDD-style approach: Define your flow first in YAML,
then implement tasks one by one with automatic progress tracking.
"""

import yaml
import os
import re
import shutil
from pathlib import Path
from typing import Dict, List, Set, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime

from .scaffolder_merge import CodeMerger, TestMerger, extract_implementation_status


@dataclass
class TaskInfo:
    """Information about a task extracted from a flow"""
    name: str
    inputs: Set[str] = field(default_factory=set)
    step_ids: List[str] = field(default_factory=list)
    is_implemented: bool = False


class FlowScaffolder:
    """Generates task stubs, tests, and documentation from flow definitions"""

    def __init__(self, output_dir: str = ".", force: bool = False):
        self.output_dir = Path(output_dir)
        self.tasks: Dict[str, TaskInfo] = {}
        self.flow_name = "UnnamedFlow"
        self.force = force  # If True, skip merge and overwrite everything
        self.merge_summary = {
            'tasks_preserved': 0,
            'tasks_added': 0,
            'tasks_updated': 0,
            'tests_preserved': 0,
            'tests_added': 0,
            'tests_updated': 0,
        }

    def analyze_flow(self, flow_yaml: str) -> Dict[str, TaskInfo]:
        """
        Parse flow and extract all required tasks.

        Args:
            flow_yaml: YAML string containing flow definition

        Returns:
            Dictionary mapping task names to TaskInfo objects
        """
        flow_def = yaml.safe_load(flow_yaml)
        self.flow_name = flow_def.get('flow', 'UnnamedFlow')

        print(f"📊 Analyzing flow: {self.flow_name}")
        print("="*60)

        # Extract tasks from steps
        steps = flow_def.get('steps', [])
        self._extract_tasks_from_steps(steps)

        print(f"\n✓ Found {len(self.tasks)} unique tasks")
        for task_name, task_info in sorted(self.tasks.items()):
            print(f"  - {task_name} (used {len(task_info.step_ids)} times)")

        return self.tasks

    def _extract_tasks_from_steps(self, steps: List[Dict], depth: int = 0):
        """Recursively extract tasks from step definitions"""
        for step in steps:
            # Direct task
            if 'task' in step:
                task_name = step['task']
                step_id = step.get('id', task_name)
                inputs = set(step.get('inputs', {}).keys())

                if task_name not in self.tasks:
                    self.tasks[task_name] = TaskInfo(
                        name=task_name,
                        inputs=inputs,
                        step_ids=[step_id]
                    )
                else:
                    # Task used multiple times, track all step IDs
                    self.tasks[task_name].step_ids.append(step_id)
                    # Merge inputs (union of all inputs across uses)
                    self.tasks[task_name].inputs.update(inputs)

            # Parallel steps
            elif 'parallel' in step:
                self._extract_tasks_from_steps(step['parallel'], depth + 1)

            # Conditional steps (both 'condition' and 'if' syntax)
            elif 'condition' in step or 'if' in step:
                condition = step.get('condition', step)
                if 'then' in condition:
                    self._extract_tasks_from_steps(condition['then'], depth + 1)
                if 'else' in condition:
                    self._extract_tasks_from_steps(condition['else'], depth + 1)

            # Loop steps (both 'loop' and 'for_each' syntax)
            elif 'loop' in step or 'for_each' in step:
                loop = step.get('loop', step)
                if 'do' in loop:
                    self._extract_tasks_from_steps(loop['do'], depth + 1)

    def generate_task_stubs(self, filename: str = "tasks.py") -> str:
        """
        Generate Python file with task stubs, preserving implemented tasks.

        Args:
            filename: Name of the output file

        Returns:
            Path to the generated file
        """
        output_path = self.output_dir / filename

        print(f"\n📝 Generating task stubs: {output_path}")

        # Check if file exists and not forcing overwrite
        existing_merger = None
        if output_path.exists() and not self.force:
            print(f"  ℹ️  Existing file found - using smart merge to preserve implementations")

            # Create backup on first merge
            backup_path = output_path.parent / f"{filename}.backup"
            if not backup_path.exists():
                shutil.copy(output_path, backup_path)
                print(f"  💾 Created backup: {backup_path}")

            # Parse existing file
            with open(output_path, 'r') as f:
                existing_code = f.read()
            existing_merger = CodeMerger(existing_code)

        # Generate code (with or without merge)
        code = self._generate_stubs_code_with_merge(existing_merger)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w') as f:
            f.write(code)

        if existing_merger:
            print(f"  ✅ Preserved {self.merge_summary['tasks_preserved']} implemented tasks")
            print(f"  🆕 Added {self.merge_summary['tasks_added']} new task stubs")
            if self.merge_summary['tasks_updated'] > 0:
                print(f"  ⚠️  {self.merge_summary['tasks_updated']} signatures updated - review manually")
        else:
            print(f"✓ Generated {len(self.tasks)} task stubs")

        return str(output_path)

    def _generate_stubs_code(self) -> str:
        """Generate the Python code for task stubs"""
        lines = [
            '"""',
            f'Task implementations for {self.flow_name}',
            f'Auto-generated by FlowLang Scaffolder on {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}',
            '',
            'Status: All tasks are STUBS - implement them one by one!',
            '',
            'To implement a task:',
            '1. Find the task function below',
            '2. Remove the NotImplementedTaskError',
            '3. Add your implementation',
            '4. Update the implementation status in get_implementation_status()',
            '5. Run tests: pytest tests/test_tasks.py',
            '"""',
            '',
            'import asyncio',
            'from typing import Dict, Any',
            'from pathlib import Path',
            'import sys',
            '',
            '# Add src to path for imports',
            'sys.path.insert(0, str(Path(__file__).parent.parent / "src"))',
            '',
            'from flowlang import TaskRegistry',
            'from flowlang.exceptions import NotImplementedTaskError',
            '',
            '',
            'def create_task_registry() -> TaskRegistry:',
            '    """Create and populate the task registry with all tasks"""',
            '    registry = TaskRegistry()',
            '    ',
            '    # ========================================================================',
            '    # TASK IMPLEMENTATIONS',
            f'    # Total: {len(self.tasks)} tasks',
            '    # Status: 0 implemented, {} pending'.format(len(self.tasks)),
            '    # ========================================================================',
            '    ',
        ]

        # Generate stub for each task
        for task_name, task_info in sorted(self.tasks.items()):
            lines.extend(self._generate_task_stub(task_name, task_info))

        lines.extend([
            '',
            '    return registry',
            '',
            '',
            '# ========================================================================',
            '# IMPLEMENTATION TRACKER',
            '# ========================================================================',
            '',
            'def get_implementation_status() -> Dict[str, Any]:',
            '    """',
            '    Get status of task implementations.',
            '    ',
            '    Update this as you implement tasks:',
            '    Change False to True for each completed task.',
            '    """',
            '    tasks = {',
        ])

        for task_name in sorted(self.tasks.keys()):
            lines.append(f"        '{task_name}': False,  # TODO: Set to True when implemented")

        lines.extend([
            '    }',
            '    ',
            '    implemented = sum(1 for v in tasks.values() if v)',
            '    total = len(tasks)',
            '    ',
            '    return {',
            "        'total': total,",
            "        'implemented': implemented,",
            "        'pending': total - implemented,",
            "        'progress': f'{implemented}/{total}',",
            "        'percentage': (implemented / total * 100) if total > 0 else 0,",
            "        'tasks': tasks",
            '    }',
            '',
            '',
            'def print_status():',
            '    """Print implementation status to console"""',
            '    status = get_implementation_status()',
            '    print("="*60)',
            f'    print(f"📊 {self.flow_name} - Task Implementation Status")',
            '    print("="*60)',
            '    print(f"Total Tasks: {status[\'total\']}")',
            '    print(f"Implemented: {status[\'implemented\']} ✅")',
            '    print(f"Pending: {status[\'pending\']} ⚠️")',
            '    print(f"Progress: {status[\'progress\']} ({status[\'percentage\']:.1f}%)")',
            '    print("="*60)',
            '    ',
            '    if status[\'pending\'] > 0:',
            '        print("\\n⚠️  Pending Tasks:")',
            '        for task, implemented in sorted(status[\'tasks\'].items()):',
            '            if not implemented:',
            '                print(f"  [ ] {task}")',
            '    ',
            '    if status[\'implemented\'] > 0:',
            '        print("\\n✅ Implemented Tasks:")',
            '        for task, implemented in sorted(status[\'tasks\'].items()):',
            '            if implemented:',
            '                print(f"  [✓] {task}")',
            '    ',
            '    print()',
            '',
            '',
            'if __name__ == \'__main__\':',
            '    print_status()',
        ])

        return '\n'.join(lines)

    def _generate_stubs_code_with_merge(self, existing_merger: Optional[CodeMerger]) -> str:
        """
        Generate task stubs code with smart merge support.

        Args:
            existing_merger: CodeMerger with existing file, or None for fresh generation

        Returns:
            Generated Python code
        """
        if not existing_merger:
            # No existing file, generate normally
            return self._generate_stubs_code()

        # Extract existing implementation status
        existing_status = extract_implementation_status(existing_merger.source_code)

        # Generate header
        lines = [
            '"""',
            f'Task implementations for {self.flow_name}',
            f'Auto-generated by FlowLang Scaffolder on {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}',
            '',
            'Status: Mix of implemented tasks and stubs',
            '',
            'IMPORTANT: This file was generated with smart merge.',
            'Your implemented tasks have been preserved.',
            '"""',
            '',
            'import asyncio',
            'from typing import Dict, Any',
            'from pathlib import Path',
            'import sys',
            '',
            '# Add src to path for imports',
            'sys.path.insert(0, str(Path(__file__).parent.parent / "src"))',
            '',
            'from flowlang import TaskRegistry',
            'from flowlang.exceptions import NotImplementedTaskError',
            '',
            '',
            'def create_task_registry() -> TaskRegistry:',
            '    """Create and populate the task registry with all tasks"""',
            '    registry = TaskRegistry()',
            '    ',
            '    # ========================================================================',
            '    # TASK IMPLEMENTATIONS',
            f'    # Total: {len(self.tasks)} tasks',
            '    # ========================================================================',
            '    ',
        ]

        # Generate tasks with merge logic
        for task_name, task_info in sorted(self.tasks.items()):
            func_name = self._to_snake_case(task_name)

            # Check if task was implemented in existing file
            if existing_merger.is_function_implemented(func_name):
                # Task is implemented - preserve it exactly
                existing_body = existing_merger.get_function_body(func_name)
                lines.append(existing_body)
                lines.append('    ')
                self.merge_summary['tasks_preserved'] += 1
            else:
                # Task is not implemented or is new - generate stub
                if func_name in existing_merger.functions:
                    # Exists but is a stub - might have signature change
                    old_sig = existing_merger.get_function_signature(func_name)
                    new_sig = ', '.join(sorted(task_info.inputs)) if task_info.inputs else '**kwargs'
                    if old_sig != new_sig:
                        self.merge_summary['tasks_updated'] += 1
                else:
                    # Brand new task
                    self.merge_summary['tasks_added'] += 1

                lines.extend(self._generate_task_stub(task_name, task_info))

        lines.extend([
            '',
            '    return registry',
            '',
            '',
            '# ========================================================================',
            '# IMPLEMENTATION TRACKER',
            '# ========================================================================',
            '',
            'def get_implementation_status() -> Dict[str, Any]:',
            '    """',
            '    Get status of task implementations.',
            '    ',
            '    Update this as you implement tasks:',
            '    Change False to True for each completed task.',
            '    """',
            '    tasks = {',
        ])

        # Generate implementation status, preserving existing True values
        for task_name in sorted(self.tasks.keys()):
            is_implemented = existing_status.get(task_name, False)
            status_str = 'True' if is_implemented else 'False'
            comment = '# Implemented' if is_implemented else '# TODO: Set to True when implemented'
            lines.append(f"        '{task_name}': {status_str},  {comment}")

        lines.extend([
            '    }',
            '    ',
            '    implemented = sum(1 for v in tasks.values() if v)',
            '    total = len(tasks)',
            '    ',
            '    return {',
            "        'total': total,",
            "        'implemented': implemented,",
            "        'pending': total - implemented,",
            "        'progress': f'{implemented}/{total}',",
            "        'percentage': (implemented / total * 100) if total > 0 else 0,",
            "        'tasks': tasks",
            '    }',
            '',
            '',
            'def print_status():',
            '    """Print implementation status to console"""',
            '    status = get_implementation_status()',
            '    print("="*60)',
            f'    print(f"📊 {self.flow_name} - Task Implementation Status")',
            '    print("="*60)',
            '    print(f"Total Tasks: {status[\'total\']}")',
            '    print(f"Implemented: {status[\'implemented\']} ✅")',
            '    print(f"Pending: {status[\'pending\']} ⚠️")',
            '    print(f"Progress: {status[\'progress\']} ({status[\'percentage\']:.1f}%)")',
            '    print("="*60)',
            '    ',
            '    if status[\'pending\'] > 0:',
            '        print("\\n⚠️  Pending Tasks:")',
            '        for task, implemented in sorted(status[\'tasks\'].items()):',
            '            if not implemented:',
            '                print(f"  [ ] {task}")',
            '    ',
            '    if status[\'implemented\'] > 0:',
            '        print("\\n✅ Implemented Tasks:")',
            '        for task, implemented in sorted(status[\'tasks\'].items()):',
            '            if implemented:',
            '                print(f"  [✓] {task}")',
            '    ',
            '    print()',
            '',
            '',
            'if __name__ == \'__main__\':',
            '    print_status()',
        ])

        return '\n'.join(lines)

    def _generate_task_stub(self, task_name: str, task_info: TaskInfo) -> List[str]:
        """Generate stub code for a single task"""
        # Determine if task should be async based on name patterns
        async_patterns = [
            'send', 'fetch', 'get', 'post', 'put', 'delete',
            'process', 'create', 'update', 'call', 'query',
            'read', 'write', 'check', 'validate', 'calculate'
        ]
        is_async = any(word in task_name.lower() for word in async_patterns)

        async_prefix = 'async ' if is_async else ''

        # Generate parameter list
        if task_info.inputs:
            params = ', '.join(sorted(task_info.inputs))
        else:
            params = '**kwargs'

        # Generate docstring with usage info
        usage_info = f"Used in steps: {', '.join(task_info.step_ids[:3])}"
        if len(task_info.step_ids) > 3:
            usage_info += f" (+{len(task_info.step_ids) - 3} more)"

        func_name = self._to_snake_case(task_name)

        lines = [
            f"    @registry.register('{task_name}', description='TODO: Add description')",
            f"    {async_prefix}def {func_name}({params}):",
            f'        """',
            f'        {task_name} - TODO: Add detailed description',
            f'        ',
            f'        {usage_info}',
            f'        ',
        ]

        if task_info.inputs:
            lines.append(f'        Args:')
            for inp in sorted(task_info.inputs):
                lines.append(f'            {inp}: TODO: Describe this parameter')
            lines.append('        ')

        lines.extend([
            f'        Returns:',
            f'            Dict containing task results',
            f'        ',
            f'        Raises:',
            f'            NotImplementedTaskError: This task is not yet implemented',
            f'        """',
            f'        # TODO: Implement this task',
            f'        # ',
            f'        # Example implementation:',
            f'        # result = do_something({params})',
            f'        # return {{"result": result}}',
            f'        ',
            f'        raise NotImplementedTaskError("{task_name}")',
            f'    ',
        ])

        return lines

    def _to_snake_case(self, name: str) -> str:
        """Convert PascalCase/camelCase to snake_case"""
        # Insert underscore before uppercase letters
        s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
        # Insert underscore before uppercase letters preceded by lowercase
        return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()

    def generate_tests(self, filename: str = "test_tasks.py") -> str:
        """
        Generate test file for all tasks, preserving implemented tests.

        Args:
            filename: Name of the output file

        Returns:
            Path to the generated file
        """
        output_path = self.output_dir / filename

        print(f"\n🧪 Generating test stubs: {output_path}")

        # Check if file exists and not forcing overwrite
        existing_test_merger = None
        if output_path.exists() and not self.force:
            print(f"  ℹ️  Existing test file found - using smart merge to preserve implemented tests")

            # Create backup on first merge
            backup_path = output_path.parent / f"{filename}.backup"
            if not backup_path.exists():
                shutil.copy(output_path, backup_path)
                print(f"  💾 Created backup: {backup_path}")

            # Parse existing test file
            with open(output_path, 'r') as f:
                existing_test_code = f.read()
            existing_test_merger = TestMerger(existing_test_code)

        # Generate code (with or without merge)
        code = self._generate_tests_code_with_merge(existing_test_merger)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w') as f:
            f.write(code)

        if existing_test_merger:
            print(f"  ✅ Preserved {self.merge_summary['tests_preserved']} implemented tests")
            print(f"  🆕 Added {self.merge_summary['tests_added']} new test stubs")
            if self.merge_summary['tests_updated'] > 0:
                print(f"  ⚠️  {self.merge_summary['tests_updated']} test signatures updated - review manually")
        else:
            print(f"✓ Generated tests for {len(self.tasks)} tasks")

        return str(output_path)

    def _generate_tests_code(self) -> str:
        """Generate test code"""
        lines = [
            '"""',
            f'Tests for {self.flow_name} tasks',
            f'Auto-generated by FlowLang Scaffolder on {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}',
            '',
            'Initially, all tests expect NotImplementedTaskError.',
            'As you implement tasks, update the tests to verify actual behavior.',
            '"""',
            '',
            'import pytest',
            'import asyncio',
            'import sys',
            'from pathlib import Path',
            '',
            '# Add parent directory to path for flow module import',
            'sys.path.insert(0, str(Path(__file__).parent.parent))',
            '',
            'from flow import create_task_registry',
            'from flowlang.exceptions import NotImplementedTaskError',
            '',
            '',
            '@pytest.fixture',
            'def registry():',
            '    """Fixture providing task registry"""',
            '    return create_task_registry()',
            '',
            '',
            '# ========================================================================',
            '# TASK TESTS',
            '# ========================================================================',
            '',
        ]

        for task_name, task_info in sorted(self.tasks.items()):
            lines.extend(self._generate_task_test(task_name, task_info))

        lines.extend([
            '',
            '# ========================================================================',
            '# INTEGRATION TESTS',
            '# ========================================================================',
            '',
            'def test_all_tasks_registered(registry):',
            '    """Verify all tasks are registered"""',
            '    expected_tasks = [',
        ])

        for task_name in sorted(self.tasks.keys()):
            lines.append(f"        '{task_name}',")

        lines.extend([
            '    ]',
            '    ',
            '    for task in expected_tasks:',
            '        assert registry.has_task(task), f"Task {task} not registered"',
            '',
            '',
            'def test_implementation_progress(registry):',
            '    """Track implementation progress"""',
            '    from flow import get_implementation_status',
            '    ',
            '    status = get_implementation_status()',
            '    print(f"\\nImplementation progress: {status[\'progress\']} ({status[\'percentage\']:.1f}%)")',
            '    ',
            '    # This test always passes but shows progress',
            '    assert status[\'total\'] > 0',
            '',
            '',
            'if __name__ == \'__main__\':',
            '    pytest.main([__file__, \'-v\'])',
        ])

        return '\n'.join(lines)

    def _generate_tests_code_with_merge(self, existing_test_merger: Optional[TestMerger]) -> str:
        """
        Generate test code with smart merge support.

        Args:
            existing_test_merger: TestMerger with existing test file, or None for fresh generation

        Returns:
            Generated test code
        """
        if not existing_test_merger:
            # No existing file, generate normally
            return self._generate_tests_code()

        # Generate header
        lines = [
            '"""',
            f'Tests for {self.flow_name} tasks',
            f'Auto-generated by FlowLang Scaffolder on {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}',
            '',
            'IMPORTANT: This file was generated with smart merge.',
            'Implemented tests have been preserved.',
            '"""',
            '',
            'import pytest',
            'import asyncio',
            'import sys',
            'from pathlib import Path',
            '',
            '# Add parent directory to path for flow module import',
            'sys.path.insert(0, str(Path(__file__).parent.parent))',
            '',
            'from flow import create_task_registry',
            'from flowlang.exceptions import NotImplementedTaskError',
            '',
            '',
            '@pytest.fixture',
            'def registry():',
            '    """Fixture providing task registry"""',
            '    return create_task_registry()',
            '',
            '',
            '# ========================================================================',
            '# TASK TESTS',
            '# ========================================================================',
            '',
        ]

        # Generate tests with merge logic
        for task_name, task_info in sorted(self.tasks.items()):
            func_name = self._to_snake_case(task_name)
            test_name = f'test_{func_name}'

            # Check if test was implemented in existing file
            # TestMerger uses is_function_implemented (inherited from CodeMerger)
            if existing_test_merger.is_function_implemented(test_name):
                # Test is implemented - preserve it exactly
                existing_test_body = existing_test_merger.get_function_body(test_name)
                lines.append(existing_test_body)
                lines.append('')
                self.merge_summary['tests_preserved'] += 1
            else:
                # Test is not implemented or is new - generate stub
                if test_name in existing_test_merger.functions:
                    # Exists but is a stub
                    # Note: Not checking signature changes for tests as they're more complex
                    pass
                else:
                    # Brand new test
                    self.merge_summary['tests_added'] += 1

                lines.extend(self._generate_task_test(task_name, task_info))

        lines.extend([
            '',
            '# ========================================================================',
            '# INTEGRATION TESTS',
            '# ========================================================================',
            '',
            'def test_all_tasks_registered(registry):',
            '    """Verify all tasks are registered"""',
            '    expected_tasks = [',
        ])

        for task_name in sorted(self.tasks.keys()):
            lines.append(f"        '{task_name}',")

        lines.extend([
            '    ]',
            '    ',
            '    for task in expected_tasks:',
            '        assert registry.has_task(task), f"Task {task} not registered"',
            '',
            '',
            'def test_implementation_progress(registry):',
            '    """Track implementation progress"""',
            '    from flow import get_implementation_status',
            '    ',
            '    status = get_implementation_status()',
            '    print(f"\\nImplementation progress: {status[\'progress\']} ({status[\'percentage\']:.1f}%)")',
            '    ',
            '    # This test always passes but shows progress',
            '    assert status[\'total\'] > 0',
            '',
            '',
            'if __name__ == \'__main__\':',
            '    pytest.main([__file__, \'-v\'])',
        ])

        return '\n'.join(lines)

    def _generate_task_test(self, task_name: str, task_info: TaskInfo) -> List[str]:
        """Generate test for a single task"""
        async_patterns = [
            'send', 'fetch', 'get', 'post', 'put', 'delete',
            'process', 'create', 'update', 'call', 'query',
            'read', 'write', 'check', 'validate', 'calculate'
        ]
        is_async = any(word in task_name.lower() for word in async_patterns)

        # Build decorators
        decorators = []
        decorators.append('@pytest.mark.skip(reason="Task not yet implemented")')
        if is_async:
            decorators.append('@pytest.mark.asyncio')

        async_prefix = 'async ' if is_async else ''
        await_prefix = 'await ' if is_async else ''

        func_name = self._to_snake_case(task_name)

        # Generate sample inputs
        sample_inputs = {}
        for inp in sorted(task_info.inputs):
            inp_lower = inp.lower()
            if 'email' in inp_lower:
                sample_inputs[inp] = 'test@example.com'
            elif 'name' in inp_lower:
                sample_inputs[inp] = 'Test Name'
            elif 'id' in inp_lower:
                sample_inputs[inp] = 'test_id_123'
            elif 'amount' in inp_lower or 'price' in inp_lower:
                sample_inputs[inp] = 100.0
            elif 'date' in inp_lower:
                sample_inputs[inp] = '2025-01-01'
            elif 'url' in inp_lower:
                sample_inputs[inp] = 'https://example.com'
            elif 'count' in inp_lower or 'num' in inp_lower:
                sample_inputs[inp] = 10
            else:
                sample_inputs[inp] = 'test_value'

        inputs_str = ', '.join(f'{k}={repr(v)}' for k, v in sample_inputs.items())

        lines = []
        for decorator in decorators:
            lines.append(decorator)
        lines.extend([
            f'{async_prefix}def test_{func_name}(registry):',
            f'    """',
            f'    Test {task_name} task',
            f'    ',
            f'    This test is skipped until the task is implemented.',
            f'    ',
            f'    After implementing the task:',
            f'    1. Remove the @pytest.mark.skip decorator',
            f'    2. Update this test to verify:',
            f'       - Correct output structure',
            f'       - Expected values',
            f'       - Error handling',
            f'    """',
            f'    # Get the task',
            f'    task = registry.get_task(\'{task_name}\')',
            f'    ',
        ])

        # Define test input variables
        if sample_inputs:
            lines.append(f'    # Test inputs')
            for key, value in sample_inputs.items():
                lines.append(f'    {key} = {repr(value)}')
            lines.append(f'    ')

        lines.extend([
            f'    # Currently expecting NotImplementedTaskError',
            f'    with pytest.raises(NotImplementedTaskError):',
        ])

        if is_async:
            lines.append(f'        {await_prefix}task({inputs_str})')
        else:
            lines.append(f'        task({inputs_str})')

        lines.extend([
            f'    ',
            f'    # TODO: After implementing, replace above with actual assertions:',
            f'    # result = {await_prefix}task({inputs_str})',
            f'    # assert isinstance(result, dict)',
            f'    # assert "expected_key" in result',
            f'    # assert result["expected_key"] == expected_value',
            '',
        ])

        return lines

    def generate_readme(self, filename: str = "README.md") -> str:
        """
        Generate README with implementation guide.

        Args:
            filename: Name of the output file

        Returns:
            Path to the generated file
        """
        output_path = self.output_dir / filename

        print(f"\n📖 Generating README: {output_path}")

        content = f"""# {self.flow_name} - Implementation Guide

Auto-generated by FlowLang Scaffolder on {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

## Overview

This project contains a flow definition and scaffolded task implementations. All tasks are currently **stubs** that need to be implemented.

## Project Structure

```
.
├── flow.yaml           # Flow definition (your design)
├── flow.py             # Task implementations (TODO: implement these)
├── api.py              # FastAPI app export
├── README.md           # This file
├── tools/              # Scripts and utilities
│   ├── generate.sh     # Smart scaffold/update
│   └── start_server.sh # Start API server
└── tests/              # Test files
    └── test_tasks.py   # Unit tests for tasks
```

## Implementation Status

- **Total tasks**: {len(self.tasks)}
- **Implemented**: 0
- **Pending**: {len(self.tasks)}
- **Progress**: 0/{len(self.tasks)} (0.0%)

## Quick Start

### 1. Check Current Status

```bash
python flow.py
```

This shows which tasks are pending implementation.

### 2. Implement Tasks One by One

Each task in `flow.py` currently raises `NotImplementedTaskError`. Implement them incrementally:

```python
@registry.register('TaskName')
async def task_name(param1, param2):
    # Remove this line:
    # raise NotImplementedTaskError("TaskName")

    # Add your implementation:
    result = do_something(param1, param2)

    return {{
        'output_key': result
    }}
```

### 3. Update Implementation Status

After implementing a task, update `get_implementation_status()` in `flow.py`:

```python
def get_implementation_status() -> Dict[str, Any]:
    tasks = {{
        'TaskName': True,  # ← Changed from False to True
        ...
    }}
```

### 4. Run Tests

```bash
# Run all tests
pytest tests/test_tasks.py -v

# Run specific test
pytest tests/test_tasks.py::test_task_name -v
```

Update tests to verify actual behavior instead of expecting `NotImplementedTaskError`.

### 5. Run the Complete Flow

Once all tasks are implemented:

```python
import asyncio
from flowlang import FlowExecutor
from flow import create_task_registry

async def main():
    # Load flow
    with open('flow.yaml') as f:
        flow_yaml = f.read()

    # Create executor
    registry = create_task_registry()
    executor = FlowExecutor(registry)

    # Execute flow
    result = await executor.execute_flow(
        flow_yaml,
        inputs={{
            # Your flow inputs here
        }}
    )

    print(f"Success: {{result['success']}}")
    print(f"Outputs: {{result['outputs']}}")

if __name__ == '__main__':
    asyncio.run(main())
```

## Task List

"""

        for i, (task_name, task_info) in enumerate(sorted(self.tasks.items()), 1):
            content += f"\n### {i}. {task_name}\n\n"
            content += f"- **Status**: ⚠️ Not implemented\n"
            content += f"- **Function**: `{self._to_snake_case(task_name)}`\n"
            content += f"- **Used in**: {', '.join(task_info.step_ids[:3])}"
            if len(task_info.step_ids) > 3:
                content += f" (+{len(task_info.step_ids) - 3} more)"
            content += "\n"
            if task_info.inputs:
                content += f"- **Inputs**: `{', '.join(sorted(task_info.inputs))}`\n"
            content += "\n"

        content += """
## Development Tips

1. **Start with simple tasks** - Implement logging, validation tasks first
2. **Use TDD approach** - Write/update tests as you implement
3. **Check progress frequently** - Run `python flow.py` to see status
4. **Test incrementally** - Test each task as you complete it
5. **Mock external dependencies** - Use mock data initially, integrate real APIs later

## Testing Strategy

- **Unit tests**: Test each task in isolation (test_tasks.py)
- **Integration tests**: Test the complete flow execution
- **Use fixtures**: Create reusable test data
- **Mock external calls**: Don't depend on external services in tests

## Next Steps

- [ ] Implement all task stubs
- [ ] Write comprehensive tests
- [ ] Integrate with external APIs/databases
- [ ] Add error handling and retries
- [ ] Add logging and monitoring
- [ ] Deploy to production

## Getting Help

- FlowLang documentation: See CLAUDE.md
- Flow syntax: Check flow.yaml for examples
- Task registry: See src/flowlang/registry.py

Good luck! 🚀
"""

        with open(output_path, 'w') as f:
            f.write(content)

        print(f"✓ Generated README")
        return str(output_path)

    def generate_api(self, filename: str = "api.py") -> str:
        """
        Generate FastAPI app export file.

        Args:
            filename: Name of the output file

        Returns:
            Path to the generated file
        """
        output_path = self.output_dir / filename

        print(f"\n🚀 Generating API file: {output_path}")

        content = f'''"""
{self.flow_name} API - FastAPI app instance

This module creates the FastAPI app that can be run with uvicorn directly:
    uvicorn api:app --host 0.0.0.0 --port 8000 --reload
"""

import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from flowlang.server import FlowServer

# Create the server and get the FastAPI app
server = FlowServer(
    project_dir=".",
    tasks_file="flow.py",
    title="{self.flow_name} API",
    version="1.0.0"
)

# Export the app for uvicorn
app = server.app
'''

        with open(output_path, 'w') as f:
            f.write(content)

        print(f"✓ Generated API file")
        return str(output_path)

    def generate_tools(self) -> str:
        """
        Generate tools/ directory with utility scripts.

        Returns:
            Path to the generated directory
        """
        tools_dir = self.output_dir / "tools"
        tools_dir.mkdir(parents=True, exist_ok=True)

        print(f"\n🔧 Generating tools directory: {tools_dir}")

        # Generate generate.sh script
        generate_sh_content = '''#!/bin/bash
# Smart generator - automatically detects whether to scaffold or update
# Usage: ./generate.sh (run from tools/ directory)

set -e

# Move to project root (parent of tools/)
cd "$(dirname "$0")/.."

FLOW_FILE="flow.yaml"
OUTPUT_DIR="."

# Activate virtual environment if it exists
# Check common locations: ../../myenv (FlowLang root), ../myenv, ./myenv
if [ -d "../../myenv" ]; then
    source ../../myenv/bin/activate
elif [ -d "../myenv" ]; then
    source ../myenv/bin/activate
elif [ -d "myenv" ]; then
    source myenv/bin/activate
fi

# Check if flow.yaml exists
if [ ! -f "$FLOW_FILE" ]; then
    echo "❌ Error: flow.yaml not found in project root"
    exit 1
fi

# Check if this is an existing project by looking for flow.py
if [ -f "flow.py" ]; then
    echo "📦 Existing project detected"
    echo "🔄 Running UPDATE to preserve your implementations..."
    echo ""
    python -m flowlang.scaffolder update "$FLOW_FILE" -o "$OUTPUT_DIR"
    echo ""
    echo "✅ Update complete! Your implementations have been preserved."
else
    echo "🆕 New project detected"
    echo "🏗️  Running SCAFFOLD to create initial structure..."
    echo ""
    python -m flowlang.scaffolder scaffold "$FLOW_FILE" -o "$OUTPUT_DIR"
    echo ""
    echo "✅ Scaffold complete! Start implementing tasks in flow.py"
fi

echo ""
echo "📝 Next steps:"
echo "   - Check flow.py for task stubs to implement"
echo "   - Run: ./tools/start_server.sh"
echo "   - Visit: http://localhost:8000/docs"
'''

        generate_sh_path = tools_dir / "generate.sh"
        with open(generate_sh_path, 'w') as f:
            f.write(generate_sh_content)
        generate_sh_path.chmod(0o755)  # Make executable
        print(f"  ✓ Generated generate.sh (executable)")

        # Generate start_server.sh script
        start_server_sh_content = f'''#!/bin/bash
# Start {self.flow_name} API Server
# Usage: ./start_server.sh [--reload]

cd "$(dirname "$0")/.."  # Move to project root

echo "========================================"
echo "Starting {self.flow_name} API Server..."
echo "========================================"
echo ""

# Check if virtual environment exists
if [ ! -d "../myenv" ]; then
    echo "❌ Virtual environment not found at ../myenv"
    echo "Please create it first with: python -m venv myenv"
    exit 1
fi

# Activate virtual environment
source ../myenv/bin/activate

# Check if dependencies are installed
if ! python -c "import fastapi" 2>/dev/null; then
    echo "❌ FastAPI not installed. Installing dependencies..."
    pip install -r ../requirements.txt
fi

echo "Starting server with uvicorn..."
echo "📖 API Docs: http://localhost:8000/docs"
echo "🔍 Health: http://localhost:8000/health"
echo "Press Ctrl+C to stop"
echo ""

# Check if --reload flag is passed
if [ "$1" = "--reload" ]; then
    echo "🔄 Auto-reload enabled"
    uvicorn api:app --host 0.0.0.0 --port 8000 --reload
else
    uvicorn api:app --host 0.0.0.0 --port 8000
fi
'''

        start_server_sh_path = tools_dir / "start_server.sh"
        with open(start_server_sh_path, 'w') as f:
            f.write(start_server_sh_content)
        start_server_sh_path.chmod(0o755)  # Make executable
        print(f"  ✓ Generated start_server.sh (executable)")

        print(f"✓ Generated tools directory with 2 scripts")
        return str(tools_dir)

    def scaffold(self, flow_yaml: str, output_dir: str = None):
        """
        Initial scaffolding: create new project from flow definition.
        FAILS if flow.py already exists (use update() instead).

        Args:
            flow_yaml: YAML string containing flow definition
            output_dir: Directory to output files (uses self.output_dir if None)

        Raises:
            FileExistsError: If flow.py already exists in output directory
        """
        if output_dir:
            self.output_dir = Path(output_dir)

        # Ensure output directory exists
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Check if flow.py already exists
        flow_py_path = self.output_dir / 'flow.py'
        if flow_py_path.exists() and not self.force:
            print(f"❌ Error: Project already exists at {self.output_dir}")
            print(f"   Found existing file: {flow_py_path}")
            print(f"\n💡 To update an existing project, use:")
            print(f"   python -m flowlang.scaffolder update flow.yaml -o {self.output_dir}")
            print(f"\n⚠️  Or use --force to overwrite (WARNING: destroys all implementations!)")
            raise FileExistsError(f"Project already exists at {flow_py_path}")

        # Save flow definition
        flow_path = self.output_dir / 'flow.yaml'
        with open(flow_path, 'w') as f:
            f.write(flow_yaml)
        print(f"💾 Saved flow definition: {flow_path}")

        # Analyze and generate (force=False ensures fresh generation)
        self.analyze_flow(flow_yaml)
        self.generate_task_stubs(filename="flow.py")

        # Create tests/ subdirectory for tests
        tests_dir = self.output_dir / "tests"
        tests_dir.mkdir(parents=True, exist_ok=True)
        self.generate_tests(filename="tests/test_tasks.py")

        self.generate_readme()
        self.generate_api()
        self.generate_tools()

        print("\n" + "="*60)
        print("🎉 Scaffolding complete!")
        print("="*60)
        print(f"📁 Output directory: {self.output_dir.absolute()}")
        print(f"\n📋 Next steps:")
        print(f"  1. cd {self.output_dir}")
        print(f"  2. python flow.py              # Check implementation status")
        print(f"  3. Edit flow.py                # Implement tasks one by one")
        print(f"  4. pytest tests/test_tasks.py  # Run tests")
        print(f"  5. ./tools/start_server.sh     # Start the API server")
        print(f"\n💡 To update after changing flow.yaml:")
        print(f"  python -m flowlang.scaffolder update flow.yaml -o {self.output_dir}")
        print("="*60)
        print()

    def update(self, flow_yaml: str, output_dir: str = None):
        """
        Update existing project: smart merge with implemented code.
        REQUIRES flow.py to exist (use scaffold() for new projects).

        Args:
            flow_yaml: YAML string containing flow definition
            output_dir: Directory to output files (uses self.output_dir if None)

        Raises:
            FileNotFoundError: If flow.py doesn't exist in output directory
        """
        if output_dir:
            self.output_dir = Path(output_dir)

        # Check if flow.py exists
        flow_py_path = self.output_dir / 'flow.py'
        if not flow_py_path.exists():
            print(f"❌ Error: No existing project found at {self.output_dir}")
            print(f"   Missing file: {flow_py_path}")
            print(f"\n💡 To create a new project, use:")
            print(f"   python -m flowlang.scaffolder scaffold flow.yaml -o {self.output_dir}")
            raise FileNotFoundError(f"No existing project at {flow_py_path}")

        print(f"🔄 Updating existing project at {self.output_dir}")
        print(f"   Smart merge will preserve your implementations\n")

        # Update flow definition
        flow_path = self.output_dir / 'flow.yaml'
        with open(flow_path, 'w') as f:
            f.write(flow_yaml)
        print(f"💾 Updated flow definition: {flow_path}")

        # Analyze and update with smart merge
        self.analyze_flow(flow_yaml)
        self.generate_task_stubs(filename="flow.py")  # Will use merge logic

        # Create tests/ subdirectory if needed
        tests_dir = self.output_dir / "tests"
        tests_dir.mkdir(parents=True, exist_ok=True)
        self.generate_tests(filename="tests/test_tasks.py")  # Will use merge logic

        self.generate_readme()  # Always regenerated
        self.generate_api()     # Always regenerated
        self.generate_tools()   # Always regenerated

        print("\n" + "="*60)
        print("✅ Update complete!")
        print("="*60)

        # Show merge summary
        if self.merge_summary['tasks_preserved'] > 0 or self.merge_summary['tests_preserved'] > 0:
            print(f"\n📊 Smart Merge Summary:")
            print(f"   Tasks:  {self.merge_summary['tasks_preserved']} preserved, "
                  f"{self.merge_summary['tasks_added']} added")
            print(f"   Tests:  {self.merge_summary['tests_preserved']} preserved, "
                  f"{self.merge_summary['tests_added']} added")
            if self.merge_summary['tasks_updated'] > 0:
                print(f"\n⚠️  {self.merge_summary['tasks_updated']} task signatures changed - review manually")

        print(f"\n📋 Next steps:")
        print(f"  1. Review changes: git diff")
        print(f"  2. Check status: python flow.py")
        print(f"  3. Implement new tasks if any were added")
        print(f"  4. Run tests: pytest tests/test_tasks.py")
        print(f"  5. Start server: ./tools/start_server.sh")
        print("="*60)
        print()


# ========================================================================
# CLI INTERFACE
# ========================================================================

def main():
    """CLI for scaffolding and updating flows"""
    import argparse

    parser = argparse.ArgumentParser(
        description='FlowLang Scaffolder - Generate and update task stubs from flow definitions',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Create a new project (scaffold)
  python -m flowlang.scaffolder scaffold my_flow.yaml -o ./my_project

  # Update an existing project (smart merge)
  python -m flowlang.scaffolder update my_flow.yaml -o ./my_project

  # Quick scaffold to current directory
  python -m flowlang.scaffolder scaffold flow.yaml -o .

For more information, see: https://github.com/hello-adam-martin/FlowLang
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Command to execute')

    # Scaffold command (create new project)
    scaffold_parser = subparsers.add_parser(
        'scaffold',
        help='Create a new project from flow definition (fails if project exists)'
    )
    scaffold_parser.add_argument(
        'flow_file',
        help='Path to flow YAML file'
    )
    scaffold_parser.add_argument(
        '-o', '--output',
        default='./flow_project',
        help='Output directory (default: ./flow_project)'
    )
    scaffold_parser.add_argument(
        '--force',
        action='store_true',
        help='Force overwrite existing project (WARNING: destroys implementations!)'
    )

    # Update command (smart merge)
    update_parser = subparsers.add_parser(
        'update',
        help='Update existing project with smart merge (requires project to exist)'
    )
    update_parser.add_argument(
        'flow_file',
        help='Path to flow YAML file'
    )
    update_parser.add_argument(
        '-o', '--output',
        default='.',
        help='Output directory (default: current directory)'
    )

    args = parser.parse_args()

    # Check if subcommand was provided
    if args.command is None:
        parser.print_help()
        print("\n❌ Error: Please specify a command (scaffold or update)")
        return 1

    # Extract arguments from subcommand
    command = args.command
    flow_file = args.flow_file
    output_dir = args.output
    force = getattr(args, 'force', False)

    # Read flow file
    try:
        with open(flow_file, 'r') as f:
            flow_yaml = f.read()
    except FileNotFoundError:
        print(f"❌ Error: Flow file not found: {flow_file}")
        return 1
    except Exception as e:
        print(f"❌ Error reading flow file: {e}")
        return 1

    # Execute command
    try:
        scaffolder = FlowScaffolder(output_dir=output_dir, force=force)

        if command == 'scaffold':
            scaffolder.scaffold(flow_yaml, output_dir)
        elif command == 'update':
            scaffolder.update(flow_yaml, output_dir)
        else:
            print(f"❌ Unknown command: {command}")
            return 1

        return 0
    except (FileExistsError, FileNotFoundError) as e:
        # These are expected errors with helpful messages already printed
        return 1
    except Exception as e:
        print(f"❌ Error during {command}: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    exit(main())
