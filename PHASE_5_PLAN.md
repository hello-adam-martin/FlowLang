# Phase 5: Property Panel for Nested Editing

## Overview
Add comprehensive UI controls in property panels to manage nested structures, allowing users to view, edit, reorder, and manipulate child nodes within containers without relying solely on drag-and-drop.

## Goals
- Provide clear visibility into container contents
- Enable precise control over child node order and membership
- Support editing complex nested structures through UI controls
- Maintain consistency across all container types

## Current State

**What Works:**
- ✅ Property panels exist for all node types
- ✅ Basic properties can be edited (labels, conditions, loop variables)
- ✅ Nodes can be created inside containers via drag-and-drop
- ✅ Visual representation shows nested structures

**What's Missing:**
- ❌ No UI to see which children are inside a container
- ❌ No way to reorder children except by manually moving them
- ❌ No way to remove children from containers via UI
- ❌ No quick-add buttons to create children inside containers
- ❌ No visibility into which branch/section children belong to
- ❌ No UI for editing deeply nested quantified conditions

## Architecture

### Container Types and Child Management

**Loop Containers:**
- Single "do" section
- Children execute sequentially (Y-position sorted)
- Need: List of children, reorder controls, quick-add

**Parallel Containers:**
- Single drop zone
- Children execute based on dependencies (edges)
- Need: List of children with execution order, reorder controls, quick-add

**Conditional Routing Nodes:**
- Two branches: "then" and "else"
- Each branch is a chain of nodes connected by edges
- Need: Show branch chains, highlight which nodes are in which branch

**Switch Routing Nodes:**
- Multiple case branches + default
- Each case is a chain of nodes
- Need: Show all branch chains, highlight which case each chain belongs to

## Implementation Tasks

### Task 5.1: View Children Section (~2-3 hours)

**Files to modify:**
- `web/src/components/PropertyPanel/LoopNodeProperties.tsx`
- `web/src/components/PropertyPanel/ParallelNodeProperties.tsx`

**Implementation:**
- Add "Children" collapsible section in property panel
- Query `nodes.filter(n => n.parentId === selectedNodeId)`
- Display list with:
  - Node label and type icon
  - Execution order badge (for parallel)
  - Node ID (small, muted)
- Empty state: "No children. Drag nodes here or use Quick Add."

**UI Mockup:**
```
┌─ Children (3) ─────────────────────────┐
│ [1] 📋 Validate Data (validate_step)   │
│ [2] 📋 Process Batch (process_step)    │
│ [3] 📋 Update Status (update_step)     │
└─────────────────────────────────────────┘
```

### Task 5.2: Reorder Children (~2-3 hours)

**Files to modify:**
- `web/src/components/PropertyPanel/LoopNodeProperties.tsx`
- `web/src/components/PropertyPanel/ParallelNodeProperties.tsx`

**Implementation:**
- Add up/down arrow buttons next to each child
- On click:
  - Swap Y positions of current and adjacent node
  - Trigger `updateNode()` to persist changes
  - Re-render property panel
- Disable up arrow for first child, down arrow for last child

**UI Mockup:**
```
┌─ Children (3) ─────────────────────────┐
│ [1] 📋 Validate Data        [↓]        │
│ [2] 📋 Process Batch      [↑][↓]      │
│ [3] 📋 Update Status      [↑]          │
└─────────────────────────────────────────┘
```

### Task 5.3: Remove Child from Container (~1-2 hours)

**Files to modify:**
- `web/src/components/PropertyPanel/LoopNodeProperties.tsx`
- `web/src/components/PropertyPanel/ParallelNodeProperties.tsx`

**Implementation:**
- Add remove button (X or trash icon) for each child
- On click:
  - Confirm dialog: "Remove {label} from container? It will become a top-level node."
  - Set `parentId = undefined` on node
  - Move node outside container (x += containerWidth + 50)
  - Update node via store
- Keep node's edges intact

**UI Mockup:**
```
┌─ Children (3) ─────────────────────────┐
│ [1] 📋 Validate Data      [↑][↓][✕]   │
│ [2] 📋 Process Batch      [↑][↓][✕]   │
│ [3] 📋 Update Status      [↑]   [✕]   │
└─────────────────────────────────────────┘
```

### Task 5.4: Quick Add Child Node (~3-4 hours)

**Files to modify:**
- `web/src/components/PropertyPanel/LoopNodeProperties.tsx`
- `web/src/components/PropertyPanel/ParallelNodeProperties.tsx`

