"""
Hot Reload Module for FlowLang

Provides intelligent file watching and reloading capabilities:
- Watch flow.py and flow.yaml for changes
- Selective reload without server restart
- Error handling with rollback
- State preservation during reload
"""

import os
import sys
import importlib
import asyncio
import logging
from pathlib import Path
from typing import Optional, Callable, Dict, Any
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileModifiedEvent

logger = logging.getLogger(__name__)


class ReloadError(Exception):
    """Exception raised when reload fails"""
    pass


class FileWatcher(FileSystemEventHandler):
    """
    Watches specified files for changes and triggers callbacks.

    Uses watchdog library to monitor file system events and debounces
    rapid successive changes (e.g., multiple saves).
    """

    def __init__(self, debounce_seconds: float = 0.5):
        """
        Initialize file watcher.

        Args:
            debounce_seconds: Time to wait before processing change (avoids duplicate events)
        """
        super().__init__()
        self.debounce_seconds = debounce_seconds
        self.watched_files: Dict[str, Callable] = {}  # file_path -> callback
        self.last_modified: Dict[str, float] = {}  # file_path -> timestamp
        self.observer: Optional[Observer] = None

    def watch_file(self, file_path: str, callback: Callable):
        """
        Register a file to watch with a callback function.

        Args:
            file_path: Absolute path to file to watch
            callback: Function to call when file changes
        """
        abs_path = str(Path(file_path).resolve())
        self.watched_files[abs_path] = callback
        logger.info(f"👁️  Watching: {abs_path}")

    def on_modified(self, event):
        """Handle file modification events"""
        if event.is_directory:
            return

        file_path = str(Path(event.src_path).resolve())

        # Check if this is a file we're watching
        if file_path not in self.watched_files:
            return

        # Debounce: ignore if modified very recently
        now = datetime.now().timestamp()
        last_mod = self.last_modified.get(file_path, 0)

        if now - last_mod < self.debounce_seconds:
            return

        self.last_modified[file_path] = now

        # Trigger callback
        callback = self.watched_files[file_path]
        logger.info(f"📝 File changed: {Path(file_path).name}")

        try:
            callback(file_path)
        except Exception as e:
            logger.error(f"❌ Callback failed for {file_path}: {e}")

    def start(self, directory: str):
        """
        Start watching a directory.

        Args:
            directory: Directory to watch (watches all registered files in this dir)
        """
        if self.observer is not None:
            logger.warning("Observer already running")
            return

        self.observer = Observer()
        self.observer.schedule(self, str(directory), recursive=False)
        self.observer.start()
        logger.info(f"🔍 File watcher started for: {directory}")

    def stop(self):
        """Stop watching files"""
        if self.observer:
            self.observer.stop()
            self.observer.join()
            self.observer = None
            logger.info("🛑 File watcher stopped")


