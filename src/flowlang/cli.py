"""
FlowLang CLI - Developer Experience Tools

Provides interactive commands for project initialization, environment validation,
and project management.
"""

import sys
import os
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any
import argparse


def get_version() -> str:
    """Get FlowLang version"""
    try:
        from . import __version__
        return __version__
    except (ImportError, AttributeError):
        return "unknown"


def create_parser() -> argparse.ArgumentParser:
    """Create the main argument parser"""
    parser = argparse.ArgumentParser(
        prog='flowlang',
        description='FlowLang - Workflow orchestration made simple',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  flowlang init                    Create a new flow project interactively
  flowlang doctor                  Check your FlowLang environment
  flowlang upgrade                 Upgrade FlowLang to the latest version
  flowlang version                 Show FlowLang version

For more information, visit: https://github.com/hello-adam-martin/FlowLang
"""
    )

    parser.add_argument(
        '--version',
        action='version',
        version=f'FlowLang {get_version()}'
    )

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # flowlang init
    init_parser = subparsers.add_parser(
        'init',
        help='Create a new flow project interactively',
        description='Interactive wizard to create a new FlowLang project'
    )
    init_parser.add_argument(
        'directory',
        nargs='?',
        default='.',
        help='Directory to create the project in (default: current directory)'
    )
    init_parser.add_argument(
        '--template',
        '-t',
        help='Use a specific template (e.g., APIIntegration)'
    )
    init_parser.add_argument(
        '--name',
        '-n',
        help='Flow name (skips interactive prompt)'
    )
    init_parser.add_argument(
        '--description',
        '-d',
        help='Flow description (skips interactive prompt)'
    )
    init_parser.add_argument(
        '--no-git',
        action='store_true',
        help='Skip git repository initialization'
    )

    # flowlang doctor
    doctor_parser = subparsers.add_parser(
        'doctor',
        help='Check your FlowLang environment',
        description='Validate your FlowLang installation and environment setup'
    )
    doctor_parser.add_argument(
        '--verbose',
        '-v',
        action='store_true',
        help='Show detailed diagnostic information'
    )
    doctor_parser.add_argument(
        '--fix',
        action='store_true',
        help='Attempt to fix common issues automatically'
    )

    # flowlang upgrade
    upgrade_parser = subparsers.add_parser(
        'upgrade',
        help='Upgrade FlowLang to the latest version',
        description='Update FlowLang package and migrate existing projects if needed'
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

    # flowlang version
    version_parser = subparsers.add_parser(
        'version',
        help='Show FlowLang version information',
        description='Display version and environment information'
    )
    version_parser.add_argument(
        '--json',
        action='store_true',
        help='Output in JSON format'
    )

    # flowlang completions
    completions_parser = subparsers.add_parser(
        'completions',
        help='Generate shell completion scripts',
        description='Generate shell completion scripts for bash, zsh, or fish'
    )
    completions_parser.add_argument(
        'shell',
        choices=['bash', 'zsh', 'fish'],
        help='Shell type'
    )

    return parser


def main():
    """Main CLI entry point"""
    parser = create_parser()
    args = parser.parse_args()

    # If no command specified, show help
    if not args.command:
        parser.print_help()
        return 0

    # Route to appropriate command handler
    try:
        if args.command == 'init':
            from .cli_init import cmd_init
            return cmd_init(args)
        elif args.command == 'doctor':
            from .cli_doctor import cmd_doctor
            return cmd_doctor(args)
        elif args.command == 'upgrade':
            from .cli_upgrade import cmd_upgrade
            return cmd_upgrade(args)
        elif args.command == 'version':
            from .cli_version import cmd_version
            return cmd_version(args)
        elif args.command == 'completions':
            from .cli_completions import cmd_completions
            return cmd_completions(args)
        else:
            print(f"Unknown command: {args.command}")
            return 1

    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        return 130
    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        if '--debug' in sys.argv:
            import traceback
            traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
