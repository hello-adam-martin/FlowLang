"""
FlowLang Connection Configuration Wizard

Interactive wizard for configuring connections during project initialization.
Groups connections by category and provides smart defaults from plugin schemas.
"""

import os
from typing import Dict, List, Any, Optional
from pathlib import Path

from .connections import plugin_registry


class ConnectionWizard:
    """Interactive wizard for configuring project connections"""

    # Category metadata (labels and descriptions)
    # Plugins auto-assign themselves to categories via their 'category' property
    CATEGORY_METADATA = {
        "database": {
            "label": "Database Connections",
            "description": "Connect to databases for persistent storage"
        },
        "caching": {
            "label": "Caching Systems",
            "description": "Connect to caching services for performance"
        },
        "messaging": {
            "label": "Message Queues",
            "description": "Connect to message brokers and queuing systems"
        },
        "data_services": {
            "label": "Data Services",
            "description": "Connect to cloud data platforms and services"
        },
        "api": {
            "label": "REST APIs",
            "description": "Configure custom REST API integrations"
        },
        "other": {
            "label": "Other Connections",
            "description": "Miscellaneous connection types"
        }
    }

    def __init__(self):
        """Initialize the wizard with connection plugin registry"""
        self.registry = plugin_registry
        self.connections = {}

        # Dynamically build categories from discovered plugins
        self.categories = self._build_categories()

    def _build_categories(self) -> Dict[str, Dict[str, Any]]:
        """
        Build category structure by discovering plugins and grouping by category.

        Returns:
            Dict mapping category keys to category info with plugins list
        """
        categories = {}

        # Discover all available plugins
        all_plugins = self.registry.get_all()

        # Group plugins by category
        for plugin_name, plugin in all_plugins.items():
            category = getattr(plugin, 'category', 'other')

            # Initialize category if not exists
            if category not in categories:
                metadata = self.CATEGORY_METADATA.get(category, {
                    "label": category.replace('_', ' ').title(),
                    "description": f"{category.replace('_', ' ').title()} connections"
                })
                categories[category] = {
                    "label": metadata["label"],
                    "description": metadata["description"],
                    "plugins": []
                }

            # Add plugin to category
            categories[category]["plugins"].append(plugin_name)

        # Always include REST API category (special case)
        if "api" not in categories:
            categories["api"] = {
                "label": self.CATEGORY_METADATA["api"]["label"],
                "description": self.CATEGORY_METADATA["api"]["description"],
                "plugins": []  # Built on the fly
            }

        return categories

    def run(self) -> Dict[str, Dict[str, Any]]:
        """
        Run the interactive wizard

        Returns:
            Dict mapping connection names to their configurations
        """
        print()
        print("=" * 70)
        print("🔌 Connection Configuration Wizard")
        print("=" * 70)
        print()
        print("Let's set up connections for your project.")
        print("You can configure connections now or add them manually later.")
        print()

        # Step 1: Ask which categories they need
        selected_categories = self._prompt_categories()

        if not selected_categories:
            print("\n✓ No connections configured. You can add them manually to project.yaml later.")
            return {}

        # Step 2: For each selected category, configure specific connections
        for category in selected_categories:
            self._configure_category(category)

        print()
        print("=" * 70)
        print(f"✓ Configured {len(self.connections)} connection(s)")
        print("=" * 70)

        return self.connections

    def _prompt_categories(self) -> List[str]:
        """
        Ask user which categories of connections they need

        Returns:
            List of selected category keys
        """
        print("What types of connections does your project need?")
        print()

        # Display categories with numbers (sorted for consistency)
        category_list = sorted(self.categories.keys())
        for i, category_key in enumerate(category_list, 1):
            category = self.categories[category_key]
            print(f"  {i}. {category['label']}")
            print(f"     {category['description']}")
            print()

        print("Enter numbers separated by commas (e.g., 1,3) or press Enter to skip:")
        response = input("> ").strip()

        if not response:
            return []

        # Parse response
        selected = []
        for item in response.split(','):
            try:
                idx = int(item.strip()) - 1
                if 0 <= idx < len(category_list):
                    selected.append(category_list[idx])
            except ValueError:
                continue

        return selected

    def _configure_category(self, category_key: str):
        """
        Configure connections for a specific category

        Args:
            category_key: The category to configure
        """
        category = self.categories[category_key]

        print()
        print("-" * 70)
        print(f"📦 {category['label']}")
        print("-" * 70)
        print()

        if category_key == "api":
            self._configure_rest_api()
            return

        # Show available plugins for this category
        available_plugins = []
        for plugin_name in category['plugins']:
            plugin = self.registry.get(plugin_name)
            if plugin:
                available_plugins.append(plugin)

        if not available_plugins:
            print(f"⚠️  No plugins available for {category['label']}")
            return

        # Let user select which plugins to configure
        print(f"Available {category['label'].lower()}:")
        print()

        for i, plugin in enumerate(available_plugins, 1):
            print(f"  {i}. {plugin.name} - {plugin.description}")

        print()
        print("Enter numbers to configure (e.g., 1,2) or press Enter to skip:")
        response = input("> ").strip()

        if not response:
            return

        # Parse response and configure selected plugins
        for item in response.split(','):
            try:
                idx = int(item.strip()) - 1
                if 0 <= idx < len(available_plugins):
                    plugin = available_plugins[idx]
                    self._configure_plugin(plugin)
            except ValueError:
                continue

    def _configure_plugin(self, plugin):
        """
        Configure a specific connection plugin

        Args:
            plugin: ConnectionPlugin instance to configure
        """
        print()
        print(f"⚙️  Configuring {plugin.name}")
        print()

        # Get plugin's configuration schema
        schema = plugin.get_config_schema()
        properties = schema.get('properties', {})
        required = schema.get('required', [])

        # Prompt for connection name
        default_name = plugin.name
        name = input(f"Connection name (default: {default_name}): ").strip() or default_name

        if name in self.connections:
            print(f"⚠️  Connection '{name}' already exists. Skipping.")
            return

        # Build configuration by prompting for each property
        config = {"type": plugin.name}

        print()
        print("Enter configuration values (press Enter for defaults):")
        print()

        for prop_name, prop_schema in properties.items():
            value = self._prompt_property(prop_name, prop_schema, prop_name in required)
            if value is not None:
                config[prop_name] = value

        # Validate configuration
        try:
            validation_result = plugin.validate_config(config)
            if not validation_result.get('valid', False):
                print(f"\n⚠️  Configuration validation failed: {validation_result.get('error', 'Unknown error')}")
                print("Skipping this connection.")
                return
        except Exception as e:
            print(f"\n⚠️  Configuration validation error: {e}")
            print("Skipping this connection.")
            return

        # Save configuration
        self.connections[name] = config
        print(f"\n✓ Configured connection: {name}")

    def _prompt_property(self, name: str, schema: Dict[str, Any], required: bool) -> Optional[Any]:
        """
        Prompt user for a configuration property value

        Args:
            name: Property name
            schema: JSON schema for the property
            required: Whether the property is required

        Returns:
            The configured value or None if skipped
        """
        prop_type = schema.get('type', 'string')
        description = schema.get('description', '')
        default = schema.get('default')

        # Build prompt
        prompt_parts = [f"  {name}"]
        if description:
            prompt_parts.append(f"({description})")
        if default is not None:
            prompt_parts.append(f"[default: {default}]")
        if required:
            prompt_parts.append("(required)")

        prompt = " ".join(prompt_parts) + ": "

        # Get user input
        response = input(prompt).strip()

        # Handle empty response
        if not response:
            if default is not None:
                return default
            if required:
                print(f"    ⚠️  {name} is required. Using empty string.")
                return ""
            return None

        # Convert based on type
        if prop_type == 'integer':
            try:
                return int(response)
            except ValueError:
                print(f"    ⚠️  Invalid integer. Using default: {default}")
                return default
        elif prop_type == 'number':
            try:
                return float(response)
            except ValueError:
                print(f"    ⚠️  Invalid number. Using default: {default}")
                return default
        elif prop_type == 'boolean':
            return response.lower() in ('true', 'yes', '1', 'y')
        else:
            return response

    def _configure_rest_api(self):
        """Configure a generic REST API connection"""
        print("Configure a custom REST API integration")
        print()

        # Prompt for API name
        name = input("API connection name (e.g., 'stripe', 'slack'): ").strip()

        if not name:
            print("⚠️  API name is required. Skipping.")
            return

        if name in self.connections:
            print(f"⚠️  Connection '{name}' already exists. Skipping.")
            return

        print()
        print("Enter API configuration:")
        print()

        # Basic configuration
        base_url = input("  Base URL (e.g., https://api.example.com): ").strip()
        if not base_url:
            print("⚠️  Base URL is required. Skipping.")
            return

        # Authentication
        print()
        print("Authentication type:")
        print("  1. API Key (header)")
        print("  2. Bearer Token")
        print("  3. Basic Auth")
        print("  4. None")
        auth_choice = input("Select (1-4): ").strip()

        config = {
            "type": "rest_api",
            "base_url": base_url
        }

        if auth_choice == "1":
            header_name = input("  Header name (e.g., X-API-Key): ").strip() or "X-API-Key"
            env_var = input("  Environment variable for API key: ").strip() or f"{name.upper()}_API_KEY"
            config["auth"] = {
                "type": "api_key",
                "header": header_name,
                "value": f"${{{env_var}}}"
            }
        elif auth_choice == "2":
            env_var = input("  Environment variable for token: ").strip() or f"{name.upper()}_TOKEN"
            config["auth"] = {
                "type": "bearer",
                "token": f"${{{env_var}}}"
            }
        elif auth_choice == "3":
            username_var = input("  Environment variable for username: ").strip() or f"{name.upper()}_USERNAME"
            password_var = input("  Environment variable for password: ").strip() or f"{name.upper()}_PASSWORD"
            config["auth"] = {
                "type": "basic",
                "username": f"${{{username_var}}}",
                "password": f"${{{password_var}}}"
            }

        # Optional settings
        print()
        timeout = input("  Request timeout in seconds (default: 30): ").strip()
        if timeout:
            try:
                config["timeout"] = int(timeout)
            except ValueError:
                config["timeout"] = 30

        retry = input("  Enable automatic retries? (y/n, default: y): ").strip().lower()
        if retry != 'n':
            config["retry"] = {
                "max_attempts": 3,
                "backoff_factor": 2
            }

        # Save configuration
        self.connections[name] = config
        print(f"\n✓ Configured REST API connection: {name}")


def run_connection_wizard() -> Dict[str, Dict[str, Any]]:
    """
    Run the connection wizard and return configured connections

    Returns:
        Dict mapping connection names to their configurations
    """
    wizard = ConnectionWizard()
    return wizard.run()
