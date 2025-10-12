# Connection Configuration Wizard

The FlowLang connection wizard provides an intelligent, category-based interface for configuring connections during project initialization.

## Overview

When you run `flowlang project init`, the wizard automatically:
1. **Discovers** all available connection plugins
2. **Groups** them by category (database, caching, data services, etc.)
3. **Prompts** you interactively with smart defaults from plugin schemas
4. **Generates** connection configuration in `project.yaml`

## How It Works

### 1. Auto-Discovery

The wizard uses the `ConnectionPluginRegistry` to discover all available plugins:

```python
from flowlang.connections import plugin_registry

# Automatically discovers:
# - Built-in plugins in src/flowlang/connections/
# - Third-party plugins via setuptools entry points

all_plugins = plugin_registry.get_all()
# Returns: {'postgres': PostgresPlugin(), 'redis': RedisPlugin(), ...}
```

### 2. Category Grouping

Plugins self-declare their category via the `category` property:

```python
class PostgresPlugin(ConnectionPlugin):
    name = "postgres"
    description = "PostgreSQL database connection with asyncpg"
    version = "1.0.0"
    category = "database"  # ← Self-categorization
```

**Available Categories**:
- `database` - PostgreSQL, MySQL, MongoDB, SQLite
- `caching` - Redis, Memcached
- `messaging` - RabbitMQ, Kafka (future)
- `data_services` - Airtable, Notion, etc.
- `api` - Custom REST APIs
- `other` - Miscellaneous connections

The wizard dynamically builds categories from discovered plugins, so **new plugins automatically appear** without code changes.

### 3. Smart Configuration

For each selected plugin, the wizard:

1. **Extracts schema** from `plugin.get_config_schema()`:
   ```python
   {
       "type": "object",
       "required": ["url"],
       "properties": {
           "url": {"type": "string", "description": "Connection URL"},
           "pool_size": {"type": "integer", "default": 10}
       }
   }
   ```

2. **Prompts with defaults**:
   ```
   url (Connection URL) (required): postgresql://localhost/db
   pool_size (Maximum connections) [default: 10]:
   ```

3. **Validates** using `plugin.validate_config()` before saving

4. **Generates YAML**:
   ```yaml
   shared_connections:
     db:
       type: postgres
       url: postgresql://localhost/db
       pool_size: 10
   ```

### 4. REST API Builder

For custom REST APIs, the wizard provides a specialized flow:

```
API connection name: stripe
Base URL: https://api.stripe.com/v1

Authentication type:
  1. API Key (header)
  2. Bearer Token
  3. Basic Auth
  4. None
Select (1-4): 1
  Header name: Authorization
  Environment variable: STRIPE_API_KEY

Request timeout in seconds [default: 30]:
Enable automatic retries? (y/n) [default: y]:
```

Result:
```yaml
shared_connections:
  stripe:
    type: rest_api
    base_url: https://api.stripe.com/v1
    auth:
      type: api_key
      header: Authorization
      value: ${STRIPE_API_KEY}
    timeout: 30
    retry:
      max_attempts: 3
      backoff_factor: 2
```

## Adding New Connection Plugins

### Step 1: Create Plugin

Create a new plugin in `src/flowlang/connections/your_plugin/`:

```python
# src/flowlang/connections/rabbitmq/provider.py

from ..base import ConnectionPlugin

class RabbitMQPlugin(ConnectionPlugin):
    name = "rabbitmq"
    description = "RabbitMQ message broker with aio-pika"
    version = "1.0.0"
    category = "messaging"  # ← Declare category

    def get_config_schema(self):
        return {
            "type": "object",
            "required": ["url"],
            "properties": {
                "url": {
                    "type": "string",
                    "description": "AMQP connection URL"
                },
                "exchange": {
                    "type": "string",
                    "default": "default",
                    "description": "Default exchange name"
                }
            }
        }

    # Implement required methods...
```

### Step 2: Register Plugin

Create `__init__.py` to auto-register:

```python
# src/flowlang/connections/rabbitmq/__init__.py

from .provider import RabbitMQPlugin
from .. import plugin_registry

# Auto-register when imported
plugin_registry.register(RabbitMQPlugin())

__all__ = ['RabbitMQPlugin']
```

### Step 3: That's It!

The wizard will **automatically discover** your plugin on next run:

