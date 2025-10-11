"""
Airtable Connection Plugin

Provides Airtable API connectivity for FlowLang flows.

Usage in flow.yaml:
    connections:
      airtable:
        type: airtable
        api_key: ${env.AIRTABLE_API_KEY}
        base_id: ${env.AIRTABLE_BASE_ID}

    steps:
      # Metadata discovery
      - airtable_list_bases:
          id: list_bases
          connection: airtable
          outputs:
            - bases

      # CRUD operations
      - airtable_list:
          id: fetch_records
          connection: airtable
          table: Contacts
          filter_by_formula: "{Active} = 1"
          outputs:
            - records

For more examples, run:
    flowlang connection example airtable
"""
from .provider import AirtablePlugin
from .. import plugin_registry

# Auto-register plugin
plugin_registry.register(AirtablePlugin())

# Exports
__all__ = ['AirtablePlugin']
