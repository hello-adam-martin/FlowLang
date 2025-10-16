# Nested Flows Implementation Roadmap

## Overview
This document outlines the plan to enable the FlowLang visual designer to fully support complex nested flows, using `flows/examples/loan_approval/flow.yaml` as the reference implementation.

## Current State

### What Works ✅
- Container node types exist (Conditional, Parallel, Loop, Switch)
- Container nodes have drop zones and track child nodes via `parentId`
- Container nodes display child counts ("3 tasks" labels)
- Basic YAML import/export for top-level structures
- Container nodes support quantified conditions (all/any/none) in UI
- Drag-and-drop from node library works

### What's Broken ❌
1. **Child nodes aren't rendered inside containers** - They're tracked in data but invisible
2. **YAML import doesn't recursively parse** - `then`, `else`, `do`, `parallel` arrays ignored
3. **YAML export doesn't reconstruct nesting** - Children exported as flat sequential steps
4. **No visual feedback** when nodes are inside containers
5. **Can't edit nested structures** - No way to add/remove/reorder children
6. **Execution doesn't work for nested flows** - Simulator doesn't handle hierarchy

## The Problem: Loan Approval Flow

The `loan_approval` flow demonstrates the complexity we need to support:

```yaml
# Main screening check (top-level conditional)
- if:
    none: [bankruptcy, foreclosure, low_credit, late_payments]
  then:
    # Premium tier (nested conditional #1)
    - if:
        all: [excellent_conditions]
      then: [approve_premium, send_letter]

    # Standard tier (nested conditional #2)
    - if:
        any: [good_conditions]
      then:
        # Double-nested conditional!
        - if:
            all: [acceptable_conditions]
          then: [approve_standard, send_letter]

    # Manual review (nested conditional #3)
    - if:
        any: [complex_cases]
      then: [flag_review, notify_underwriter]

    - task: RecordDecision  # Sequential task after conditionals

  else:
    - task: RejectLoan
    # Parallel block nested in else!
    - parallel:
        - SendRejectionNotice
        - LogRejection
        - ReportToCreditBureau
        - ScheduleFollowUpCampaign
    - task: RecordDecision  # Sequential task after parallel
```

**Key Challenges:**
- 4 levels of nesting (top conditional → nested conditional → double-nested conditional)
- Parallel block inside else branch
- Sequential tasks mixed with container nodes at same level
- Complex quantified conditions with nested logic

## Implementation Phases

### Phase 1: Child Node Visualization (FOUNDATION)
**Goal:** Make child nodes visible inside their parent containers

**Status by Container:**

#### Loop Container - ✅ COMPLETE
**File:** `web/src/components/nodes/LoopContainerNode.tsx`
- ✅ Custom resize handle (bottom-right corner)
- ✅ 30px padding constraint preventing edge positioning
- ✅ Execution order tracking with numbered badges
- ✅ Delete button on hover
- ✅ Grey color scheme
- ✅ Droppable "do" section with visual feedback
- ✅ Children render automatically via ReactFlow parentId
- ✅ Badge positioned top-right
- ✅ Starting dimensions: 250x150px

#### Conditional Container - 🟡 IN PROGRESS
**File:** `web/src/components/nodes/ConditionalContainerNode.tsx`
- ✅ Has "then" and "else" sections
- ✅ Delete button on hover
- ✅ Grey color scheme
- ⚠️ Uses NodeResizer (not custom resize handle)
- ⚠️ No padding constraints (nodes can snap to edges)
- ❌ Execution order tracking not implemented
- ❌ No visual differentiation when branch is active
- ❌ Sections may need layout improvements

**Needs:**
- Custom resize handle like Loop container
- 30px padding constraints
- Visual highlighting of active branch during execution
- Improved section layout/styling

#### Parallel Container - 🟡 IN PROGRESS
**File:** `web/src/components/nodes/ParallelContainerNode.tsx`
- ✅ Has track system with ghost placeholders
- ✅ Delete button on hover
- ✅ Grey color scheme
- ⚠️ Uses NodeResizer (not custom resize handle)
- ⚠️ Track-specific drop zones work but complex
- ❌ No padding constraints
- ❌ No execution order tracking
- ❌ Track management UI could be improved

**Needs:**
- Custom resize handle like Loop container
- Padding constraints (but must respect track layout)
- Execution progress visualization per track
- Better track add/remove UI

