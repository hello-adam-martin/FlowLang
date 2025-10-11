"""
FlowLang Watch Mode - Live Testing

Provides interactive watch mode for flow development:
- Monitor flow.yaml and flow.py for changes
- Auto-execute flow with test inputs on changes
- Display results in terminal with color-coded output
- Performance metrics and diff comparison
"""

import os
import sys
import json
import asyncio
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from .executor import FlowExecutor
from .registry import TaskRegistry

# Color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

logger = logging.getLogger(__name__)


class WatchMode:
    """
    Live testing mode for FlowLang development.

    Watches flow files and auto-executes with test inputs on changes.
    """

    def __init__(
        self,
        flow_file: str,
        tasks_file: str = "flow.py",
        test_inputs: Optional[Dict[str, Any]] = None,
        test_inputs_file: Optional[str] = None
    ):
        """
        Initialize watch mode.

        Args:
            flow_file: Path to flow.yaml
            tasks_file: Path to tasks file (default: flow.py)
            test_inputs: Test input dictionary
            test_inputs_file: Path to JSON file with test inputs
        """
        self.flow_file = Path(flow_file).resolve()
        self.tasks_file = Path(tasks_file).resolve() if tasks_file else None
        self.project_dir = self.flow_file.parent

        # Load test inputs
        if test_inputs_file:
            with open(test_inputs_file, 'r') as f:
                self.test_inputs = json.load(f)
        else:
            self.test_inputs = test_inputs or {}

        # Execution state
        self.last_result = None
        self.last_execution_time = None
        self.execution_count = 0
        self.error_count = 0

        # File watcher
        self.observer = None
        self.pending_execution = False
        self.execution_lock = asyncio.Lock()

        logger.info(f"Watch mode initialized")
        logger.info(f"  Flow: {self.flow_file}")
        logger.info(f"  Tasks: {self.tasks_file}")
        logger.info(f"  Test inputs: {len(self.test_inputs)} parameters")

    def print_banner(self):
        """Print welcome banner"""
        print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*70}{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.CYAN}FlowLang Watch Mode - Live Testing{Colors.RESET}")
        print(f"{Colors.CYAN}{'='*70}{Colors.RESET}")
        print(f"\n{Colors.BOLD}Watching:{Colors.RESET}")
        print(f"  📄 {self.flow_file.name}")
        if self.tasks_file:
            print(f"  🐍 {self.tasks_file.name}")
        print(f"\n{Colors.BOLD}Test Inputs:{Colors.RESET}")
        if self.test_inputs:
            for key, value in self.test_inputs.items():
                print(f"  {key} = {json.dumps(value)}")
        else:
            print(f"  {Colors.YELLOW}(none - using empty inputs){Colors.RESET}")
        print(f"\n{Colors.BOLD}Press Ctrl+C to stop{Colors.RESET}\n")

    async def execute_flow(self) -> bool:
        """
        Execute the flow with test inputs.

        Returns:
            True if successful, False if error
        """
        async with self.execution_lock:
            if self.pending_execution:
                return True  # Already executing

            self.pending_execution = True

        try:
            start_time = datetime.now()

            print(f"\n{Colors.BOLD}{Colors.BLUE}{'─'*70}{Colors.RESET}")
            print(f"{Colors.BOLD}[{start_time.strftime('%H:%M:%S')}] Executing flow...{Colors.RESET}")
            print(f"{Colors.BLUE}{'─'*70}{Colors.RESET}\n")

            # Add project directory to Python path
            project_dir_str = str(self.project_dir)
            if project_dir_str not in sys.path:
                sys.path.insert(0, project_dir_str)

            # Import tasks module
            if self.tasks_file:
                tasks_module_name = self.tasks_file.stem

                # Reload if already imported
                if tasks_module_name in sys.modules:
                    import importlib
                    module = sys.modules[tasks_module_name]
                    importlib.reload(module)
                else:
                    __import__(tasks_module_name)
                    module = sys.modules[tasks_module_name]

                # Get task registry
                if hasattr(module, 'create_task_registry'):
                    registry = module.create_task_registry()
                else:
                    print(f"{Colors.RED}❌ No create_task_registry() function found{Colors.RESET}")
                    return False
            else:
                # Empty registry
                registry = TaskRegistry()

            # Load flow YAML
            with open(self.flow_file, 'r') as f:
                flow_yaml = f.read()

            # Execute flow
            executor = FlowExecutor(registry)
            result = await executor.execute_flow(flow_yaml, self.test_inputs)

            # Calculate execution time
            end_time = datetime.now()
            elapsed_ms = (end_time - start_time).total_seconds() * 1000

            # Update stats
            self.execution_count += 1
            self.last_execution_time = elapsed_ms

            # Print results
            print(f"{Colors.GREEN}✅ Flow completed successfully{Colors.RESET}")
            print(f"{Colors.BOLD}Execution time:{Colors.RESET} {elapsed_ms:.0f}ms")

            if result:
                print(f"\n{Colors.BOLD}Outputs:{Colors.RESET}")
                print(json.dumps(result, indent=2))

            # Compare with previous result
            if self.last_result is not None:
                if result == self.last_result:
                    print(f"\n{Colors.CYAN}ℹ️  Output unchanged from previous run{Colors.RESET}")
                else:
                    print(f"\n{Colors.YELLOW}⚠️  Output changed from previous run{Colors.RESET}")

            self.last_result = result

            print(f"\n{Colors.BLUE}{'─'*70}{Colors.RESET}")
            print(f"{Colors.BOLD}Stats:{Colors.RESET} {self.execution_count} runs, {self.error_count} errors")
            print(f"{Colors.BLUE}{'─'*70}{Colors.RESET}\n")

            return True

        except Exception as e:
            self.error_count += 1

            print(f"{Colors.RED}❌ Flow execution failed{Colors.RESET}")
            print(f"{Colors.RED}{type(e).__name__}: {e}{Colors.RESET}\n")

            print(f"{Colors.BLUE}{'─'*70}{Colors.RESET}")
            print(f"{Colors.BOLD}Stats:{Colors.RESET} {self.execution_count} runs, {self.error_count} errors")
            print(f"{Colors.BLUE}{'─'*70}{Colors.RESET}\n")

            return False

        finally:
            async with self.execution_lock:
                self.pending_execution = False

    async def run(self):
        """Start watch mode"""
        self.print_banner()

        # Initial execution
        print(f"{Colors.YELLOW}🚀 Running initial execution...{Colors.RESET}")
        await self.execute_flow()

        # Setup file watching
        class ChangeHandler(FileSystemEventHandler):
            def __init__(self, watch_mode):
                self.watch_mode = watch_mode
                self.last_modified = {}

            def on_modified(self, event):
                if event.is_directory:
                    return

                file_path = Path(event.src_path).resolve()

                # Check if it's a file we care about
                if file_path not in [self.watch_mode.flow_file, self.watch_mode.tasks_file]:
                    return

                # Debounce
                now = datetime.now().timestamp()
                last_mod = self.last_modified.get(str(file_path), 0)
                if now - last_mod < 0.5:
                    return

                self.last_modified[str(file_path)] = now

                # Trigger execution
                print(f"\n{Colors.YELLOW}📝 File changed: {file_path.name}{Colors.RESET}")
                asyncio.create_task(self.watch_mode.execute_flow())

        handler = ChangeHandler(self)
        self.observer = Observer()
        self.observer.schedule(handler, str(self.project_dir), recursive=False)
        self.observer.start()

        print(f"{Colors.GREEN}👁️  Watching for changes...{Colors.RESET}\n")

        try:
            # Keep running
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            print(f"\n\n{Colors.YELLOW}Stopping watch mode...{Colors.RESET}")
            self.observer.stop()
            self.observer.join()
            print(f"{Colors.GREEN}✅ Watch mode stopped{Colors.RESET}\n")


async def watch_command(
    flow_file: str = "flow.yaml",
    tasks_file: str = "flow.py",
    test_inputs: Optional[str] = None
):
    """
    CLI command for watch mode.

    Args:
        flow_file: Path to flow.yaml
        tasks_file: Path to tasks file
        test_inputs: Path to JSON file with test inputs
    """
    # Setup logging
    logging.basicConfig(
        level=logging.WARNING,  # Only show warnings/errors
        format='%(message)s'
    )

    # Create watch mode
    watch = WatchMode(
        flow_file=flow_file,
        tasks_file=tasks_file,
        test_inputs_file=test_inputs
    )

    # Run
    await watch.run()


if __name__ == "__main__":
    import sys

    flow_file = sys.argv[1] if len(sys.argv) > 1 else "flow.yaml"
    tasks_file = sys.argv[2] if len(sys.argv) > 2 else "flow.py"
    test_inputs = sys.argv[3] if len(sys.argv) > 3 else None

    asyncio.run(watch_command(flow_file, tasks_file, test_inputs))
