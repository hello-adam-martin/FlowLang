"""
FlowLang REST API Server

FastAPI-based server that exposes FlowLang flows as REST endpoints.
Automatically loads flow.yaml and tasks.py from a project directory.
"""

import asyncio
import os
import sys
import time
import traceback
from pathlib import Path
from typing import Dict, Any, Optional, List
import importlib.util

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, create_model
import yaml
import uvicorn

from .executor import FlowExecutor
from .exceptions import FlowLangError, NotImplementedTaskError


class FlowExecuteRequest(BaseModel):
    """Request model for flow execution"""
    inputs: Dict[str, Any] = Field(
        default_factory=dict,
        description="Input parameters for the flow"
    )


class FlowExecuteResponse(BaseModel):
    """Response model for flow execution"""
    success: bool = Field(description="Whether the flow executed successfully")
    outputs: Optional[Dict[str, Any]] = Field(None, description="Flow outputs")
    error: Optional[str] = Field(None, description="Error message if failed")
    error_details: Optional[str] = Field(None, description="Detailed error information")
    execution_time_ms: float = Field(description="Execution time in milliseconds")
    flow: str = Field(description="Name of the executed flow")


class FlowInputSchema(BaseModel):
    """Schema for a flow input parameter"""
    name: str
    type: str
    required: bool = False
    description: Optional[str] = None


class FlowOutputSchema(BaseModel):
    """Schema for a flow output"""
    name: str
    value: Optional[str] = None


class FlowInfo(BaseModel):
    """Information about a flow"""
    name: str
    description: Optional[str] = None
    inputs: List[FlowInputSchema] = Field(default_factory=list)
    outputs: List[FlowOutputSchema] = Field(default_factory=list)