#### Switch Container - 🟡 IN PROGRESS
**File:** `web/src/components/nodes/SwitchContainerNode.tsx`
- ✅ Has case sections with dynamic add/remove
- ✅ Has default section
- ✅ Delete button on hover
- ✅ Grey color scheme
- ⚠️ Uses NodeResizer (not custom resize handle)
- ❌ No padding constraints
- ❌ No execution order tracking
- ❌ Case management UI could be cleaner

**Needs:**
- Custom resize handle like Loop container
- 30px padding constraints for all sections
- Visual highlighting of active case during execution
- Improved case add/remove UX

**Tasks:**
1.1. ✅ Render child nodes in "do" section of LoopContainerNode
1.2. ⚠️ Render child nodes in "then" section of ConditionalContainerNode (works but needs polish)
1.3. ⚠️ Render child nodes in "else" section of ConditionalContainerNode (works but needs polish)
1.4. ⚠️ Render child nodes in parallel tracks of ParallelContainerNode (works but needs polish)
1.5. ⚠️ Render child nodes in switch cases of SwitchContainerNode (works but needs polish)
1.6. ✅ Position children relatively within parent bounds (ReactFlow handles this)
1.7. ✅ Add visual indicators (border, background) for container membership (grey scheme applied)
1.8. ❌ Handle scrolling when many children (needs testing)
1.9. ✅ Add padding constraints to prevent edge positioning (Loop only)
1.10. ✅ Add custom resize handles (Loop only)
1.11. ✅ Add execution order tracking (Loop only)

**Test Criteria:**
- [✅] Manually create a loop with task nodes inside
- [✅] Children appear visually inside the loop container boundaries
- [✅] Can see connections between child nodes inside loop
- [✅] Container sections have distinct visual styling
- [⚠️] Scrolling works if children overflow (needs testing with many nodes)
- [⚠️] Same tests needed for Conditional, Parallel, and Switch containers

**Expected Result:**
All four container types should have:
- Custom resize handles (bottom-right corner)
- 30px padding constraints
- Consistent visual styling
- Delete on hover
- Execution order tracking where applicable
- Professional polish matching Loop container quality

---

### Phase 2: Recursive YAML Import
**Goal:** Parse nested flow structures from YAML and create proper node hierarchy

**Files to Modify:**
- `web/src/services/yamlConverter.ts` (yamlToFlow function)

**Tasks:**
2.1. Create `recursivelyParseSteps()` helper function
2.2. Parse conditional `then` array → child nodes with `section: 'then'`, `parentId: conditionalId`
2.3. Parse conditional `else` array → child nodes with `section: 'else'`, `parentId: conditionalId`
2.4. Parse loop `do` array → child nodes with `section: 'do'`, `parentId: loopId`
2.5. Parse parallel array → child nodes with `trackId` assigned, `parentId: parallelId`
2.6. Calculate automatic positions for nested nodes (vertical stacking)
2.7. Calculate container sizes based on child count
2.8. Handle nested containers (recursive parentId chains)
2.9. Support nested quantified conditions (all/any/none with nesting)

**Test Criteria:**
- [ ] Import `loan_approval.yaml` successfully
- [ ] All task nodes appear in correct container sections
- [ ] Nested conditionals appear as containers within containers
- [ ] Parallel block in else branch renders correctly
- [ ] Node positions are readable (no overlaps)
- [ ] Container sizes accommodate their children

**Expected Result:**
Opening loan_approval.yaml shows the full nested structure visually, with all ~20 task nodes properly nested in their containers.

---

### Phase 3: Nested Drag & Drop
**Goal:** Support dragging nodes into/out of containers and between sections

**Files to Modify:**
- `web/src/components/FlowDesigner/FlowDesigner.tsx` (onDrop handler)
- `web/src/components/nodes/ConditionalContainerNode.tsx` (drop zones)
- `web/src/components/nodes/ParallelContainerNode.tsx` (track drop zones)
- `web/src/components/nodes/LoopContainerNode.tsx` (do drop zone)

**Tasks:**
3.1. Detect when drop occurs over container section (then/else/do/track)
3.2. Set `parentId` and section metadata on dropped node
3.3. Position dropped node relative to parent container
3.4. Support dragging node OUT of container back to canvas (remove parentId)
3.5. Support dragging between container sections (then → else)
3.6. Prevent containers from being dropped into themselves
3.7. Update container size when children added/removed
3.8. Handle edge connections when moving nodes between containers

**Test Criteria:**
- [ ] Can drag task from library into conditional "then" section
- [ ] Task appears inside container with proper parentId
- [ ] Can drag task from "then" to "else" section
- [ ] Can drag task out of container back to main canvas
- [ ] Cannot drop conditional into its own then/else sections
- [ ] Edges remain connected when moving nodes
- [ ] Container auto-resizes when children change

