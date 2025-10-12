"""
FlowLang Project CLI Commands

Commands for managing projects (collections of related flows).
"""

import sys
import argparse
from pathlib import Path
from typing import Optional

from .project import ProjectManager, ProjectConfig, validate_project_structure


def cmd_project(args):
    """Handle project commands"""
    if not hasattr(args, 'project_command'):
        print("Error: No project subcommand specified")
        print("\nAvailable commands:")
        print("  flowlang project init      - Create a new project")
        print("  flowlang project list      - List projects in directory")
        print("  flowlang project info      - Show project information")
        print("  flowlang project validate  - Validate project structure")
        print("  flowlang project serve     - Start server for specific project")
        return 1

    if args.project_command == 'init':
        return cmd_project_init(args)
    elif args.project_command == 'list':
        return cmd_project_list(args)
    elif args.project_command == 'info':
        return cmd_project_info(args)
    elif args.project_command == 'validate':
        return cmd_project_validate(args)
    elif args.project_command == 'serve':
        return cmd_project_serve(args)
    else:
        print(f"Unknown project command: {args.project_command}")
        return 1


def cmd_project_init(args):
    """Initialize a new project"""
    # Smart directory detection: if given a simple name without slashes,
    # try to find flows/ directory in repository
    directory_arg = args.directory

    if '/' not in directory_arg and directory_arg != '.':
        # User provided just a name like "order-system"
        # Try to find flows/ directory automatically
        cwd = Path.cwd()

        # Check if we're already in flows/ directory
        if cwd.name == 'flows':
            project_dir = (cwd / directory_arg).resolve()
            print(f"📁 Detected flows/ directory: {cwd}")
            print(f"   Creating project: {project_dir}")
        # Check if flows/ exists in current directory
        elif (cwd / 'flows').exists():
            project_dir = (cwd / 'flows' / directory_arg).resolve()
            print(f"📁 Found flows/ directory: {cwd / 'flows'}")
            print(f"   Creating project: {project_dir}")
        # Check if we're inside a FlowLang repository (look for src/flowlang)
        elif (cwd / 'src' / 'flowlang').exists() or \
             (cwd.parent / 'src' / 'flowlang').exists():
            # Find repository root
            repo_root = cwd if (cwd / 'src' / 'flowlang').exists() else cwd.parent
            flows_dir = repo_root / 'flows'
            flows_dir.mkdir(exist_ok=True)
            project_dir = (flows_dir / directory_arg).resolve()
            print(f"📁 Detected FlowLang repository: {repo_root}")
            print(f"   Using flows directory: {flows_dir}")
            print(f"   Creating project: {project_dir}")
        else:
            # Fallback: use relative path as-is
            project_dir = Path(directory_arg).resolve()
            print(f"⚠️  No flows/ directory detected")
            print(f"   Creating project at: {project_dir}")
    else:
        # User provided a path (absolute or relative with slashes)
        project_dir = Path(directory_arg).resolve()

    name = args.name
    description = args.description

    # Interactive mode if name not provided
    if not name:
        print("📁 Create New FlowLang Project")
        print("=" * 60)
        name = input("Project name: ").strip()

        if not name:
            print("❌ Error: Project name is required")
            return 1

    # Interactive description
    if not description:
        description = input(f"Description (optional): ").strip()
        if not description:
            description = f"{name} FlowLang project"

    # Create project
    try:
        print()
        project = ProjectManager.create_project(
            project_dir=project_dir,
            name=name,
            description=description
        )

        print()
        print("✅ Project created successfully!")
        print()
        print("Next steps:")
        print(f"  1. cd {project_dir}")
        print(f"  2. Create flow directories (mkdir flow_name)")
        print(f"  3. Initialize flows with: flowlang init flow_name")
        print(f"  4. Start multi-flow server: flowlang project serve .")

        return 0

    except Exception as e:
        print(f"\n❌ Error creating project: {e}")
        return 1


def cmd_project_list(args):
    """List all projects in a directory"""
    root_dir = Path(args.directory).resolve()

    if not root_dir.exists():
        print(f"❌ Error: Directory not found: {root_dir}")
        return 1

    print(f"🔍 Discovering projects in: {root_dir}")
    print("=" * 60)

    try:
        projects = ProjectManager.discover_projects(root_dir)

        if not projects:
            print("No projects found.")
            print()
            print("To create a project:")
            print(f"  flowlang project init {root_dir / 'my-project'}")
            return 0

        print(f"\nFound {len(projects)} project(s):\n")

        for project in projects:
            print(f"📁 {project.name}")
            if project.description:
                print(f"   Description: {project.description}")
            print(f"   Version: {project.version}")
            print(f"   Location: {project.project_dir}")

            # Discover flows in project
            if project.project_dir:
                flows = ProjectManager.discover_flows_in_project(project.project_dir)
                print(f"   Flows: {len(flows)}")
                for flow_dir in flows:
                    print(f"     - {flow_dir.name}")

            print()

        return 0

    except Exception as e:
        print(f"\n❌ Error discovering projects: {e}")
        return 1


