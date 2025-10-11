"""
FlowLang Python Client SDK

Type-safe client for calling FlowLang flows via REST API.
Supports both sync and async execution with automatic retry logic.
"""

import asyncio
import time
from typing import Dict, Any, Optional, List, Callable
from urllib.parse import urljoin
import json

try:
    import httpx
except ImportError:
    raise ImportError(
        "httpx is required for the FlowLang client. Install it with: pip install httpx"
    )


class FlowLangError(Exception):
    """Base exception for FlowLang client errors"""
    pass


class FlowExecutionError(FlowLangError):
    """Raised when a flow execution fails"""
    def __init__(self, message: str, error_details: Optional[str] = None, flow: Optional[str] = None):
        super().__init__(message)
        self.error_details = error_details
        self.flow = flow


class FlowNotReadyError(FlowLangError):
    """Raised when a flow is not ready for execution (tasks not implemented)"""
    def __init__(
        self,
        message: str,
        pending_tasks: Optional[List[str]] = None,
        progress: Optional[str] = None
    ):
        super().__init__(message)
        self.pending_tasks = pending_tasks or []
        self.progress = progress


class FlowNotFoundError(FlowLangError):
    """Raised when a flow is not found"""
    pass


class FlowExecutionResult:
    """Result of a flow execution"""

    def __init__(
        self,
        success: bool,
        outputs: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        error_details: Optional[str] = None,
        execution_time_ms: Optional[float] = None,
        flow: Optional[str] = None
    ):
        self.success = success
        self.outputs = outputs or {}
        self.error = error
        self.error_details = error_details
        self.execution_time_ms = execution_time_ms
        self.flow = flow

    def __repr__(self):
        if self.success:
            return f"<FlowExecutionResult success=True outputs={self.outputs}>"
        else:
            return f"<FlowExecutionResult success=False error={self.error}>"


class FlowInfo:
    """Information about a flow"""

    def __init__(self, name: str, description: Optional[str] = None, inputs: Optional[List[Dict]] = None, outputs: Optional[List[Dict]] = None):
        self.name = name
        self.description = description
        self.inputs = inputs or []
        self.outputs = outputs or []

    def __repr__(self):
        return f"<FlowInfo name={self.name} inputs={len(self.inputs)} outputs={len(self.outputs)}>"