**Expected Result:**
Full interactive editing of nested structures - drag nodes in/out/between containers freely.

---

### Phase 4: Recursive YAML Export
**Goal:** Convert nested node hierarchy back to valid FlowLang YAML

**Files to Modify:**
- `web/src/services/yamlConverter.ts` (flowToYaml function)

**Tasks:**
4.1. Create `reconstructNestedSteps()` helper function
4.2. Identify root nodes (no parentId) vs child nodes (has parentId)
4.3. For conditional nodes: separate children by `section` → build then/else arrays
4.4. For loop nodes: gather children → build do array
4.5. For parallel nodes: gather children, group by trackId → build parallel array
4.6. Recursively process children that are also containers (nested conditionals)
4.7. Maintain step order within sections (sort by Y position)
4.8. Export quantified conditions with full nesting structure
4.9. Add helpful comments for nested structures
4.10. Handle mixed sequential/nested steps at same level

**Test Criteria:**
- [ ] Import loan_approval.yaml, then export immediately
- [ ] Exported YAML is semantically equivalent to original
- [ ] Nested structure preserved (conditionals in conditionals)
- [ ] Parallel block in else branch exports correctly
- [ ] Sequential tasks mixed with containers work
- [ ] Quantified conditions (all/any/none) export properly
- [ ] Can re-import exported YAML and get same visual structure

**Expected Result:**
Round-trip success: Import → Visual Edit → Export → Import produces identical flow.

---

### Phase 5: Property Panel for Nested Editing
**Goal:** Edit nested structures through property panels

**Files to Modify:**
- `web/src/components/PropertyPanel/ConditionalNodeProperties.tsx`
- `web/src/components/PropertyPanel/ParallelNodeProperties.tsx`
- `web/src/components/PropertyPanel/LoopNodeProperties.tsx`
- `web/src/components/PropertyPanel/PropertyPanel.tsx`

**Tasks:**
5.1. Add "View Children" section showing list of child nodes
5.2. Add buttons to reorder children (move up/down)
5.3. Add button to remove child from container
5.4. Add button to add new task to section (quick add)
5.5. For conditionals: Show which section each child belongs to (then/else)
5.6. For parallel: Show track assignments for each child
5.7. For conditionals: Add UI to edit nested quantified conditions (all/any/none)
5.8. Add UI to nest quantifiers (drag-and-drop or tree view)
5.9. Validate condition structure (prevent circular nesting)
5.10. Add "Collapse/Expand" toggle for large nested structures

**Test Criteria:**
- [ ] Select conditional node and see list of children in property panel
- [ ] Can reorder children using up/down buttons
- [ ] Can remove child from container via property panel
- [ ] Can add new task to "then" section via quick-add button
- [ ] Parallel tracks show which tasks are assigned to each
- [ ] Can edit complex quantified conditions visually
- [ ] Can nest conditions (all with nested any, etc.)
- [ ] Collapse/expand works for readability

**Expected Result:**
Can fully edit nested structures without directly dragging nodes - use property panel for precise control.

---

### Phase 6: Nested Execution Visualization
**Goal:** Execute flows with nested structures and visualize execution

**Files to Modify:**
- `web/src/services/flowSimulator.ts`
- `web/src/components/nodes/ConditionalContainerNode.tsx` (execution state)
- `web/src/components/nodes/ParallelContainerNode.tsx` (execution state)
- `web/src/components/nodes/LoopContainerNode.tsx` (execution state)

**Tasks:**
6.1. Update flowSimulator to track execution state for child nodes
6.2. Highlight active container section during execution (then vs else)
6.3. Show which branch of conditional is executing
6.4. Show parallel track progress independently
6.5. Show loop iteration counter and current item
6.6. Pass execution state to child nodes inside containers
6.7. Handle variable scope (children access parent outputs + loop variables)
6.8. Update execution history to show nested node states
6.9. Add execution visualization to child nodes (same as root level)
6.10. Handle error states in nested structures

**Test Criteria:**
- [ ] Run simulation on loan_approval flow
- [ ] See which conditional branches are taken (then/else highlighting)
- [ ] See individual task execution inside nested conditionals
- [ ] Parallel tasks in else branch show concurrent execution
- [ ] Execution history shows all nested node states
- [ ] Can click on child nodes in history to see their inputs/outputs
- [ ] Error in nested task propagates correctly

