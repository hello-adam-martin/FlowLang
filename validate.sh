#!/bin/bash
# Interactive flow validator - Validate all or selected flows
# Usage: ./validate.sh

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
echo "FlowLang - Flow Validator"
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
echo "Validate which flows?"
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
    echo "🔍 Validating ALL flows..."
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
echo "Validating ${#flows_to_process[@]} flow(s)..."
echo "========================================"
echo ""

success_count=0
warning_count=0
error_count=0

for flow_file in "${flows_to_process[@]}"; do
    filename=$(basename "$flow_file")
    flow_name="${filename%.yaml}"

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔍 Validating: $filename"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Check if YAML is valid
    if ! python -c "import yaml; yaml.safe_load(open('$flow_file'))" 2>/dev/null; then
        echo "   ❌ Invalid YAML syntax"
        error_count=$((error_count + 1))
        echo ""
        continue
    fi

    # Extract flow name from YAML
    yaml_flow_name=$(python -c "import yaml; print(yaml.safe_load(open('$flow_file')).get('flow', ''))" 2>/dev/null)

    if [ -z "$yaml_flow_name" ]; then
        echo "   ❌ Missing 'flow' field in YAML"
        error_count=$((error_count + 1))
        echo ""
        continue
    fi

    # Convert flow name to PascalCase directory name
    flow_dir="flows/$yaml_flow_name"

    # Check if generated directory exists
    if [ ! -d "$flow_dir" ]; then
        echo "   ⚠️  Directory not found: $flow_dir"
        echo "   💡 Run: python -m flowlang.scaffolder auto $flow_file"
        warning_count=$((warning_count + 1))
        echo ""
        continue
    fi

    # Check if flow.py exists
    if [ ! -f "$flow_dir/flow.py" ]; then
        echo "   ❌ Missing flow.py in $flow_dir"
        error_count=$((error_count + 1))
        echo ""
        continue
    fi

    # Run flow validation (YAML structure, variable references, etc.)
    echo "   🔍 Running flow validation..."
    validation_output=$(python -m flowlang validate "$flow_file" --tasks-file="$flow_dir/flow.py" 2>&1 || true)

    # Check for validation errors and warnings
    if echo "$validation_output" | grep -q "❌ Flow validation failed"; then
        echo -e "   ${RED}❌ Flow validation failed${NC}"
        # Show error details (lines starting with "  [" after filtering)
        echo "$validation_output" | grep "^  \[" | while read -r line; do
            echo -e "   ${RED}${line}${NC}"
        done
        error_count=$((error_count + 1))
        echo ""
        continue
    elif echo "$validation_output" | grep -q "⚠️.*Warning"; then
        echo -e "   ${YELLOW}⚠️  Flow has validation warnings${NC}"
        # Show warning details (lines starting with "  [")
        echo "$validation_output" | grep "^  \[" | while read -r line; do
            echo -e "   ${YELLOW}${line}${NC}"
        done
        warning_count=$((warning_count + 1))
    else
        echo -e "   ${GREEN}✅ Flow validation passed${NC}"
    fi
    echo ""

    # Check implementation status
    echo "   📊 Checking implementation status..."

    # Run the flow.py status check
    impl_output=$(cd "$flow_dir" && python flow.py 2>&1 || true)

    # Extract implementation stats
    total=$(echo "$impl_output" | grep "Total Tasks:" | awk '{print $3}' || echo "0")
    implemented=$(echo "$impl_output" | grep "Implemented:" | awk '{print $2}' || echo "0")
    pending=$(echo "$impl_output" | grep "Pending:" | awk '{print $2}' || echo "0")

    if [ "$total" = "0" ]; then
        echo -e "   ${YELLOW}⚠️  Could not determine implementation status${NC}"
        warning_count=$((warning_count + 1))
    elif [ "$pending" = "0" ]; then
        echo -e "   ${GREEN}✅ All tasks implemented ($implemented/$total)${NC}"
        success_count=$((success_count + 1))
    else
        echo -e "   ${YELLOW}⚠️  Implementation incomplete: ${BOLD}$implemented/$total${NC}${YELLOW} tasks${NC}"
        echo -e "   ${YELLOW}📝 $pending task(s) still pending${NC}"

        # Show pending tasks
        pending_tasks=$(echo "$impl_output" | sed -n '/⚠️  Pending Tasks:/,/^$/p' | grep "\[ \]" | sed 's/^[[:space:]]*/      /' || true)
        if [ -n "$pending_tasks" ]; then
            echo "$pending_tasks"
        fi

        warning_count=$((warning_count + 1))
    fi

    # Check if flow.yaml exists in the directory
    if [ ! -f "$flow_dir/flow.yaml" ]; then
        echo "   ⚠️  Missing flow.yaml in $flow_dir (should be copied from source)"
    fi

    # Check if tests exist
    if [ ! -f "$flow_dir/tests/test_tasks.py" ]; then
        echo "   ⚠️  Missing tests/test_tasks.py"
    fi

    # Check if API file exists
    if [ ! -f "$flow_dir/api.py" ]; then
        echo "   ⚠️  Missing api.py (needed for server)"
    fi

    echo ""
done

# Summary
echo "========================================"
echo "📊 Validation Summary"
echo "========================================"
echo "Total validated: ${#flows_to_process[@]}"
echo -e "${GREEN}✅ Fully implemented: $success_count${NC}"
if [ $warning_count -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Warnings: $warning_count${NC}"
fi
if [ $error_count -gt 0 ]; then
    echo -e "${RED}❌ Errors: $error_count${NC}"
fi
echo "========================================"
echo ""

if [ $warning_count -gt 0 ] || [ $error_count -gt 0 ]; then
    echo "💡 Next steps:"
    if [ $error_count -gt 0 ]; then
        echo "   - Fix YAML syntax errors"
        echo "   - Generate missing projects: ./generate_flows.sh"
    fi
    if [ $warning_count -gt 0 ]; then
        echo "   - Implement pending tasks in flows/*/flow.py"
        echo "   - Run tests: pytest flows/*/tests/"
    fi
    echo ""
    exit 1
else
    echo "🎉 All flows validated successfully!"
    echo ""
    echo "💡 Next steps:"
    echo "   - Run tests: pytest flows/*/tests/"
    echo "   - Start multi-flow server: ./start_multi_server.sh"
    echo ""
    exit 0
fi