**Implementation:**
- Add "Add Task" button at bottom of children section
- On click:
  - Generate new task node with:
    - `parentId` = container ID
    - Position inside container (below last child)
    - Default label "New Task"
  - Add node via `addNode()`
  - Auto-open property panel for new node
- Alternative: Dropdown with task templates

**UI Mockup:**
```
┌─ Children (3) ─────────────────────────┐
│ [1] 📋 Validate Data      [↑][↓][✕]   │
│ [2] 📋 Process Batch      [↑][↓][✕]   │
│ [3] 📋 Update Status      [↑]   [✕]   │
│                                         │
│ [+ Add Task] [+ From Template ▼]       │
└─────────────────────────────────────────┘
```

### Task 5.5: Show Branch Chains for Routing Nodes (~2-3 hours)

**Files to modify:**
- `web/src/components/PropertyPanel/ConditionalNodeProperties.tsx`
- `web/src/components/PropertyPanel/SwitchNodeProperties.tsx`

**Implementation:**
For Conditional nodes:
- Show "Then Branch" section
  - Follow edges from `sourceHandle: 'then'`
  - Display chain of connected nodes
  - Show node labels with icons
- Show "Else Branch" section
  - Follow edges from `sourceHandle: 'else'`
  - Display chain of connected nodes
- Empty state: "No nodes connected to this branch"

For Switch nodes:
- Show section for each case
  - Follow edges from `sourceHandle: 'case_X'`
  - Display chain of connected nodes
- Show "Default Branch" section

**UI Mockup (Conditional):**
```
┌─ Then Branch (when true) ──────────────┐
│ → 📋 Approve Premium                    │
│ → 📋 Send Letter                        │
└─────────────────────────────────────────┘

┌─ Else Branch (when false) ─────────────┐
│ → 📋 Reject Loan                        │
│ → ⇉ Notify Stakeholders (parallel)     │
│ → 📋 Record Decision                    │
└─────────────────────────────────────────┘
```

### Task 5.6: Show Execution Order in Parallel (~1 hour)

**Files to modify:**
- `web/src/components/PropertyPanel/ParallelNodeProperties.tsx`

**Implementation:**
- Already have execution order calculation in ParallelContainerNode
- Display execution order badge next to each child
- Show explanation tooltip:
  - No badge = Starts immediately (no dependencies)
  - Badge [1] = Waits for predecessor
  - Badge [2] = Waits for [1], etc.

**UI Mockup:**
```
┌─ Children (4) ─────────────────────────┐
│     📋 Fetch Data A     [↑][↓][✕]      │
│     📋 Fetch Data B     [↑][↓][✕]      │
│ [2] 📋 Merge Data       [↑][↓][✕]      │
│ [3] 📋 Save Result      [↑]   [✕]      │
│                                         │
│ ℹ️ No badge = runs immediately          │
│ ℹ️ [N] = waits for step N to complete   │
└─────────────────────────────────────────┘
```

### Task 5.7: Edit Nested Quantified Conditions (~4-5 hours)

**Files to modify:**
- `web/src/components/PropertyPanel/ConditionalNodeProperties.tsx`
- Create new component: `web/src/components/PropertyPanel/QuantifiedConditionEditor.tsx`

**Implementation:**
- Create recursive tree editor for quantified conditions
- Support structure like:
  ```yaml
  if:
    all:
      - ${credit_score} > 700
      - any:
          - ${income} > 50000
          - ${assets} > 100000
      - none:
          - ${bankruptcy}
          - ${foreclosure}
  ```
- Features:
  - Add/remove condition clauses
  - Change quantifier type (all/any/none)
  - Nest quantifiers (add child all/any/none)
  - Drag-and-drop to reorder
  - Indentation shows nesting level
  - Validation prevents circular nesting

**UI Mockup:**
```
┌─ Condition Editor ─────────────────────────────┐
│ Type: [Quantified ▼]                           │
│                                                 │
│ ALL must be true:                               │
│   ├─ ${credit_score} > 700           [✕][↕]   │
│   ├─ ANY must be true:               [✕][↕]   │
│   │   ├─ ${income} > 50000           [✕][↕]   │
│   │   └─ ${assets} > 100000          [✕][↕]   │
│   │   [+ Add Condition] [+ Add Nested ▼]       │
│   └─ NONE must be true:              [✕][↕]   │
│       ├─ ${bankruptcy}               [✕][↕]   │
│       └─ ${foreclosure}              [✕][↕]   │
│       [+ Add Condition] [+ Add Nested ▼]       │
│                                                 │
│ [+ Add Condition] [+ Add Nested Quantifier ▼]  │
└─────────────────────────────────────────────────┘
```

### Task 5.8: Nested Quantifier UI (~2-3 hours)

