#!/usr/bin/env python3
"""
TodoManager API Server

Starts a REST API server for the TodoManager flow.
"""

import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from flowlang.server import FlowServer


def main():
    """Start the TodoManager API server"""
    # Create server for current directory (contains flow.yaml and tasks.py)
    server = FlowServer(
        project_dir=".",
        title="TodoManager API",
        version="1.0.0"
    )

    # Run the server
    server.run(
        host="0.0.0.0",
        port=8000,
        reload=True  # Auto-reload on code changes
    )


if __name__ == '__main__':
    main()
