"""
FlowLang Connection Plugin CLI

Commands for managing connection plugins:
- list: List all available connection plugins
- info: Show detailed information about a plugin
- deps: Show plugin dependencies
- install: Install plugin dependencies
- scaffold: Generate connection config snippet
- helpers: Generate helper functions
- example: Generate example flow
"""
import sys
import argparse
from pathlib import Path


def cmd_connection(args):
    """Main entry point for connection commands"""
    # Create subcommand parser
    parser = argparse.ArgumentParser(
        description='Manage FlowLang connection plugins',
        usage='flowlang connection <subcommand> [options]'
    )

    subparsers = parser.add_subparsers(dest='subcommand', help='Connection subcommands')

    # List command
    list_parser = subparsers.add_parser(
        'list',
        help='List all available connection plugins'
    )
    list_parser.add_argument(
        '--format',
        choices=['text', 'json'],
        default='text',
        help='Output format'
    )

    # Info command
    info_parser = subparsers.add_parser(
        'info',
        help='Show detailed information about a plugin'
    )
    info_parser.add_argument(
        'plugin',
        help='Plugin name (e.g., postgres, redis)'
    )
    info_parser.add_argument(
        '--json',
        action='store_true',
        help='Output in JSON format'
    )

    # Deps command
    deps_parser = subparsers.add_parser(
        'deps',
        help='Show plugin dependencies'
    )
    deps_parser.add_argument(
        'plugin',
        help='Plugin name'
    )
    deps_parser.add_argument(
        '--check',
        action='store_true',
        help='Check if dependencies are installed'
    )

    # Install command
    install_parser = subparsers.add_parser(
        'install',
        help='Install plugin dependencies'
    )
    install_parser.add_argument(
        'plugin',
        help='Plugin name'
    )
    install_parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be installed without installing'
    )

    # Scaffold command
    scaffold_parser = subparsers.add_parser(
        'scaffold',
        help='Generate connection config snippet'
    )
    scaffold_parser.add_argument(
        'plugin',
        help='Plugin name'
    )
    scaffold_parser.add_argument(
        '--name', '-n',
        default='conn',
        help='Connection name to use (default: conn)'
    )
    scaffold_parser.add_argument(
        '--output', '-o',
        help='Output file (default: stdout)'
    )

    # Helpers command
    helpers_parser = subparsers.add_parser(
        'helpers',
        help='Generate helper functions for a plugin'
    )
    helpers_parser.add_argument(
        'plugin',
        help='Plugin name'
    )
    helpers_parser.add_argument(
        '--output', '-o',
        default='.',
        help='Output directory (default: current directory)'
    )
    helpers_parser.add_argument(
        '--connection',
        default='conn',
        help='Connection name from flow YAML (default: conn)'
    )

    # Example command
    example_parser = subparsers.add_parser(
        'example',
        help='Generate example flow for a plugin'
    )
    example_parser.add_argument(
        'plugin',
        help='Plugin name'
    )
    example_parser.add_argument(
        '--output', '-o',
        default='.',
        help='Output directory (default: current directory)'
    )
    example_parser.add_argument(
        '--connection',
        default='conn',
        help='Connection name to use (default: conn)'
    )

    # Parse subcommand args
    if not hasattr(args, 'connection_args') or not args.connection_args:
        parser.print_help()
        return 1

    subargs = parser.parse_args(args.connection_args)

    if not subargs.subcommand:
        parser.print_help()
        return 1

    # Route to subcommand handler
    if subargs.subcommand == 'list':
        return cmd_list(subargs)
    elif subargs.subcommand == 'info':
        return cmd_info(subargs)
    elif subargs.subcommand == 'deps':
        return cmd_deps(subargs)
    elif subargs.subcommand == 'install':
        return cmd_install(subargs)
    elif subargs.subcommand == 'scaffold':
        return cmd_scaffold(subargs)
    elif subargs.subcommand == 'helpers':
        return cmd_helpers(subargs)
    elif subargs.subcommand == 'example':
        return cmd_example(subargs)
    else:
        parser.print_help()
        return 1


