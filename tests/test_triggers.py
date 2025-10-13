"""
Unit tests for FlowLang Trigger Framework

Tests cover:
- Trigger base class functionality
- WebhookTrigger configuration and lifecycle
- TriggerManager registration and management
- Authentication mechanisms
- Input mapping strategies
- Sync and async execution modes
"""
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, MagicMock
from fastapi import Request, HTTPException
from fastapi.testclient import TestClient

from src.flowlang.triggers.base import Trigger, TriggerManager
from src.flowlang.triggers.webhook import WebhookTrigger, create_webhook_trigger


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def mock_flow_executor():
    """Mock flow executor that returns success"""
    async def executor(inputs):
        return {
            'success': True,
            'outputs': {'result': 'executed', 'input_echo': inputs}
        }
    return executor


@pytest.fixture
def mock_failing_flow_executor():
    """Mock flow executor that returns failure"""
    async def executor(inputs):
        return {
            'success': False,
            'error': 'Flow execution failed'
        }
    return executor


@pytest.fixture
def basic_webhook_config():
    """Basic webhook configuration"""
    return {
        'path': '/test-webhook',
        'method': 'POST',
        'async': False,
        'input_mapping': 'body'
    }


@pytest.fixture
def webhook_config_with_auth():
    """Webhook configuration with API key authentication"""
    return {
        'path': '/secure-webhook',
        'method': 'POST',
        'async': False,
        'input_mapping': 'body',
        'auth': {
            'type': 'api_key',
            'header': 'X-API-Key',
            'key': 'test-secret-key-12345'
        }
    }


@pytest.fixture
def webhook_config_bearer_auth():
    """Webhook configuration with bearer token authentication"""
    return {
        'path': '/bearer-webhook',
        'method': 'POST',
        'async': True,
        'input_mapping': 'body',
        'auth': {
            'type': 'bearer',
            'key': 'test-bearer-token-12345'
        }
    }


# ============================================================================
# Trigger Base Class Tests
# ============================================================================

class TestTriggerBase:
    """Tests for the base Trigger class functionality via WebhookTrigger"""

    @pytest.mark.asyncio
    async def test_trigger_creation(self, mock_flow_executor):
        """Test basic trigger creation"""
        config = {'path': '/test', 'type': 'webhook'}
        trigger = WebhookTrigger('test-trigger', config, 'TestFlow', mock_flow_executor)

        assert trigger.trigger_id == 'test-trigger'
        assert trigger.flow_name == 'TestFlow'
        assert trigger.flow_executor == mock_flow_executor
        assert trigger.is_running == False

    @pytest.mark.asyncio
    async def test_trigger_lifecycle(self, mock_flow_executor):
        """Test trigger start/stop lifecycle"""
        trigger = WebhookTrigger('test-trigger', {'path': '/test'}, 'TestFlow', mock_flow_executor)

        # Start trigger
        await trigger.start()
        assert trigger.is_running == True

        # Stop trigger
        await trigger.stop()
        assert trigger.is_running == False

    @pytest.mark.asyncio
    async def test_trigger_execute_flow(self, mock_flow_executor):
        """Test trigger can execute flow"""
        trigger = WebhookTrigger('test-trigger', {'path': '/test'}, 'TestFlow', mock_flow_executor)

        inputs = {'test': 'data'}
        result = await trigger.execute_flow(inputs)

        assert result['success'] == True
        assert result['outputs']['result'] == 'executed'
        assert result['outputs']['input_echo'] == inputs

    @pytest.mark.asyncio
    async def test_trigger_execution_metrics(self, mock_flow_executor):
        """Test trigger tracks execution count and timing"""
        trigger = WebhookTrigger('test-trigger', {'path': '/test'}, 'TestFlow', mock_flow_executor)

        # Execute flow multiple times
        await trigger.execute_flow({'test': '1'})
        await trigger.execute_flow({'test': '2'})
        await trigger.execute_flow({'test': '3'})

        status = trigger.get_base_status()
        assert status['executions'] == 3
        assert status['last_execution_time'] is not None

    @pytest.mark.asyncio
    async def test_trigger_handles_flow_errors(self, mock_failing_flow_executor):
        """Test trigger handles flow execution errors gracefully"""
        trigger = WebhookTrigger('test-trigger', {'path': '/test'}, 'TestFlow', mock_failing_flow_executor)

        result = await trigger.execute_flow({'test': 'data'})

        assert result['success'] == False
        assert 'error' in result


