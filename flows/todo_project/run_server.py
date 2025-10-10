#!/usr/bin/env python3
"""
TodoManager API Server

Starts a REST API server for the TodoManager flow.

Usage:
    python run_server.py              # Run with defaults
    python run_server.py --port 8080  # Custom port
    python run_server.py --no-reload  # Disable auto-reload
"""

import sys
import argparse
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))


def main():
    """Start the TodoManager API server"""
    parser = argparse.ArgumentParser(
        description='TodoManager REST API Server',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Start with defaults (port 8000, auto-reload)
  python run_server.py

  # Use custom port
  python run_server.py --port 8080

  # Disable auto-reload (for production)
  python run_server.py --no-reload

  # Run on specific host
  python run_server.py --host 127.0.0.1

  # Alternative: Use uvicorn directly for more control
  uvicorn api:app --host 0.0.0.0 --port 8000 --reload --workers 4
        """
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
        '--no-reload',
        action='store_true',
        help='Disable auto-reload on code changes'
    )
    parser.add_argument(
        '--log-level',
        default='info',
        choices=['critical', 'error', 'warning', 'info', 'debug'],
        help='Logging level (default: info)'
    )

    args = parser.parse_args()

    # Import here to avoid issues with reload
    from flowlang.server import FlowServer

    print("\n" + "="*70)
    print("🚀 TodoManager API Server")
    print("="*70)
    print(f"Starting server on http://{args.host}:{args.port}")

    if not args.no_reload:
        print("\n💡 For auto-reload during development, use uvicorn directly:")
        print(f"   uvicorn api:app --host {args.host} --port {args.port} --reload")

    print(f"\n📖 Interactive API docs: http://localhost:{args.port}/docs")
    print(f"🔍 Health check:        http://localhost:{args.port}/health")
    print("\n💡 Press Ctrl+C to stop the server")
    print("="*70 + "\n")

    try:
        # Create server for current directory (contains flow.yaml and tasks.py)
        server = FlowServer(
            project_dir=".",
            title="TodoManager API",
            version="1.0.0"
        )

        # Run the server (reload is always False, use uvicorn for reload)
        server.run(
            host=args.host,
            port=args.port,
            reload=False,
            log_level=args.log_level
        )
    except KeyboardInterrupt:
        print("\n\n" + "="*70)
        print("👋 Server stopped by user")
        print("="*70)
    except Exception as e:
        print(f"\n❌ Error starting server: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
