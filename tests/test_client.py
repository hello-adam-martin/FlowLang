"""
Unit tests for FlowLang Python Client SDK
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
import httpx
import json

from flowlang.client import (
    FlowLangClient,
    FlowExecutionResult,
    FlowInfo,
    FlowLangError,
    FlowExecutionError,
    FlowNotReadyError,
    FlowNotFoundError
)


@pytest.fixture
def mock_httpx_client():
    """Mock httpx.AsyncClient"""
    with patch('flowlang.client.httpx.AsyncClient') as mock:
        yield mock


@pytest.fixture
def mock_httpx_sync_client():
    """Mock httpx.Client"""
    with patch('flowlang.client.httpx.Client') as mock:
        yield mock


@pytest.fixture
def client():
    """Create a test client"""
    client = FlowLangClient("http://test.example.com")
    yield client
    client.close()


class TestFlowLangClient:
    """Tests for FlowLangClient initialization and configuration"""

    def test_init_default_config(self):
        """Test client initialization with default config"""
        client = FlowLangClient("http://localhost:8000")

        assert client.base_url == "http://localhost:8000"
        assert client.timeout == 30.0
        assert client.retry_attempts == 3
        assert client.retry_delay == 1.0
        assert client.retry_backoff == 2.0

        client.close()

    def test_init_custom_config(self):
        """Test client initialization with custom config"""
        client = FlowLangClient(
            "http://custom:9000",
            timeout=60.0,
            retry_attempts=5,
            retry_delay=2.0,
            retry_backoff=3.0,
            headers={"X-Custom": "value"}
        )

        assert client.base_url == "http://custom:9000"
        assert client.timeout == 60.0
        assert client.retry_attempts == 5
        assert client.retry_delay == 2.0
        assert client.retry_backoff == 3.0
        assert client.headers == {"X-Custom": "value"}

        client.close()

    def test_base_url_trailing_slash(self):
        """Test that trailing slash is removed from base URL"""
        client = FlowLangClient("http://localhost:8000/")
        assert client.base_url == "http://localhost:8000"
        client.close()


class TestAsyncContextManager:
    """Tests for async context manager support"""

    @pytest.mark.asyncio
    async def test_async_context_manager(self):
        """Test async context manager entry and exit"""
        async with FlowLangClient("http://test.com") as client:
            assert client is not None
            assert client.base_url == "http://test.com"

    @pytest.mark.asyncio
    async def test_sync_context_manager(self):
        """Test sync context manager entry and exit"""
        with FlowLangClient("http://test.com") as client:
            assert client is not None
            assert client.base_url == "http://test.com"


class TestExecuteFlow:
    """Tests for execute_flow method"""

    @pytest.mark.asyncio
    async def test_execute_flow_success(self, client):
        """Test successful flow execution"""
        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'success': True,
            'outputs': {'result': 'test_value'},
            'execution_time_ms': 123.45,
            'flow': 'TestFlow'
        }

        client._async_client.request = AsyncMock(return_value=mock_response)

        result = await client.execute_flow("TestFlow", {"input": "test"})

        assert isinstance(result, FlowExecutionResult)
        assert result.success is True
        assert result.outputs == {'result': 'test_value'}
        assert result.execution_time_ms == 123.45
        assert result.flow == 'TestFlow'

    @pytest.mark.asyncio
    async def test_execute_flow_not_found(self, client):
        """Test flow not found error"""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.json.return_value = {'error': 'Flow not found'}

        client._async_client.request = AsyncMock(return_value=mock_response)

        with pytest.raises(FlowNotFoundError, match="Flow not found"):
            await client.execute_flow("NonExistent", {})

    @pytest.mark.asyncio
    async def test_execute_flow_not_ready(self, client):
        """Test flow not ready error"""
        mock_response = Mock()
        mock_response.status_code = 503
        mock_response.json.return_value = {
            'success': False,
            'error': 'Flow not ready',
            'pending_tasks': ['Task1', 'Task2'],
            'implementation_progress': '3/5 (60%)'
        }

        client._async_client.request = AsyncMock(return_value=mock_response)

        with pytest.raises(FlowNotReadyError) as exc_info:
            await client.execute_flow("TestFlow", {})

        assert exc_info.value.pending_tasks == ['Task1', 'Task2']
        assert exc_info.value.progress == '3/5 (60%)'

    @pytest.mark.asyncio
    async def test_execute_flow_execution_error(self, client):
        """Test flow execution error"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'success': False,
            'error': 'Execution failed',
            'error_details': 'Task xyz failed',
            'flow': 'TestFlow'
        }

        client._async_client.request = AsyncMock(return_value=mock_response)

        with pytest.raises(FlowExecutionError, match="Execution failed"):
            await client.execute_flow("TestFlow", {})

    @pytest.mark.asyncio
    async def test_execute_flow_empty_inputs(self, client):
        """Test flow execution with empty inputs"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'success': True,
            'outputs': {},
            'flow': 'TestFlow'
        }

        client._async_client.request = AsyncMock(return_value=mock_response)

        # Test with None
        result = await client.execute_flow("TestFlow", None)
        assert result.success is True

        # Test with empty dict
        result = await client.execute_flow("TestFlow", {})
        assert result.success is True


class TestExecuteFlowSync:
    """Tests for execute_flow_sync method"""

    def test_execute_flow_sync_success(self, client):
        """Test successful sync flow execution"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'success': True,
            'outputs': {'result': 'sync_test'},
            'execution_time_ms': 100.0,
            'flow': 'TestFlow'
        }

        client._sync_client.request = Mock(return_value=mock_response)

        result = client.execute_flow_sync("TestFlow", {"input": "test"})

        assert result.success is True
        assert result.outputs == {'result': 'sync_test'}