# ============================================================================
# WebhookTrigger Tests
# ============================================================================

class TestWebhookTrigger:
    """Tests for WebhookTrigger class"""

    @pytest.mark.asyncio
    async def test_webhook_creation(self, basic_webhook_config, mock_flow_executor):
        """Test webhook trigger creation with basic config"""
        webhook = WebhookTrigger(
            'webhook-1',
            basic_webhook_config,
            'TestFlow',
            mock_flow_executor
        )

        assert webhook.trigger_id == 'webhook-1'
        assert webhook.path == '/test-webhook'
        assert webhook.method == 'POST'
        assert webhook.async_execution == False
        assert webhook.input_mapping == 'body'
        assert webhook.auth_type is None

    @pytest.mark.asyncio
    async def test_webhook_path_normalization(self, mock_flow_executor):
        """Test webhook path is normalized to start with /"""
        config = {'path': 'no-leading-slash', 'method': 'GET'}
        webhook = WebhookTrigger('webhook-1', config, 'TestFlow', mock_flow_executor)

        assert webhook.path == '/no-leading-slash'

    @pytest.mark.asyncio
    async def test_webhook_requires_path(self, mock_flow_executor):
        """Test webhook requires path in config"""
        config = {'method': 'POST'}  # Missing path

        with pytest.raises(ValueError, match="must have a 'path'"):
            WebhookTrigger('webhook-1', config, 'TestFlow', mock_flow_executor)

    @pytest.mark.asyncio
    async def test_webhook_default_method(self, mock_flow_executor):
        """Test webhook defaults to POST method"""
        config = {'path': '/test'}
        webhook = WebhookTrigger('webhook-1', config, 'TestFlow', mock_flow_executor)

        assert webhook.method == 'POST'

    @pytest.mark.asyncio
    async def test_webhook_default_async(self, mock_flow_executor):
        """Test webhook defaults to async execution"""
        config = {'path': '/test'}
        webhook = WebhookTrigger('webhook-1', config, 'TestFlow', mock_flow_executor)

        assert webhook.async_execution == True

    @pytest.mark.asyncio
    async def test_webhook_status(self, basic_webhook_config, mock_flow_executor):
        """Test webhook status includes webhook-specific fields"""
        webhook = WebhookTrigger(
            'webhook-1',
            basic_webhook_config,
            'TestFlow',
            mock_flow_executor
        )
        await webhook.start()

        status = webhook.get_status()

        assert status['type'] == 'webhook'
        assert status['method'] == 'POST'
        assert status['path'] == '/test-webhook'
        assert status['auth_enabled'] == False
        assert status['async_execution'] == False
        assert status['running'] == True  # Changed from is_running

    @pytest.mark.asyncio
    async def test_webhook_with_api_key_auth(self, webhook_config_with_auth, mock_flow_executor):
        """Test webhook with API key authentication"""
        webhook = WebhookTrigger(
            'webhook-1',
            webhook_config_with_auth,
            'TestFlow',
            mock_flow_executor
        )

        assert webhook.auth_type == 'api_key'
        assert webhook.auth_header == 'X-API-Key'
        assert webhook.auth_key == 'test-secret-key-12345'

        status = webhook.get_status()
        assert status['auth_enabled'] == True
        assert status['auth_type'] == 'api_key'

    @pytest.mark.asyncio
    async def test_webhook_with_bearer_auth(self, webhook_config_bearer_auth, mock_flow_executor):
        """Test webhook with bearer token authentication"""
        webhook = WebhookTrigger(
            'webhook-1',
            webhook_config_bearer_auth,
            'TestFlow',
            mock_flow_executor
        )

        assert webhook.auth_type == 'bearer'
        assert webhook.auth_key == 'test-bearer-token-12345'

        status = webhook.get_status()
        assert status['auth_enabled'] == True
        assert status['auth_type'] == 'bearer'

    @pytest.mark.asyncio
    async def test_webhook_factory_function(self, basic_webhook_config, mock_flow_executor):
        """Test create_webhook_trigger factory function"""
        webhook = create_webhook_trigger(
            'webhook-1',
            basic_webhook_config,
            'TestFlow',
            mock_flow_executor
        )

        assert isinstance(webhook, WebhookTrigger)
        assert webhook.trigger_id == 'webhook-1'
        assert webhook.flow_name == 'TestFlow'


