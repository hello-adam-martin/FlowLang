"""
FlowLang - A workflow orchestration language for describing task flows
"""

__version__ = "0.1.0"

from .executor import FlowExecutor
from .registry import TaskRegistry
from .context import FlowContext
from .scaffolder import FlowScaffolder
from .server import FlowServer, create_server
from .validator import FlowValidator, validate_flow, ValidationResult, ValidationError
from .exceptions import (
    FlowLangError,
    TaskNotFoundError,
    FlowValidationError,
    FlowExecutionError,
    NotImplementedTaskError,
)

# Client SDK (optional dependency - httpx required)
try:
    from .client import (
        FlowLangClient,
        FlowExecutionResult,
        FlowInfo as ClientFlowInfo,
        FlowNotReadyError,
        FlowNotFoundError,
    )
    _client_available = True
except ImportError:
    _client_available = False
    FlowLangClient = None
    FlowExecutionResult = None
    ClientFlowInfo = None
    FlowNotReadyError = None
    FlowNotFoundError = None

__all__ = [
    "FlowExecutor",
    "TaskRegistry",
    "FlowContext",
    "FlowScaffolder",
    "FlowServer",
    "create_server",
    "FlowValidator",
    "validate_flow",
    "ValidationResult",
    "ValidationError",
    "FlowLangError",
    "TaskNotFoundError",
    "FlowValidationError",
    "FlowExecutionError",
    "NotImplementedTaskError",
]

# Add client SDK exports if available
if _client_available:
    __all__.extend([
        "FlowLangClient",
        "FlowExecutionResult",
        "ClientFlowInfo",
        "FlowNotReadyError",
        "FlowNotFoundError",
    ])