class ReloadManager:
    """
    Manages hot reload operations for FlowLang server.

    Handles:
    - Selective task reloading from flow.py
    - Flow definition reloading from flow.yaml
    - Error handling and rollback
    - State preservation
    """

    def __init__(self, project_dir: str, tasks_file: str = "flow.py"):
        """
        Initialize reload manager.

        Args:
            project_dir: Directory containing flow files
            tasks_file: Name of tasks file (default: flow.py)
        """
        self.project_dir = Path(project_dir).resolve()
        self.tasks_file = tasks_file
        self.tasks_module_name = Path(tasks_file).stem  # "flow.py" -> "flow"

        # Paths
        self.tasks_path = self.project_dir / tasks_file
        self.flow_yaml_path = self.project_dir / "flow.yaml"

        # Backups for rollback
        self.previous_registry = None
        self.previous_flow_yaml = None

        # Stats
        self.reload_count = 0
        self.last_reload_time: Optional[datetime] = None
        self.error_count = 0

        logger.info(f"🔧 ReloadManager initialized")
        logger.info(f"   Project dir: {self.project_dir}")
        logger.info(f"   Tasks file: {self.tasks_file}")

    def reload_tasks(self, registry) -> bool:
        """
        Reload tasks from flow.py without restarting server.

        Args:
            registry: TaskRegistry instance to update

        Returns:
            True if reload succeeded, False otherwise
        """
        logger.info("⚡ Reloading tasks...")
        start_time = datetime.now()

        try:
            # Backup current registry
            self.previous_registry = registry.copy() if hasattr(registry, 'copy') else None

            # Add project directory to Python path if not already there
            project_dir_str = str(self.project_dir)
            if project_dir_str not in sys.path:
                sys.path.insert(0, project_dir_str)

            # Import or reload the tasks module
            if self.tasks_module_name in sys.modules:
                # Module already loaded - reload it
                module = sys.modules[self.tasks_module_name]
                importlib.reload(module)
                logger.info(f"   ♻️  Reloaded module: {self.tasks_module_name}")
            else:
                # First time import
                module = importlib.import_module(self.tasks_module_name)
                logger.info(f"   📦 Imported module: {self.tasks_module_name}")

            # Get the create_task_registry function
            if not hasattr(module, 'create_task_registry'):
                raise ReloadError("Module does not have 'create_task_registry' function")

            # Create new registry
            new_registry = module.create_task_registry()

            # Update the existing registry with new tasks
            # Clear old tasks
            registry.tasks.clear()

            # Copy new tasks
            registry.tasks.update(new_registry.tasks)

            # Update stats
            elapsed_ms = (datetime.now() - start_time).total_seconds() * 1000
            self.reload_count += 1
            self.last_reload_time = datetime.now()

            logger.info(f"✅ Tasks reloaded successfully ({elapsed_ms:.0f}ms)")
            logger.info(f"   Tasks loaded: {len(registry.tasks)}")

            return True

        except Exception as e:
            self.error_count += 1
            logger.error(f"❌ Task reload failed: {e}")
            logger.error(f"   Keeping previous version active")

            # Rollback if we have a backup
            if self.previous_registry is not None:
                registry.tasks.clear()
                registry.tasks.update(self.previous_registry.tasks)
                logger.info("   ↩️  Rolled back to previous version")

            return False

    def reload_flow_yaml(self) -> Optional[str]:
        """
        Reload flow.yaml and return the new YAML content.

        Returns:
            New YAML content if successful, None if failed
        """
        logger.info("⚡ Reloading flow.yaml...")
        start_time = datetime.now()

        try:
            # Backup current YAML
            if self.flow_yaml_path.exists():
                with open(self.flow_yaml_path, 'r') as f:
                    self.previous_flow_yaml = f.read()

            # Read new YAML
            with open(self.flow_yaml_path, 'r') as f:
                new_yaml = f.read()

            # Validate by attempting to parse
            import yaml
            flow_def = yaml.safe_load(new_yaml)

            if not isinstance(flow_def, dict):
                raise ReloadError("Flow YAML must be a dictionary")

            if 'flow' not in flow_def:
                raise ReloadError("Flow YAML must have a 'flow' field")

            elapsed_ms = (datetime.now() - start_time).total_seconds() * 1000
            self.reload_count += 1
            self.last_reload_time = datetime.now()

            logger.info(f"✅ Flow YAML reloaded successfully ({elapsed_ms:.0f}ms)")
            logger.info(f"   Flow name: {flow_def.get('flow')}")

            return new_yaml

        except Exception as e:
            self.error_count += 1
            logger.error(f"❌ Flow YAML reload failed: {e}")
            logger.error(f"   Keeping previous flow definition active")
            return None

    def get_stats(self) -> Dict[str, Any]:
        """Get reload statistics"""
        return {
            'reload_count': self.reload_count,
            'error_count': self.error_count,
            'last_reload_time': self.last_reload_time.isoformat() if self.last_reload_time else None,
            'success_rate': (self.reload_count - self.error_count) / max(self.reload_count, 1) * 100
        }