class TestWebhookInputMapping:
    """Tests for webhook input mapping strategies"""

    @pytest.mark.asyncio
    async def test_input_mapping_body(self, mock_flow_executor):
        """Test extracting inputs from request body"""
        config = {'path': '/test', 'input_mapping': 'body'}
        webhook = WebhookTrigger('webhook-1', config, 'TestFlow', mock_flow_executor)

        # Mock request with JSON body
        mock_request = Mock(spec=Request)
        mock_request.json = AsyncMock(return_value={'key': 'value', 'num': 42})
        mock_request.method = 'POST'
        mock_request.url.path = '/test'
        mock_request.client.host = '127.0.0.1'

        inputs = await webhook._extract_inputs(mock_request)

        assert inputs['key'] == 'value'
        assert inputs['num'] == 42
        assert '_webhook' in inputs
        assert inputs['_webhook']['method'] == 'POST'

    @pytest.mark.asyncio
    async def test_input_mapping_query(self, mock_flow_executor):
        """Test extracting inputs from query parameters"""
        config = {'path': '/test', 'input_mapping': 'query'}
        webhook = WebhookTrigger('webhook-1', config, 'TestFlow', mock_flow_executor)

        # Mock request with query params
        mock_request = Mock(spec=Request)
        mock_request.query_params = {'param1': 'value1', 'param2': 'value2'}
        mock_request.method = 'GET'
        mock_request.url.path = '/test'
        mock_request.client.host = '127.0.0.1'

        inputs = await webhook._extract_inputs(mock_request)

        assert inputs['param1'] == 'value1'
        assert inputs['param2'] == 'value2'
        assert '_webhook' in inputs

    @pytest.mark.asyncio
    async def test_input_mapping_headers(self, mock_flow_executor):
        """Test extracting inputs from headers"""
        config = {'path': '/test', 'input_mapping': 'headers'}
        webhook = WebhookTrigger('webhook-1', config, 'TestFlow', mock_flow_executor)

        # Mock request with headers
        mock_request = Mock(spec=Request)
        mock_request.headers = {'x-custom-header': 'custom-value', 'user-agent': 'test'}
        mock_request.method = 'POST'
        mock_request.url.path = '/test'
        mock_request.client.host = '127.0.0.1'

        inputs = await webhook._extract_inputs(mock_request)

        assert inputs['x-custom-header'] == 'custom-value'
        assert inputs['user-agent'] == 'test'
        assert '_webhook' in inputs

    @pytest.mark.asyncio
    async def test_input_mapping_all(self, mock_flow_executor):
        """Test extracting inputs from all sources"""
        config = {'path': '/test', 'input_mapping': 'all'}
        webhook = WebhookTrigger('webhook-1', config, 'TestFlow', mock_flow_executor)

        # Mock request with all sources
        mock_request = Mock(spec=Request)
        mock_request.json = AsyncMock(return_value={'body_key': 'body_value'})
        mock_request.query_params = {'query_key': 'query_value'}
        mock_request.headers = {'x-header': 'header_value'}
        mock_request.path_params = {'path_key': 'path_value'}
        mock_request.method = 'POST'
        mock_request.url.path = '/test'
        mock_request.client.host = '127.0.0.1'

        inputs = await webhook._extract_inputs(mock_request)

        assert 'body' in inputs
        assert inputs['body']['body_key'] == 'body_value'
        assert 'query' in inputs
        assert inputs['query']['query_key'] == 'query_value'
        assert 'headers' in inputs
        assert inputs['headers']['x-header'] == 'header_value'
        assert 'path' in inputs
        assert '_webhook' in inputs


