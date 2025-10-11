#!/bin/bash
# Interactive flow generator - Generate all or selected flows from YAML templates
# Usage: ./generate_flows.sh

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo "========================================"
echo "FlowLang - Flow Generator"
echo "========================================"
echo ""

# Activate virtual environment if it exists
if [ -d "myenv" ]; then
    echo "🐍 Activating virtual environment"
    source myenv/bin/activate
    echo ""
fi

# Check if flows directory exists
if [ ! -d "flows" ]; then
    echo "❌ Error: flows/ directory not found"
    exit 1
fi

# Find all YAML files in flows/ directory (not in subdirectories)
# Compatible with bash 3.2+
yaml_files=()
while IFS= read -r -d $'\0' file; do
    yaml_files+=("$file")
done < <(find flows -maxdepth 1 -name "*.yaml" -type f -print0 | sort -z)

# Check if any YAML files were found
if [ ${#yaml_files[@]} -eq 0 ]; then
    echo "⚠️  No YAML flow files found in flows/"
    echo ""
    echo "Create a flow file like flows/my_flow.yaml to get started"
    exit 1
fi

# Display available flows
echo "📋 Found ${#yaml_files[@]} flow file(s):"
echo ""
for i in "${!yaml_files[@]}"; do
    filename=$(basename "${yaml_files[$i]}")
    printf "  %2d. %s\n" $((i+1)) "$filename"
done

echo ""
echo "========================================"
echo "Generate which flows?"
echo "========================================"
echo "  [a] All flows"
echo "  [1-${#yaml_files[@]}] Specific flows (space-separated numbers)"
echo "  [q] Quit"
echo ""
read -p "Enter choice: " choice

# Handle quit
if [[ "$choice" == "q" ]] || [[ "$choice" == "quit" ]]; then
    echo ""
    echo "👋 Cancelled"
    exit 0
fi

# Determine which flows to process
flows_to_process=()

if [[ "$choice" == "a" ]] || [[ "$choice" == "all" ]]; then
    # Process all flows
    flows_to_process=("${yaml_files[@]}")
    echo ""
    echo "🔄 Generating ALL flows..."
else
    # Parse user input (numbers or flow names)
    IFS=' ' read -ra selections <<< "$choice"

    for selection in "${selections[@]}"; do
        # Check if it's a number
        if [[ "$selection" =~ ^[0-9]+$ ]]; then
            idx=$((selection - 1))
            if [ $idx -ge 0 ] && [ $idx -lt ${#yaml_files[@]} ]; then
                flows_to_process+=("${yaml_files[$idx]}")
            else
                echo "⚠️  Warning: Invalid number $selection (out of range)"
            fi
        else
            # Try to match by filename
            matched=false
            for yaml_file in "${yaml_files[@]}"; do
                filename=$(basename "$yaml_file")
                if [[ "$filename" == "$selection"* ]] || [[ "$filename" == *"$selection"* ]]; then
                    flows_to_process+=("$yaml_file")
                    matched=true
                    break
                fi
            done
            if [ "$matched" = false ]; then
                echo "⚠️  Warning: No flow matching '$selection'"
            fi
        fi
    done
fi

# Check if we have any flows to process
if [ ${#flows_to_process[@]} -eq 0 ]; then
    echo ""
    echo "❌ No valid flows selected"
    exit 1
fi

# Process selected flows
echo ""
echo "========================================"
echo "Processing ${#flows_to_process[@]} flow(s)..."
echo "========================================"
echo ""

success_count=0
error_count=0

for flow_file in "${flows_to_process[@]}"; do
    filename=$(basename "$flow_file")
    echo "🔨 Generating: $filename"
    echo ""

    # Capture output and check for success
    output=$(python -m flowlang.scaffolder auto "$flow_file" 2>&1)

    # Show only validation results (filter verbose scaffolding output)
    # Match: validation headers, success/error/warning messages, and detail lines starting with spaces + "["
    echo "$output" | grep -E "🔍 Validating|✅ No issues|❌.*error|⚠️.*warning|^      \[" | while read -r line; do
        # Add color to warnings and errors
        if [[ "$line" =~ "warning" ]]; then
            echo -e "   ${YELLOW}${line}${NC}"
        elif [[ "$line" =~ "error" ]]; then
            echo -e "   ${RED}${line}${NC}"
        elif [[ "$line" =~ "✅" ]]; then
            echo -e "   ${GREEN}${line}${NC}"
        elif [[ "$line" =~ ^[[:space:]]*\[ ]]; then
            # Detail lines (error/warning details) - start with spaces and [
            echo -e "   ${YELLOW}${line}${NC}"
        else
            echo "   $line"
        fi
    done

    # Check if successful
    if echo "$output" | grep -q "complete\|Update complete"; then
        echo -e "   ${GREEN}✅ Success${NC}"
        success_count=$((success_count + 1))
    else
        echo -e "   ${RED}❌ Failed${NC}"
        error_count=$((error_count + 1))
    fi
    echo ""
done

# Summary
echo "========================================"
echo "📊 Generation Summary"
echo "========================================"
echo "Total processed: ${#flows_to_process[@]}"
echo -e "${GREEN}✅ Success: $success_count${NC}"
if [ $error_count -gt 0 ]; then
    echo -e "${RED}❌ Errors: $error_count${NC}"
fi
echo "========================================"
echo ""

if [ $success_count -gt 0 ]; then
    echo "📝 Next steps:"
    echo "   - Review generated projects in flows/*/"
    echo "   - Implement tasks in flows/*/flow.py"
    echo "   - Start multi-flow server: ./start_multi_server.sh"
    echo ""
fi

exit 0