class FlowServer:
    """
    FastAPI server for FlowLang flows.

    Loads a flow project (flow.yaml + tasks.py) and exposes it as REST endpoints.
    """

    def __init__(
        self,
        project_dir: str = ".",
        flow_file: str = "flow.yaml",
        tasks_file: str = "tasks.py",
        title: str = "FlowLang API",
        version: str = "1.0.0"
    ):
        """
        Initialize the FlowLang server.

        Args:
            project_dir: Directory containing flow.yaml and tasks.py
            flow_file: Name of the flow YAML file
            tasks_file: Name of the tasks Python file
            title: API title for OpenAPI docs
            version: API version
        """
        self.project_dir = Path(project_dir).absolute()
        self.flow_file = flow_file
        self.tasks_file = tasks_file

        # Load flow definition
        self.flow_yaml, self.flow_def = self._load_flow()
        self.flow_name = self.flow_def.get('flow', 'UnnamedFlow')

        # Load task registry
        self.registry = self._load_tasks()

        # Create executor
        self.executor = FlowExecutor(self.registry)

        # Create dynamic request model based on flow inputs
        self.request_model = self._create_request_model()

        # Create FastAPI app
        self.app = FastAPI(
            title=title,
            version=version,
            description=f"FlowLang API for {self.flow_name} flow"
        )

        # Register routes
        self._register_routes()

    def _load_flow(self) -> tuple[str, Dict]:
        """Load flow YAML definition"""
        flow_path = self.project_dir / self.flow_file

        if not flow_path.exists():
            raise FileNotFoundError(f"Flow file not found: {flow_path}")

        with open(flow_path, 'r') as f:
            flow_yaml = f.read()

        flow_def = yaml.safe_load(flow_yaml)

        return flow_yaml, flow_def

    def _load_tasks(self):
        """Load task registry from tasks.py"""
        tasks_path = self.project_dir / self.tasks_file

        if not tasks_path.exists():
            raise FileNotFoundError(f"Tasks file not found: {tasks_path}")

        # Add project dir to path
        sys.path.insert(0, str(self.project_dir))

        # Load the tasks module
        spec = importlib.util.spec_from_file_location("tasks", tasks_path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Could not load tasks from {tasks_path}")

        tasks_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(tasks_module)

        # Get the registry from the module
        if not hasattr(tasks_module, 'create_task_registry'):
            raise ImportError(
                f"Tasks file {tasks_path} must define create_task_registry() function"
            )

        registry = tasks_module.create_task_registry()

        return registry

    def _create_request_model(self) -> type[BaseModel]:
        """
        Create a dynamic Pydantic model based on flow inputs.
        This makes the API docs show the actual input fields instead of generic Dict.
        """
        inputs_def = self.flow_def.get('inputs', [])

        if not inputs_def:
            # No inputs defined, use generic model
            return FlowExecuteRequest

        # Build field definitions for Pydantic
        field_definitions = {}

        # Map flow types to Python types
        type_mapping = {
            'string': str,
            'integer': int,
            'int': int,
            'number': float,
            'float': float,
            'boolean': bool,
            'bool': bool,
            'object': dict,
            'array': list,
            'list': list,
        }

        for input_def in inputs_def:
            name = input_def.get('name')
            type_str = input_def.get('type', 'string')
            required = input_def.get('required', False)
            description = input_def.get('description', '')

            # Get Python type
            python_type = type_mapping.get(type_str.lower(), str)

            # Create field with proper annotation
            if required:
                field_definitions[name] = (python_type, Field(..., description=description or f"{name} (required)"))
            else:
                field_definitions[name] = (Optional[python_type], Field(None, description=description or f"{name} (optional)"))

        # Create dynamic model
        DynamicInputModel = create_model(
            f'{self.flow_name}Inputs',
            **field_definitions
        )

        # Create the request wrapper model
        RequestModel = create_model(
            f'{self.flow_name}Request',
            inputs=(DynamicInputModel, Field(..., description=f"Input parameters for {self.flow_name} flow"))
        )

        return RequestModel

    def _register_routes(self):
        """Register FastAPI routes"""

        @self.app.get("/", tags=["Info"])
        async def root():
            """API root - returns basic information"""
            return {
                "service": "FlowLang API Server",
                "flow": self.flow_name,
                "version": self.app.version,
                "docs": "/docs",
                "endpoints": {
                    "execute": f"/flows/{self.flow_name}/execute",
                    "info": f"/flows/{self.flow_name}",
                    "list": "/flows"
                }
            }

        @self.app.get("/health", tags=["Health"])
        async def health():
            """Health check endpoint"""
            status = self.registry.get_implementation_status()
            return {
                "status": "healthy",
                "flow": self.flow_name,
                "tasks_implemented": status['implemented'],
                "tasks_total": status['total'],
                "ready": status['implemented'] > 0
            }

        @self.app.get("/flows", response_model=List[FlowInfo], tags=["Flows"])
        async def list_flows():
            """List all available flows"""
            # Convert inputs and outputs to proper schema objects
            inputs = [
                FlowInputSchema(**inp) for inp in self.flow_def.get('inputs', [])
            ]
            outputs = [
                FlowOutputSchema(**out) for out in self.flow_def.get('outputs', [])
            ]

            return [
                FlowInfo(
                    name=self.flow_name,
                    description=self.flow_def.get('description'),
                    inputs=inputs,
                    outputs=outputs
                )
            ]

        @self.app.get("/flows/{flow_name}", response_model=FlowInfo, tags=["Flows"])
        async def get_flow_info(flow_name: str):
            """Get information about a specific flow"""
            if flow_name != self.flow_name:
                raise HTTPException(status_code=404, detail=f"Flow not found: {flow_name}")

            # Convert inputs and outputs to proper schema objects
            inputs = [
                FlowInputSchema(**inp) for inp in self.flow_def.get('inputs', [])
            ]
            outputs = [
                FlowOutputSchema(**out) for out in self.flow_def.get('outputs', [])
            ]

            return FlowInfo(
                name=self.flow_name,
                description=self.flow_def.get('description'),
                inputs=inputs,
                outputs=outputs
            )

        @self.app.post(
            "/flows/{flow_name}/execute",
            response_model=FlowExecuteResponse,
            tags=["Execution"]
        )
        async def execute_flow(flow_name: str, request: self.request_model):
            """
            Execute a flow with the provided inputs.

            Returns the flow outputs on success, or error details on failure.
            """
            if flow_name != self.flow_name:
                raise HTTPException(status_code=404, detail=f"Flow not found: {flow_name}")

            start_time = time.time()

            try:
                # Convert request inputs to dict
                # The dynamic model has an 'inputs' field containing the actual input values
                if hasattr(request, 'inputs'):
                    # Dynamic model case - inputs is a nested Pydantic model
                    inputs_dict = request.inputs.model_dump(exclude_none=False)
                else:
                    # Fallback for generic model
                    inputs_dict = request.dict().get('inputs', {})

                # Execute the flow
                result = await self.executor.execute_flow(
                    self.flow_yaml,
                    inputs=inputs_dict
                )

                execution_time = (time.time() - start_time) * 1000

                if result['success']:
                    return FlowExecuteResponse(
                        success=True,
                        outputs=result.get('outputs', {}),
                        execution_time_ms=execution_time,
                        flow=flow_name
                    )
                else:
                    # Flow completed but with errors
                    error_msg = result.get('error', 'Unknown error')
                    return FlowExecuteResponse(
                        success=False,
                        error=str(error_msg),
                        error_details=result.get('error_details'),
                        execution_time_ms=execution_time,
                        flow=flow_name
                    )

            except NotImplementedTaskError as e:
                execution_time = (time.time() - start_time) * 1000
                return FlowExecuteResponse(
                    success=False,
                    error=f"Task not implemented: {str(e)}",
                    error_details="One or more tasks in the flow are not yet implemented",
                    execution_time_ms=execution_time,
                    flow=flow_name
                )

            except FlowLangError as e:
                execution_time = (time.time() - start_time) * 1000
                return FlowExecuteResponse(
                    success=False,
                    error=str(e),
                    error_details=traceback.format_exc(),
                    execution_time_ms=execution_time,
                    flow=flow_name
                )

            except Exception as e:
                execution_time = (time.time() - start_time) * 1000
                return FlowExecuteResponse(
                    success=False,
                    error=f"Unexpected error: {str(e)}",
                    error_details=traceback.format_exc(),
                    execution_time_ms=execution_time,
                    flow=flow_name
                )

        @self.app.get("/flows/{flow_name}/tasks", tags=["Tasks"])
        async def list_tasks(flow_name: str):
            """List all tasks for a flow with implementation status"""
            if flow_name != self.flow_name:
                raise HTTPException(status_code=404, detail=f"Flow not found: {flow_name}")

            tasks = self.registry.list_tasks()
            status = self.registry.get_implementation_status()

            return {
                "flow": flow_name,
                "tasks": tasks,
                "summary": {
                    "total": status['total'],
                    "implemented": status['implemented'],
                    "pending": status['pending'],
                    "percentage": status['percentage']
                }
            }

        # Exception handlers
        @self.app.exception_handler(HTTPException)
        async def http_exception_handler(request: Request, exc: HTTPException):
            return JSONResponse(
                status_code=exc.status_code,
                content={
                    "success": False,
                    "error": exc.detail,
                    "status_code": exc.status_code
                }
            )

        @self.app.exception_handler(Exception)
        async def general_exception_handler(request: Request, exc: Exception):
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "error": f"Internal server error: {str(exc)}",
                    "error_details": traceback.format_exc(),
                    "status_code": 500
                }
            )

    def run(
        self,
        host: str = "0.0.0.0",
        port: int = 8000,
        reload: bool = False,
        log_level: str = "info"
    ):
        """
        Start the FastAPI server.

        Args:
            host: Host to bind to (default: 0.0.0.0)
            port: Port to bind to (default: 8000)
            reload: Enable auto-reload on code changes (disabled by default, use uvicorn directly for reload)
            log_level: Logging level (debug, info, warning, error)
        """
        print("="*60)
        print(f"🚀 Starting FlowLang API Server")
        print("="*60)
        print(f"Flow: {self.flow_name}")
        print(f"Project: {self.project_dir}")

        status = self.registry.get_implementation_status()
        print(f"Tasks: {status['progress']} ({status['percentage']:.1f}%)")

        print(f"\n📍 Server starting on http://{host}:{port}")
        print(f"📖 API Docs: http://{host}:{port}/docs")
        print(f"🔍 Health Check: http://{host}:{port}/health")

        if reload:
            print("\n⚠️  Note: For reliable auto-reload, use uvicorn directly:")
            print(f"   uvicorn api:app --host {host} --port {port} --reload")

        print("="*60)
        print()

        # Note: reload=True doesn't work properly when passing app object
        # Users should use uvicorn directly for reload functionality
        uvicorn.run(
            self.app,
            host=host,
            port=port,
            reload=False,  # Force False - reload doesn't work with app objects
            log_level=log_level
        )


def create_server(
    project_dir: str = ".",
    **kwargs
) -> FlowServer:
    """
    Factory function to create a FlowServer instance.

    Args:
        project_dir: Directory containing flow.yaml and tasks.py
        **kwargs: Additional arguments passed to FlowServer constructor

    Returns:
        Configured FlowServer instance
    """
    return FlowServer(project_dir=project_dir, **kwargs)


if __name__ == '__main__':
    # Example: Run server from command line
    import argparse

    parser = argparse.ArgumentParser(description='FlowLang API Server')
    parser.add_argument(
        'project_dir',
        nargs='?',
        default='.',
        help='Project directory containing flow.yaml and tasks.py'
    )
    parser.add_argument(
        '--host',
        default='0.0.0.0',
        help='Host to bind to (default: 0.0.0.0)'
    )
    parser.add_argument(
        '--port',
        type=int,
        default=8000,
        help='Port to bind to (default: 8000)'
    )
    parser.add_argument(
        '--reload',
        action='store_true',
        help='Enable auto-reload on code changes'
    )

    args = parser.parse_args()

    try:
        server = FlowServer(project_dir=args.project_dir)
        server.run(host=args.host, port=args.port, reload=args.reload)
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        sys.exit(1)
