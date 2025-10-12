"""
FlowLang Project Management

Supports organizing related flows into project folders with shared configuration.
"""

import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field


@dataclass
class ProjectConfig:
    """Configuration for a FlowLang project containing multiple related flows"""

    name: str
    description: Optional[str] = None
    version: str = "1.0.0"
    shared_connections: Dict[str, Any] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)
    contact: Dict[str, str] = field(default_factory=dict)
    flows: List[str] = field(default_factory=list)
    settings: Dict[str, Any] = field(default_factory=dict)
    project_dir: Optional[Path] = None

    @classmethod
    def from_yaml_file(cls, project_yaml_path: Path) -> 'ProjectConfig':
        """
        Load project configuration from project.yaml file.

        Args:
            project_yaml_path: Path to project.yaml file

        Returns:
            ProjectConfig instance

        Raises:
            FileNotFoundError: If project.yaml doesn't exist
            yaml.YAMLError: If YAML is invalid
            ValueError: If required fields are missing
        """
        if not project_yaml_path.exists():
            raise FileNotFoundError(f"Project file not found: {project_yaml_path}")

        with open(project_yaml_path, 'r') as f:
            data = yaml.safe_load(f)

        if not data:
            raise ValueError(f"Empty project file: {project_yaml_path}")

        # Required field
        if 'project' not in data:
            raise ValueError(f"Missing required 'project' field in {project_yaml_path}")

        # Extract fields
        name = data['project']
        description = data.get('description')
        version = data.get('version', '1.0.0')

        # Settings can contain shared_connections, tags, contact, etc.
        settings = data.get('settings', {})
        shared_connections = settings.get('shared_connections', {})
        tags = settings.get('tags', [])
        contact = settings.get('contact', {})

        # Flows list (optional - can be auto-discovered)
        flows = data.get('flows', [])

        return cls(
            name=name,
            description=description,
            version=version,
            shared_connections=shared_connections,
            tags=tags,
            contact=contact,
            flows=flows,
            settings=settings,
            project_dir=project_yaml_path.parent
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert project config to dictionary"""
        return {
            'name': self.name,
            'description': self.description,
            'version': self.version,
            'settings': {
                'shared_connections': self.shared_connections,
                'tags': self.tags,
                'contact': self.contact,
                **self.settings
            },
            'flows': self.flows
        }

    def save(self, project_yaml_path: Path):
        """
        Save project configuration to project.yaml file.

        Args:
            project_yaml_path: Path where project.yaml should be saved
        """
        with open(project_yaml_path, 'w') as f:
            yaml.dump({
                'project': self.name,
                'description': self.description,
                'version': self.version,
                'settings': {
                    'shared_connections': self.shared_connections,
                    'tags': self.tags,
                    'contact': self.contact,
                },
                'flows': self.flows
            }, f, default_flow_style=False, sort_keys=False)


class ProjectManager:
    """
    Manages FlowLang projects and their flows.

    A project is a directory containing:
    - project.yaml (project metadata)
    - Multiple flow subdirectories (each with flow.yaml + flow.py)
    """

    @staticmethod
    def is_project_dir(directory: Path) -> bool:
        """
        Check if a directory is a FlowLang project.

        Args:
            directory: Directory to check

        Returns:
            True if directory contains project.yaml
        """
        return (directory / "project.yaml").exists()

    @staticmethod
    def is_flow_dir(directory: Path) -> bool:
        """
        Check if a directory is a FlowLang flow.

        Args:
            directory: Directory to check

        Returns:
            True if directory contains flow.yaml and flow.py
        """
        return (directory / "flow.yaml").exists() and (directory / "flow.py").exists()

    @staticmethod
    def discover_projects(root_dir: Path) -> List[ProjectConfig]:
        """
        Discover all projects in a root directory.

        Args:
            root_dir: Root directory to search

        Returns:
            List of ProjectConfig objects
        """
        projects = []

        if not root_dir.exists():
            return projects

        # Scan for project.yaml files
        for item in root_dir.iterdir():
            if not item.is_dir():
                continue

            project_yaml = item / "project.yaml"
            if project_yaml.exists():
                try:
                    project = ProjectConfig.from_yaml_file(project_yaml)
                    projects.append(project)
                except Exception as e:
                    print(f"⚠️  Warning: Could not load project from {item.name}: {e}")

        return projects

    @staticmethod
    def discover_flows_in_project(project_dir: Path) -> List[Path]:
        """
        Discover all flow directories within a project.

        Args:
            project_dir: Project directory

        Returns:
            List of flow directory paths
        """
        flows = []

        if not project_dir.exists():
            return flows

        # Scan for subdirectories containing flow.yaml + flow.py
        for item in project_dir.iterdir():
            if not item.is_dir():
                continue

            # Skip special directories
            if item.name.startswith('.') or item.name in ['__pycache__', 'tests', 'docs']:
                continue

            # Check if it's a flow directory
            if ProjectManager.is_flow_dir(item):
                flows.append(item)

        return flows

    @staticmethod
    def create_project(
        project_dir: Path,
        name: str,
        description: Optional[str] = None,
        flows: Optional[List[str]] = None
    ) -> ProjectConfig:
        """
        Create a new project structure.

        Args:
            project_dir: Directory where project should be created
            name: Project name
            description: Project description
            flows: Optional list of flow names to scaffold

        Returns:
            ProjectConfig instance
        """
        # Create project directory
        project_dir.mkdir(parents=True, exist_ok=True)

        # Create project config
        project = ProjectConfig(
            name=name,
            description=description or f"{name} FlowLang project",
            version="1.0.0",
            flows=flows or [],
            project_dir=project_dir
        )

        # Save project.yaml
        project_yaml_path = project_dir / "project.yaml"
        project.save(project_yaml_path)

        print(f"✅ Created project: {name}")
        print(f"   Location: {project_dir}")
        print(f"   Project file: {project_yaml_path}")

        return project

    @staticmethod
    def get_project_info(project_dir: Path) -> Optional[ProjectConfig]:
        """
        Get project configuration from a directory.

        Args:
            project_dir: Project directory

        Returns:
            ProjectConfig if project.yaml exists, None otherwise
        """
        project_yaml = project_dir / "project.yaml"

        if not project_yaml.exists():
            return None

        try:
            return ProjectConfig.from_yaml_file(project_yaml)
        except Exception as e:
            print(f"⚠️  Warning: Could not load project config: {e}")
            return None


def validate_project_structure(project_dir: Path) -> Dict[str, Any]:
    """
    Validate a project directory structure.

    Args:
        project_dir: Project directory to validate

    Returns:
        Dictionary with validation results
    """
    results = {
        'valid': True,
        'errors': [],
        'warnings': [],
        'info': {}
    }

    # Check if project.yaml exists
    project_yaml = project_dir / "project.yaml"
    if not project_yaml.exists():
        results['valid'] = False
        results['errors'].append("Missing project.yaml file")
        return results

    # Try to load project config
    try:
        project = ProjectConfig.from_yaml_file(project_yaml)
        results['info']['project_name'] = project.name
        results['info']['version'] = project.version
    except Exception as e:
        results['valid'] = False
        results['errors'].append(f"Invalid project.yaml: {e}")
        return results

    # Discover flows
    flows = ProjectManager.discover_flows_in_project(project_dir)
    results['info']['flow_count'] = len(flows)
    results['info']['flows'] = [f.name for f in flows]

    if len(flows) == 0:
        results['warnings'].append("No flows found in project")

    # Validate each flow
    for flow_dir in flows:
        flow_yaml = flow_dir / "flow.yaml"
        flow_py = flow_dir / "flow.py"

        if not flow_yaml.exists():
            results['warnings'].append(f"Flow {flow_dir.name}: Missing flow.yaml")

        if not flow_py.exists():
            results['warnings'].append(f"Flow {flow_dir.name}: Missing flow.py")

    return results
