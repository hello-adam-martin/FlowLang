"""
EarlyTerminationPatterns API - FastAPI app instance

This module creates the FastAPI app that can be run with uvicorn directly:
    uvicorn api:app --host 0.0.0.0 --port 8000 --reload

Hot reload will automatically reload tasks and flow definitions when files change!
"""

import sys
import os
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from flowlang.server import FlowServer

# Check if running with uvicorn reload
# When uvicorn uses --reload, it sets PYTHONPATH and runs with watchfiles
enable_hot_reload = os.getenv('UVICORN_RELOAD', 'false').lower() == 'true' or '--reload' in sys.argv

# Create the server and get the FastAPI app
server = FlowServer(
    project_dir=".",
    tasks_file="flow.py",
    title="EarlyTerminationPatterns API",
    version="1.0.0",
    enable_hot_reload=True  # Enable hot reload for development
)

# Export the app for uvicorn
app = server.app