class TestWebhookRouter:
    """Tests for webhook FastAPI router creation"""

    @pytest.mark.asyncio
    async def test_create_router(self, basic_webhook_config, mock_flow_executor):
        """Test router creation"""
        webhook = WebhookTrigger(
            'webhook-1',
            basic_webhook_config,
            'TestFlow',
            mock_flow_executor
        )

        router = webhook.create_router()

        assert router is not None
        assert webhook.router == router
        # Check router has tags
        assert 'Webhooks - TestFlow' in router.tags

    @pytest.mark.asyncio
    async def test_router_supports_http_methods(self, mock_flow_executor):
        """Test router supports different HTTP methods"""
        methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

        for method in methods:
            config = {'path': f'/{method.lower()}', 'method': method}
            webhook = WebhookTrigger('webhook-1', config, 'TestFlow', mock_flow_executor)

            # Should not raise error
            router = webhook.create_router()
            assert router is not None

    @pytest.mark.asyncio
    async def test_router_rejects_invalid_method(self, mock_flow_executor):
        """Test router rejects invalid HTTP methods"""
        config = {'path': '/test', 'method': 'INVALID'}
        webhook = WebhookTrigger('webhook-1', config, 'TestFlow', mock_flow_executor)

        with pytest.raises(ValueError, match="Unsupported HTTP method"):
            webhook.create_router()


# ============================================================================
# TriggerManager Tests
# ============================================================================

