"""
Webhook Trigger - Execute flows via HTTP requests

Enables flows to be triggered by incoming HTTP requests with support for:
- Multiple HTTP methods (GET, POST, PUT, DELETE, PATCH)
- Authentication (API key, bearer token)
- Request validation
- Async and sync execution modes
"""

from typing import Dict, Any, Optional, Callable, Awaitable
from fastapi import APIRouter, Request, HTTPException, Header, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
import logging
import secrets

from .base import Trigger

logger = logging.getLogger(__name__)


class WebhookTrigger(Trigger):
    """
    Webhook trigger that creates HTTP endpoints to execute flows.

    Configuration format in flow.yaml:
    ```yaml
    triggers:
      - type: webhook
        path: /webhooks/my-flow       # URL path (required)
        method: POST                   # HTTP method (default: POST)
        auth:
          type: api_key                # Authentication type
          header: X-API-Key            # Header name (default: X-API-Key)
          key: your-secret-key         # Expected API key value
        async: true                    # Execute flow async (default: true)
    ```
    """

    def __init__(
        self,
        trigger_id: str,
        config: Dict[str, Any],
        flow_name: str,
        flow_executor: Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]
    ):
        """
        Initialize webhook trigger.

        Args:
            trigger_id: Unique trigger identifier
            config: Webhook configuration (path, method, auth, etc.)
            flow_name: Name of the flow to execute
            flow_executor: Async function to execute the flow
        """
        super().__init__(trigger_id, config, flow_name, flow_executor)

        # Extract configuration
        self.path = config.get('path')
        if not self.path:
            raise ValueError(f"Webhook trigger {trigger_id} must have a 'path'")

        # Normalize path to start with /
        if not self.path.startswith('/'):
            self.path = '/' + self.path

        self.method = config.get('method', 'POST').upper()
        self.async_execution = config.get('async', True)

        # Parse authentication config
        self.auth_config = config.get('auth', {})
        self.auth_type = self.auth_config.get('type') if self.auth_config else None
        self.auth_header = self.auth_config.get('header', 'X-API-Key')
        self.auth_key = self.auth_config.get('key')

        # FastAPI router for this webhook
        self.router: Optional[APIRouter] = None

        # Request mapping (how to extract inputs from HTTP request)
        self.input_mapping = config.get('input_mapping', 'body')  # body, query, path, headers

    async def start(self):
        """Start the webhook trigger (router will be registered by server)"""
        self.is_running = True
        logger.info(f"Webhook trigger {self.trigger_id} started: {self.method} {self.path}")

    async def stop(self):
        """Stop the webhook trigger"""
        self.is_running = False
        logger.info(f"Webhook trigger {self.trigger_id} stopped")

    def get_status(self) -> Dict[str, Any]:
        """Get webhook status"""
        status = self.get_base_status()
        status.update({
            'type': 'webhook',
            'method': self.method,
            'path': self.path,
            'auth_enabled': self.auth_type is not None,
            'auth_type': self.auth_type,
            'async_execution': self.async_execution
        })
        return status

    def create_router(self) -> APIRouter:
        """
        Create FastAPI router with the webhook endpoint.

        Returns:
            APIRouter with the configured webhook endpoint
        """
        router = APIRouter(tags=[f"Webhooks - {self.flow_name}"])

        # Create auth dependency if authentication is configured
        auth_dependency = self._create_auth_dependency() if self.auth_type else None

        # Define the webhook handler
        async def webhook_handler(
            request: Request,
            background_tasks: BackgroundTasks,
            auth_result: Optional[Dict[str, Any]] = Depends(auth_dependency) if auth_dependency else None
        ):
            """Handle incoming webhook request"""
            try:
                # Extract inputs from request based on input_mapping
                inputs = await self._extract_inputs(request)

                # Add auth context if present
                if auth_result:
                    inputs['_auth'] = auth_result

                if self.async_execution:
                    # Execute flow in background
                    background_tasks.add_task(self.execute_flow, inputs)

                    return JSONResponse(
                        status_code=202,
                        content={
                            "success": True,
                            "message": f"Flow {self.flow_name} triggered successfully",
                            "flow": self.flow_name,
                            "execution": "async"
                        }
                    )
                else:
                    # Execute flow synchronously and wait for result
                    result = await self.execute_flow(inputs)

                    status_code = 200 if result.get('success') else 500

                    return JSONResponse(
                        status_code=status_code,
                        content={
                            "success": result.get('success'),
                            "outputs": result.get('outputs'),
                            "error": result.get('error'),
                            "flow": self.flow_name,
                            "execution": "sync"
                        }
                    )

            except Exception as e:
                logger.exception(f"Webhook handler error for {self.trigger_id}: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        # Register the endpoint with appropriate HTTP method
        if self.method == 'GET':
            router.get(self.path)(webhook_handler)
        elif self.method == 'POST':
            router.post(self.path)(webhook_handler)
        elif self.method == 'PUT':
            router.put(self.path)(webhook_handler)
        elif self.method == 'DELETE':
            router.delete(self.path)(webhook_handler)
        elif self.method == 'PATCH':
            router.patch(self.path)(webhook_handler)
        else:
            raise ValueError(f"Unsupported HTTP method: {self.method}")

        self.router = router
        return router

    async def _extract_inputs(self, request: Request) -> Dict[str, Any]:
        """
        Extract flow inputs from HTTP request.

        Args:
            request: FastAPI request object

        Returns:
            Dictionary of inputs for the flow
        """
        inputs = {}

        if self.input_mapping == 'body':
            # Get JSON body
            try:
                body = await request.json()
                if isinstance(body, dict):
                    inputs = body
                else:
                    inputs = {'body': body}
            except Exception:
                # Not JSON or empty body
                inputs = {}

        elif self.input_mapping == 'query':
            # Get query parameters
            inputs = dict(request.query_params)

        elif self.input_mapping == 'headers':
            # Get headers
            inputs = dict(request.headers)

        elif self.input_mapping == 'path':
            # Get path parameters
            inputs = dict(request.path_params)

        elif self.input_mapping == 'all':
            # Combine all sources
            try:
                inputs['body'] = await request.json()
            except Exception:
                pass
            inputs['query'] = dict(request.query_params)
            inputs['headers'] = dict(request.headers)
            inputs['path'] = dict(request.path_params)

        # Always add request metadata
        inputs['_webhook'] = {
            'method': request.method,
            'path': request.url.path,
            'client': request.client.host if request.client else None,
            'trigger_id': self.trigger_id
        }

        return inputs

    def _create_auth_dependency(self) -> Optional[Callable]:
        """
        Create FastAPI dependency for authentication.

        Returns:
            Dependency function or None if no auth configured
        """
        if not self.auth_type:
            return None

        if self.auth_type == 'api_key':
            # API Key authentication
            async def verify_api_key(
                api_key: Optional[str] = Header(None, alias=self.auth_header)
            ) -> Dict[str, Any]:
                if not api_key:
                    raise HTTPException(
                        status_code=401,
                        detail=f"Missing authentication header: {self.auth_header}"
                    )

                # Compare with configured key
                if self.auth_key and not secrets.compare_digest(api_key, self.auth_key):
                    raise HTTPException(
                        status_code=401,
                        detail="Invalid API key"
                    )

                return {'auth_type': 'api_key', 'authenticated': True}

            return verify_api_key

        elif self.auth_type == 'bearer':
            # Bearer token authentication
            async def verify_bearer_token(
                authorization: Optional[str] = Header(None)
            ) -> Dict[str, Any]:
                if not authorization:
                    raise HTTPException(
                        status_code=401,
                        detail="Missing Authorization header"
                    )

                parts = authorization.split()
                if len(parts) != 2 or parts[0].lower() != 'bearer':
                    raise HTTPException(
                        status_code=401,
                        detail="Invalid Authorization header format. Expected: Bearer <token>"
                    )

                token = parts[1]

                # Compare with configured token
                if self.auth_key and not secrets.compare_digest(token, self.auth_key):
                    raise HTTPException(
                        status_code=401,
                        detail="Invalid bearer token"
                    )

                return {'auth_type': 'bearer', 'authenticated': True, 'token': token}

            return verify_bearer_token

        else:
            logger.warning(f"Unknown auth type: {self.auth_type}")
            return None


def create_webhook_trigger(
    trigger_id: str,
    config: Dict[str, Any],
    flow_name: str,
    flow_executor: Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]
) -> WebhookTrigger:
    """
    Factory function to create a WebhookTrigger instance.

    Args:
        trigger_id: Unique trigger identifier
        config: Webhook configuration
        flow_name: Name of the flow to execute
        flow_executor: Async function to execute the flow

    Returns:
        WebhookTrigger instance
    """
    return WebhookTrigger(trigger_id, config, flow_name, flow_executor)
