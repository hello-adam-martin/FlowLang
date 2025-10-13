"""
Base classes and manager for FlowLang triggers.

Triggers enable flows to be executed automatically in response to events:
- Webhooks: HTTP requests
- Schedules: Cron-based timing
- Queues: Messages from message brokers
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Callable, Awaitable, List
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class TriggerConfig:
    """
    Configuration for a trigger.

    Attributes:
        type: Trigger type (webhook, schedule, queue, etc.)
        config: Type-specific configuration dictionary
        enabled: Whether the trigger is enabled
        id: Optional unique identifier for the trigger
    """
    type: str
    config: Dict[str, Any]
    enabled: bool = True
    id: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TriggerConfig':
        """Create TriggerConfig from dictionary (from flow YAML)"""
        trigger_type = data.get('type')
        if not trigger_type:
            raise ValueError("Trigger must have a 'type' field")

        # Extract config (all fields except 'type', 'enabled', 'id')
        config = {k: v for k, v in data.items() if k not in ('type', 'enabled', 'id')}

        return cls(
            type=trigger_type,
            config=config,
            enabled=data.get('enabled', True),
            id=data.get('id')
        )


class Trigger(ABC):
    """
    Abstract base class for all triggers.

    A trigger is responsible for detecting events and executing flows in response.
    """

    def __init__(
        self,
        trigger_id: str,
        config: Dict[str, Any],
        flow_name: str,
        flow_executor: Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]
    ):
        """
        Initialize a trigger.

        Args:
            trigger_id: Unique identifier for this trigger instance
            config: Trigger-specific configuration
            flow_name: Name of the flow this trigger will execute
            flow_executor: Async function to execute the flow with inputs
        """
        self.trigger_id = trigger_id
        self.config = config
        self.flow_name = flow_name
        self.flow_executor = flow_executor
        self.is_running = False
        self.execution_count = 0
        self.error_count = 0
        self.last_execution_time: Optional[float] = None
        self.last_error: Optional[str] = None

    @abstractmethod
    async def start(self):
        """
        Start the trigger.

        Called when the server starts up. Should set up any necessary
        resources (listeners, connections, etc.).
        """
        pass

    @abstractmethod
    async def stop(self):
        """
        Stop the trigger and clean up resources.

        Called when the server shuts down.
        """
        pass

    @abstractmethod
    def get_status(self) -> Dict[str, Any]:
        """
        Get the current status of the trigger.

        Returns:
            Dictionary with trigger status information
        """
        pass

    async def execute_flow(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the associated flow with the given inputs.

        Args:
            inputs: Input parameters for the flow

        Returns:
            Flow execution result
        """
        import time

        start_time = time.time()

        try:
            logger.info(f"Trigger {self.trigger_id} executing flow {self.flow_name}")
            result = await self.flow_executor(inputs)

            self.execution_count += 1
            self.last_execution_time = time.time() - start_time

            if not result.get('success'):
                self.error_count += 1
                self.last_error = result.get('error', 'Unknown error')
                logger.error(f"Trigger {self.trigger_id} flow execution failed: {self.last_error}")
            else:
                logger.info(f"Trigger {self.trigger_id} flow executed successfully in {self.last_execution_time:.2f}s")

            return result

        except Exception as e:
            self.error_count += 1
            self.last_error = str(e)
            self.last_execution_time = time.time() - start_time
            logger.exception(f"Trigger {self.trigger_id} flow execution error: {e}")

            return {
                'success': False,
                'error': str(e),
                'flow': self.flow_name
            }

    def get_base_status(self) -> Dict[str, Any]:
        """Get base status info common to all triggers"""
        return {
            'id': self.trigger_id,
            'flow': self.flow_name,
            'running': self.is_running,
            'executions': self.execution_count,
            'errors': self.error_count,
            'last_execution_time': self.last_execution_time,
            'last_error': self.last_error
        }


class TriggerManager:
    """
    Manages multiple triggers for a flow or server.

    Responsible for:
    - Creating triggers from configuration
    - Starting/stopping all triggers
    - Tracking trigger status
    """

    def __init__(self):
        """Initialize the trigger manager"""
        self.triggers: Dict[str, Trigger] = {}
        self.trigger_factories: Dict[str, Callable] = {}

    def register_trigger_type(
        self,
        trigger_type: str,
        factory: Callable[[str, Dict[str, Any], str, Callable], Trigger]
    ):
        """
        Register a trigger type with its factory function.

        Args:
            trigger_type: Type identifier (e.g., 'webhook', 'schedule')
            factory: Factory function that creates trigger instances
        """
        self.trigger_factories[trigger_type] = factory
        logger.debug(f"Registered trigger type: {trigger_type}")

    def create_trigger(
        self,
        trigger_config: TriggerConfig,
        flow_name: str,
        flow_executor: Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]
    ) -> Optional[Trigger]:
        """
        Create a trigger from configuration.

        Args:
            trigger_config: Trigger configuration
            flow_name: Name of the flow to execute
            flow_executor: Async function to execute the flow

        Returns:
            Trigger instance or None if type not supported
        """
        trigger_type = trigger_config.type

        if trigger_type not in self.trigger_factories:
            logger.warning(f"Unknown trigger type: {trigger_type}")
            return None

        # Generate trigger ID if not provided
        trigger_id = trigger_config.id or f"{flow_name}_{trigger_type}_{len(self.triggers)}"

        try:
            factory = self.trigger_factories[trigger_type]
            trigger = factory(
                trigger_id,
                trigger_config.config,
                flow_name,
                flow_executor
            )

            self.triggers[trigger_id] = trigger
            logger.info(f"Created trigger: {trigger_id} ({trigger_type}) for flow {flow_name}")

            return trigger

        except Exception as e:
            logger.exception(f"Failed to create trigger {trigger_id}: {e}")
            return None

    async def start_all(self):
        """Start all registered triggers"""
        logger.info(f"Starting {len(self.triggers)} triggers")

        for trigger_id, trigger in self.triggers.items():
            try:
                await trigger.start()
                logger.info(f"Started trigger: {trigger_id}")
            except Exception as e:
                logger.exception(f"Failed to start trigger {trigger_id}: {e}")

    async def stop_all(self):
        """Stop all triggers and clean up resources"""
        logger.info(f"Stopping {len(self.triggers)} triggers")

        for trigger_id, trigger in self.triggers.items():
            try:
                await trigger.stop()
                logger.info(f"Stopped trigger: {trigger_id}")
            except Exception as e:
                logger.exception(f"Failed to stop trigger {trigger_id}: {e}")

    def get_trigger(self, trigger_id: str) -> Optional[Trigger]:
        """Get a trigger by ID"""
        return self.triggers.get(trigger_id)

    def list_triggers(self) -> List[Dict[str, Any]]:
        """Get status of all triggers"""
        return [trigger.get_status() for trigger in self.triggers.values()]

    def get_triggers_for_flow(self, flow_name: str) -> List[Trigger]:
        """Get all triggers for a specific flow"""
        return [
            trigger for trigger in self.triggers.values()
            if trigger.flow_name == flow_name
        ]