**Files to modify:**
- `web/src/components/PropertyPanel/QuantifiedConditionEditor.tsx`

**Implementation:**
- Add "Add Nested Quantifier" dropdown:
  - Options: "All (AND)", "Any (OR)", "None (NOT)"
- On select:
  - Insert new quantifier node as child
  - Render with increased indentation
  - Allow adding conditions to nested level
- Support unlimited nesting depth (with visual warning for 3+ levels)

### Task 5.9: Validate Quantified Conditions (~1-2 hours)

**Files to modify:**
- `web/src/components/PropertyPanel/QuantifiedConditionEditor.tsx`

**Implementation:**
- Prevent empty quantifiers (must have at least 1 condition)
- Warn about deeply nested structures (3+ levels)
- Validate condition syntax (basic check for `${...}` variables)
- Show inline error messages
- Disable save button if validation fails

**Validation Rules:**
- ✅ At least one condition per quantifier
- ✅ No circular references
- ✅ Valid variable syntax
- ⚠️ Warning for 3+ nesting levels
- ⚠️ Warning for 10+ total conditions

### Task 5.10: Collapse/Expand Sections (~1-2 hours)

**Files to modify:**
- All property panel components

**Implementation:**
- Add collapse/expand icons to section headers
- Store expand state in local component state
- Default to expanded for sections with <5 items
- Default to collapsed for sections with 5+ items
- Persist state in localStorage (optional)

**UI Mockup:**
```
┌─ Children (12) [˅] ────────────────────┐
│ [1] 📋 Validate Data      [↑][↓][✕]   │
│ [2] 📋 Process Batch      [↑][↓][✕]   │
│ ... (10 more)                           │
└─────────────────────────────────────────┘

┌─ Children (12) [>] ────────────────────┐
│ (Collapsed - click to expand)           │
└─────────────────────────────────────────┘
```

## Testing Strategy

### Unit Tests
- Test child node queries work correctly
- Test reorder logic swaps positions
- Test remove sets parentId to undefined
- Test quick-add creates valid nodes
- Test branch chain following logic

### Integration Tests
- Create loop with 3 children, reorder them
- Remove child from parallel container
- Quick-add task to loop, verify it appears
- Edit nested quantified condition
- Collapse/expand sections

### User Acceptance Tests
- Can manage children without touching canvas
- Reordering feels intuitive
- Quick-add is convenient for simple additions
- Nested condition editor is understandable
- Large containers are manageable with collapse

## Timeline Estimate

**Task 5.1:** 2-3 hours (View Children)
**Task 5.2:** 2-3 hours (Reorder)
**Task 5.3:** 1-2 hours (Remove)
**Task 5.4:** 3-4 hours (Quick Add)
**Task 5.5:** 2-3 hours (Branch Chains)
**Task 5.6:** 1 hour (Execution Order)
**Task 5.7:** 4-5 hours (Quantified Conditions)
**Task 5.8:** 2-3 hours (Nested Quantifiers)
**Task 5.9:** 1-2 hours (Validation)
**Task 5.10:** 1-2 hours (Collapse/Expand)

**Total:** 19-28 hours (~2.5-3.5 days)

## Incremental Rollout

**Day 1: Container Children Management**
- Task 5.1: View Children
- Task 5.2: Reorder Children
- Task 5.3: Remove Children
- Task 5.4: Quick Add

**Day 2: Routing Nodes & Execution Order**
- Task 5.5: Branch Chains for Conditionals/Switch
- Task 5.6: Execution Order Display
- Task 5.10: Collapse/Expand

**Day 3: Advanced Condition Editing**
- Task 5.7: Quantified Condition Editor
- Task 5.8: Nested Quantifiers
- Task 5.9: Validation

## Success Criteria

**Must Have:**
- ✅ Can see all children in a container via property panel
- ✅ Can reorder children with up/down buttons
- ✅ Can remove children from containers
- ✅ Can quick-add tasks to containers
- ✅ Can see which branch each node belongs to (routing nodes)

**Should Have:**
- ✅ Execution order visible for parallel containers
- ✅ Collapse/expand for large lists
- ✅ Edit basic quantified conditions

**Nice to Have:**
- ✅ Deeply nested quantifier editing
- ✅ Validation warnings
- ✅ Drag-and-drop reordering

## Notes

- Focus on container nodes (Loop, Parallel) first - they're simpler
- Routing nodes (Conditional, Switch) are more complex - handle them second
- Quantified condition editor is the most complex feature - save for last
- Each task should be independently testable
- Get user feedback after Day 1 implementation before proceeding
