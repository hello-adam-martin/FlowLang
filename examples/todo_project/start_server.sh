#!/bin/bash
# Start TodoManager API Server
# Usage: ./start_server.sh

cd "$(dirname "$0")"

echo "========================================"
echo "Starting TodoManager API Server..."
echo "========================================"
echo ""

# Check if virtual environment exists
if [ ! -d "../../myenv" ]; then
    echo "❌ Virtual environment not found at ../../myenv"
    echo "Please create it first with: python -m venv myenv"
    exit 1
fi

# Activate virtual environment
source ../../myenv/bin/activate

# Check if dependencies are installed
if ! python -c "import fastapi" 2>/dev/null; then
    echo "❌ FastAPI not installed. Installing dependencies..."
    pip install -r ../../requirements.txt
fi

echo "Starting server..."
echo "Press Ctrl+C to stop"
echo ""

# Start the server
python run_server.py
