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
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, create_model
import yaml
import uvicorn
import json

from .executor import FlowExecutor
from .exceptions import FlowLangError, NotImplementedTaskError
from .hot_reload import FileWatcher, ReloadManager


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
    execution_time_ms: Optional[float] = Field(None, description="Execution time in milliseconds")
    flow: str = Field(description="Name of the executed flow")
    pending_tasks: Optional[List[str]] = Field(None, description="List of unimplemented tasks (if not ready)")
    implementation_progress: Optional[str] = Field(None, description="Implementation progress (e.g., '3/5 (60%)')")


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
        version: str = "1.0.0",
        enable_hot_reload: bool = False
    ):
        """
        Initialize the FlowLang server.

        Args:
            project_dir: Directory containing flow.yaml and tasks.py
            flow_file: Name of the flow YAML file
            tasks_file: Name of the tasks Python file
            title: API title for OpenAPI docs
            version: API version
            enable_hot_reload: Enable hot reload for development (watches files for changes)
        """
        self.project_dir = Path(project_dir).absolute()
        self.flow_file = flow_file
        self.tasks_file = tasks_file
        self.enable_hot_reload = enable_hot_reload

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

        # Initialize hot reload if enabled
        self.reload_manager = None
        self.file_watcher = None
        if self.enable_hot_reload:
            self._setup_hot_reload()

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

    def _setup_hot_reload(self):
        """Setup hot reload functionality"""
        import logging
        logging.basicConfig(level=logging.INFO)
        logger = logging.getLogger(__name__)

        logger.info("🔥 Hot reload enabled")
        logger.info(f"   Watching: {self.tasks_file}, {self.flow_file}")

        # Create reload manager
        self.reload_manager = ReloadManager(
            project_dir=str(self.project_dir),
            tasks_file=self.tasks_file
        )

        # Create file watcher
        self.file_watcher = FileWatcher(debounce_seconds=0.5)

        # Register file watch callbacks
        tasks_path = self.project_dir / self.tasks_file
        flow_path = self.project_dir / self.flow_file

        def on_tasks_change(file_path):
            """Callback when flow.py changes"""
            success = self.reload_manager.reload_tasks(self.registry)
            if success:
                logger.info("   ✨ Tasks are now updated - try the API again!")

        def on_flow_change(file_path):
            """Callback when flow.yaml changes"""
            new_yaml = self.reload_manager.reload_flow_yaml()
            if new_yaml:
                # Update flow definition
                self.flow_yaml = new_yaml
                self.flow_def = yaml.safe_load(new_yaml)
                logger.info("   ✨ Flow definition updated - API schema may have changed!")

        self.file_watcher.watch_file(str(tasks_path), on_tasks_change)
        self.file_watcher.watch_file(str(flow_path), on_flow_change)

        # Start watching
        self.file_watcher.start(str(self.project_dir))

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
            """API root - returns basic information and available endpoints"""
            # Get readiness status
            status = self.registry.get_implementation_status()
            is_ready = status['unimplemented_count'] == 0

            return {
                "service": "FlowLang API Server",
                "version": self.app.version,
                "flow": {
                    "name": self.flow_name,
                    "description": self.flow_def.get('description'),
                    "ready": is_ready,
                    "progress": status['progress'],
                    "percentage": f"{status['percentage']:.1f}%"
                },
                "status": "ready" if is_ready else "incomplete",
                "documentation": {
                    "openapi": "/docs",
                    "redoc": "/redoc",
                    "openapi_json": "/openapi.json"
                },
                "endpoints": {
                    "info": {
                        "root": "/",
                        "health": "/health"
                    },
                    "flows": {
                        "list": "/flows",
                        "info": f"/flows/{self.flow_name}",
                        "tasks": f"/flows/{self.flow_name}/tasks",
                        "visualize": f"/flows/{self.flow_name}/visualize"
                    },
                    "execution": {
                        "execute": f"/flows/{self.flow_name}/execute",
                        "stream": f"/flows/{self.flow_name}/execute/stream"
                    }
                }
            }

        @self.app.get("/health", tags=["Health"])
        async def health():
            """
            Health check endpoint

            Returns service health and implementation status.
            The 'ready' field is true only when ALL tasks are implemented.
            """
            status = self.registry.get_implementation_status()
            all_tasks_implemented = status['unimplemented_count'] == 0

            return {
                "status": "healthy",
                "flow": self.flow_name,
                "tasks_implemented": status['implemented'],
                "tasks_total": status['total'],
                "tasks_pending": status['unimplemented_count'],
                "implementation_complete": all_tasks_implemented,
                "ready": all_tasks_implemented,
                "pending_task_names": status['unimplemented_tasks'] if not all_tasks_implemented else []
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
            tags=["Execution"],
            responses={
                200: {"description": "Flow executed successfully"},
                503: {"description": "Flow not ready - tasks not yet implemented"}
            }
        )
        async def execute_flow(flow_name: str, request: self.request_model):
            """
            Execute a flow with the provided inputs.

            Returns the flow outputs on success, or error details on failure.

            Returns 503 Service Unavailable if not all tasks are implemented.
            """
            if flow_name != self.flow_name:
                raise HTTPException(status_code=404, detail=f"Flow not found: {flow_name}")

            # Pre-flight check: verify all tasks are implemented
            status = self.registry.get_implementation_status()
            if status['unimplemented_count'] > 0:
                # Return 503 with detailed information about what's missing
                pending_tasks = status['unimplemented_tasks']
                progress = f"{status['implemented']}/{status['total']} ({status['percentage']:.1f}%)"

                response = FlowExecuteResponse(
                    success=False,
                    error="Flow not ready for execution",
                    error_details=f"{status['unimplemented_count']} of {status['total']} tasks are not yet implemented",
                    execution_time_ms=None,
                    flow=flow_name,
                    pending_tasks=pending_tasks,
                    implementation_progress=progress
                )

                return JSONResponse(
                    status_code=503,
                    content=response.model_dump()
                )

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

        @self.app.post(
            "/flows/{flow_name}/execute/stream",
            tags=["Execution"],
            responses={
                200: {"description": "Flow execution events stream"},
                404: {"description": "Flow not found"},
                503: {"description": "Flow not ready - tasks not yet implemented"}
            }
        )
        async def execute_flow_stream(flow_name: str, request: self.request_model):
            """
            Execute a flow and stream execution events in real-time using Server-Sent Events (SSE).

            Each event includes:
            - event: Event type (flow_started, step_started, step_completed, step_failed, flow_completed, flow_failed)
            - data: Event data as JSON

            Example event format:
            ```
            event: step_started
            data: {"step_id": "validate", "task": "ValidateUser", "timestamp": "2025-10-11T..."}

            event: step_completed
            data: {"step_id": "validate", "task": "ValidateUser", "outputs": {...}, "duration_ms": 12.5}
            ```

            Use with curl:
            ```
            curl -N -X POST http://localhost:8000/flows/MyFlow/execute/stream \\
              -H "Content-Type: application/json" \\
              -d '{"inputs": {...}}'
            ```
            """
            if flow_name != self.flow_name:
                raise HTTPException(status_code=404, detail=f"Flow not found: {flow_name}")

            # Pre-flight check: verify all tasks are implemented
            status = self.registry.get_implementation_status()
            if status['unimplemented_count'] > 0:
                pending_tasks = status['unimplemented_tasks']
                progress = f"{status['implemented']}/{status['total']} ({status['percentage']:.1f}%)"

                # Return error as SSE event
                async def error_stream():
                    error_event = {
                        'success': False,
                        'error': 'Flow not ready for execution',
                        'error_details': f"{status['unimplemented_count']} of {status['total']} tasks are not yet implemented",
                        'flow': flow_name,
                        'pending_tasks': pending_tasks,
                        'implementation_progress': progress
                    }
                    yield f"event: error\ndata: {json.dumps(error_event)}\n\n"

                return StreamingResponse(
                    error_stream(),
                    media_type="text/event-stream",
                    status_code=503
                )

            # Create event stream
            async def event_stream():
                # Queue to collect events
                event_queue = asyncio.Queue()

                # Event callback that puts events in the queue
                async def event_callback(event_type: str, event_data: Dict[str, Any]):
                    await event_queue.put((event_type, event_data))

                # Task to execute the flow
                async def execute_task():
                    try:
                        # Convert request inputs to dict
                        if hasattr(request, 'inputs'):
                            inputs_dict = request.inputs.model_dump(exclude_none=False)
                        else:
                            inputs_dict = request.dict().get('inputs', {})

                        # Execute the flow with event callback
                        result = await self.executor.execute_flow(
                            self.flow_yaml,
                            inputs=inputs_dict,
                            event_callback=event_callback
                        )

                        # Put final result in queue (not already sent via events)
                        # This signals completion
                        await event_queue.put(('_done', result))

                    except Exception as e:
                        # Put error in queue
                        await event_queue.put(('_error', {
                            'error': str(e),
                            'error_type': type(e).__name__,
                            'error_details': traceback.format_exc()
                        }))

                # Start execution task
                execution_task = asyncio.create_task(execute_task())

                # Stream events as they arrive
                try:
                    while True:
                        event_type, event_data = await event_queue.get()

                        # Check for completion signals
                        if event_type == '_done':
                            # Execution completed - flow_completed event was already sent
                            break
                        elif event_type == '_error':
                            # Execution failed with unexpected error
                            yield f"event: error\ndata: {json.dumps(event_data)}\n\n"
                            break
                        else:
                            # Regular event - send to client
                            yield f"event: {event_type}\ndata: {json.dumps(event_data)}\n\n"

                except asyncio.CancelledError:
                    # Client disconnected - cancel execution
                    execution_task.cancel()
                    raise

            return StreamingResponse(
                event_stream(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "X-Accel-Buffering": "no",  # Disable buffering in nginx
                }
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

        @self.app.get("/flows/{flow_name}/visualize", tags=["Visualization"])
        async def visualize_flow(flow_name: str):
            """
            Generate a Mermaid diagram visualization of the flow structure.

            Returns a Mermaid flowchart diagram showing:
            - Flow inputs and outputs
            - Task steps
            - Parallel execution
            - Conditional branching
            - Loops
            """
            if flow_name != self.flow_name:
                raise HTTPException(status_code=404, detail=f"Flow not found: {flow_name}")

            try:
                from .visualizer import FlowVisualizer

                visualizer = FlowVisualizer(self.flow_def)
                diagram = visualizer.generate_mermaid()

                return {
                    "flow": flow_name,
                    "diagram": diagram,
                    "format": "mermaid"
                }
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Error generating visualization: {str(e)}"
                )

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

        if self.enable_hot_reload:
            print(f"\n🔥 Hot reload: ENABLED")
            print(f"   Watching: {self.tasks_file}, {self.flow_file}")
            print(f"   Changes will reload automatically!")

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