```
What types of connections does your project need?

  1. Caching Systems
     Connect to caching services for performance

  2. Database Connections
     Connect to databases for persistent storage

  3. Message Queues          ← NEW CATEGORY!
     Connect to message brokers and queuing systems

  4. REST APIs
     Configure custom REST API integrations

Enter numbers: 3
```

Then:

```
----------------------------------------------------------------------
📦 Message Queues
----------------------------------------------------------------------

Available message queues:

  1. rabbitmq - RabbitMQ message broker with aio-pika ← NEW PLUGIN!

Enter numbers to configure: 1
```

## Custom Categories

If your plugin uses a category not in the predefined list, the wizard will:

1. **Auto-create** the category with a sensible label
2. **Display** it in the wizard
3. **Group** your plugin under it

For example, if you set `category = "search_engines"`:

```python
class ElasticsearchPlugin(ConnectionPlugin):
    name = "elasticsearch"
    category = "search_engines"  # ← Custom category
```

The wizard will show:

```
  5. Search Engines
     Search Engines connections
```

For better UX, add your category to `CATEGORY_METADATA`:

```python
# In cli_connection_wizard.py

CATEGORY_METADATA = {
    # ...
    "search_engines": {
        "label": "Search Engines",
        "description": "Full-text search and analytics engines"
    }
}
```

## Usage

### Interactive Mode (Default)

```bash
flowlang project init my-project

# Wizard automatically runs after project creation
```

### Skip Wizard

```bash
flowlang project init my-project --skip-connections

# Add connections manually to project.yaml later
```

### Programmatic Usage

```python
from flowlang.cli_connection_wizard import run_connection_wizard

connections = run_connection_wizard()
# Returns: {'db': {'type': 'postgres', ...}, ...}

# Update project.yaml
import yaml
with open('project.yaml', 'r') as f:
    project_data = yaml.safe_load(f)

project_data['settings']['shared_connections'] = connections

with open('project.yaml', 'w') as f:
    yaml.safe_dump(project_data, f)
```

## Benefits

### For Users

✅ **Guided configuration** - No need to memorize YAML syntax
✅ **Smart defaults** - Sensible values from plugin schemas
✅ **Type-safe** - Validation before saving
✅ **Discoverable** - See all available connection types
✅ **Flexible** - Can skip and configure manually

### For Plugin Developers

✅ **Zero integration** - Just set `category` property
✅ **Automatic discovery** - No registry updates needed
✅ **Consistent UX** - Same wizard experience for all plugins
✅ **Schema-driven** - Configuration extracted from `get_config_schema()`
✅ **Extensible** - Custom categories supported

## Architecture

```
┌─────────────────────────────────────────────┐
│         ConnectionWizard                     │
├─────────────────────────────────────────────┤
│                                              │
│  1. __init__():                              │
│     - Get all plugins from registry          │
│     - Group by plugin.category               │
│     - Build dynamic category structure       │
│                                              │
│  2. run():                                   │
│     - Prompt for category selection          │
│     - For each category:                     │
│       - Show available plugins               │
│       - Prompt for plugin selection          │
│       - Configure each selected plugin       │
│                                              │
│  3. _configure_plugin(plugin):               │
│     - Extract schema from plugin             │
│     - Prompt for each property               │
│     - Use defaults from schema               │
│     - Validate with plugin.validate_config() │
│     - Save to connections dict               │
│                                              │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│      ConnectionPluginRegistry                │
├─────────────────────────────────────────────┤
│                                              │
│  - discover_plugins():                       │
│    - Scan src/flowlang/connections/         │
│    - Import each __init__.py                 │
│    - Plugins self-register on import         │
│                                              │
│  - get_all():                                │
│    - Return all registered plugins           │
│                                              │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│          Connection Plugins                  │
├─────────────────────────────────────────────┤
│                                              │
│  class PostgresPlugin(ConnectionPlugin):    │
│      category = "database"  ← Self-categorize│
│                                              │
│      def get_config_schema():                │
│          return {schema}    ← Provide schema │
│                                              │
│  class RedisPlugin(ConnectionPlugin):       │
│      category = "caching"   ← Self-categorize│
│                                              │
│  class CustomPlugin(ConnectionPlugin):      │
│      category = "custom"    ← Any category!  │
│                                              │
└─────────────────────────────────────────────┘
```

## See Also

- [Connection Plugins](/docs/connections.md) - Plugin development guide
- [Database Connections](/docs/tutorial-database-connections.md) - Using databases in flows
- [Project Organization](/README.md#project-based-organization) - Project structure
