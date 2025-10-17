# Phase 3 Implementation Plan: Nested Container Support

## Goal
Enable containers (Loop, Parallel) to contain other container nodes as children, supporting arbitrary nesting depth.

## Current State vs Target State

### What Works Now ✅
- Loop and Parallel containers can have **task nodes** as children
- Children use `parentId` to reference their container
- Conditional and Switch routing nodes connect to separate node chains via edges
- Routing nodes can already route **to** container nodes (this works!)

### What Doesn't Work Yet ❌
- Cannot have a **container inside another container**
- YAML import doesn't recognize nested containers
- YAML export doesn't reconstruct nested container hierarchy
- Drag & drop doesn't support moving containers into other containers

### What We Need to Support
1. **Loop inside Parallel**: Parallel has a loop as one of its children
2. **Parallel inside Loop**: Loop's `do` section contains a parallel container
3. **Deep nesting**: Parallel > Loop > Parallel (3+ levels)
4. **Mixed nesting**: Containers and tasks at the same level

## Test Files Created

1. `test-nested-loop-in-parallel.yaml`
   - Parallel container with 3 branches
   - Middle branch is a loop container
   - Loop contains 2 tasks

2. `test-nested-parallel-in-loop.yaml`
   - Loop container iterating over batches
   - Inside loop: validate task, then parallel with 3 tasks, then merge task
   - Tests parallel as a step within loop's `do` array

3. `test-nested-deep-three-levels.yaml`
   - Level 1: Parallel (3 branches)
   - Level 2: Loop inside parallel (middle branch)
   - Level 3: Parallel inside loop
   - Tests deep nesting with mixed tasks and containers

## Implementation Tasks

### Task 1: YAML Import - Recognize Nested Containers

**File**: `web/src/services/yamlConverter.ts` (yamlToFlow function)

**Current behavior:**
- `processSteps()` creates nodes for each step
- Sets `parentId` for nodes inside containers
- Works for tasks but doesn't recognize when a step is itself a container

**Changes needed:**

1. **Detect container steps within container processing**
   - When processing a parallel array, check if a step is `for_each` (loop) or another `parallel`
   - When processing a loop's `do` array, check if a step is `parallel` or another `for_each`

2. **Create nested container nodes with proper parentId**
   ```typescript
   // Example: Processing parallel array
   if (step.for_each) {
     // This is a loop inside the parallel!
     const nestedLoopNode = createNode({
       type: 'loopContainer',
       parentId: currentParentId,  // Set parent to the parallel container
       position: { x: childX, y: childY },  // Position inside parent
       data: { ... }
     });

     // Then recursively process the loop's 'do' array
     // with nestedLoopNode.id as the new parent
     processSteps(step.do, nestedLoopNode.id, ...);
   }
   ```

