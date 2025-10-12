---
description: Orchestrate a FlowLang project through all phases using specialized agents
---

# FlowLang Project Orchestration

You are orchestrating a complete FlowLang project workflow using specialized agents.

## Your Role

You act as the **orchestrator** - guiding the user through each phase and delegating to specialized agents.

**CRITICAL RULES:**
1. Show clear phase markers with status (✅ complete, 🔄 in progress, ⏸️ waiting)
2. Use the Task tool to invoke specialized agents (business-analyst, business-process-designer, etc.)
3. Display all agent outputs to the user immediately
4. Wait for user to type 'continue' before proceeding to next phase
5. If an agent asks questions, show them to the user one at a time
6. Pass user answers back to the agent by invoking it again with the answers

## Workflow Phases

### Phase 0: Project Initialization
**Who does it:** YOU (using Bash tool)

**Actions:**
1. Check if project directory exists in flows/
2. If not, run: `flowlang project init <PROJECT_NAME> --name "<Display Name>" --description "<description>" --skip-connections`
3. Verify only project.yaml was created (no flow directories yet)

**Output:** flows/<PROJECT_NAME>/project.yaml

---

### Phase 1: Requirements Gathering
**Who does it:** business-analyst agent

**Actions:**
1. Display: "🔄 Phase 1: Requirements Gathering - Invoking business-analyst agent"
2. Use Task tool to invoke business-analyst with:
   - Project location: /Users/adam/Projects/FlowLang/flows/<PROJECT_NAME>
   - Flow name: <flow-name>
   - User's initial request
   - **IMPORTANT:** Instruction to create REQUIREMENTS.md in flow directory: `flows/<PROJECT_NAME>/<flow-name>/REQUIREMENTS.md`
   - NOT in project directory (to support multiple flows per project)
3. Business-analyst will ask questions - show them to user one at a time
4. When user answers, invoke business-analyst again with the answers
5. Repeat until business-analyst creates REQUIREMENTS.md

**Output:** flows/<PROJECT_NAME>/<flow-name>/REQUIREMENTS.md

---

### Phase 2: Flow Design
**Who does it:** business-process-designer agent, then yaml-flow-expert agent

**Actions:**
1. Display: "🔄 Phase 2: Flow Design - Invoking business-process-designer agent"
2. Use Task tool to invoke business-process-designer with:
   - Project location
   - REQUIREMENTS.md path: `flows/<PROJECT_NAME>/<flow-name>/REQUIREMENTS.md`
   - Flow name
   - **IMPORTANT:** Instruct to create **ONLY flow.yaml** (no documentation files)
   - Specify Mode 1: Initial Flow Design
3. Wait for business-process-designer to complete
4. Display: "🔄 Phase 2: Flow Validation - Invoking yaml-flow-expert agent"
5. Use Task tool to invoke yaml-flow-expert with:
   - flow.yaml path
   - Instruction to validate and optimize
6. Wait for yaml-flow-expert to complete

**Output:** flows/<PROJECT_NAME>/<flow-name>/flow.yaml (validated and finalized)

---

### Phase 3: Scaffolding
**Who does it:** YOU (using Bash tool)

**Actions:**
1. Display: "🔄 Phase 3: Scaffolding - Generating project structure"
2. Run: `cd /Users/adam/Projects/FlowLang && source myenv/bin/activate && python -m flowlang.scaffolder auto flows/<PROJECT_NAME>/<flow-name>/flow.yaml`
3. Verify generated files:
   - flow.py
   - api.py
   - tests/test_tasks.py
   - tools/generate.sh
   - tools/start_server.sh
   - README.md (basic scaffolder-generated)

**Output:** Complete project structure with task stubs

---

### Phase 3.5: Documentation Generation
**Who does it:** business-process-designer agent (Mode 2: Documentation Generation)

**Actions:**
1. Display: "🔄 Phase 3.5: Documentation Generation - Creating comprehensive docs"
2. Use Task tool to invoke business-process-designer with:
   - Flow directory path
   - **IMPORTANT:** Specify Mode 2: Documentation Generation
   - Instruct to read scaffolded files (flow.yaml, flow.py, api.py, tests/)
   - Create comprehensive documentation:
     - README.md (replace scaffolder-generated with comprehensive version)
     - IMPLEMENTATION_GUIDE.md (developer guide with code references)
     - FLOW_DIAGRAM.md (visual flow diagrams)
     - SUMMARY.md (executive overview)
     - INDEX.md (navigation guide)
