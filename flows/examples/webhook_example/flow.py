"""
WebhookExample Flow - Task Implementations
"""
from flowlang import TaskRegistry
from datetime import datetime


def create_task_registry():
    """
    Create and configure the task registry for this flow.
    """
    registry = TaskRegistry()

    @registry.register('ProcessMessage', description='Process incoming webhook message')
    async def process_message(message: str):
        """
        Process the incoming message from the webhook.

        Args:
            message: The message to process

        Returns:
            Dictionary with processed_message and timestamp
        """
        processed = f"Processed: {message.upper()}"
        timestamp = datetime.utcnow().isoformat()

        return {
            'processed_message': processed,
            'timestamp': timestamp
        }

    return registry
