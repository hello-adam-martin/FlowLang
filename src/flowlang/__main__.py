"""
FlowLang CLI

Usage:
    python -m flowlang init [options]                  # Create new project
    python -m flowlang doctor [options]                # Check environment
    python -m flowlang upgrade [options]               # Upgrade FlowLang
    python -m flowlang version [options]               # Show version
    python -m flowlang completions <shell>             # Shell completions
    python -m flowlang connection <subcommand> [opts]  # Connection plugins
    python -m flowlang project <subcommand> [opts]     # Project management

    python -m flowlang validate <flow.yaml>            # Validate flow
    python -m flowlang watch <flow.yaml> [options]     # Watch mode
    python -m flowlang template <command> [options]    # Templates
    python -m flowlang scaffolder <command> <args>     # Scaffolder
    python -m flowlang server <command> <args>         # Server
"""

import sys
import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(
        description='FlowLang - Workflow orchestration made simple',
        usage='python -m flowlang <command> [<args>]'
    )

    parser.add_argument(
        '--version',
        action='store_true',
        help='Show FlowLang version'
    )

    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # Developer Experience Commands

    # Init command
    init_parser = subparsers.add_parser(
        'init',
        help='Create a new flow project interactively'
    )
    init_parser.add_argument(
        'directory',
        nargs='?',
        default='.',
        help='Directory to create the project in (default: current directory)'
    )
    init_parser.add_argument(
        '--template', '-t',
        help='Use a specific template (e.g., APIIntegration)'
    )
    init_parser.add_argument(
        '--name', '-n',
        help='Flow name (skips interactive prompt)'
    )
    init_parser.add_argument(
        '--description', '-d',
        help='Flow description (skips interactive prompt)'
    )
    init_parser.add_argument(
        '--no-git',
        action='store_true',
        help='Skip git repository initialization'
    )

    # Doctor command
    doctor_parser = subparsers.add_parser(
        'doctor',
        help='Check your FlowLang environment'
    )
    doctor_parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Show detailed diagnostic information'
    )
    doctor_parser.add_argument(
        '--fix',
        action='store_true',
        help='Attempt to fix common issues automatically'
    )

    # Upgrade command
    upgrade_parser = subparsers.add_parser(
        'upgrade',
        help='Upgrade FlowLang to the latest version'
    )
    upgrade_parser.add_argument(
        '--check',
        action='store_true',
        help='Check for updates without installing'
    )
    upgrade_parser.add_argument(
        '--pre',
        action='store_true',
        help='Include pre-release versions'
    )

    # Version command
    version_parser = subparsers.add_parser(
        'version',
        help='Show FlowLang version information'
    )
    version_parser.add_argument(
        '--json',
        action='store_true',
        help='Output in JSON format'
    )

    # Completions command
    completions_parser = subparsers.add_parser(
        'completions',
        help='Generate shell completion scripts'
    )
    completions_parser.add_argument(
        'shell',
        choices=['bash', 'zsh', 'fish'],
        help='Shell type'
    )

    # Connection command
    connection_parser = subparsers.add_parser(
        'connection',
        help='Manage connection plugins'
    )
    connection_parser.add_argument(
        'connection_args',
        nargs=argparse.REMAINDER,
        help='Connection subcommand and arguments'
    )

    # Project command
    project_parser = subparsers.add_parser(
        'project',
        help='Manage FlowLang projects'
    )
    # Add project subcommands
    from flowlang.cli_project import add_project_subparsers
    add_project_subparsers(project_parser)

    # Development Commands

    # Validate command
    validate_parser = subparsers.add_parser(
        'validate',
        help='Validate a flow definition'
    )
    validate_parser.add_argument(
        'flow_file',
        type=str,
        help='Path to flow YAML file'
    )
    validate_parser.add_argument(
        '--tasks-file',
        type=str,
        help='Path to Python file with task registry (optional)'
    )

    # Watch command
    watch_parser = subparsers.add_parser(
        'watch',
        help='Watch flow files and auto-execute on changes'
    )
    watch_parser.add_argument(
        'flow_file',
        type=str,
        nargs='?',
        default='flow.yaml',
        help='Path to flow YAML file (default: flow.yaml)'
    )
    watch_parser.add_argument(
        '--tasks-file',
        type=str,
        default='flow.py',
        help='Path to Python file with task implementations (default: flow.py)'
    )
    watch_parser.add_argument(
        '--test-inputs',
        type=str,
        help='Path to JSON file with test inputs'
    )

    # Scaffolder command
    scaffolder_parser = subparsers.add_parser(
        'scaffolder',
        help='Run scaffolder commands'
    )
    scaffolder_parser.add_argument(
        'scaffolder_args',
        nargs=argparse.REMAINDER,
        help='Scaffolder arguments'
    )

    # Template command
    template_parser = subparsers.add_parser(
        'template',
        help='Work with flow templates'
    )
    template_parser.add_argument(
        'template_args',
        nargs=argparse.REMAINDER,
        help='Template arguments'
    )

    # Server command
    server_parser = subparsers.add_parser(
        'server',
        help='Run server commands'
    )
    server_parser.add_argument(
        'server_args',
        nargs=argparse.REMAINDER,
        help='Server arguments'
    )

    args = parser.parse_args()

    # Handle --version flag
    if args.version:
        try:
            from . import __version__
            print(f"FlowLang {__version__}")
        except (ImportError, AttributeError):
            print("FlowLang (version unknown)")
        sys.exit(0)

    # Route to appropriate command handler
    if args.command == 'init':
        from flowlang.cli_init import cmd_init
        sys.exit(cmd_init(args))
    elif args.command == 'doctor':
        from flowlang.cli_doctor import cmd_doctor
        sys.exit(cmd_doctor(args))
    elif args.command == 'upgrade':
        from flowlang.cli_upgrade import cmd_upgrade
        sys.exit(cmd_upgrade(args))
    elif args.command == 'version':
        from flowlang.cli_version import cmd_version
        sys.exit(cmd_version(args))
    elif args.command == 'completions':
        from flowlang.cli_completions import cmd_completions
        sys.exit(cmd_completions(args))
    elif args.command == 'connection':
        from flowlang.cli_connection import cmd_connection
        sys.exit(cmd_connection(args))
    elif args.command == 'project':
        from flowlang.cli_project import cmd_project
        sys.exit(cmd_project(args))
    elif args.command == 'validate':
        run_validate(args)
    elif args.command == 'watch':
        run_watch(args)
    elif args.command == 'template':
        from flowlang.templates import main as template_main
        sys.argv = ['flowlang.templates'] + args.template_args
        template_main()
    elif args.command == 'scaffolder':
        from flowlang.scaffolder import main as scaffolder_main
        sys.argv = ['flowlang.scaffolder'] + args.scaffolder_args
        scaffolder_main()
    elif args.command == 'server':
        from flowlang.server import main as server_main
        sys.argv = ['flowlang.server'] + args.server_args
        server_main()
    else:
        parser.print_help()
        sys.exit(1)


