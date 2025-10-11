"""
FlowLang CLI - Init Command

Interactive wizard for creating new FlowLang projects.
"""

import sys
import os
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any

from .templates import TemplateManager


def cmd_init(args) -> int:
    """
    Interactive flow creation wizard.

    Creates a new FlowLang project from templates with interactive prompts
    for template selection and variable configuration.
    """
    try:
        # Get target directory
        target_dir = Path(args.directory).resolve()

        # Check if directory exists and is not empty
        if target_dir.exists():
            if list(target_dir.iterdir()):
                print(f"⚠️  Directory {target_dir} is not empty.")
                response = input("Continue anyway? [y/N]: ").strip().lower()
                if response != 'y':
                    print("Aborted.")
                    return 0
        else:
            target_dir.mkdir(parents=True, exist_ok=True)

        template_manager = TemplateManager()

        # Template selection
        if args.template:
            template_name = args.template
            # list_templates() returns list of dicts with 'name' key
            available_templates = [t['name'] for t in template_manager.list_templates()]
            if template_name not in available_templates:
                print(f"❌ Template not found: {template_name}")
                print(f"\nAvailable templates:")
                for tmpl_info in template_manager.list_templates():
                    tmpl = tmpl_info['name']
                    info = template_manager.get_template_info(tmpl)
                    print(f"  - {tmpl}: {info.get('description', 'No description')}")
                return 1
        else:
            # Interactive template selection
            templates_list = template_manager.list_templates()

            if not templates_list:
                print("❌ No templates available. Please check your FlowLang installation.")
                return 1

            print("\n🎨 Available FlowLang Templates:\n")
            for i, tmpl_info in enumerate(templates_list, 1):
                tmpl = tmpl_info['name']
                desc = tmpl_info.get('description', 'No description')
                print(f"  {i}. {tmpl}")
                print(f"     {desc}\n")

            while True:
                choice = input(f"Select template (1-{len(templates_list)}) or 'q' to quit: ").strip()

                if choice.lower() == 'q':
                    print("Aborted.")
                    return 0

                try:
                    choice_idx = int(choice) - 1
                    if 0 <= choice_idx < len(templates_list):
                        template_name = templates_list[choice_idx]['name']
                        break
                    else:
                        print(f"Please enter a number between 1 and {len(templates_list)}")
                except ValueError:
                    print("Invalid input. Please enter a number or 'q' to quit.")

        # Get template info
        template_info = template_manager.get_template_info(template_name)
        required_vars = template_info.get('required_variables', [])

        print(f"\n✨ Creating flow from template: {template_name}\n")

        # Collect variable values
        variables: Dict[str, str] = {}

        # Flow name (special handling)
        if args.name:
            flow_name = args.name
        else:
            default_name = target_dir.name.replace('-', '').replace('_', '')
            flow_name = input(f"Flow name [{default_name}]: ").strip() or default_name

        variables['FLOW_NAME'] = flow_name

        # Flow description (special handling)
        if args.description:
            flow_description = args.description
        else:
            default_desc = f"A {template_name} flow"
            flow_description = input(f"Flow description [{default_desc}]: ").strip() or default_desc

        variables['FLOW_DESCRIPTION'] = flow_description

        # Collect other required variables
        for var_name in required_vars:
            if var_name in ('FLOW_NAME', 'FLOW_DESCRIPTION'):
                continue  # Already handled

            # Get default from template info
            defaults = template_info.get('variable_defaults', {})
            default_value = defaults.get(var_name, '')

            # Get variable description if available
            var_descriptions = template_info.get('variable_descriptions', {})
            var_desc = var_descriptions.get(var_name, '')

            if var_desc:
                print(f"\n{var_desc}")

            if default_value:
                user_input = input(f"{var_name} [{default_value}]: ").strip()
                variables[var_name] = user_input or default_value
            else:
                while True:
                    user_input = input(f"{var_name} (required): ").strip()
                    if user_input:
                        variables[var_name] = user_input
                        break
                    print("This variable is required.")

        # Create from template
        print(f"\n📦 Creating project in {target_dir}...\n")

        template_manager.create_from_template(
            template_name=template_name,
            output_dir=target_dir,
            variables=variables
        )

        print(f"✅ Project created successfully!\n")

        # Git initialization
        if not args.no_git and not (target_dir / '.git').exists():
            print("📝 Initializing git repository...")
            try:
                subprocess.run(
                    ['git', 'init'],
                    cwd=target_dir,
                    check=True,
                    capture_output=True
                )
                subprocess.run(
                    ['git', 'add', '.'],
                    cwd=target_dir,
                    check=True,
                    capture_output=True
                )
                subprocess.run(
                    ['git', 'commit', '-m', f'Initial commit: {flow_name}'],
                    cwd=target_dir,
                    check=True,
                    capture_output=True
                )
                print("✅ Git repository initialized\n")
            except (subprocess.CalledProcessError, FileNotFoundError):
                print("⚠️  Git initialization skipped (git not available)\n")

        # Print next steps
        print("🚀 Next steps:\n")
        print(f"  cd {target_dir}")
        print("  # Activate your virtual environment")
        print("  # Install dependencies: pip install -r requirements.txt")
        print("  ./tools/start_server.sh")
        print("\n  Then visit http://localhost:8000/docs for API documentation\n")

        return 0

    except KeyboardInterrupt:
        print("\n\nAborted by user")
        return 130
    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        if '--debug' in sys.argv:
            import traceback
            traceback.print_exc()
        return 1