class FlowLangClient:
    """
    FlowLang Python Client

    Type-safe client for calling FlowLang flows via REST API.

    Example usage:
        # Async usage
        async with FlowLangClient("http://localhost:8000") as client:
            result = await client.execute_flow("HelloWorld", {"user_name": "Alice"})
            print(result.outputs["message"])

        # Sync usage
        client = FlowLangClient("http://localhost:8000")
        result = client.execute_flow_sync("HelloWorld", {"user_name": "Alice"})
        print(result.outputs["message"])
        client.close()
    """

    def __init__(
        self,
        base_url: str,
        timeout: float = 30.0,
        retry_attempts: int = 3,
        retry_delay: float = 1.0,
        retry_backoff: float = 2.0,
        headers: Optional[Dict[str, str]] = None
    ):
        """
        Initialize the FlowLang client.

        Args:
            base_url: Base URL of the FlowLang API server (e.g., "http://localhost:8000")
            timeout: Request timeout in seconds (default: 30.0)
            retry_attempts: Number of retry attempts for failed requests (default: 3)
            retry_delay: Initial delay between retries in seconds (default: 1.0)
            retry_backoff: Backoff multiplier for retry delays (default: 2.0)
            headers: Optional additional headers to send with requests
        """
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.retry_attempts = retry_attempts
        self.retry_delay = retry_delay
        self.retry_backoff = retry_backoff
        self.headers = headers or {}

        # Create async and sync clients
        self._async_client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            headers=self.headers
        )
        self._sync_client = httpx.Client(
            base_url=self.base_url,
            timeout=self.timeout,
            headers=self.headers
        )

    async def __aenter__(self):
        """Async context manager entry"""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close_async()

    def __enter__(self):
        """Sync context manager entry"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Sync context manager exit"""
        self.close()

    async def close_async(self):
        """Close the async HTTP client"""
        await self._async_client.aclose()

    def close(self):
        """Close the sync HTTP client"""
        self._sync_client.close()

    async def _request_with_retry(
        self,
        method: str,
        path: str,
        **kwargs
    ) -> httpx.Response:
        """Make an HTTP request with retry logic (async)"""
        last_error = None
        delay = self.retry_delay

        for attempt in range(self.retry_attempts):
            try:
                response = await self._async_client.request(method, path, **kwargs)

                # Don't retry on client errors (4xx) except 429 (rate limit)
                if 400 <= response.status_code < 500 and response.status_code != 429:
                    return response

                # Retry on server errors (5xx) and rate limits (429)
                if response.status_code >= 500 or response.status_code == 429:
                    if attempt < self.retry_attempts - 1:
                        await asyncio.sleep(delay)
                        delay *= self.retry_backoff
                        continue

                return response

            except (httpx.RequestError, httpx.TimeoutException) as e:
                last_error = e
                if attempt < self.retry_attempts - 1:
                    await asyncio.sleep(delay)
                    delay *= self.retry_backoff
                    continue
                raise FlowLangError(f"Request failed after {self.retry_attempts} attempts: {str(e)}")

        raise FlowLangError(f"Request failed after {self.retry_attempts} attempts: {str(last_error)}")

    def _request_with_retry_sync(
        self,
        method: str,
        path: str,
        **kwargs
    ) -> httpx.Response:
        """Make an HTTP request with retry logic (sync)"""
        last_error = None
        delay = self.retry_delay

        for attempt in range(self.retry_attempts):
            try:
                response = self._sync_client.request(method, path, **kwargs)

                # Don't retry on client errors (4xx) except 429 (rate limit)
                if 400 <= response.status_code < 500 and response.status_code != 429:
                    return response

                # Retry on server errors (5xx) and rate limits (429)
                if response.status_code >= 500 or response.status_code == 429:
                    if attempt < self.retry_attempts - 1:
                        time.sleep(delay)
                        delay *= self.retry_backoff
                        continue

                return response

            except (httpx.RequestError, httpx.TimeoutException) as e:
                last_error = e
                if attempt < self.retry_attempts - 1:
                    time.sleep(delay)
                    delay *= self.retry_backoff
                    continue
                raise FlowLangError(f"Request failed after {self.retry_attempts} attempts: {str(e)}")

        raise FlowLangError(f"Request failed after {self.retry_attempts} attempts: {str(last_error)}")

    async def execute_flow(
        self,
        flow_name: str,
        inputs: Optional[Dict[str, Any]] = None
    ) -> FlowExecutionResult:
        """
        Execute a flow asynchronously.

        Args:
            flow_name: Name of the flow to execute
            inputs: Input parameters for the flow (default: empty dict)

        Returns:
            FlowExecutionResult with outputs or error information

        Raises:
            FlowNotFoundError: If the flow doesn't exist
            FlowNotReadyError: If the flow has unimplemented tasks
            FlowExecutionError: If the flow execution fails
            FlowLangError: For other client errors
        """
        inputs = inputs or {}

        try:
            response = await self._request_with_retry(
                "POST",
                f"/flows/{flow_name}/execute",
                json={"inputs": inputs}
            )

            if response.status_code == 404:
                raise FlowNotFoundError(f"Flow not found: {flow_name}")

            data = response.json()

            # Handle 503 Service Unavailable (flow not ready)
            if response.status_code == 503:
                raise FlowNotReadyError(
                    data.get('error', 'Flow not ready'),
                    pending_tasks=data.get('pending_tasks', []),
                    progress=data.get('implementation_progress')
                )

            result = FlowExecutionResult(
                success=data.get('success', False),
                outputs=data.get('outputs'),
                error=data.get('error'),
                error_details=data.get('error_details'),
                execution_time_ms=data.get('execution_time_ms'),
                flow=data.get('flow', flow_name)
            )

            # Raise exception if execution failed
            if not result.success:
                raise FlowExecutionError(
                    result.error or "Flow execution failed",
                    error_details=result.error_details,
                    flow=result.flow
                )

            return result

        except httpx.HTTPStatusError as e:
            raise FlowLangError(f"HTTP error: {e.response.status_code}")
        except json.JSONDecodeError as e:
            raise FlowLangError(f"Invalid JSON response: {str(e)}")

    def execute_flow_sync(
        self,
        flow_name: str,
        inputs: Optional[Dict[str, Any]] = None
    ) -> FlowExecutionResult:
        """
        Execute a flow synchronously.

        Args:
            flow_name: Name of the flow to execute
            inputs: Input parameters for the flow (default: empty dict)

        Returns:
            FlowExecutionResult with outputs or error information

        Raises:
            FlowNotFoundError: If the flow doesn't exist
            FlowNotReadyError: If the flow has unimplemented tasks
            FlowExecutionError: If the flow execution fails
            FlowLangError: For other client errors
        """
        inputs = inputs or {}

        try:
            response = self._request_with_retry_sync(
                "POST",
                f"/flows/{flow_name}/execute",
                json={"inputs": inputs}
            )

            if response.status_code == 404:
                raise FlowNotFoundError(f"Flow not found: {flow_name}")

            data = response.json()

            # Handle 503 Service Unavailable (flow not ready)
            if response.status_code == 503:
                raise FlowNotReadyError(
                    data.get('error', 'Flow not ready'),
                    pending_tasks=data.get('pending_tasks', []),
                    progress=data.get('implementation_progress')
                )

            result = FlowExecutionResult(
                success=data.get('success', False),
                outputs=data.get('outputs'),
                error=data.get('error'),
                error_details=data.get('error_details'),
                execution_time_ms=data.get('execution_time_ms'),
                flow=data.get('flow', flow_name)
            )

            # Raise exception if execution failed
            if not result.success:
                raise FlowExecutionError(
                    result.error or "Flow execution failed",
                    error_details=result.error_details,
                    flow=result.flow
                )

            return result

        except httpx.HTTPStatusError as e:
            raise FlowLangError(f"HTTP error: {e.response.status_code}")
        except json.JSONDecodeError as e:
            raise FlowLangError(f"Invalid JSON response: {str(e)}")

    async def execute_flow_stream(
        self,
        flow_name: str,
        inputs: Optional[Dict[str, Any]] = None,
        on_event: Optional[Callable[[str, Dict[str, Any]], None]] = None
    ) -> FlowExecutionResult:
        """
        Execute a flow and stream events in real-time using Server-Sent Events.

        Args:
            flow_name: Name of the flow to execute
            inputs: Input parameters for the flow (default: empty dict)
            on_event: Optional callback function called for each event (event_type, event_data)

        Returns:
            FlowExecutionResult with final outputs

        Raises:
            FlowNotFoundError: If the flow doesn't exist
            FlowNotReadyError: If the flow has unimplemented tasks
            FlowExecutionError: If the flow execution fails
            FlowLangError: For other client errors

        Example:
            def handle_event(event_type, data):
                if event_type == 'step_started':
                    print(f"Starting step: {data['step_id']}")
                elif event_type == 'step_completed':
                    print(f"Completed step: {data['step_id']}")

            result = await client.execute_flow_stream(
                "MyFlow",
                {"input": "value"},
                on_event=handle_event
            )
        """
        inputs = inputs or {}
        final_result = None

        try:
            async with self._async_client.stream(
                "POST",
                f"/flows/{flow_name}/execute/stream",
                json={"inputs": inputs}
            ) as response:

                if response.status_code == 404:
                    raise FlowNotFoundError(f"Flow not found: {flow_name}")

                # Handle 503 for unimplemented flows
                if response.status_code == 503:
                    # Read the error event
                    async for line in response.aiter_lines():
                        if line.startswith('data: '):
                            data = json.loads(line[6:])
                            raise FlowNotReadyError(
                                data.get('error', 'Flow not ready'),
                                pending_tasks=data.get('pending_tasks', []),
                                progress=data.get('implementation_progress')
                            )

                # Parse SSE stream
                event_type = None
                async for line in response.aiter_lines():
                    line = line.strip()

                    if not line:
                        continue

                    if line.startswith('event: '):
                        event_type = line[7:]
                    elif line.startswith('data: '):
                        data = json.loads(line[6:])

                        # Handle events
                        if event_type == 'flow_completed':
                            final_result = FlowExecutionResult(
                                success=data.get('success', True),
                                outputs=data.get('outputs', {}),
                                execution_time_ms=data.get('duration_ms'),
                                flow=flow_name
                            )
                        elif event_type == 'flow_failed' or event_type == 'error':
                            final_result = FlowExecutionResult(
                                success=False,
                                error=data.get('error'),
                                error_details=data.get('error_details'),
                                flow=flow_name
                            )

                        # Call user callback if provided
                        if on_event and event_type:
                            if asyncio.iscoroutinefunction(on_event):
                                await on_event(event_type, data)
                            else:
                                on_event(event_type, data)

                        event_type = None

            if final_result is None:
                raise FlowLangError("Stream ended without completion event")

            if not final_result.success:
                raise FlowExecutionError(
                    final_result.error or "Flow execution failed",
                    error_details=final_result.error_details,
                    flow=final_result.flow
                )

            return final_result

        except httpx.HTTPStatusError as e:
            raise FlowLangError(f"HTTP error: {e.response.status_code}")
        except json.JSONDecodeError as e:
            raise FlowLangError(f"Invalid JSON in stream: {str(e)}")

    async def list_flows(self) -> List[FlowInfo]:
        """
        List all available flows.

        Returns:
            List of FlowInfo objects
        """
        try:
            response = await self._request_with_retry("GET", "/flows")
            response.raise_for_status()
            data = response.json()

            return [
                FlowInfo(
                    name=flow['name'],
                    description=flow.get('description'),
                    inputs=flow.get('inputs', []),
                    outputs=flow.get('outputs', [])
                )
                for flow in data
            ]
        except httpx.HTTPStatusError as e:
            raise FlowLangError(f"HTTP error: {e.response.status_code}")

    def list_flows_sync(self) -> List[FlowInfo]:
        """
        List all available flows (sync).

        Returns:
            List of FlowInfo objects
        """
        try:
            response = self._request_with_retry_sync("GET", "/flows")
            response.raise_for_status()
            data = response.json()

            return [
                FlowInfo(
                    name=flow['name'],
                    description=flow.get('description'),
                    inputs=flow.get('inputs', []),
                    outputs=flow.get('outputs', [])
                )
                for flow in data
            ]
        except httpx.HTTPStatusError as e:
            raise FlowLangError(f"HTTP error: {e.response.status_code}")

    async def get_flow_info(self, flow_name: str) -> FlowInfo:
        """
        Get information about a specific flow.

        Args:
            flow_name: Name of the flow

        Returns:
            FlowInfo object

        Raises:
            FlowNotFoundError: If the flow doesn't exist
        """
        try:
            response = await self._request_with_retry("GET", f"/flows/{flow_name}")

            if response.status_code == 404:
                raise FlowNotFoundError(f"Flow not found: {flow_name}")

            response.raise_for_status()
            data = response.json()

            return FlowInfo(
                name=data['name'],
                description=data.get('description'),
                inputs=data.get('inputs', []),
                outputs=data.get('outputs', [])
            )
        except httpx.HTTPStatusError as e:
            raise FlowLangError(f"HTTP error: {e.response.status_code}")

    def get_flow_info_sync(self, flow_name: str) -> FlowInfo:
        """
        Get information about a specific flow (sync).

        Args:
            flow_name: Name of the flow

        Returns:
            FlowInfo object

        Raises:
            FlowNotFoundError: If the flow doesn't exist
        """
        try:
            response = self._request_with_retry_sync("GET", f"/flows/{flow_name}")

            if response.status_code == 404:
                raise FlowNotFoundError(f"Flow not found: {flow_name}")

            response.raise_for_status()
            data = response.json()

            return FlowInfo(
                name=data['name'],
                description=data.get('description'),
                inputs=data.get('inputs', []),
                outputs=data.get('outputs', [])
            )
        except httpx.HTTPStatusError as e:
            raise FlowLangError(f"HTTP error: {e.response.status_code}")

    async def health_check(self) -> Dict[str, Any]:
        """
        Check API server health.

        Returns:
            Health check response data
        """
        try:
            response = await self._request_with_retry("GET", "/health")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise FlowLangError(f"HTTP error: {e.response.status_code}")

    def health_check_sync(self) -> Dict[str, Any]:
        """
        Check API server health (sync).

        Returns:
            Health check response data
        """
        try:
            response = self._request_with_retry_sync("GET", "/health")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise FlowLangError(f"HTTP error: {e.response.status_code}")

    async def cancel_execution(self, flow_name: str, execution_id: str) -> Dict[str, Any]:
        """
        Cancel a running flow execution.

        Args:
            flow_name: Name of the flow
            execution_id: ID of the execution to cancel

        Returns:
            Cancellation response data

        Raises:
            FlowNotFoundError: If the flow or execution doesn't exist
            FlowLangError: For other client errors
        """
        try:
            response = await self._request_with_retry(
                "POST",
                f"/flows/{flow_name}/executions/{execution_id}/cancel"
            )

            if response.status_code == 404:
                raise FlowNotFoundError(f"Execution not found: {execution_id}")

            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise FlowLangError(f"HTTP error: {e.response.status_code}")

    def cancel_execution_sync(self, flow_name: str, execution_id: str) -> Dict[str, Any]:
        """
        Cancel a running flow execution (sync).

        Args:
            flow_name: Name of the flow
            execution_id: ID of the execution to cancel

        Returns:
            Cancellation response data

        Raises:
            FlowNotFoundError: If the flow or execution doesn't exist
            FlowLangError: For other client errors
        """
        try:
            response = self._request_with_retry_sync(
                "POST",
                f"/flows/{flow_name}/executions/{execution_id}/cancel"
            )

            if response.status_code == 404:
                raise FlowNotFoundError(f"Execution not found: {execution_id}")

            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise FlowLangError(f"HTTP error: {e.response.status_code}")

    async def get_execution_status(self, flow_name: str, execution_id: str) -> Dict[str, Any]:
        """
        Get the status of a flow execution.

        Args:
            flow_name: Name of the flow
            execution_id: ID of the execution

        Returns:
            Execution status data

        Raises:
            FlowNotFoundError: If the flow or execution doesn't exist
            FlowLangError: For other client errors
        """
        try:
            response = await self._request_with_retry(
                "GET",
                f"/flows/{flow_name}/executions/{execution_id}"
            )

            if response.status_code == 404:
                raise FlowNotFoundError(f"Execution not found: {execution_id}")

            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise FlowLangError(f"HTTP error: {e.response.status_code}")

    def get_execution_status_sync(self, flow_name: str, execution_id: str) -> Dict[str, Any]:
        """
        Get the status of a flow execution (sync).

        Args:
            flow_name: Name of the flow
            execution_id: ID of the execution

        Returns:
            Execution status data

        Raises:
            FlowNotFoundError: If the flow or execution doesn't exist
            FlowLangError: For other client errors
        """
        try:
            response = self._request_with_retry_sync(
                "GET",
                f"/flows/{flow_name}/executions/{execution_id}"
            )

            if response.status_code == 404:
                raise FlowNotFoundError(f"Execution not found: {execution_id}")

            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise FlowLangError(f"HTTP error: {e.response.status_code}")
