#!/bin/bash
# Create a new flow from a template
# Usage: ./create_flow_from_template.sh [OPTIONS]

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Change to project root
cd "$(dirname "$0")/.."

# Activate virtual environment if it exists
if [ -d "myenv" ]; then
    echo -e "${BLUE}🐍 Activating virtual environment...${NC}"
    source myenv/bin/activate
fi

# Function to show usage
show_usage() {
    cat << EOF
${GREEN}FlowLang Template Creator${NC}

Create a new flow from a pre-built template.

${YELLOW}Usage:${NC}
    $0                                           # Interactive mode (default)
    $0 --template TEMPLATE --name FLOW_NAME [OPTIONS]  # Direct mode

${YELLOW}Available Templates:${NC}
$(python -m flowlang template list 2>/dev/null | tail -n +3)

${YELLOW}Options:${NC}
    --interactive, -i       Interactive mode (default if no args provided)
    --template, -t NAME     Template name (e.g., APIIntegration)
    --name, -n NAME         Flow name (e.g., MyAPI)
    --output, -o DIR        Output directory (default: flows/FLOW_NAME)
    --help, -h              Show this help message

${YELLOW}Interactive Mode (Default):${NC}
    $0                    # Just run it!
    $0 --interactive      # Or be explicit

${YELLOW}Direct Mode Examples:${NC}
    # GitHub API integration
    $0 --template APIIntegration --name GitHubAPI \\
       --var API_BASE_URL="https://api.github.com" \\
       --var API_KEY_ENV_VAR="GITHUB_TOKEN"

    # Stripe API integration
    $0 --template APIIntegration --name StripeAPI \\
       --var API_BASE_URL="https://api.stripe.com" \\
       --var API_KEY_ENV_VAR="STRIPE_API_KEY" \\
       --var AUTH_HEADER_PREFIX="Bearer "

${YELLOW}After Creation:${NC}
    cd flows/YourFlowName
    python flow.py                     # Check status
    ./tools/start_server.sh --reload   # Start API server

EOF
}

# Interactive mode
run_interactive() {
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  FlowLang Template Creator (Interactive)  ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""

    # List available templates
    echo -e "${BLUE}Available Templates:${NC}"
    python -m flowlang template list
    echo ""

    # Get template name
    read -p "$(echo -e ${YELLOW}Enter template name [APIIntegration]: ${NC})" TEMPLATE
    TEMPLATE=${TEMPLATE:-APIIntegration}

    # Get flow name
    read -p "$(echo -e ${YELLOW}Enter flow name: ${NC})" FLOW_NAME
    if [ -z "$FLOW_NAME" ]; then
        echo -e "${RED}Error: Flow name is required${NC}"
        exit 1
    fi

    # Always use flows/ directory
    OUTPUT_DIR="flows/$FLOW_NAME"

    echo ""
    echo -e "${BLUE}Getting template variables...${NC}"

    # Get template variables (format: "  {{VAR_NAME}}")
    VARS=$(python -m flowlang template vars $TEMPLATE 2>/dev/null | grep "^  {{" | sed 's/^  {{\(.*\)}}$/\1/')

    # Build command using array for proper quoting
    CMD_ARGS=("python" "-m" "flowlang" "template" "create" "$TEMPLATE" "$OUTPUT_DIR")

    echo ""
    echo -e "${YELLOW}Please provide values for template variables:${NC}"
    echo ""

    for VAR in $VARS; do
        # Provide sensible defaults based on variable name
        DEFAULT=""
        case $VAR in
            FLOW_NAME)
                DEFAULT=$FLOW_NAME
                ;;
            FLOW_DESCRIPTION)
                DEFAULT="$FLOW_NAME API integration"
                ;;
            API_BASE_URL)
                DEFAULT="https://api.example.com"
                ;;
            API_KEY_ENV_VAR)
                DEFAULT="${FLOW_NAME}_API_KEY"
                ;;
            AUTH_HEADER_NAME)
                DEFAULT="Authorization"
                ;;
            AUTH_HEADER_PREFIX)
                DEFAULT="Bearer "
                ;;
        esac

        if [ -n "$DEFAULT" ]; then
            read -p "$(echo -e ${YELLOW}  $VAR [$DEFAULT]: ${NC})" VALUE
            VALUE=${VALUE:-$DEFAULT}
        else
            read -p "$(echo -e ${YELLOW}  $VAR: ${NC})" VALUE
        fi

        CMD_ARGS+=("--var" "$VAR=$VALUE")
    done

    echo ""
    echo -e "${BLUE}Creating flow...${NC}"
    echo ""

    # Execute command with proper quoting
    "${CMD_ARGS[@]}"

    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Flow created successfully!${NC}"
        echo ""

        # Run scaffolder to generate complete project structure (use update to merge with template)
        echo -e "${BLUE}Generating complete project structure...${NC}"
        python -m flowlang scaffolder update "$OUTPUT_DIR/flow.yaml" -o "$OUTPUT_DIR"

        if [ $? -eq 0 ]; then
            echo ""
            echo -e "${GREEN}✅ Project structure generated!${NC}"
            echo ""
            echo -e "${YELLOW}Next steps:${NC}"
            echo -e "  cd $OUTPUT_DIR"
            echo -e "  python flow.py                     # Check implementation status"
            echo -e "  python -m flowlang validate flow.yaml  # Validate the flow"
            echo -e "  ./tools/start_server.sh --reload   # Start API server with hot reload"
            echo ""
            echo -e "${BLUE}The flow has full implementations - customize as needed!${NC}"
        else
            echo -e "${RED}⚠️  Template created but scaffolder failed${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Failed to create flow${NC}"
        exit 1
    fi
}

# Parse arguments
if [ $# -eq 0 ] || [ "$1" == "--interactive" ] || [ "$1" == "-i" ]; then
    run_interactive
    exit 0
fi

if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    show_usage
    exit 0
fi

# Direct mode - parse arguments
TEMPLATE=""
FLOW_NAME=""
OUTPUT_DIR=""
VARS=""

while [ $# -gt 0 ]; do
    case $1 in
        --template|-t)
            TEMPLATE="$2"
            shift 2
            ;;
        --name|-n)
            FLOW_NAME="$2"
            shift 2
            ;;
        --output|-o)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --var)
            VARS="$VARS --var $2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_usage
            exit 1
            ;;
    esac
done

# Validate required arguments
if [ -z "$TEMPLATE" ] || [ -z "$FLOW_NAME" ]; then
    echo -e "${RED}Error: --template and --name are required${NC}"
    echo ""
    show_usage
    exit 1
fi

# Set default output directory
if [ -z "$OUTPUT_DIR" ]; then
    OUTPUT_DIR="flows/$FLOW_NAME"
fi

# Add FLOW_NAME to variables if not already specified
if [[ ! $VARS =~ FLOW_NAME ]]; then
    VARS="--var FLOW_NAME=\"$FLOW_NAME\" $VARS"
fi

# Execute command
echo -e "${BLUE}Creating flow from template...${NC}"
CMD="python -m flowlang template create $TEMPLATE $OUTPUT_DIR $VARS"
echo -e "${YELLOW}Command: $CMD${NC}"
echo ""

eval $CMD

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Flow created successfully!${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "  cd $OUTPUT_DIR"
    echo -e "  python flow.py"
    echo -e "  ./tools/start_server.sh --reload"
else
    echo -e "${RED}❌ Failed to create flow${NC}"
    exit 1
fi