class TestRetryLogic:
    """Tests for retry logic"""

    @pytest.mark.asyncio
    async def test_retry_on_500_error(self, client):
        """Test retry on 500 error"""
        # First call fails with 500, second succeeds
        fail_response = Mock()
        fail_response.status_code = 500

        success_response = Mock()
        success_response.status_code = 200
        success_response.json.return_value = {
            'success': True,
            'outputs': {},
            'flow': 'TestFlow'
        }

        client._async_client.request = AsyncMock(
            side_effect=[fail_response, success_response]
        )

        # Should succeed after retry
        result = await client.execute_flow("TestFlow", {})
        assert result.success is True

    @pytest.mark.asyncio
    async def test_retry_on_429_rate_limit(self, client):
        """Test retry on 429 rate limit"""
        fail_response = Mock()
        fail_response.status_code = 429

        success_response = Mock()
        success_response.status_code = 200
        success_response.json.return_value = {
            'success': True,
            'outputs': {},
            'flow': 'TestFlow'
        }

        client._async_client.request = AsyncMock(
            side_effect=[fail_response, success_response]
        )

        result = await client.execute_flow("TestFlow", {})
        assert result.success is True

    @pytest.mark.asyncio
    async def test_no_retry_on_400_error(self, client):
        """Test no retry on 400 client error"""
        fail_response = Mock()
        fail_response.status_code = 400
        fail_response.json.return_value = {'error': 'Bad request'}

        client._async_client.request = AsyncMock(return_value=fail_response)

        # Should fail immediately without retry
        with pytest.raises(Exception):
            await client.execute_flow("TestFlow", {})

        # Should only be called once (no retries)
        assert client._async_client.request.call_count == 1

    @pytest.mark.asyncio
    async def test_retry_exhaustion(self, client):
        """Test failure after exhausting retries"""
        client.retry_attempts = 3

        # Always fail with network error
        client._async_client.request = AsyncMock(
            side_effect=httpx.RequestError("Connection failed")
        )

        with pytest.raises(FlowLangError, match="Request failed after 3 attempts"):
            await client.execute_flow("TestFlow", {})

        # Should be called retry_attempts times
        assert client._async_client.request.call_count == 3


class TestStreamExecution:
    """Tests for execute_flow_stream method"""

    @pytest.mark.asyncio
    async def test_execute_flow_stream_success(self, client):
        """Test successful streaming execution"""
        # Mock SSE stream
        stream_data = [
            "event: flow_started\ndata: {\"flow\": \"TestFlow\"}\n\n",
            "event: step_started\ndata: {\"step_id\": \"step1\", \"task\": \"Task1\"}\n\n",
            "event: step_completed\ndata: {\"step_id\": \"step1\", \"duration_ms\": 10}\n\n",
            "event: flow_completed\ndata: {\"success\": true, \"outputs\": {\"result\": \"done\"}, \"duration_ms\": 100}\n\n"
        ]

        async def aiter_lines():
            for line in stream_data:
                for l in line.split('\n'):
                    yield l

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.aiter_lines = aiter_lines

        mock_stream = AsyncMock()
        mock_stream.__aenter__.return_value = mock_response
        mock_stream.__aexit__.return_value = None

        client._async_client.stream = Mock(return_value=mock_stream)

        # Track events
        events = []

        def on_event(event_type, data):
            events.append((event_type, data))

        result = await client.execute_flow_stream("TestFlow", {}, on_event=on_event)

        assert result.success is True
        assert result.outputs == {'result': 'done'}
        assert len(events) == 4

    @pytest.mark.asyncio
    async def test_execute_flow_stream_not_found(self, client):
        """Test streaming with flow not found"""
        mock_response = Mock()
        mock_response.status_code = 404

        mock_stream = AsyncMock()
        mock_stream.__aenter__.return_value = mock_response

        client._async_client.stream = Mock(return_value=mock_stream)

        with pytest.raises(FlowNotFoundError):
            await client.execute_flow_stream("NonExistent", {})