def cmd_list(args):
    """List all available connection plugins"""
    from flowlang.connections import plugin_registry
    import json

    plugins = plugin_registry.list_plugins()

    if args.format == 'json':
        # JSON output
        plugin_data = []
        for name in plugins:
            plugin = plugin_registry.get(name)
            if plugin:
                deps_installed, missing = plugin.check_dependencies()
                plugin_data.append({
                    'name': plugin.name,
                    'description': plugin.description,
                    'version': plugin.version,
                    'dependencies_installed': deps_installed,
                    'builtin_tasks': list(plugin.get_builtin_tasks().keys())
                })

        print(json.dumps({'plugins': plugin_data}, indent=2))
    else:
        # Text output
        if not plugins:
            print("No connection plugins found.")
            print("\nTo create a custom plugin, see:")
            print("  docs/creating-connection-plugins.md")
            return 0

        print("Available Connection Plugins:")
        print()

        for name in plugins:
            plugin = plugin_registry.get(name)
            if plugin:
                deps_installed, missing = plugin.check_dependencies()
                status = "✅" if deps_installed else "⚠️"

                print(f"{status} {plugin.name} (v{plugin.version})")
                print(f"   {plugin.description}")

                builtin_tasks = plugin.get_builtin_tasks()
                if builtin_tasks:
                    print(f"   Built-in tasks: {', '.join(builtin_tasks.keys())}")

                if not deps_installed:
                    print(f"   Missing dependencies: {', '.join(missing)}")
                    print(f"   Install with: flowlang connection install {plugin.name}")

                print()

        print(f"Total: {len(plugins)} plugin(s)")
        print("\nFor more info: flowlang connection info <plugin>")

    return 0


def cmd_info(args):
    """Show detailed information about a plugin"""
    from flowlang.connections import plugin_registry
    import json

    plugin = plugin_registry.get(args.plugin)

    if not plugin:
        available = plugin_registry.list_plugins()
        print(f"❌ Plugin '{args.plugin}' not found.")
        if available:
            print(f"\nAvailable plugins: {', '.join(available)}")
        return 1

    if args.json:
        # JSON output
        info = plugin.get_info()
        print(json.dumps(info, indent=2))
    else:
        # Text output
        print(f"Plugin: {plugin.name}")
        print(f"Version: {plugin.version}")
        print(f"Description: {plugin.description}")
        print()

        # Dependencies
        deps = plugin.get_dependencies()
        if deps:
            deps_installed, missing = plugin.check_dependencies()

            print("Dependencies:")
            for dep in deps:
                is_missing = dep in missing
                status = "❌" if is_missing else "✅"
                print(f"  {status} {dep}")

            if missing:
                print()
                print(f"Install missing dependencies:")
                print(f"  flowlang connection install {plugin.name}")
                print(f"  # or directly:")
                print(f"  pip install {' '.join(missing)}")
        else:
            print("Dependencies: None")

        print()

        # Built-in tasks
        builtin_tasks = plugin.get_builtin_tasks()
        if builtin_tasks:
            print(f"Built-in tasks ({len(builtin_tasks)}):")
            for task_name in sorted(builtin_tasks.keys()):
                print(f"  - {task_name}")
        else:
            print("Built-in tasks: None")

        print()

        # Configuration schema
        schema = plugin.get_config_schema()
        if 'properties' in schema:
            print("Configuration:")
            for key, prop in schema['properties'].items():
                required = key in schema.get('required', [])
                req_marker = "*" if required else " "
                prop_type = prop.get('type', 'any')
                default = prop.get('default')

                print(f" {req_marker} {key}: {prop_type}", end='')
                if default is not None:
                    print(f" (default: {default})", end='')
                print()

                desc = prop.get('description')
                if desc:
                    print(f"     {desc}")

        print()
        print("Commands:")
        print(f"  flowlang connection scaffold {plugin.name}  # Generate config")
        print(f"  flowlang connection helpers {plugin.name}   # Generate helpers")
        print(f"  flowlang connection example {plugin.name}   # Generate example")

    return 0


