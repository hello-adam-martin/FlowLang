"""
FlowLang Template System

Provides template management and instantiation for creating new flows from templates.
"""

import os
import re
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Any


class TemplateManager:
    """Manages FlowLang templates"""

    def __init__(self, templates_dir: Optional[str] = None):
        """
        Initialize template manager.

        Args:
            templates_dir: Directory containing templates. Defaults to templates/ in FlowLang root.
        """
        if templates_dir is None:
            # Default to templates/ directory in FlowLang installation
            flowlang_root = Path(__file__).parent.parent.parent
            templates_dir = flowlang_root / "templates"

        self.templates_dir = Path(templates_dir)

    def list_templates(self) -> List[Dict[str, str]]:
        """
        List all available templates.

        Returns:
            List of template info dicts with 'name', 'path', 'description'
        """
        if not self.templates_dir.exists():
            return []

        templates = []
        for template_dir in self.templates_dir.iterdir():
            if template_dir.is_dir() and (template_dir / "flow.yaml").exists():
                # Try to read description from README
                description = "No description"
                readme_path = template_dir / "README.md"
                if readme_path.exists():
                    with open(readme_path, 'r') as f:
                        lines = f.readlines()
                        # Look for first paragraph after title
                        for i, line in enumerate(lines):
                            if line.startswith('#') and i + 2 < len(lines):
                                desc_line = lines[i + 2].strip()
                                if desc_line:
                                    description = desc_line
                                    break

                templates.append({
                    'name': template_dir.name,
                    'path': str(template_dir),
                    'description': description
                })

        return sorted(templates, key=lambda t: t['name'])

    def get_template_variables(self, template_name: str) -> List[str]:
        """
        Extract variable placeholders from a template.

        Args:
            template_name: Name of the template

        Returns:
            List of variable names (e.g., ['FLOW_NAME', 'API_BASE_URL'])
        """
        template_dir = self.templates_dir / template_name
        if not template_dir.exists():
            raise ValueError(f"Template '{template_name}' not found")

        variables = set()

        # Scan all files in template for {{VARIABLE}} patterns
        for file_path in template_dir.rglob("*"):
            if file_path.is_file() and not file_path.name.startswith('.'):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        # Find all {{VARIABLE}} patterns
                        matches = re.findall(r'\{\{([A-Z_]+)\}\}', content)
                        variables.update(matches)
                except (UnicodeDecodeError, PermissionError):
                    # Skip binary files or files we can't read
                    continue

        return sorted(list(variables))

    def instantiate_template(
        self,
        template_name: str,
        output_dir: str,
        variables: Dict[str, str],
        overwrite: bool = False
    ) -> Dict[str, Any]:
        """
        Create a new flow project from a template.

        Args:
            template_name: Name of the template to use
            output_dir: Directory to create the new flow project
            variables: Dict mapping variable names to values
            overwrite: Whether to overwrite existing directory

        Returns:
            Dict with creation info (files_created, warnings, etc.)

        Raises:
            ValueError: If template not found or output directory exists
        """
        template_dir = self.templates_dir / template_name
        if not template_dir.exists():
            raise ValueError(f"Template '{template_name}' not found")

        output_path = Path(output_dir)

        # Check if output directory exists
        if output_path.exists():
            if not overwrite:
                raise ValueError(
                    f"Output directory '{output_dir}' already exists. "
                    "Use overwrite=True to replace it."
                )
            # Remove existing directory
            shutil.rmtree(output_path)

        # Create output directory
        output_path.mkdir(parents=True, exist_ok=True)

        # Track what we create
        files_created = []
        warnings = []

        # Get all files in template
        template_files = [
            f for f in template_dir.rglob("*")
            if f.is_file() and not f.name.startswith('.')
        ]

        # Copy and process each file
        for template_file in template_files:
            # Calculate relative path
            rel_path = template_file.relative_to(template_dir)
            output_file = output_path / rel_path

            # Create parent directories if needed
            output_file.parent.mkdir(parents=True, exist_ok=True)

            # Read template file
            try:
                with open(template_file, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Substitute variables
                processed_content = self._substitute_variables(content, variables)

                # Check for unsubstituted variables
                remaining_vars = re.findall(r'\{\{([A-Z_]+)\}\}', processed_content)
                if remaining_vars:
                    warnings.append(
                        f"{rel_path}: Contains unsubstituted variables: {', '.join(set(remaining_vars))}"
                    )

                # Write processed content
                with open(output_file, 'w', encoding='utf-8') as f:
                    f.write(processed_content)

                files_created.append(str(rel_path))

            except (UnicodeDecodeError, PermissionError):
                # Binary file or can't read - copy as-is
                shutil.copy2(template_file, output_file)
                files_created.append(str(rel_path))

        # Make shell scripts executable
        for script_file in output_path.rglob("*.sh"):
            script_file.chmod(0o755)

        return {
            'template': template_name,
            'output_dir': str(output_path),
            'files_created': files_created,
            'warnings': warnings,
            'variables_used': variables
        }

    def _substitute_variables(self, content: str, variables: Dict[str, str]) -> str:
        """
        Replace {{VARIABLE}} placeholders with values.

        Args:
            content: Template content
            variables: Variable name -> value mapping

        Returns:
            Content with variables substituted
        """
        result = content

        for var_name, var_value in variables.items():
            # Replace {{VAR_NAME}} with value
            pattern = r'\{\{' + re.escape(var_name) + r'\}\}'
            result = re.sub(pattern, var_value, result)

        return result


def list_templates(templates_dir: Optional[str] = None) -> List[Dict[str, str]]:
    """
    List all available templates.

    Args:
        templates_dir: Custom templates directory (optional)

    Returns:
        List of template info dicts
    """
    manager = TemplateManager(templates_dir)
    return manager.list_templates()


def create_from_template(
    template_name: str,
    output_dir: str,
    variables: Dict[str, str],
    templates_dir: Optional[str] = None,
    overwrite: bool = False
) -> Dict[str, Any]:
    """
    Create a new flow from a template.

    Args:
        template_name: Name of template to use
        output_dir: Where to create the new flow
        variables: Template variable values
        templates_dir: Custom templates directory (optional)
        overwrite: Whether to overwrite existing directory

    Returns:
        Dict with creation info

    Example:
        >>> create_from_template(
        ...     template_name='APIIntegration',
        ...     output_dir='./MyAPI',
        ...     variables={
        ...         'FLOW_NAME': 'GitHubAPI',
        ...         'FLOW_DESCRIPTION': 'GitHub API integration',
        ...         'API_BASE_URL': 'https://api.github.com',
        ...         'API_KEY_ENV_VAR': 'GITHUB_TOKEN',
        ...         'AUTH_HEADER_NAME': 'Authorization',
        ...         'AUTH_HEADER_PREFIX': 'Bearer '
        ...     }
        ... )
    """
    manager = TemplateManager(templates_dir)
    return manager.instantiate_template(template_name, output_dir, variables, overwrite)


def get_template_variables(
    template_name: str,
    templates_dir: Optional[str] = None
) -> List[str]:
    """
    Get list of variables required by a template.

    Args:
        template_name: Name of template
        templates_dir: Custom templates directory (optional)

    Returns:
        List of variable names
    """
    manager = TemplateManager(templates_dir)
    return manager.get_template_variables(template_name)


def main():
    """CLI interface for template management"""
    import sys
    import argparse
    import json

    parser = argparse.ArgumentParser(description='FlowLang Template Manager')
    subparsers = parser.add_subparsers(dest='command', help='Command to run')

    # List templates
    list_parser = subparsers.add_parser('list', help='List available templates')

    # Show template variables
    vars_parser = subparsers.add_parser('vars', help='Show template variables')
    vars_parser.add_argument('template', help='Template name')

    # Create from template
    create_parser = subparsers.add_parser('create', help='Create from template')
    create_parser.add_argument('template', help='Template name')
    create_parser.add_argument('output', help='Output directory')
    create_parser.add_argument('--var', action='append', help='Variable (VAR=value)')
    create_parser.add_argument('--vars-file', help='JSON file with variables')
    create_parser.add_argument('--overwrite', action='store_true', help='Overwrite existing')

    args = parser.parse_args()

    if args.command == 'list':
        templates = list_templates()
        if not templates:
            print("No templates found")
        else:
            print(f"\nAvailable templates ({len(templates)}):\n")
            for t in templates:
                print(f"  {t['name']}")
                print(f"    {t['description']}")
                print()

    elif args.command == 'vars':
        try:
            variables = get_template_variables(args.template)
            print(f"\nTemplate '{args.template}' requires these variables:\n")
            for var in variables:
                print(f"  {{{{{var}}}}}")
            print()
        except ValueError as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)

    elif args.command == 'create':
        # Parse variables
        variables = {}

        # From --vars-file
        if args.vars_file:
            with open(args.vars_file, 'r') as f:
                variables.update(json.load(f))

        # From --var flags
        if args.var:
            for var_spec in args.var:
                if '=' not in var_spec:
                    print(f"Error: Invalid variable format: {var_spec}", file=sys.stderr)
                    print("Use --var VAR_NAME=value", file=sys.stderr)
                    sys.exit(1)
                name, value = var_spec.split('=', 1)
                variables[name] = value

        try:
            result = create_from_template(
                template_name=args.template,
                output_dir=args.output,
                variables=variables,
                overwrite=args.overwrite
            )

            print(f"\n✅ Created flow from template '{args.template}'")
            print(f"   Output: {result['output_dir']}")
            print(f"   Files created: {len(result['files_created'])}")

            if result['warnings']:
                print("\n⚠️  Warnings:")
                for warning in result['warnings']:
                    print(f"   {warning}")

            print("\nNext steps:")
            print(f"  cd {result['output_dir']}")
            print("  ./tools/start_server.sh --reload")
            print()

        except ValueError as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)

    else:
        parser.print_help()


if __name__ == '__main__':
    main()
