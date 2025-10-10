#!/bin/bash
# Start TodoManager API Server
# Usage: ./start_server.sh [--reload]

cd "$(dirname "$0")/.."  # Move to project root

echo "========================================"
echo "Starting TodoManager API Server..."
echo "========================================"
echo ""

# Check if virtual environment exists
if [ ! -d "../myenv" ]; then
    echo "❌ Virtual environment not found at ../myenv"
    echo "Please create it first with: python -m venv myenv"
    exit 1
fi

# Activate virtual environment
source ../myenv/bin/activate

# Check if dependencies are installed
if ! python -c "import fastapi" 2>/dev/null; then
    echo "❌ FastAPI not installed. Installing dependencies..."
    pip install -r ../requirements.txt
fi

echo "Starting server with uvicorn..."
echo "📖 API Docs: http://localhost:8000/docs"
echo "🔍 Health: http://localhost:8000/health"
echo "Press Ctrl+C to stop"
echo ""

# Check if --reload flag is passed
if [ "$1" = "--reload" ]; then
    echo "🔄 Auto-reload enabled"
    uvicorn api:app --host 0.0.0.0 --port 8000 --reload
else
    uvicorn api:app --host 0.0.0.0 --port 8000
fi
