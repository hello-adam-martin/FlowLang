"""
Schedule Trigger - Execute flows on a cron schedule

Enables flows to be executed automatically based on time schedules with support for:
- Cron expression parsing (5-field format)
- Timezone support
- Next execution calculation
- Execution history tracking
- Overlap prevention
"""

from typing import Dict, Any, Optional, Callable, Awaitable
import logging
import asyncio
from datetime import datetime, timedelta
from croniter import croniter
import pytz

from .base import Trigger

logger = logging.getLogger(__name__)


class ScheduleTrigger(Trigger):
    """
    Schedule trigger that executes flows based on cron expressions.

    Configuration format in flow.yaml:
    ```yaml
    triggers:
      - type: schedule
        cron: "0 * * * *"           # Cron expression (required)
        timezone: UTC                # Timezone (default: UTC)
        max_instances: 1             # Max concurrent executions (default: 1)
        enabled: true                # Whether trigger is enabled (default: true)
    ```

    Cron expression format (5 fields):
    - Minute (0-59)
    - Hour (0-23)
    - Day of month (1-31)
    - Month (1-12)
    - Day of week (0-6, Sunday=0)

    Examples:
    - "0 * * * *" - Every hour
    - "*/5 * * * *" - Every 5 minutes
    - "0 9 * * 1-5" - 9 AM on weekdays
    - "0 0 * * 0" - Midnight on Sundays
    """

    def __init__(
        self,
        trigger_id: str,
        config: Dict[str, Any],
        flow_name: str,
        flow_executor: Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]
    ):
        """
        Initialize schedule trigger.

        Args:
            trigger_id: Unique trigger identifier
            config: Schedule configuration (cron, timezone, etc.)
            flow_name: Name of the flow to execute
            flow_executor: Async function to execute the flow
        """
        super().__init__(trigger_id, config, flow_name, flow_executor)

        # Extract cron expression
        self.cron_expression = config.get('cron')
        if not self.cron_expression:
            raise ValueError(f"Schedule trigger {trigger_id} must have a 'cron' expression")

        # Validate cron expression
        try:
            croniter(self.cron_expression)
        except Exception as e:
            raise ValueError(f"Invalid cron expression '{self.cron_expression}': {e}")

        # Extract timezone
        timezone_str = config.get('timezone', 'UTC')
        try:
            self.timezone = pytz.timezone(timezone_str)
        except pytz.exceptions.UnknownTimeZoneError:
            raise ValueError(f"Unknown timezone: {timezone_str}")

        # Max concurrent instances (prevent overlap)
        self.max_instances = config.get('max_instances', 1)
        self.running_instances = 0

        # Scheduling state
        self.scheduler_task: Optional[asyncio.Task] = None
        self.next_execution: Optional[datetime] = None
        self.last_scheduled_time: Optional[datetime] = None

    async def start(self):
        """Start the schedule trigger"""
        self.is_running = True

        # Calculate initial next execution
        self._calculate_next_execution()

        # Start scheduler task
        self.scheduler_task = asyncio.create_task(self._scheduler_loop())

        logger.info(
            f"Schedule trigger {self.trigger_id} started: {self.cron_expression} "
            f"(timezone: {self.timezone}, next: {self.next_execution})"
        )

    async def stop(self):
        """Stop the schedule trigger"""
        self.is_running = False

        # Cancel scheduler task
        if self.scheduler_task and not self.scheduler_task.done():
            self.scheduler_task.cancel()
            try:
                await self.scheduler_task
            except asyncio.CancelledError:
                pass

        logger.info(f"Schedule trigger {self.trigger_id} stopped")

    def get_status(self) -> Dict[str, Any]:
        """Get schedule trigger status"""
        status = self.get_base_status()
        status.update({
            'type': 'schedule',
            'cron': self.cron_expression,
            'timezone': str(self.timezone),
            'next_execution': self.next_execution.isoformat() if self.next_execution else None,
            'last_scheduled': self.last_scheduled_time.isoformat() if self.last_scheduled_time else None,
            'max_instances': self.max_instances,
            'running_instances': self.running_instances
        })
        return status

    def _calculate_next_execution(self):
        """Calculate next execution time based on cron expression"""
        now = datetime.now(self.timezone)
        cron = croniter(self.cron_expression, now)
        self.next_execution = cron.get_next(datetime)
        logger.debug(f"Schedule trigger {self.trigger_id}: next execution at {self.next_execution}")

    async def _scheduler_loop(self):
        """Main scheduler loop that checks for execution times"""
        try:
            while self.is_running:
                now = datetime.now(self.timezone)

                # Check if it's time to execute
                if self.next_execution and now >= self.next_execution:
                    # Check if we can execute (max instances check)
                    if self.running_instances < self.max_instances:
                        logger.info(
                            f"Schedule trigger {self.trigger_id} executing flow {self.flow_name} "
                            f"(scheduled: {self.next_execution})"
                        )

                        # Record scheduled time
                        self.last_scheduled_time = self.next_execution

                        # Execute flow in background
                        asyncio.create_task(self._execute_with_tracking())

                        # Calculate next execution
                        self._calculate_next_execution()
                    else:
                        logger.warning(
                            f"Schedule trigger {self.trigger_id} skipping execution: "
                            f"max instances ({self.max_instances}) reached"
                        )

                        # Still calculate next execution to avoid getting stuck
                        self._calculate_next_execution()

                # Sleep until next check
                # Check every second for simplicity (can be optimized)
                await asyncio.sleep(1)

        except asyncio.CancelledError:
            logger.debug(f"Schedule trigger {self.trigger_id} scheduler loop cancelled")
            raise
        except Exception as e:
            logger.exception(f"Schedule trigger {self.trigger_id} scheduler loop error: {e}")

    async def _execute_with_tracking(self):
        """Execute flow with instance tracking"""
        self.running_instances += 1

        try:
            # Prepare inputs with schedule metadata
            inputs = {
                '_schedule': {
                    'trigger_id': self.trigger_id,
                    'cron': self.cron_expression,
                    'scheduled_time': self.last_scheduled_time.isoformat() if self.last_scheduled_time else None,
                    'execution_time': datetime.now(self.timezone).isoformat(),
                    'timezone': str(self.timezone)
                }
            }

            # Execute flow
            await self.execute_flow(inputs)

        finally:
            self.running_instances -= 1


def create_schedule_trigger(
    trigger_id: str,
    config: Dict[str, Any],
    flow_name: str,
    flow_executor: Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]
) -> ScheduleTrigger:
    """
    Factory function to create a ScheduleTrigger instance.

    Args:
        trigger_id: Unique trigger identifier
        config: Schedule configuration
        flow_name: Name of the flow to execute
        flow_executor: Async function to execute the flow

    Returns:
        ScheduleTrigger instance
    """
    return ScheduleTrigger(trigger_id, config, flow_name, flow_executor)