class TestTriggerManager:
    """Tests for TriggerManager"""

    @pytest.mark.asyncio
    async def test_manager_creation(self):
        """Test trigger manager creation"""
        manager = TriggerManager()

        assert manager.triggers == {}
        assert manager.trigger_factories == {}

    @pytest.mark.asyncio
    async def test_register_trigger_type(self):
        """Test registering a trigger type"""
        from src.flowlang.triggers.webhook import create_webhook_trigger

        manager = TriggerManager()
        manager.register_trigger_type('webhook', create_webhook_trigger)

        assert 'webhook' in manager.trigger_factories
        assert manager.trigger_factories['webhook'] == create_webhook_trigger

    @pytest.mark.asyncio
    async def test_create_trigger(self, mock_flow_executor):
        """Test creating a trigger via TriggerConfig"""
        from src.flowlang.triggers.webhook import create_webhook_trigger
        from src.flowlang.triggers.base import TriggerConfig

        manager = TriggerManager()
        manager.register_trigger_type('webhook', create_webhook_trigger)

        trigger_config = TriggerConfig(
            type='webhook',
            config={'path': '/test-webhook', 'method': 'POST'}
        )

        trigger = manager.create_trigger(trigger_config, 'TestFlow', mock_flow_executor)

        assert trigger is not None
        assert trigger.flow_name == 'TestFlow'
        assert trigger.path == '/test-webhook'
        assert trigger.trigger_id in manager.triggers

    @pytest.mark.asyncio
    async def test_create_trigger_unknown_type(self, mock_flow_executor):
        """Test creating trigger with unknown type returns None"""
        from src.flowlang.triggers.base import TriggerConfig

        manager = TriggerManager()

        trigger_config = TriggerConfig(
            type='unknown',
            config={'path': '/test'}
        )

        trigger = manager.create_trigger(trigger_config, 'TestFlow', mock_flow_executor)

        assert trigger is None

    @pytest.mark.asyncio
    async def test_start_all_triggers(self, mock_flow_executor):
        """Test starting all triggers"""
        from src.flowlang.triggers.webhook import create_webhook_trigger
        from src.flowlang.triggers.base import TriggerConfig

        manager = TriggerManager()
        manager.register_trigger_type('webhook', create_webhook_trigger)

        config1 = TriggerConfig(type='webhook', config={'path': '/webhook1'}, id='webhook-1')
        config2 = TriggerConfig(type='webhook', config={'path': '/webhook2'}, id='webhook-2')

        webhook1 = manager.create_trigger(config1, 'Flow1', mock_flow_executor)
        webhook2 = manager.create_trigger(config2, 'Flow2', mock_flow_executor)

        await manager.start_all()

        assert webhook1.is_running == True
        assert webhook2.is_running == True

    @pytest.mark.asyncio
    async def test_stop_all_triggers(self, mock_flow_executor):
        """Test stopping all triggers"""
        from src.flowlang.triggers.webhook import create_webhook_trigger
        from src.flowlang.triggers.base import TriggerConfig

        manager = TriggerManager()
        manager.register_trigger_type('webhook', create_webhook_trigger)

        config1 = TriggerConfig(type='webhook', config={'path': '/webhook1'}, id='webhook-1')
        config2 = TriggerConfig(type='webhook', config={'path': '/webhook2'}, id='webhook-2')

        webhook1 = manager.create_trigger(config1, 'Flow1', mock_flow_executor)
        webhook2 = manager.create_trigger(config2, 'Flow2', mock_flow_executor)

        await manager.start_all()
        await manager.stop_all()

        assert webhook1.is_running == False
        assert webhook2.is_running == False

    @pytest.mark.asyncio
    async def test_list_triggers(self, mock_flow_executor):
        """Test getting status of all triggers"""
        from src.flowlang.triggers.webhook import create_webhook_trigger
        from src.flowlang.triggers.base import TriggerConfig

        manager = TriggerManager()
        manager.register_trigger_type('webhook', create_webhook_trigger)

        config1 = TriggerConfig(type='webhook', config={'path': '/webhook1'}, id='webhook-1')
        config2 = TriggerConfig(type='webhook', config={'path': '/webhook2'}, id='webhook-2')

        manager.create_trigger(config1, 'Flow1', mock_flow_executor)
        manager.create_trigger(config2, 'Flow2', mock_flow_executor)

        await manager.start_all()

        status_list = manager.list_triggers()

        assert len(status_list) == 2
        assert status_list[0]['id'] in ['webhook-1', 'webhook-2']
        assert status_list[1]['id'] in ['webhook-1', 'webhook-2']

    @pytest.mark.asyncio
    async def test_get_trigger_by_id(self, mock_flow_executor):
        """Test getting specific trigger by ID"""
        from src.flowlang.triggers.webhook import create_webhook_trigger
        from src.flowlang.triggers.base import TriggerConfig

        manager = TriggerManager()
        manager.register_trigger_type('webhook', create_webhook_trigger)

        config = TriggerConfig(type='webhook', config={'path': '/test'}, id='webhook-1')
        created_trigger = manager.create_trigger(config, 'Flow1', mock_flow_executor)

        trigger = manager.get_trigger('webhook-1')

        assert trigger == created_trigger

    @pytest.mark.asyncio
    async def test_get_nonexistent_trigger(self):
        """Test getting non-existent trigger returns None"""
        manager = TriggerManager()

        trigger = manager.get_trigger('nonexistent')

        assert trigger is None


# ============================================================================
# Integration Tests
# ============================================================================

