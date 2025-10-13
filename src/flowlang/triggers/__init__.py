"""
FlowLang Triggers - Event-Driven Flow Execution

Triggers enable flows to execute automatically in response to events:
- Webhooks: Execute flows via HTTP requests
- Schedules: Execute flows on a cron schedule (future)
- Queues: Execute flows from message queues (future)
"""

from .base import Trigger, TriggerConfig, TriggerManager

__all__ = [
    'Trigger',
    'TriggerConfig',
    'TriggerManager',
]