def cmd_project_info(args):
    """Show detailed project information"""
    project_dir = Path(args.directory).resolve()

    if not project_dir.exists():
        print(f"❌ Error: Directory not found: {project_dir}")
        return 1

    project_yaml = project_dir / "project.yaml"
    if not project_yaml.exists():
        print(f"❌ Error: Not a project directory (no project.yaml found)")
        print(f"   Directory: {project_dir}")
        return 1

    try:
        # Load project config
        project = ProjectConfig.from_yaml_file(project_yaml)

        print("📁 Project Information")
        print("=" * 60)
        print(f"Name: {project.name}")
        print(f"Version: {project.version}")

        if project.description:
            print(f"Description: {project.description}")

        print(f"Location: {project.project_dir}")

        # Tags
        if project.tags:
            print(f"Tags: {', '.join(project.tags)}")

        # Contact
        if project.contact:
            print("\nContact:")
            for key, value in project.contact.items():
                print(f"  {key}: {value}")

        # Shared connections
        if project.shared_connections:
            print("\nShared Connections:")
            for name, config in project.shared_connections.items():
                print(f"  - {name}")

        # Discover flows
        print("\nFlows:")
        flows = ProjectManager.discover_flows_in_project(project_dir)

        if not flows:
            print("  (no flows found)")
        else:
            for flow_dir in flows:
                print(f"  ✓ {flow_dir.name}")

        print()
        return 0

    except Exception as e:
        print(f"\n❌ Error reading project: {e}")
        import traceback
        if args.verbose:
            traceback.print_exc()
        return 1


def cmd_project_validate(args):
    """Validate project structure"""
    project_dir = Path(args.directory).resolve()

    if not project_dir.exists():
        print(f"❌ Error: Directory not found: {project_dir}")
        return 1

    print(f"🔍 Validating project: {project_dir}")
    print("=" * 60)

    try:
        results = validate_project_structure(project_dir)

        # Print info
        if results['info']:
            info = results['info']
            print(f"\nProject: {info.get('project_name', 'Unknown')}")
            print(f"Version: {info.get('version', 'Unknown')}")
            print(f"Flows: {info.get('flow_count', 0)}")

        # Print errors
        if results['errors']:
            print("\n❌ Errors:")
            for error in results['errors']:
                print(f"  - {error}")

        # Print warnings
        if results['warnings']:
            print("\n⚠️  Warnings:")
            for warning in results['warnings']:
                print(f"  - {warning}")

        # Result
        print()
        if results['valid']:
            print("✅ Project structure is valid")
            return 0
        else:
            print("❌ Project structure has errors")
            return 1

    except Exception as e:
        print(f"\n❌ Error validating project: {e}")
        return 1


def cmd_project_serve(args):
    """Start multi-flow server for a project"""
    project_dir = Path(args.directory).resolve()

    if not project_dir.exists():
        print(f"❌ Error: Directory not found: {project_dir}")
        return 1

    # Check if this is a project directory
    if not ProjectManager.is_project_dir(project_dir):
        print(f"❌ Error: Not a project directory (no project.yaml found)")
        print(f"   Directory: {project_dir}")
        print()
        print("To create a project:")
        print(f"  flowlang project init {project_dir}")
        return 1

    try:
        from .server import MultiFlowServer

        # Load project info
        project = ProjectConfig.from_yaml_file(project_dir / "project.yaml")

        print(f"🚀 Starting server for project: {project.name}")
        print()

        # Create and run multi-flow server
        server = MultiFlowServer(
            flows_dir=str(project_dir),
            title=f"{project.name} API",
            version=project.version,
            enable_hot_reload=args.reload
        )

        server.run(
            host=args.host,
            port=args.port,
            reload=False,  # Hot reload is handled internally
            log_level=args.log_level
        )

        return 0

    except Exception as e:
        print(f"\n❌ Error starting server: {e}")
        import traceback
        traceback.print_exc()
        return 1


def add_project_subparsers(parent_parser):
    """Add project subcommands to parent parser"""
    subparsers = parent_parser.add_subparsers(dest='project_command', help='Project commands')

    # flowlang project init
    init_parser = subparsers.add_parser(
        'init',
        help='Create a new project'
    )
    init_parser.add_argument(
        'directory',
        nargs='?',
        default='.',
        help='Directory to create project in (default: current directory)'
    )
    init_parser.add_argument(
        '--name', '-n',
        help='Project name (skips interactive prompt)'
    )
    init_parser.add_argument(
        '--description', '-d',
        help='Project description (skips interactive prompt)'
    )

    # flowlang project list
    list_parser = subparsers.add_parser(
        'list',
        help='List all projects in a directory'
    )
    list_parser.add_argument(
        'directory',
        nargs='?',
        default='.',
        help='Directory to search (default: current directory)'
    )

    # flowlang project info
    info_parser = subparsers.add_parser(
        'info',
        help='Show detailed information about a project'
    )
    info_parser.add_argument(
        'directory',
        nargs='?',
        default='.',
        help='Project directory (default: current directory)'
    )
    info_parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Show detailed error information'
    )

    # flowlang project validate
    validate_parser = subparsers.add_parser(
        'validate',
        help='Validate project structure'
    )
    validate_parser.add_argument(
        'directory',
        nargs='?',
        default='.',
        help='Project directory (default: current directory)'
    )

    # flowlang project serve
    serve_parser = subparsers.add_parser(
        'serve',
        help='Start multi-flow server for a project'
    )
    serve_parser.add_argument(
        'directory',
        nargs='?',
        default='.',
        help='Project directory (default: current directory)'
    )
    serve_parser.add_argument(
        '--host',
        default='0.0.0.0',
        help='Host to bind to (default: 0.0.0.0)'
    )
    serve_parser.add_argument(
        '--port',
        type=int,
        default=8000,
        help='Port to bind to (default: 8000)'
    )
    serve_parser.add_argument(
        '--reload',
        action='store_true',
        help='Enable hot reload for development'
    )
    serve_parser.add_argument(
        '--log-level',
        default='info',
        choices=['debug', 'info', 'warning', 'error'],
        help='Logging level (default: info)'
    )