def cmd_deps(args):
    """Show plugin dependencies"""
    from flowlang.connections import plugin_registry

    plugin = plugin_registry.get(args.plugin)

    if not plugin:
        available = plugin_registry.list_plugins()
        print(f"❌ Plugin '{args.plugin}' not found.")
        if available:
            print(f"\nAvailable plugins: {', '.join(available)}")
        return 1

    deps = plugin.get_dependencies()

    if not deps:
        print(f"Plugin '{plugin.name}' has no dependencies.")
        return 0

    if args.check:
        # Check installation status
        deps_installed, missing = plugin.check_dependencies()

        print(f"Dependencies for '{plugin.name}':")
        for dep in deps:
            is_missing = dep in missing
            status = "❌ NOT INSTALLED" if is_missing else "✅ Installed"
            print(f"  {dep:30} {status}")

        print()
        if missing:
            print(f"Missing: {len(missing)}/{len(deps)} package(s)")
            print(f"\nInstall with: flowlang connection install {plugin.name}")
            return 1
        else:
            print(f"All dependencies installed ✅")
            return 0
    else:
        # Just list dependencies
        print(f"Dependencies for '{plugin.name}':")
        for dep in deps:
            print(f"  - {dep}")

        print()
        print(f"Check installation: flowlang connection deps {plugin.name} --check")
        print(f"Install: flowlang connection install {plugin.name}")

    return 0


def cmd_install(args):
    """Install plugin dependencies"""
    from flowlang.connections import plugin_registry
    import subprocess

    plugin = plugin_registry.get(args.plugin)

    if not plugin:
        available = plugin_registry.list_plugins()
        print(f"❌ Plugin '{args.plugin}' not found.")
        if available:
            print(f"\nAvailable plugins: {', '.join(available)}")
        return 1

    deps = plugin.get_dependencies()

    if not deps:
        print(f"Plugin '{plugin.name}' has no dependencies to install.")
        return 0

    # Check what's missing
    deps_installed, missing = plugin.check_dependencies()

    if not missing:
        print(f"✅ All dependencies for '{plugin.name}' are already installed.")
        return 0

    print(f"Installing dependencies for '{plugin.name}':")
    for dep in missing:
        print(f"  - {dep}")
    print()

    if args.dry_run:
        print("Dry run - would execute:")
        print(f"  pip install {' '.join(missing)}")
        return 0

    # Install
    try:
        result = subprocess.run(
            [sys.executable, '-m', 'pip', 'install'] + missing,
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            print("✅ Installation successful!")
            return 0
        else:
            print("❌ Installation failed:")
            print(result.stderr)
            return 1

    except Exception as e:
        print(f"❌ Error installing dependencies: {e}")
        return 1


def cmd_scaffold(args):
    """Generate connection config snippet"""
    from flowlang.connections import plugin_registry

    plugin = plugin_registry.get(args.plugin)

    if not plugin:
        available = plugin_registry.list_plugins()
        print(f"❌ Plugin '{args.plugin}' not found.")
        if available:
            print(f"\nAvailable plugins: {', '.join(available)}")
        return 1

    # Generate config
    config = plugin.scaffold_connection_config(name=args.name)

    if args.output:
        # Write to file
        output_path = Path(args.output)
        with open(output_path, 'w') as f:
            f.write("connections:")
            f.write(config)

        print(f"✅ Generated connection config: {output_path}")
    else:
        # Print to stdout
        print("# Add this to your flow.yaml:")
        print()
        print("connections:")
        print(config)

    return 0


def cmd_helpers(args):
    """Generate helper functions"""
    from flowlang.connections import plugin_registry

    plugin = plugin_registry.get(args.plugin)

    if not plugin:
        available = plugin_registry.list_plugins()
        print(f"❌ Plugin '{args.plugin}' not found.")
        if available:
            print(f"\nAvailable plugins: {', '.join(available)}")
        return 1

    # Generate helpers
    output_dir = Path(args.output)

    try:
        plugin.scaffold_task_helpers(
            output_dir=str(output_dir),
            connection_name=args.connection
        )

        print(f"✅ Generated helper functions in: {output_dir}")
        return 0

    except Exception as e:
        print(f"❌ Error generating helpers: {e}")
        return 1


def cmd_example(args):
    """Generate example flow"""
    from flowlang.connections import plugin_registry

    plugin = plugin_registry.get(args.plugin)

    if not plugin:
        available = plugin_registry.list_plugins()
        print(f"❌ Plugin '{args.plugin}' not found.")
        if available:
            print(f"\nAvailable plugins: {', '.join(available)}")
        return 1

    # Generate example
    output_dir = Path(args.output)

    try:
        plugin.scaffold_example_flow(
            output_dir=str(output_dir),
            connection_name=args.connection
        )

        print(f"✅ Generated example flow in: {output_dir}")
        return 0

    except Exception as e:
        print(f"❌ Error generating example: {e}")
        return 1