class TestListFlows:
    """Tests for list_flows method"""

    @pytest.mark.asyncio
    async def test_list_flows_success(self, client):
        """Test listing flows"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.raise_for_status = Mock()
        mock_response.json.return_value = [
            {
                'name': 'Flow1',
                'description': 'First flow',
                'inputs': [{'name': 'input1', 'type': 'string'}],
                'outputs': [{'name': 'output1'}]
            },
            {
                'name': 'Flow2',
                'description': 'Second flow',
                'inputs': [],
                'outputs': []
            }
        ]

        client._async_client.request = AsyncMock(return_value=mock_response)

        flows = await client.list_flows()

        assert len(flows) == 2
        assert isinstance(flows[0], FlowInfo)
        assert flows[0].name == 'Flow1'
        assert flows[0].description == 'First flow'
        assert flows[1].name == 'Flow2'


class TestGetFlowInfo:
    """Tests for get_flow_info method"""

    @pytest.mark.asyncio
    async def test_get_flow_info_success(self, client):
        """Test getting flow info"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.raise_for_status = Mock()
        mock_response.json.return_value = {
            'name': 'TestFlow',
            'description': 'Test flow',
            'inputs': [{'name': 'input1', 'type': 'string'}],
            'outputs': [{'name': 'output1'}]
        }

        client._async_client.request = AsyncMock(return_value=mock_response)

        flow_info = await client.get_flow_info("TestFlow")

        assert isinstance(flow_info, FlowInfo)
        assert flow_info.name == 'TestFlow'
        assert flow_info.description == 'Test flow'

    @pytest.mark.asyncio
    async def test_get_flow_info_not_found(self, client):
        """Test getting info for non-existent flow"""
        mock_response = Mock()
        mock_response.status_code = 404

        client._async_client.request = AsyncMock(return_value=mock_response)

        with pytest.raises(FlowNotFoundError):
            await client.get_flow_info("NonExistent")


class TestHealthCheck:
    """Tests for health_check method"""

    @pytest.mark.asyncio
    async def test_health_check_success(self, client):
        """Test health check"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.raise_for_status = Mock()
        mock_response.json.return_value = {
            'status': 'healthy',
            'ready': True,
            'tasks_implemented': 10,
            'tasks_total': 10
        }

        client._async_client.request = AsyncMock(return_value=mock_response)

        health = await client.health_check()

        assert health['status'] == 'healthy'
        assert health['ready'] is True

    @pytest.mark.asyncio
    async def test_health_check_not_ready(self, client):
        """Test health check when not ready"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.raise_for_status = Mock()
        mock_response.json.return_value = {
            'status': 'healthy',
            'ready': False,
            'tasks_implemented': 5,
            'tasks_total': 10,
            'tasks_pending': 5
        }

        client._async_client.request = AsyncMock(return_value=mock_response)

        health = await client.health_check()

        assert health['ready'] is False
        assert health['tasks_pending'] == 5


class TestFlowExecutionResult:
    """Tests for FlowExecutionResult class"""

    def test_success_result(self):
        """Test success result"""
        result = FlowExecutionResult(
            success=True,
            outputs={'result': 'value'},
            execution_time_ms=100.0,
            flow='TestFlow'
        )

        assert result.success is True
        assert result.outputs == {'result': 'value'}
        assert result.error is None

    def test_failure_result(self):
        """Test failure result"""
        result = FlowExecutionResult(
            success=False,
            error='Test error',
            error_details='Detailed error info',
            flow='TestFlow'
        )

        assert result.success is False
        assert result.error == 'Test error'
        assert result.error_details == 'Detailed error info'
        assert result.outputs == {}


class TestFlowInfo:
    """Tests for FlowInfo class"""

    def test_flow_info_creation(self):
        """Test FlowInfo creation"""
        flow_info = FlowInfo(
            name='TestFlow',
            description='Test description',
            inputs=[{'name': 'input1', 'type': 'string'}],
            outputs=[{'name': 'output1'}]
        )

        assert flow_info.name == 'TestFlow'
        assert flow_info.description == 'Test description'
        assert len(flow_info.inputs) == 1
        assert len(flow_info.outputs) == 1


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
