"""
FlowLang CLI

Usage:
    python -m flowlang validate <flow.yaml>
    python -m flowlang watch <flow.yaml> [options]
    python -m flowlang template <command> [options]
    python -m flowlang scaffolder <command> <args>
    python -m flowlang server <command> <args>
"""

import sys
import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(
        description='FlowLang CLI',
        usage='python -m flowlang <command> [<args>]'
    )

    subparsers = parser.add_subparsers(dest='command', help='Commands')

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

    if args.command == 'validate':
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
