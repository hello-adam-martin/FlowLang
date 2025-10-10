#!/bin/bash
# Smart generator - automatically detects whether to scaffold or update
# Usage: ./generate.sh

set -e

FLOW_FILE="flow.yaml"
OUTPUT_DIR="."

# Activate virtual environment if it exists
if [ -d "../../myenv" ]; then
    source ../../myenv/bin/activate
elif [ -d "../myenv" ]; then
    source ../myenv/bin/activate
elif [ -d "myenv" ]; then
    source myenv/bin/activate
fi

# Check if flow.yaml exists
if [ ! -f "$FLOW_FILE" ]; then
    echo "❌ Error: flow.yaml not found in current directory"
    exit 1
fi

# Move to parent directory (project root)
cd ..

# Check if this is an existing project by looking for flow.py
if [ -f "flow.py" ]; then
    echo "📦 Existing project detected"
    echo "🔄 Running UPDATE to preserve your implementations..."
    echo ""
    python -m flowlang.scaffolder update "$FLOW_FILE" -o "$OUTPUT_DIR"
    echo ""
    echo "✅ Update complete! Your implementations have been preserved."
else
    echo "🆕 New project detected"
    echo "🏗️  Running SCAFFOLD to create initial structure..."
    echo ""
    python -m flowlang.scaffolder scaffold "$FLOW_FILE" -o "$OUTPUT_DIR"
    echo ""
    echo "✅ Scaffold complete! Start implementing tasks in flow.py"
fi

echo ""
echo "📝 Next steps:"
echo "   - Check flow.py for task stubs to implement"
echo "   - Run: python tools/run_server.py"
echo "   - Visit: http://localhost:8000/docs"
