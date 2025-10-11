"""
UserAuth API - FastAPI app instance

This module creates the FastAPI app that can be run with uvicorn directly:
    uvicorn api:app --host 0.0.0.0 --port 8000 --reload
"""

import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from flowlang.server import FlowServer

# Create the server and get the FastAPI app
server = FlowServer(
    project_dir=".",
    tasks_file="flow.py",
    title="UserAuth API",
    version="1.0.0"
)

# Export the app for uvicorn
app = server.app