**Expected Result:**
Full execution visualization works for nested flows - can watch execution flow through complex hierarchies.

---

### Phase 7: Advanced Features (Nice-to-Have)
**Goal:** Polish and advanced capabilities

**Tasks:**
7.1. Add zoom/pan inside container sections for large nested flows
7.2. Add "focus mode" - isolate a container to edit its children
7.3. Add breadcrumb navigation for nested editing (Parent > Child > Grandchild)
7.4. Add minimap showing position in nested hierarchy
7.5. Add validation warnings for deeply nested structures (performance concerns)
7.6. Add keyboard shortcuts for nesting operations
7.7. Add templates for common nested patterns (if-then-else, parallel-in-conditional, etc.)
7.8. Add visual guides showing nesting depth (colors, indentation)
7.9. Support copy-paste of nested structures
7.10. Add "flatten" operation to convert nested to sequential where possible

**Test Criteria:**
- [ ] Can zoom into container to see child details
- [ ] Focus mode provides clean editing experience
- [ ] Breadcrumbs help navigate complex nesting
- [ ] Validation warns about 5+ levels of nesting
- [ ] Can copy entire nested conditional and paste elsewhere

**Expected Result:**
Professional-grade nested flow editor with excellent UX for complex workflows.

---

## Success Metrics

### Minimum Viable Product (MVP)
- ✅ Phases 1-4 complete
- ✅ Can import/export loan_approval.yaml correctly
- ✅ Can visually edit nested structures via drag-and-drop
- ✅ Round-trip YAML import/export works

### Full Feature Set
- ✅ All 6 phases complete
- ✅ Can execute and visualize nested flow execution
- ✅ Property panels provide full editing capabilities
- ✅ Performance acceptable for flows with 50+ nodes

### Production Ready
- ✅ Phase 7 nice-to-haves implemented
- ✅ User documentation written
- ✅ Example nested flows in gallery
- ✅ Performance optimized for 100+ nodes
- ✅ Full test coverage

## Testing Strategy

### Per-Phase Testing
Each phase should be tested independently before proceeding:
1. Developer tests feature works
2. Create test flow demonstrating the feature
3. User tests and provides feedback
4. Fix issues before moving to next phase

### Integration Testing
After phases 1-4:
- Import all example flows in `flows/examples/`
- Edit each one and export
- Verify re-import works correctly

### Performance Testing
After phase 6:
- Create flow with 50 nested nodes
- Measure render time (<100ms)
- Measure YAML import time (<500ms)
- Measure execution simulation time

### User Acceptance Testing
After phase 6:
- Can reproduce loan_approval.yaml from scratch
- Can understand nested structure visually
- Can make complex edits confidently
- Execution visualization is clear

## Risk Mitigation

### Technical Risks
1. **Rendering performance** - Many nested nodes could be slow
   - Mitigation: Virtualization, lazy rendering, collapse/expand

2. **Layout complexity** - Auto-positioning nested nodes is hard
   - Mitigation: Start with simple vertical stacking, iterate based on feedback

3. **YAML export complexity** - Reconstructing hierarchy from graph is non-trivial
   - Mitigation: Store section metadata on nodes, traverse parent chain

### UX Risks
1. **Complexity overwhelms users** - Too many nesting levels confusing
   - Mitigation: Visual guides, depth indicators, focus mode

2. **Discoverability** - Users don't know they can nest
   - Mitigation: Tutorial, examples, visual hints in empty containers

## Timeline Estimate

**Phase 1:** 1-2 days (foundation work)
**Phase 2:** 2-3 days (complex recursive parsing)
**Phase 3:** 1-2 days (D&D interactions)
**Phase 4:** 2-3 days (complex recursive export)
**Phase 5:** 2-3 days (UI/UX for editing)
**Phase 6:** 2-3 days (execution integration)
**Phase 7:** 3-5 days (polish)

**Total MVP (Phases 1-4):** 6-10 days
**Total Full Feature (Phases 1-6):** 10-16 days
**Total Production Ready (Phases 1-7):** 13-21 days

## Next Steps

1. ✅ Create this roadmap document
2. Begin Phase 1: Child Node Visualization
3. Test Phase 1 before proceeding to Phase 2
4. Iterate based on feedback

## Notes

- Each phase should be testable independently
- Get user feedback after each phase before proceeding
- Prioritize correctness over performance initially
- Keep backwards compatibility - flat flows must still work
- Document edge cases as they're discovered
- Update this roadmap as new challenges emerge