class TestTriggerIntegration:
    """Integration tests for triggers with flow execution"""

    @pytest.mark.asyncio
    async def test_webhook_trigger_executes_flow(self, basic_webhook_config):
        """Test webhook trigger successfully executes flow"""
        # Track if flow was executed
        executed = {'called': False, 'inputs': None}

        async def test_executor(inputs):
            executed['called'] = True
            executed['inputs'] = inputs
            return {'success': True, 'outputs': {'result': 'ok'}}

        webhook = WebhookTrigger(
            'webhook-1',
            basic_webhook_config,
            'TestFlow',
            test_executor
        )

        test_inputs = {'message': 'Hello World'}
        result = await webhook.execute_flow(test_inputs)

        assert executed['called'] == True
        assert executed['inputs'] == test_inputs
        assert result['success'] == True
        assert result['outputs']['result'] == 'ok'

    @pytest.mark.asyncio
    async def test_multiple_triggers_same_manager(self, mock_flow_executor):
        """Test multiple triggers can coexist in same manager"""
        from src.flowlang.triggers.webhook import create_webhook_trigger
        from src.flowlang.triggers.base import TriggerConfig

        manager = TriggerManager()
        manager.register_trigger_type('webhook', create_webhook_trigger)

        config1 = TriggerConfig(
            type='webhook',
            config={'path': '/webhook1', 'method': 'POST'},
            id='webhook-1'
        )

        config2 = TriggerConfig(
            type='webhook',
            config={'path': '/webhook2', 'method': 'GET'},
            id='webhook-2'
        )

        webhook1 = manager.create_trigger(config1, 'Flow1', mock_flow_executor)
        webhook2 = manager.create_trigger(config2, 'Flow2', mock_flow_executor)

        await manager.start_all()

        # Both should be running
        assert webhook1.is_running == True
        assert webhook2.is_running == True

        # Each should track execution independently
        await webhook1.execute_flow({'test': '1'})
        await webhook1.execute_flow({'test': '2'})
        await webhook2.execute_flow({'test': '3'})

        assert webhook1.get_status()['executions'] == 2
        assert webhook2.get_status()['executions'] == 1


# ============================================================================
# ScheduleTrigger Tests
# ============================================================================