def run_validate(args):
    """Run flow validation"""
    from flowlang import validate_flow

    # Load flow
    flow_path = Path(args.flow_file)
    if not flow_path.exists():
        print(f"❌ Error: Flow file not found: {flow_path}")
        sys.exit(1)

    with open(flow_path) as f:
        flow_yaml = f.read()

    # Load task registry if provided
    registry = None
    if args.tasks_file:
        tasks_path = Path(args.tasks_file)
        if not tasks_path.exists():
            print(f"❌ Error: Tasks file not found: {tasks_path}")
            sys.exit(1)

        # Import the module and get registry
        import importlib.util
        spec = importlib.util.spec_from_file_location("flow_tasks", tasks_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        if hasattr(module, 'create_task_registry'):
            registry = module.create_task_registry()
        else:
            print(f"⚠️  Warning: No 'create_task_registry()' function found in {tasks_path}")

    # Validate
    print(f"🔍 Validating flow: {flow_path}")
    if registry:
        print(f"📋 Using task registry from: {args.tasks_file}")
    print()

    result = validate_flow(flow_yaml, registry)
    print(result)

    # Exit with appropriate code
    sys.exit(0 if result.valid else 1)


def run_watch(args):
    """Run watch mode for live testing"""
    import asyncio
    from flowlang.watch import watch_command

    asyncio.run(watch_command(
        flow_file=args.flow_file,
        tasks_file=args.tasks_file,
        test_inputs=args.test_inputs
    ))


if __name__ == '__main__':
    main()
