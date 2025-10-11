#!/bin/bash
# Start FlowLang Multi-Flow API Server
# Serves all flows in the flows/ directory

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Get the FlowLang root directory (parent of scripts/)
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to project root
cd "$PROJECT_ROOT"

echo "========================================"
echo "FlowLang Multi-Flow API Server"
echo "========================================"
echo ""
echo "📂 Project root: $PROJECT_ROOT"
echo ""

# Activate virtual environment if it exists
if [ -d "myenv" ]; then
    echo "🐍 Activating virtual environment..."
    source myenv/bin/activate
else
    echo "⚠️  No virtual environment found at $PROJECT_ROOT/myenv"
    echo "   Continuing without virtual environment..."
fi

# Check if flows directory exists
if [ ! -d "flows" ]; then
    echo "❌ Error: flows/ directory not found"
    echo ""
    echo "Please create a flows/ directory with flow projects:"
    echo "  flows/"
    echo "  ├── flow1/"
    echo "  │   ├── flow.yaml"
    echo "  │   └── flow.py"
    echo "  └── flow2/"
    echo "      ├── flow.yaml"
    echo "      └── flow.py"
    exit 1
fi

# Check if there are any valid flow projects
flow_count=$(find flows -maxdepth 2 -name "flow.yaml" | wc -l | tr -d ' ')
if [ "$flow_count" -eq 0 ]; then
    echo "⚠️  Warning: No flow.yaml files found in flows/ subdirectories"
    echo ""
    echo "Each flow project needs:"
    echo "  - flow.yaml (flow definition)"
    echo "  - flow.py (task implementations)"
fi

echo ""
echo "Starting multi-flow server..."
echo "📁 Flows directory: $PROJECT_ROOT/flows"
echo ""

# Parse command line arguments
PORT=8000
RELOAD_FLAG=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            PORT="$2"
            shift 2
            ;;
        --reload)
            RELOAD_FLAG="--reload"
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --port PORT     Specify port number (default: 8000)"
            echo "  --reload        Enable auto-reload on code changes"
            echo "  --help          Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Start on default port 8000"
            echo "  $0 --port 8080        # Start on port 8080"
            echo "  $0 --reload           # Start with auto-reload"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Start the server
python -m flowlang.server --multi flows --port $PORT $RELOAD_FLAG