3. **Calculate positions for nested containers**
   - Nested containers should be positioned inside their parent's bounds
   - Use relative positioning (offset from parent's position)
   - Account for padding (15-30px from parent edges)

4. **Recursively process nested container children**
   - When we create a nested container, immediately process its children
   - Pass the nested container's ID as `parentId` for its children
   - This creates the parent chain: Task → Loop → Parallel

**Specific code locations:**

- `processSteps()` function around lines 100-400
- Currently handles `parallel:` around line 140
- Currently handles `for_each:` around line 260
- Need to add container detection within these sections

**Pseudocode:**
```typescript
function processSteps(steps, parentId, startX, startY, isParallel = false) {
  steps.forEach((step, index) => {
    // Check for parallel
    if (step.parallel && Array.isArray(step.parallel)) {
      const parallelNode = createParallelNode({ parentId, position: ... });
      nodes.push(parallelNode);

      // Process parallel children - EACH CHILD COULD BE A CONTAINER!
      step.parallel.forEach((childStep, childIndex) => {
        // NEW: Check if childStep is a container
        if (isContainerStep(childStep)) {
          const nestedContainer = createContainerNode(childStep, parallelNode.id, ...);
          nodes.push(nestedContainer);
          // Recursively process nested container's children
          processNestedContainerChildren(childStep, nestedContainer.id, ...);
        } else {
          // Existing task processing
          processTaskNode(childStep, parallelNode.id, ...);
        }
      });
    }

    // Check for loop
    if (step.for_each && step.do) {
      const loopNode = createLoopNode({ parentId, position: ... });
      nodes.push(loopNode);

      // Process loop 'do' children - EACH CHILD COULD BE A CONTAINER!
      step.do.forEach((childStep, childIndex) => {
        if (isContainerStep(childStep)) {
          const nestedContainer = createContainerNode(childStep, loopNode.id, ...);
          nodes.push(nestedContainer);
          processNestedContainerChildren(childStep, nestedContainer.id, ...);
        } else {
          processTaskNode(childStep, loopNode.id, ...);
        }
      });
    }
  });
}

function isContainerStep(step): boolean {
  return !!(step.parallel || step.for_each);
}
```

---

### Task 2: YAML Export - Reconstruct Nested Containers

**File**: `web/src/services/yamlConverter.ts` (flowToYaml function)

**Current behavior:**
- `buildStep()` creates YAML step objects from nodes
- Handles containers by finding children via `parentId`
- Works for tasks but doesn't detect when a child is itself a container

**Changes needed:**

1. **Detect container children when exporting**
   ```typescript
   // When building parallel step
   const parallelChildren = nodes.filter(n => n.parentId === parallelId);

   const parallelArray = parallelChildren.map(child => {
     // NEW: Check if child is a container
     if (child.type === 'loopContainer') {
       // Recursively build the nested loop
       return buildLoopStep(child);
     } else if (child.type === 'parallelContainer') {
       return buildParallelStep(child);
     } else {
       // Existing task export
       return buildTaskStep(child);
     }
   });

   return { parallel: parallelArray };
   ```

2. **Recursive container export**
   - Extract `buildLoopStep()` and `buildParallelStep()` into reusable functions
   - These functions should call themselves when they encounter container children
   - Maintain proper YAML structure (parallel array, loop with do array)

3. **Preserve step order**
   - Sort children by position (Y coordinate) before exporting
   - Ensures visual order matches YAML order

**Specific code locations:**

- `buildStep()` function around lines 420-580
- Currently handles `parallelContainer` around line 490
- Currently handles `loopContainer` around line 510
- Need to make these sections recursive

**Pseudocode:**
```typescript
function buildStep(node: Node): Step | null {
  if (node.type === 'parallelContainer') {
    return buildParallelStep(node);
  }

  if (node.type === 'loopContainer') {
    return buildLoopStep(node);
  }

  // ... other node types
}

function buildParallelStep(parallelNode: Node): Step {
  const children = nodes.filter(n => n.parentId === parallelNode.id);
  const sortedChildren = sortByPosition(children);

  const parallelArray = sortedChildren.map(child => {
    // Recursively handle nested containers
    return buildStep(child);  // This calls back to buildStep!
  }).filter(Boolean);

  return { parallel: parallelArray };
}

function buildLoopStep(loopNode: Node): Step {
  const children = nodes.filter(n => n.parentId === loopNode.id);
  const sortedChildren = sortByPosition(children);

  const doArray = sortedChildren.map(child => {
    return buildStep(child);  // Recursive!
  }).filter(Boolean);

  return {
    for_each: loopNode.data.items,
    id: loopNode.id,
    as: loopNode.data.loopVariable,
    do: doArray
  };
}
```

---

### Task 3: Visual Feedback & Positioning

**Files**: Container node components

**Changes needed:**

1. **Container sizing**
   - When a container has nested containers as children, it needs to be large enough
   - Auto-expand parent when nested container is added
   - Respect minimum sizes for deeply nested structures

2. **Visual nesting indicators**
   - Subtle visual cues for nesting depth (border styles, shadows)
   - Maybe show nesting level as a small badge (Level 1, Level 2, etc.)

3. **Z-index management**
   - Nested containers should render above their parent's background
   - ReactFlow handles most of this, but may need `zIndex` adjustments

4. **Positioning constraints**
   - Nested containers must stay within parent bounds
   - Parent's padding constraint (15-30px) applies to nested containers too
   - When parent resizes, nested containers should move if needed

**No immediate code changes required** - ReactFlow's `parentId` and `extent="parent"` should handle most of this automatically. We can test and add polish later if needed.

---

### Task 4: Drag & Drop Support (Future - Not Phase 3 MVP)

**Note**: The roadmap lists this as part of Phase 3, but let's consider it **optional for now**. We can implement YAML import/export first, test it, and then add drag-and-drop as Phase 3.5.

**When we implement it:**

1. **Allow dragging containers into containers**
   - Detect drop on container node
   - Set `parentId` on dropped container
   - Update position to be relative to parent

2. **Prevent circular nesting**
   - Can't drag a parent into its own child
   - Can't drag a container into itself

3. **Move entire subtree**
   - When dragging a container that has children, move all children too
   - Maintain relative positions

**Files**: `web/src/components/FlowDesigner/FlowDesigner.tsx`

---

## Implementation Order

### MVP (Minimum Viable Product)
1. ✅ Create test YAML files
2. **Implement Task 1: YAML Import for nested containers**
3. **Test import with all 3 test files**
4. **Implement Task 2: YAML Export for nested containers**
5. **Test round-trip (import → export → import)**
6. **Add visual polish (Task 3) if needed**

### Phase 3.5 (Optional Enhancement)
7. Implement drag & drop for nesting containers (Task 4)
8. Add validation rules (prevent circular nesting)
9. Add UI indicators for nesting depth

---

## Success Criteria

### Must Work ✅
- [ ] Import `test-nested-loop-in-parallel.yaml` successfully
  - Parallel container created
  - Loop container created as child of parallel (has parentId)
  - 2 tasks created as children of loop
  - All nodes positioned correctly

- [ ] Import `test-nested-parallel-in-loop.yaml` successfully
  - Loop container created
  - Parallel container created as child of loop
  - 3 tasks created as children of parallel
  - Sequential tasks before/after parallel work correctly

- [ ] Import `test-nested-deep-three-levels.yaml` successfully
  - 3-level nesting: Parallel > Loop > Parallel
  - All containers and tasks created with correct parentId chains
  - Visual structure reflects logical structure

- [ ] Export nested flows back to YAML
  - Exported YAML matches original structure
  - Nested containers appear as nested YAML objects
  - Can re-import exported YAML and get same structure

- [ ] Round-trip test passes
  - Import YAML → Visual → Export YAML → Import YAML
  - Second import produces identical node structure

### Should Work (Nice to Have) ⭐
- [ ] Visual indicators show nesting depth
- [ ] Parent containers auto-resize to fit nested children
- [ ] Performance is acceptable (< 200ms render time for 3 levels)

---

## Risk Analysis

### Technical Risks

1. **Positioning complexity**
   - Problem: Calculating positions for deeply nested nodes is complex
   - Mitigation: Start with simple vertical stacking, iterate based on user feedback
   - Fallback: Use absolute positions, let user manually arrange

2. **Circular nesting**
   - Problem: User could theoretically create circular parent chains
   - Mitigation: For MVP, assume valid YAML input; add validation in Phase 3.5
   - Detection: Check parent chain when setting `parentId`

3. **Performance with deep nesting**
   - Problem: 5+ levels of nesting might be slow to render
   - Mitigation: Test with deep nesting, optimize if needed
   - Solutions: Virtualization, lazy rendering, collapse/expand

### UX Risks

1. **Visual clutter**
   - Problem: Too many nested containers might overwhelm users
   - Mitigation: Clean visual design, good spacing, depth indicators
   - Future: Add collapse/expand for nested containers

2. **Confusing interactions**
   - Problem: Clicking deeply nested nodes might be tricky
   - Mitigation: Clear selection states, breadcrumbs (future)
   - Future: "Focus mode" to isolate a container

---

## Next Steps

1. Review this plan with the user
2. Implement Task 1 (YAML Import)
3. Test with first test file
4. Iterate based on feedback
5. Implement Task 2 (YAML Export)
6. Test round-trip
7. Mark Phase 3 as complete!

---

## Notes

- Phase 3 focuses on **container nesting** (Loop, Parallel)
- Routing nodes (Conditional, Switch) already work correctly - they route **to** containers
- We don't need to change routing nodes for Phase 3
- Drag & drop is optional - YAML import/export is the core requirement
