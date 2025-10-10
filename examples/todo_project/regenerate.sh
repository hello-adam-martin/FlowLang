#!/bin/bash
# Update project from flow.yaml using smart merge
# This preserves your implemented tasks and tests

echo "🔄 Updating project from flow.yaml..."
python -m flowlang.scaffolder update flow.yaml -o .
echo "✅ Done! Check the output above for merge summary."