3. Wait for business-process-designer to complete

**Output:** Comprehensive project documentation referencing actual scaffolded code

---

### Phase 4: Task Implementation
**Who does it:** task-implementer agent, then test-developer agent

**Actions:**
1. Display: "🔄 Phase 4: Task Implementation - Invoking task-implementer agent"
2. Use Task tool to invoke task-implementer with:
   - flow.yaml path
   - flow.py path
   - Instruction to implement all tasks
3. Wait for task-implementer to complete
4. Display: "🔄 Phase 4: Test Development - Invoking test-developer agent"
5. Use Task tool to invoke test-developer with:
   - flow.yaml path
   - flow.py path
   - tests/test_tasks.py path
   - Instruction to write comprehensive tests
6. Wait for test-developer to complete

**Output:** Fully implemented flow.py and tests/test_tasks.py

---

### Phase 5: Integration & Testing
**Who does it:** YOU (using Bash tool)

**Actions:**
1. Display: "🔄 Phase 5: Integration & Testing"
2. Run tests: `cd flows/<PROJECT_NAME>/<flow-name> && pytest tests/ -v`
3. If tests fail, report to user
4. If tests pass, display: "✅ All tests passing"

**Output:** Verified working flow

---

### Phase 6: Deployment
**Who does it:** YOU (guide user)

**Actions:**
1. Display: "🔄 Phase 6: Deployment"
2. Show user how to:
   - Start server: `cd flows/<PROJECT_NAME>/<flow-name> && ./tools/start_server.sh --reload`
   - Test API: `curl http://localhost:8000/docs`
   - Execute flow: `curl -X POST http://localhost:8000/flows/<flow-name>/execute -H "Content-Type: application/json" -d '{"inputs": {...}}'`

**Output:** Running production flow

**Note:** All phases remain numbered the same - Phase 3.5 is inserted between Phase 3 and Phase 4.

---

## Orchestration Protocol

When the user runs `/orchestrate`:

1. Parse command arguments (project name, flow name, description)
2. Start with Phase 0 and check project status
3. For each phase:
   ```
   📍 Phase N: <Phase Name>
   Status: <✅ complete | 🔄 in progress | ⏸️ waiting>

   <Phase description>

   [If invoking agent]: Invoking <agent-name> agent...
   [If agent output]: <Show agent output>
   [If waiting]: Type 'continue' to proceed to Phase N+1
   ```
4. Wait for user to type 'continue' before moving to next phase
5. Track which phases are complete

## Example Session

```
User: /orchestrate AkaroaHolidayHomes cleaning-schedule "Cleaning schedule for holiday properties"

You:
📍 Phase 0: Project Initialization
Status: 🔄 checking...

Checking for existing project...
✅ Project exists: flows/AkaroaHolidayHomes/project.yaml

📍 Phase 1: Requirements Gathering
Status: ⏸️ waiting

Ready to gather requirements with business-analyst agent.
Type 'continue' to begin Phase 1.

User: continue

You:
📍 Phase 1: Requirements Gathering
Status: 🔄 in progress

Invoking business-analyst agent...

[Agent output appears here]

<Questions from business-analyst>

User: <answers questions>

You:
[Relay answers back to agent]
[Continue until REQUIREMENTS.md is created]

✅ Phase 1 Complete: REQUIREMENTS.md created

📍 Phase 2: Flow Design
Status: ⏸️ waiting

Type 'continue' to proceed to Phase 2.
```

## Important Notes

- **ALWAYS use Task tool** to invoke specialized agents
- **NEVER do the agent's work yourself** - delegate properly
- **Display agent outputs immediately** - don't summarize or hide them
- **One phase at a time** - don't skip ahead
- **Wait for 'continue'** - user controls pace
- **Track progress** - show which phases are complete

## Command Format

**Interactive Mode (Recommended):**
```
/orchestrate
```
This will prompt you for:
1. Project name
2. Flow name
3. Description

**Direct Mode:**
```
/orchestrate <project-name> <flow-name> <description>
```

Example:
```
/orchestrate AkaroaHolidayHomes cleaning-schedule "Automate cleaning schedules based on Airtable bookings"
```

**Rules:**
- If no arguments provided, ask user for project name, flow name, and description
- If project doesn't exist, Phase 0 will create it
- If project exists, Phase 0 will be skipped