class TestScheduleTrigger:
    """Tests for ScheduleTrigger class"""

    @pytest.fixture
    def basic_schedule_config(self):
        """Basic schedule configuration"""
        return {
            'cron': '* * * * *',  # Every minute
            'timezone': 'UTC',
            'max_instances': 1
        }

    @pytest.fixture
    def custom_schedule_config(self):
        """Custom schedule configuration with different timezone"""
        return {
            'cron': '0 */6 * * *',  # Every 6 hours
            'timezone': 'America/New_York',
            'max_instances': 2
        }

    @pytest.mark.asyncio
    async def test_schedule_creation(self, basic_schedule_config, mock_flow_executor):
        """Test schedule trigger creation with basic config"""
        from src.flowlang.triggers.schedule import ScheduleTrigger

        schedule = ScheduleTrigger(
            'schedule-1',
            basic_schedule_config,
            'TestFlow',
            mock_flow_executor
        )

        assert schedule.trigger_id == 'schedule-1'
        assert schedule.cron_expression == '* * * * *'
        assert str(schedule.timezone) == 'UTC'
        assert schedule.max_instances == 1
        assert schedule.running_instances == 0

    @pytest.mark.asyncio
    async def test_schedule_requires_cron(self, mock_flow_executor):
        """Test schedule trigger requires cron expression"""
        from src.flowlang.triggers.schedule import ScheduleTrigger

        config = {'timezone': 'UTC'}  # Missing cron

        with pytest.raises(ValueError, match="must have a 'cron' expression"):
            ScheduleTrigger('schedule-1', config, 'TestFlow', mock_flow_executor)

    @pytest.mark.asyncio
    async def test_schedule_validates_cron(self, mock_flow_executor):
        """Test schedule trigger validates cron expression"""
        from src.flowlang.triggers.schedule import ScheduleTrigger

        config = {'cron': 'invalid cron expression'}

        with pytest.raises(ValueError, match="Invalid cron expression"):
            ScheduleTrigger('schedule-1', config, 'TestFlow', mock_flow_executor)

    @pytest.mark.asyncio
    async def test_schedule_validates_timezone(self, mock_flow_executor):
        """Test schedule trigger validates timezone"""
        from src.flowlang.triggers.schedule import ScheduleTrigger

        config = {'cron': '* * * * *', 'timezone': 'Invalid/Timezone'}

        with pytest.raises(ValueError, match="Unknown timezone"):
            ScheduleTrigger('schedule-1', config, 'TestFlow', mock_flow_executor)

    @pytest.mark.asyncio
    async def test_schedule_default_timezone(self, mock_flow_executor):
        """Test schedule trigger defaults to UTC timezone"""
        from src.flowlang.triggers.schedule import ScheduleTrigger

        config = {'cron': '* * * * *'}  # No timezone specified
        schedule = ScheduleTrigger('schedule-1', config, 'TestFlow', mock_flow_executor)

        assert str(schedule.timezone) == 'UTC'

    @pytest.mark.asyncio
    async def test_schedule_default_max_instances(self, mock_flow_executor):
        """Test schedule trigger defaults to 1 max instance"""
        from src.flowlang.triggers.schedule import ScheduleTrigger

        config = {'cron': '* * * * *'}  # No max_instances specified
        schedule = ScheduleTrigger('schedule-1', config, 'TestFlow', mock_flow_executor)

        assert schedule.max_instances == 1

    @pytest.mark.asyncio
    async def test_schedule_custom_timezone(self, custom_schedule_config, mock_flow_executor):
        """Test schedule trigger with custom timezone"""
        from src.flowlang.triggers.schedule import ScheduleTrigger

        schedule = ScheduleTrigger(
            'schedule-1',
            custom_schedule_config,
            'TestFlow',
            mock_flow_executor
        )

        assert str(schedule.timezone) == 'America/New_York'
        assert schedule.max_instances == 2

    @pytest.mark.asyncio
    async def test_schedule_lifecycle(self, basic_schedule_config, mock_flow_executor):
        """Test schedule trigger start/stop lifecycle"""
        from src.flowlang.triggers.schedule import ScheduleTrigger

        schedule = ScheduleTrigger(
            'schedule-1',
            basic_schedule_config,
            'TestFlow',
            mock_flow_executor
        )

        # Start trigger
        await schedule.start()
        assert schedule.is_running == True
        assert schedule.next_execution is not None
        assert schedule.scheduler_task is not None

        # Stop trigger
        await schedule.stop()
        assert schedule.is_running == False

    @pytest.mark.asyncio
    async def test_schedule_calculates_next_execution(self, basic_schedule_config, mock_flow_executor):
        """Test schedule trigger calculates next execution time"""
        from src.flowlang.triggers.schedule import ScheduleTrigger
        from datetime import datetime

        schedule = ScheduleTrigger(
            'schedule-1',
            basic_schedule_config,
            'TestFlow',
            mock_flow_executor
        )

        await schedule.start()

        # Next execution should be set
        assert schedule.next_execution is not None
        # Next execution should be in the future
        now = datetime.now(schedule.timezone)
        assert schedule.next_execution > now

        await schedule.stop()

    @pytest.mark.asyncio
    async def test_schedule_status(self, basic_schedule_config, mock_flow_executor):
        """Test schedule trigger status includes schedule-specific fields"""
        from src.flowlang.triggers.schedule import ScheduleTrigger

        schedule = ScheduleTrigger(
            'schedule-1',
            basic_schedule_config,
            'TestFlow',
            mock_flow_executor
        )
        await schedule.start()

        status = schedule.get_status()

        assert status['type'] == 'schedule'
        assert status['cron'] == '* * * * *'
        assert status['timezone'] == 'UTC'
        assert status['max_instances'] == 1
        assert status['running_instances'] == 0
        assert status['next_execution'] is not None
        assert status['running'] == True

        await schedule.stop()

    @pytest.mark.asyncio
    async def test_schedule_injects_metadata(self, basic_schedule_config):
        """Test schedule trigger injects schedule metadata into inputs"""
        from src.flowlang.triggers.schedule import ScheduleTrigger

        # Track inputs passed to flow
        captured_inputs = {}

        async def test_executor(inputs):
            captured_inputs.update(inputs)
            return {'success': True, 'outputs': {'result': 'ok'}}

        schedule = ScheduleTrigger(
            'schedule-1',
            basic_schedule_config,
            'TestFlow',
            test_executor
        )

        await schedule.start()

        # Manually trigger execution (without waiting for scheduler)
        await schedule._execute_with_tracking()

        # Check that schedule metadata was injected
        assert '_schedule' in captured_inputs
        assert captured_inputs['_schedule']['trigger_id'] == 'schedule-1'
        assert captured_inputs['_schedule']['cron'] == '* * * * *'
        assert captured_inputs['_schedule']['timezone'] == 'UTC'
        assert 'scheduled_time' in captured_inputs['_schedule']
        assert 'execution_time' in captured_inputs['_schedule']

        await schedule.stop()

    @pytest.mark.asyncio
    async def test_schedule_tracks_running_instances(self, basic_schedule_config, mock_flow_executor):
        """Test schedule trigger tracks running instances"""
        from src.flowlang.triggers.schedule import ScheduleTrigger

        schedule = ScheduleTrigger(
            'schedule-1',
            basic_schedule_config,
            'TestFlow',
            mock_flow_executor
        )

        # Initially no running instances
        assert schedule.running_instances == 0

        # Start execution (it will increment, then decrement when done)
        await schedule._execute_with_tracking()

        # After execution, should be back to 0
        assert schedule.running_instances == 0

    @pytest.mark.asyncio
    async def test_schedule_factory_function(self, basic_schedule_config, mock_flow_executor):
        """Test create_schedule_trigger factory function"""
        from src.flowlang.triggers.schedule import create_schedule_trigger

        schedule = create_schedule_trigger(
            'schedule-1',
            basic_schedule_config,
            'TestFlow',
            mock_flow_executor
        )

        from src.flowlang.triggers.schedule import ScheduleTrigger
        assert isinstance(schedule, ScheduleTrigger)
        assert schedule.trigger_id == 'schedule-1'
        assert schedule.flow_name == 'TestFlow'

    @pytest.mark.asyncio
    async def test_schedule_cron_patterns(self, mock_flow_executor):
        """Test various cron expression patterns are accepted"""
        from src.flowlang.triggers.schedule import ScheduleTrigger

        patterns = [
            '* * * * *',          # Every minute
            '*/5 * * * *',        # Every 5 minutes
            '0 * * * *',          # Every hour
            '0 0 * * *',          # Every day at midnight
            '0 9 * * 1-5',        # 9 AM on weekdays
            '0 0 * * 0',          # Midnight on Sundays
            '0 */6 * * *',        # Every 6 hours
        ]

        for pattern in patterns:
            config = {'cron': pattern}
            schedule = ScheduleTrigger('schedule-1', config, 'TestFlow', mock_flow_executor)
            assert schedule.cron_expression == pattern

    @pytest.mark.asyncio
    async def test_schedule_with_manager(self, basic_schedule_config, mock_flow_executor):
        """Test schedule trigger integration with TriggerManager"""
        from src.flowlang.triggers.schedule import create_schedule_trigger
        from src.flowlang.triggers.base import TriggerConfig

        manager = TriggerManager()
        manager.register_trigger_type('schedule', create_schedule_trigger)

        trigger_config = TriggerConfig(
            type='schedule',
            config=basic_schedule_config,
            id='schedule-1'
        )

        schedule = manager.create_trigger(trigger_config, 'TestFlow', mock_flow_executor)

        assert schedule is not None
        assert schedule.flow_name == 'TestFlow'
        assert schedule.cron_expression == '* * * * *'
        assert schedule.trigger_id in manager.triggers

        await manager.stop_all()


# ============================================================================
# Run Tests
# ============================================================================

if __name__ == '__main__':
    pytest.main([__file__, '-v'])