class MultiFlowServer:
    """
    FastAPI server that serves multiple FlowLang flows from a directory structure.

    Automatically discovers flows in subdirectories and exposes them through unified endpoints.

    Directory structure:
        flows_root/
        ├── flow1/
        │   ├── flow.yaml
        │   └── flow.py
        ├── flow2/
        │   ├── flow.yaml
        │   └── flow.py
        └── ...
    """

    def __init__(
        self,
        flows_dir: str = ".",
        title: str = "FlowLang Multi-Flow API",
        version: str = "1.0.0",
        enable_hot_reload: bool = False
    ):
        """
        Initialize the multi-flow server.

        Args:
            flows_dir: Root directory containing flow subdirectories
            title: API title for OpenAPI docs
            version: API version
            enable_hot_reload: Enable hot reload for development (watches all flow files for changes)
        """
        self.flows_dir = Path(flows_dir).absolute()
        self.flows = {}  # {flow_name: {'executor': ..., 'registry': ..., 'flow_def': ..., 'flow_yaml': ..., 'reload_manager': ..., 'file_watcher': ...}}
        self.enable_hot_reload = enable_hot_reload

        # Discover and load all flows
        self._discover_flows()

        # Create FastAPI app
        self.app = FastAPI(
            title=title,
            version=version,
            description=f"FlowLang Multi-Flow API serving {len(self.flows)} flows"
        )

        # Register routes
        self._register_routes()

        # Setup hot reload for all flows if enabled
        if self.enable_hot_reload:
            self._setup_hot_reload()

    def _discover_flows(self):
        """Discover and load all flow projects in subdirectories"""
        print(f"🔍 Discovering flows in: {self.flows_dir}")
        print("="*60)

        if not self.flows_dir.exists():
            raise FileNotFoundError(f"Flows directory not found: {self.flows_dir}")

        # Scan for subdirectories containing flow.yaml and flow.py
        for item in self.flows_dir.iterdir():
            if not item.is_dir():
                continue

            flow_yaml_path = item / "flow.yaml"
            flow_py_path = item / "flow.py"

            # Check if this is a valid flow project
            if not (flow_yaml_path.exists() and flow_py_path.exists()):
                continue

            try:
                # Load flow definition
                with open(flow_yaml_path, 'r') as f:
                    flow_yaml = f.read()

                flow_def = yaml.safe_load(flow_yaml)
                flow_name = flow_def.get('flow', item.name)

                # Load task registry
                sys.path.insert(0, str(item))
                spec = importlib.util.spec_from_file_location(f"flow_{item.name}", flow_py_path)
                if spec is None or spec.loader is None:
                    print(f"  ⚠️  Skipping {item.name}: Could not load flow.py")
                    continue

                flow_module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(flow_module)

                if not hasattr(flow_module, 'create_task_registry'):
                    print(f"  ⚠️  Skipping {item.name}: No create_task_registry() function")
                    continue

                registry = flow_module.create_task_registry()
                executor = FlowExecutor(registry)

                # Store flow data
                self.flows[flow_name] = {
                    'executor': executor,
                    'registry': registry,
                    'flow_def': flow_def,
                    'flow_yaml': flow_yaml,
                    'project_dir': item
                }

                status = registry.get_implementation_status()
                ready = "✅" if status['unimplemented_count'] == 0 else "⚠️"
                print(f"  {ready} Loaded: {flow_name} ({status['progress']} tasks)")

            except Exception as e:
                print(f"  ❌ Error loading {item.name}: {e}")
                continue

        if not self.flows:
            raise ValueError(f"No valid flows found in {self.flows_dir}")

        print("="*60)
        print(f"✅ Loaded {len(self.flows)} flows successfully\n")

    def _setup_hot_reload(self):
        """Setup hot reload for all flows"""
        import logging
        logging.basicConfig(level=logging.INFO)
        logger = logging.getLogger(__name__)

        logger.info("🔥 Hot reload enabled for multi-flow server")
        logger.info(f"   Watching {len(self.flows)} flows")

        # Setup hot reload for each flow
        for flow_name, flow_data in self.flows.items():
            project_dir = flow_data['project_dir']
            registry = flow_data['registry']

            # Create reload manager for this flow
            reload_manager = ReloadManager(
                project_dir=str(project_dir),
                tasks_file="flow.py"
            )

            # Create file watcher for this flow
            file_watcher = FileWatcher(debounce_seconds=0.5)

            # Register file watch callbacks
            tasks_path = project_dir / "flow.py"
            flow_yaml_path = project_dir / "flow.yaml"

            def create_tasks_callback(flow_name, registry, reload_mgr):
                """Create a callback closure for this specific flow"""
                def on_tasks_change(file_path):
                    logger.info(f"📝 [{flow_name}] flow.py changed")
                    success = reload_mgr.reload_tasks(registry)
                    if success:
                        logger.info(f"   ✨ [{flow_name}] Tasks reloaded successfully")
                return on_tasks_change

            def create_flow_callback(flow_name, flow_data, reload_mgr):
                """Create a callback closure for this specific flow"""
                def on_flow_change(file_path):
                    logger.info(f"📝 [{flow_name}] flow.yaml changed")
                    new_yaml = reload_mgr.reload_flow_yaml()
                    if new_yaml:
                        # Update flow definition in the flows dict
                        flow_data['flow_yaml'] = new_yaml
                        flow_data['flow_def'] = yaml.safe_load(new_yaml)
                        logger.info(f"   ✨ [{flow_name}] Flow definition reloaded")
                return on_flow_change

            # Register callbacks with closures to capture flow-specific data
            file_watcher.watch_file(
                str(tasks_path),
                create_tasks_callback(flow_name, registry, reload_manager)
            )
            file_watcher.watch_file(
                str(flow_yaml_path),
                create_flow_callback(flow_name, flow_data, reload_manager)
            )

            # Start watching this flow's directory
            file_watcher.start(str(project_dir))

            # Store reload components in flow data
            flow_data['reload_manager'] = reload_manager
            flow_data['file_watcher'] = file_watcher

            logger.info(f"   👁️  Watching: {flow_name} (flow.py, flow.yaml)")

    def _register_routes(self):
        """Register FastAPI routes for all flows"""

        @self.app.get("/", tags=["Info"])
        async def root():
            """API root - returns basic information and available endpoints"""
            # Get readiness status
            flow_statuses = {}
            all_ready = True
            for flow_name, flow_data in self.flows.items():
                status = flow_data['registry'].get_implementation_status()
                flow_ready = status['unimplemented_count'] == 0
                all_ready = all_ready and flow_ready
                flow_statuses[flow_name] = {
                    "ready": flow_ready,
                    "progress": status['progress'],
                    "percentage": f"{status['percentage']:.1f}%"
                }

            return {
                "service": "FlowLang Multi-Flow API Server",
                "version": self.app.version,
                "status": "ready" if all_ready else "incomplete",
                "flows": {
                    "count": len(self.flows),
                    "names": list(self.flows.keys()),
                    "status": flow_statuses
                },
                "documentation": {
                    "openapi": "/docs",
                    "redoc": "/redoc",
                    "openapi_json": "/openapi.json"
                },
                "endpoints": {
                    "info": {
                        "root": "/",
                        "health": "/health"
                    },
                    "flows": {
                        "list": "/flows",
                        "info": "/flows/{flow_name}",
                        "tasks": "/flows/{flow_name}/tasks",
                        "visualize": "/flows/{flow_name}/visualize"
                    },
                    "execution": {
                        "execute": "/flows/{flow_name}/execute",
                        "stream": "/flows/{flow_name}/execute/stream"
                    }
                }
            }

        @self.app.get("/health", tags=["Health"])
        async def health():
            """
            Health check endpoint showing status of all flows.

            Returns aggregate readiness: ready only if ALL flows are ready.
            """
            flow_statuses = []
            all_ready = True
            total_tasks = 0
            total_implemented = 0

            for flow_name, flow_data in self.flows.items():
                status = flow_data['registry'].get_implementation_status()
                flow_ready = status['unimplemented_count'] == 0
                all_ready = all_ready and flow_ready
                total_tasks += status['total']
                total_implemented += status['implemented']

                flow_statuses.append({
                    "name": flow_name,
                    "ready": flow_ready,
                    "tasks_implemented": status['implemented'],
                    "tasks_total": status['total'],
                    "tasks_pending": status['unimplemented_count'],
                    "progress": status['progress'],
                    "pending_task_names": status['unimplemented_tasks'] if not flow_ready else []
                })

            return {
                "status": "healthy",
                "server_type": "multi-flow",
                "flows_count": len(self.flows),
                "all_flows_ready": all_ready,
                "aggregate_tasks": {
                    "total": total_tasks,
                    "implemented": total_implemented,
                    "pending": total_tasks - total_implemented,
                    "progress": f"{total_implemented}/{total_tasks}"
                },
                "flows": flow_statuses
            }

        @self.app.get("/flows", response_model=List[FlowInfo], tags=["Flows"])
        async def list_flows():
            """List all available flows"""
            flows_list = []

            for flow_name, flow_data in self.flows.items():
                flow_def = flow_data['flow_def']

                inputs = [
                    FlowInputSchema(**inp) for inp in flow_def.get('inputs', [])
                ]
                outputs = [
                    FlowOutputSchema(**out) for out in flow_def.get('outputs', [])
                ]

                flows_list.append(FlowInfo(
                    name=flow_name,
                    description=flow_def.get('description'),
                    inputs=inputs,
                    outputs=outputs
                ))

            return flows_list

        @self.app.get("/flows/{flow_name}", response_model=FlowInfo, tags=["Flows"])
        async def get_flow_info(flow_name: str):
            """Get information about a specific flow"""
            if flow_name not in self.flows:
                available = ', '.join(self.flows.keys())
                raise HTTPException(
                    status_code=404,
                    detail=f"Flow not found: {flow_name}. Available flows: {available}"
                )

            flow_def = self.flows[flow_name]['flow_def']

            inputs = [
                FlowInputSchema(**inp) for inp in flow_def.get('inputs', [])
            ]
            outputs = [
                FlowOutputSchema(**out) for out in flow_def.get('outputs', [])
            ]

            return FlowInfo(
                name=flow_name,
                description=flow_def.get('description'),
                inputs=inputs,
                outputs=outputs
            )

        @self.app.post(
            "/flows/{flow_name}/execute",
            response_model=FlowExecuteResponse,
            tags=["Execution"],
            responses={
                200: {"description": "Flow executed successfully"},
                404: {"description": "Flow not found"},
                503: {"description": "Flow not ready - tasks not yet implemented"}
            }
        )
        async def execute_flow(flow_name: str, request: FlowExecuteRequest):
            """
            Execute a flow with the provided inputs.

            Returns the flow outputs on success, or error details on failure.
            Returns 503 Service Unavailable if not all tasks are implemented.
            """
            if flow_name not in self.flows:
                available = ', '.join(self.flows.keys())
                raise HTTPException(
                    status_code=404,
                    detail=f"Flow not found: {flow_name}. Available flows: {available}"
                )

            flow_data = self.flows[flow_name]
            registry = flow_data['registry']
            executor = flow_data['executor']
            flow_yaml = flow_data['flow_yaml']

            # Pre-flight check: verify all tasks are implemented
            status = registry.get_implementation_status()
            if status['unimplemented_count'] > 0:
                pending_tasks = status['unimplemented_tasks']
                progress = f"{status['implemented']}/{status['total']} ({status['percentage']:.1f}%)"

                response = FlowExecuteResponse(
                    success=False,
                    error="Flow not ready for execution",
                    error_details=f"{status['unimplemented_count']} of {status['total']} tasks are not yet implemented",
                    execution_time_ms=None,
                    flow=flow_name,
                    pending_tasks=pending_tasks,
                    implementation_progress=progress
                )

                return JSONResponse(
                    status_code=503,
                    content=response.model_dump()
                )

            start_time = time.time()

            try:
                # Execute the flow
                result = await executor.execute_flow(
                    flow_yaml,
                    inputs=request.inputs
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

        @self.app.post(
            "/flows/{flow_name}/execute/stream",
            tags=["Execution"],
            responses={
                200: {"description": "Flow execution events stream"},
                404: {"description": "Flow not found"},
                503: {"description": "Flow not ready - tasks not yet implemented"}
            }
        )
        async def execute_flow_stream(flow_name: str, request: FlowExecuteRequest):
            """
            Execute a flow and stream execution events in real-time using Server-Sent Events (SSE).

            Each event includes:
            - event: Event type (flow_started, step_started, step_completed, step_failed, flow_completed, flow_failed)
            - data: Event data as JSON

            Example event format:
            ```
            event: step_started
            data: {"step_id": "validate", "task": "ValidateUser", "timestamp": "2025-10-11T..."}

            event: step_completed
            data: {"step_id": "validate", "task": "ValidateUser", "outputs": {...}, "duration_ms": 12.5}
            ```

            Use with curl:
            ```
            curl -N -X POST http://localhost:8000/flows/MyFlow/execute/stream \\
              -H "Content-Type: application/json" \\
              -d '{"inputs": {...}}'
            ```
            """
            if flow_name not in self.flows:
                available = ', '.join(self.flows.keys())
                raise HTTPException(
                    status_code=404,
                    detail=f"Flow not found: {flow_name}. Available flows: {available}"
                )

            flow_data = self.flows[flow_name]
            registry = flow_data['registry']
            executor = flow_data['executor']
            flow_yaml = flow_data['flow_yaml']

            # Pre-flight check: verify all tasks are implemented
            status = registry.get_implementation_status()
            if status['unimplemented_count'] > 0:
                pending_tasks = status['unimplemented_tasks']
                progress = f"{status['implemented']}/{status['total']} ({status['percentage']:.1f}%)"

                # Return error as SSE event
                async def error_stream():
                    error_event = {
                        'success': False,
                        'error': 'Flow not ready for execution',
                        'error_details': f"{status['unimplemented_count']} of {status['total']} tasks are not yet implemented",
                        'flow': flow_name,
                        'pending_tasks': pending_tasks,
                        'implementation_progress': progress
                    }
                    yield f"event: error\ndata: {json.dumps(error_event)}\n\n"

                return StreamingResponse(
                    error_stream(),
                    media_type="text/event-stream",
                    status_code=503
                )

            # Create event stream
            async def event_stream():
                # Queue to collect events
                event_queue = asyncio.Queue()

                # Event callback that puts events in the queue
                async def event_callback(event_type: str, event_data: Dict[str, Any]):
                    await event_queue.put((event_type, event_data))

                # Task to execute the flow
                async def execute_task():
                    try:
                        # Execute the flow with event callback
                        result = await executor.execute_flow(
                            flow_yaml,
                            inputs=request.inputs,
                            event_callback=event_callback
                        )

                        # Put final result in queue (not already sent via events)
                        # This signals completion
                        await event_queue.put(('_done', result))

                    except Exception as e:
                        # Put error in queue
                        await event_queue.put(('_error', {
                            'error': str(e),
                            'error_type': type(e).__name__,
                            'error_details': traceback.format_exc()
                        }))

                # Start execution task
                execution_task = asyncio.create_task(execute_task())

                # Stream events as they arrive
                try:
                    while True:
                        event_type, event_data = await event_queue.get()

                        # Check for completion signals
                        if event_type == '_done':
                            # Execution completed - flow_completed event was already sent
                            break
                        elif event_type == '_error':
                            # Execution failed with unexpected error
                            yield f"event: error\ndata: {json.dumps(event_data)}\n\n"
                            break
                        else:
                            # Regular event - send to client
                            yield f"event: {event_type}\ndata: {json.dumps(event_data)}\n\n"

                except asyncio.CancelledError:
                    # Client disconnected - cancel execution
                    execution_task.cancel()
                    raise

            return StreamingResponse(
                event_stream(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "X-Accel-Buffering": "no",  # Disable buffering in nginx
                }
            )

        @self.app.get("/flows/{flow_name}/tasks", tags=["Tasks"])
        async def list_tasks(flow_name: str):
            """List all tasks for a flow with implementation status"""
            if flow_name not in self.flows:
                available = ', '.join(self.flows.keys())
                raise HTTPException(
                    status_code=404,
                    detail=f"Flow not found: {flow_name}. Available flows: {available}"
                )

            flow_data = self.flows[flow_name]
            registry = flow_data['registry']

            tasks = registry.list_tasks()
            status = registry.get_implementation_status()

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

        @self.app.get("/flows/{flow_name}/visualize", tags=["Visualization"])
        async def visualize_flow(flow_name: str):
            """
            Generate a Mermaid diagram visualization of the flow structure.

            Returns a Mermaid flowchart diagram showing:
            - Flow inputs and outputs
            - Task steps
            - Parallel execution
            - Conditional branching
            - Loops
            """
            if flow_name not in self.flows:
                available = ', '.join(self.flows.keys())
                raise HTTPException(
                    status_code=404,
                    detail=f"Flow not found: {flow_name}. Available flows: {available}"
                )

            try:
                from .visualizer import FlowVisualizer

                flow_data = self.flows[flow_name]
                flow_def = flow_data['flow_def']

                visualizer = FlowVisualizer(flow_def)
                diagram = visualizer.generate_mermaid()

                return {
                    "flow": flow_name,
                    "diagram": diagram,
                    "format": "mermaid"
                }
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Error generating visualization: {str(e)}"
                )

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
            reload: Enable auto-reload on code changes
            log_level: Logging level (debug, info, warning, error)
        """
        print("="*60)
        print(f"🚀 Starting FlowLang Multi-Flow API Server")
        print("="*60)
        print(f"Flows Directory: {self.flows_dir}")
        print(f"Flows Loaded: {len(self.flows)}")

        for flow_name, flow_data in self.flows.items():
            status = flow_data['registry'].get_implementation_status()
            ready = "✅" if status['unimplemented_count'] == 0 else "⚠️"
            print(f"  {ready} {flow_name}: {status['progress']} ({status['percentage']:.1f}%)")

        if self.enable_hot_reload:
            print(f"\n🔥 Hot reload: ENABLED")
            print(f"   Watching {len(self.flows)} flows for changes")
            print(f"   Changes to flow.py or flow.yaml will reload automatically!")

        print(f"\n📍 Server starting on http://{host}:{port}")
        print(f"📖 API Docs: http://{host}:{port}/docs")
        print(f"🔍 Health Check: http://{host}:{port}/health")

        if reload:
            print("\n⚠️  Note: For reliable auto-reload, use uvicorn directly:")
            print(f"   uvicorn api:app --host {host} --port {port} --reload")

        print("="*60)
        print()

        uvicorn.run(
            self.app,
            host=host,
            port=port,
            reload=False,
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


def create_multi_server(
    flows_dir: str = ".",
    **kwargs
) -> MultiFlowServer:
    """
    Factory function to create a MultiFlowServer instance.

    Args:
        flows_dir: Root directory containing flow subdirectories
        **kwargs: Additional arguments passed to MultiFlowServer constructor

    Returns:
        Configured MultiFlowServer instance
    """
    return MultiFlowServer(flows_dir=flows_dir, **kwargs)


if __name__ == '__main__':
    # Example: Run server from command line
    import argparse

    parser = argparse.ArgumentParser(
        description='FlowLang API Server',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Single flow mode
  python -m flowlang.server ./my_flow_project

  # Multi-flow mode
  python -m flowlang.server --multi ./flows_directory

  # With custom port
  python -m flowlang.server --multi ./flows --port 8080
        """
    )
    parser.add_argument(
        'directory',
        nargs='?',
        default='.',
        help='Project directory (single flow) or flows root directory (multi-flow)'
    )
    parser.add_argument(
        '--multi',
        action='store_true',
        help='Enable multi-flow mode (serve multiple flows from subdirectories)'
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
        if args.multi:
            # Multi-flow mode
            server = MultiFlowServer(flows_dir=args.directory, enable_hot_reload=args.reload)
            server.run(host=args.host, port=args.port, reload=args.reload)
        else:
            # Single flow mode
            server = FlowServer(project_dir=args.directory, enable_hot_reload=args.reload)
            server.run(host=args.host, port=args.port, reload=args.reload)
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
