#!/bin/bash
# Regenerate task stubs from flow.yaml
# Run this script whenever you update the flow definition

echo "🔄 Regenerating task stubs from flow.yaml..."
python -m flowlang.scaffolder flow.yaml -o .
echo "✅ Done! Check tasks.py, test_tasks.py, and README.md for updates."
