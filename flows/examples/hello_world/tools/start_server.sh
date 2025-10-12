#!/bin/bash
# Start HelloWorld API Server
# Usage: ./start_server.sh [--reload]

cd "$(dirname "$0")/.."  # Move to project root

echo "========================================"
echo "Starting HelloWorld API Server..."
echo "========================================"
echo ""

# Activate virtual environment if it exists
# Check common locations: ../../myenv (FlowLang root), ../myenv, ./myenv
VENV_ACTIVATED=false
if [ -d "../../myenv" ]; then
    echo "🐍 Activating virtual environment: ../../myenv"
    source ../../myenv/bin/activate
    VENV_ACTIVATED=true
elif [ -d "../myenv" ]; then
    echo "🐍 Activating virtual environment: ../myenv"
    source ../myenv/bin/activate
    VENV_ACTIVATED=true
elif [ -d "myenv" ]; then
    echo "🐍 Activating virtual environment: ./myenv"
    source myenv/bin/activate
    VENV_ACTIVATED=true
else
    echo "⚠️  No virtual environment found"
    echo "   Checked: ../../myenv, ../myenv, ./myenv"
    echo "   Continuing without virtual environment..."
fi

# Check if dependencies are installed
if ! python -c "import fastapi" 2>/dev/null; then
    echo "❌ FastAPI not installed. Installing dependencies..."
    pip install -r ../../requirements.txt 2>/dev/null || pip install -r ../requirements.txt 2>/dev/null || pip install fastapi uvicorn pyyaml
fi

echo ""
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
