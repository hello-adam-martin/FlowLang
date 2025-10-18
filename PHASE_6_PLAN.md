# Phase 6 Implementation Plan: Nested Execution Visualization

## Goal
Enhance visual feedback during flow execution to show what's happening inside nested containers (loops, parallels) and routing nodes (conditionals, switches). Make it easy to understand execution flow through complex nested structures.

## Current State vs Target State

### What Works Now ✅
- Flow simulator executes nested structures correctly
- Loop iteration, conditional branching, parallel execution all working
- TaskNode shows execution state (pending, running, completed, error, skipped)
- Execution logs track what's happening
- Child nodes execute in correct order
- Basic execution history works

### What's Missing ❌
1. **Container nodes don't show execution state** - No visual feedback during execution
2. **No loop iteration counter** - Can't see which iteration is running
3. **No parallel progress indicator** - Can't see how many tasks completed
4. **No branch highlighting** - Can't tell which conditional/switch branch is active
5. **Container metadata not tracked** - Simulator doesn't emit container-specific info
6. **Execution history lacks container context** - Can't see loop iterations or parallel progress

### What We Need to Support
1. **Loop Containers**: Show "Iteration 3/5" badge, current item value, execution state
2. **Parallel Containers**: Show "3/5 tasks completed", highlight running children
3. **Conditional Nodes**: Highlight active branch (then vs else), show condition result
4. **Switch Nodes**: Highlight matched case, show which value matched
5. **Container States**: Running (blue border), completed (green), error (red)
6. **Execution History**: Show container metadata in timeline

## Type Definitions

### Extended NodeExecutionData

Add container-specific metadata to the execution state:

```typescript
// In web/src/store/flowStore.ts

interface NodeExecutionData {
  state: NodeExecutionState;
  startTime?: number;
  endTime?: number;
  output?: any;
  error?: string;
  inputs?: Record<string, any>;
  inputSources?: Record<string, string>;

  // NEW: Container-specific execution metadata
  containerMeta?: {
    // For loop containers
    currentIteration?: number;
    totalIterations?: number;
    currentItem?: any;

    // For parallel containers
    activeChildren?: string[];      // Node IDs currently running
    completedChildren?: string[];   // Node IDs that finished

    // For conditional containers
    activeBranch?: 'then' | 'else';
    conditionResult?: boolean;

    // For switch containers
    matchedCase?: string | number;
    matchedCaseIndex?: number;
  };
}
```

## Implementation Tasks

### Task 6.1: Loop Iteration Tracking (Foundation) ⏱️ ~1.5 hours

**Goal:** Track loop iteration state in simulator and expose it for visualization.

**Files to Modify:**
- `web/src/store/flowStore.ts` - Add containerMeta to NodeExecutionData type
- `web/src/services/flowSimulator.ts` - Update executeLoop() to emit iteration updates

**Changes Needed:**

1. **Add containerMeta type definition** (flowStore.ts)
   - Add interface definition as shown above
   - Update NodeExecutionData to include containerMeta field

2. **Update executeLoop() function** (flowSimulator.ts, lines ~281-320)
   - Before each iteration, update node state with containerMeta:
     ```typescript
     this.context.updateNodeState(node.id, {
       state: 'running',
       containerMeta: {
         currentIteration: i + 1,
         totalIterations: items.length,
         currentItem: items[i],
       }
     });
     ```
   - After all iterations complete, mark as completed:
     ```typescript
     this.context.updateNodeState(node.id, {
       state: 'completed',
       containerMeta: undefined, // Clear metadata
     });
     ```

**Test Criteria:**
- [ ] Import `test-nested-parallel-in-loop.yaml`
- [ ] Run simulation and inspect execution state in React DevTools
- [ ] Verify loop node state includes `containerMeta.currentIteration`
- [ ] Verify `currentItem` contains the actual item value
- [ ] Verify metadata updates for each iteration

**Expected Result:**
Loop container execution state includes iteration metadata that can be accessed by the UI.

---

### Task 6.2: Loop Visual States ⏱️ ~2 hours

**Goal:** Display loop execution state visually in the LoopContainerNode component.

**Files to Modify:**
- `web/src/components/nodes/LoopContainerNode.tsx`

**Changes Needed:**

1. **Import execution state**
   ```typescript
   const execution = useFlowStore((state) => state.execution);
   const nodeExecutionState = execution.nodeStates[id];
   ```

2. **Add iteration badge** (near existing badge area)
   ```typescript
   {nodeExecutionState?.containerMeta && (
     <div className="absolute top-2 right-2 px-2 py-1 bg-blue-500 text-white rounded text-xs font-bold">
       Loop {nodeExecutionState.containerMeta.currentIteration}/{nodeExecutionState.containerMeta.totalIterations}
     </div>
   )}
   ```

3. **Add execution state styling** (border colors)
   ```typescript
   const borderColor = nodeExecutionState
     ? nodeExecutionState.state === 'running'
       ? 'border-blue-500'
       : nodeExecutionState.state === 'completed'
       ? 'border-green-500'
       : nodeExecutionState.state === 'error'
       ? 'border-red-500'
       : 'border-gray-200'
     : selected
     ? 'border-gray-400'
     : 'border-gray-200';
   ```

4. **Add current item display** (if simple type)
   ```typescript
   {nodeExecutionState?.containerMeta?.currentItem &&
    typeof nodeExecutionState.containerMeta.currentItem !== 'object' && (
     <div className="text-xs text-gray-600 mt-1 font-mono">
       Current: {String(nodeExecutionState.containerMeta.currentItem)}
     </div>
   )}
   ```

5. **Add subtle pulse animation when running**
   ```typescript
   className={`${borderColor} ${
     nodeExecutionState?.state === 'running' ? 'animate-pulse' : ''
   }`}
   ```

**Test Criteria:**
- [ ] Import `test-nested-parallel-in-loop.yaml`
- [ ] Run simulation
- [ ] Verify "Loop 1/X" badge appears during execution
- [ ] Verify border turns blue when running
- [ ] Verify border turns green when completed
- [ ] Verify current item displays (if simple type like string/number)
- [ ] Verify pulse animation during execution

**Expected Result:**
Loop container visually shows execution progress with iteration counter and colored states.

**Visual Design:**
```
┌─────────────────────────────────────┐
│ 🔄 Loop                    [3/5] ← Badge│
│ for_each: ${batches}                │
│ Current: batch-abc123  ← Current item│
│ ═════════════════════════════ ← Blue border (running)
│                                     │
│ [Child nodes render here]           │
│                                     │
└─────────────────────────────────────┘
```

---

### Task 6.3: Parallel Progress Tracking ⏱️ ~1.5 hours

**Goal:** Track parallel task completion in simulator.

**Files to Modify:**
- `web/src/services/flowSimulator.ts` - Update executeParallel() to track child progress

**Changes Needed:**

1. **Update executeParallel() function** (flowSimulator.ts, lines ~340-380)
   - Track which children are active and completed
   - Update parallel node state before executing children:
     ```typescript
     const childNodes = this.nodes.filter(n => n.parentId === node.id);
     const childIds = childNodes.map(n => n.id);

     this.context.updateNodeState(node.id, {
       state: 'running',
       containerMeta: {
         activeChildren: childIds,
         completedChildren: [],
       }
     });
     ```

   - After each child completes, update the metadata:
     ```typescript
     // Inside the Promise.all or after each child execution
     const completedIds = childResults.map((_, idx) => childIds[idx]);
     this.context.updateNodeState(node.id, {
       state: 'running',
       containerMeta: {
         activeChildren: [],
         completedChildren: completedIds,
       }
     });
     ```

   - Mark parallel as completed after all children finish:
     ```typescript
     this.context.updateNodeState(node.id, {
       state: 'completed',
       containerMeta: undefined,
     });
     ```

**Note:** Since parallel execution uses Promise.all, children start together. We may need to listen to child state changes to update activeChildren in real-time.

**Test Criteria:**
- [ ] Import `test-nested-loop-in-parallel.yaml`
- [ ] Run simulation
- [ ] Verify parallel node state includes `containerMeta`
- [ ] Verify `activeChildren` contains child node IDs
- [ ] Verify `completedChildren` updates as children finish

**Expected Result:**
Parallel container tracks which children are running and completed.

---

### Task 6.4: Parallel Visual States ⏱️ ~2 hours

**Goal:** Display parallel execution progress visually.

**Files to Modify:**
- `web/src/components/nodes/ParallelContainerNode.tsx`

**Changes Needed:**

1. **Import execution state**
   ```typescript
   const execution = useFlowStore((state) => state.execution);
   const nodeExecutionState = execution.nodeStates[id];
   ```

2. **Calculate progress**
   ```typescript
   const totalChildren = childNodes.length;
   const completedCount = nodeExecutionState?.containerMeta?.completedChildren?.length ?? 0;
   const progressText = totalChildren > 0 ? `${completedCount}/${totalChildren}` : '';
   ```

3. **Add progress badge**
   ```typescript
   {nodeExecutionState?.state === 'running' && progressText && (
     <div className="absolute top-2 right-2 px-2 py-1 bg-purple-500 text-white rounded text-xs font-bold">
       {progressText} tasks
     </div>
   )}
   ```

4. **Add execution state styling** (similar to loop)
   - Border colors: blue (running), green (completed), red (error)
   - Pulse animation when running

5. **Highlight running children** (optional enhancement)
   ```typescript
   const isChildRunning = (childId: string) => {
     return nodeExecutionState?.containerMeta?.activeChildren?.includes(childId);
   };

   // In child rendering, add a glow effect if child is in activeChildren
   ```

**Test Criteria:**
- [ ] Import `test-nested-loop-in-parallel.yaml`
- [ ] Run simulation
- [ ] Verify "X/Y tasks" badge appears
- [ ] Verify border turns blue when running
- [ ] Verify progress updates as children complete
- [ ] Verify border turns green when all children complete

**Expected Result:**
Parallel container shows task completion progress visually.

**Visual Design:**
```
┌─────────────────────────────────────┐
│ ⚡ Parallel           [3/5 tasks] ← Progress│
│ ═════════════════════════════ ← Blue border
│                                     │
│ ┌─────────────┐ ┌─────────────┐   │
│ │ ✓ Task1     │ │ ⏳ Task2     │   │ ← Running glow
│ └─────────────┘ └─────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

---

### Task 6.5: Conditional Branch Highlighting ⏱️ ~2 hours

**Goal:** Highlight which branch (then/else) is executing in conditional nodes.

**Files to Modify:**
- `web/src/services/flowSimulator.ts` - Update executeConditional()
- `web/src/components/nodes/ConditionalContainerNode.tsx`

**Changes Needed:**

1. **Update executeConditional()** (flowSimulator.ts, lines ~223-276)
   ```typescript
   // Mark conditional as running with metadata
   this.context.updateNodeState(node.id, {
     state: 'running',
     containerMeta: {
       activeBranch: conditionResult ? 'then' : 'else',
       conditionResult: conditionResult,
     }
   });

   // ... execute branch ...

   // Mark as completed
   this.context.updateNodeState(node.id, {
     state: 'completed',
     containerMeta: undefined,
   });
   ```

2. **Update ConditionalContainerNode**
   - Import execution state
   - Highlight active branch with green background
   - Dim inactive branch with gray background
   - Show condition result (true/false) in badge

   ```typescript
   const execution = useFlowStore((state) => state.execution);
   const nodeExecutionState = execution.nodeStates[id];
   const activeBranch = nodeExecutionState?.containerMeta?.activeBranch;

   // For then branch
   <div className={`relative flex items-center rounded-lg px-3 py-2 ${
     activeBranch === 'then'
       ? 'bg-green-100 border-2 border-green-500'
       : activeBranch === 'else'
       ? 'bg-gray-100 opacity-50'
       : 'bg-green-50/50 border border-green-200'
   }`}>
   ```

3. **Add condition result badge**
   ```typescript
   {nodeExecutionState?.containerMeta && (
     <div className="absolute top-2 right-2 px-2 py-1 bg-blue-500 text-white rounded text-xs">
       {nodeExecutionState.containerMeta.conditionResult ? 'TRUE' : 'FALSE'}
     </div>
   )}
   ```

**Test Criteria:**
- [ ] Create test file with conditional (or use existing flow)
- [ ] Run simulation
- [ ] Verify active branch (then or else) highlights in green
- [ ] Verify inactive branch dims/grays out
- [ ] Verify condition result badge shows TRUE/FALSE
- [ ] Verify highlighting clears after execution completes

**Expected Result:**
Conditional node clearly shows which branch is executing.

**Visual Design:**
```
┌──────────────────────────────┐
│ ? Conditional      [TRUE] ← Result│
│ if: ${condition}             │
├──────────────────────────────┤
│ ✓ Then ← GREEN HIGHLIGHT     │
│   These steps execute        │
├──────────────────────────────┤
│ Else  ← Gray/dimmed          │
│   These steps skipped        │
└──────────────────────────────┘
```

---

### Task 6.6: Switch Case Highlighting ⏱️ ~2 hours

**Goal:** Highlight which case matched in switch nodes.

**Files to Modify:**
- `web/src/services/flowSimulator.ts` - Update executeSwitch()
- `web/src/components/nodes/SwitchContainerNode.tsx`

**Changes Needed:**

1. **Update executeSwitch()** (flowSimulator.ts, lines ~324-395)
   ```typescript
   // When case matches
   this.context.updateNodeState(node.id, {
     state: 'running',
     containerMeta: {
       matchedCase: caseValue,
       matchedCaseIndex: caseIndex,
     }
   });

   // ... execute matched case ...

   // Mark as completed
   this.context.updateNodeState(node.id, {
     state: 'completed',
     containerMeta: undefined,
   });
   ```

2. **Update SwitchContainerNode**
   - Import execution state
   - Highlight matched case with green background
   - Dim non-matching cases
   - Show matched value in badge

   ```typescript
   const execution = useFlowStore((state) => state.execution);
   const nodeExecutionState = execution.nodeStates[id];
   const matchedIndex = nodeExecutionState?.containerMeta?.matchedCaseIndex;

   // For each case
   <div className={`... ${
     matchedIndex === caseIndex
       ? 'bg-green-100 border-2 border-green-500'
       : matchedIndex !== undefined
       ? 'bg-gray-100 opacity-50'
       : 'bg-blue-50/50 border border-blue-200'
   }`}>
   ```

3. **Add matched value badge**
   ```typescript
   {nodeExecutionState?.containerMeta?.matchedCase !== undefined && (
     <div className="absolute top-2 right-2 px-2 py-1 bg-blue-500 text-white rounded text-xs">
       Matched: {String(nodeExecutionState.containerMeta.matchedCase)}
     </div>
   )}
   ```

**Test Criteria:**
- [ ] Create test file with switch (or use existing)
- [ ] Run simulation
- [ ] Verify matched case highlights in green
- [ ] Verify non-matching cases dim
- [ ] Verify matched value shows in badge
- [ ] Verify default case highlights if no match

**Expected Result:**
Switch node clearly shows which case matched during execution.

**Visual Design:**
```
┌──────────────────────────────┐
│ ⚡ Switch      [Matched: "A"]│
│ switch: ${value}             │
├──────────────────────────────┤
│ ✓ Case A ← GREEN HIGHLIGHT   │
├──────────────────────────────┤
│ Case B  ← Gray/dimmed        │
├──────────────────────────────┤
│ Default ← Gray/dimmed        │
└──────────────────────────────┘
```

---

## Testing Strategy

### Per-Task Testing

Each task should be tested independently:

1. **Visual Verification**
   - Import test file
   - Run simulation in step mode (slow)
   - Verify visual changes appear as expected
   - Check border colors, badges, highlights

2. **State Verification**
   - Use React DevTools
   - Inspect execution.nodeStates
   - Verify containerMeta contains expected data
   - Check state transitions (pending → running → completed)

3. **Performance Check**
   - Run simulation at normal speed
   - Verify no lag or slowdown
   - Should be <100ms per node update

### Integration Testing

After all tasks complete:

1. **Test with all 3 nested test files**
   - `test-nested-loop-in-parallel.yaml`
   - `test-nested-parallel-in-loop.yaml`
   - `test-nested-deep-three-levels.yaml`

2. **Verify multi-level visualization**
   - 3-level nesting: Parallel > Loop > Parallel
   - All levels show execution state
   - Iteration counters work at each level
   - Progress indicators update correctly

3. **Test error states**
   - Simulate task errors
   - Verify red borders appear
   - Verify error propagates through containers

### Test Files Needed

**Existing:**
- ✅ `test-nested-loop-in-parallel.yaml`
- ✅ `test-nested-parallel-in-loop.yaml`
- ✅ `test-nested-deep-three-levels.yaml`

**New (to create):**
- ⏳ `test-conditional-execution.yaml` - Simple conditional flow
- ⏳ `test-switch-execution.yaml` - Simple switch flow

---

## Implementation Order

### Recommended Sequence:

1. **Task 6.1** - Loop Iteration Tracking (foundation)
2. **Task 6.2** - Loop Visual States (test immediately)
3. **Task 6.3** - Parallel Progress Tracking (foundation)
4. **Task 6.4** - Parallel Visual States (test immediately)
5. **Task 6.5** - Conditional Branch Highlighting
6. **Task 6.6** - Switch Case Highlighting

**Rationale:**
- Loop and parallel are the most commonly used containers
- Implementing visuals right after foundation helps verify the foundation works
- Conditional/switch can be done last (less commonly used in test files)

### Commit Strategy:

- Commit after completing 6.1 + 6.2 (loop visualization complete)
- Commit after completing 6.3 + 6.4 (parallel visualization complete)
- Commit after completing 6.5 + 6.6 (routing visualization complete)

---

## Success Criteria

### Must Work ✅
- [ ] Loop containers show iteration counter during execution
- [ ] Parallel containers show task completion progress
- [ ] Conditional nodes highlight active branch (then/else)
- [ ] Switch nodes highlight matched case
- [ ] All containers show execution state via border colors
- [ ] All 3 nested test files visualize correctly during simulation
- [ ] No performance degradation (<100ms per update)

### Should Work (Nice to Have) ⭐
- [ ] Current loop item displays (for simple types)
- [ ] Running children in parallel have subtle glow
- [ ] Pulse animation on running containers
- [ ] Execution history shows container metadata
- [ ] Can pause/resume and see frozen execution state

---

## Risk Analysis

### Technical Risks

1. **State update performance**
   - Problem: Updating containerMeta on every iteration could be slow
   - Mitigation: Only update when metadata changes, not every render
   - Fallback: Debounce updates or skip visual updates in fast loops

2. **React re-rendering**
   - Problem: Execution state changes trigger re-renders of all nodes
   - Mitigation: Use React.memo on container nodes, shallow equality checks
   - Fallback: Optimize with useMemo for expensive calculations

3. **Metadata size**
   - Problem: Storing currentItem could be large for complex objects
   - Mitigation: Only store simple types, truncate large objects
   - Fallback: Store reference ID instead of full object

### UX Risks

1. **Visual clutter**
   - Problem: Too many badges/indicators might overwhelm
   - Mitigation: Use subtle colors, small badges, only show during execution
   - Future: Add "show/hide execution details" toggle

2. **Color overload**
   - Problem: Too many colors (blue, green, red, purple) confusing
   - Mitigation: Consistent color scheme across all containers
   - Standard: Blue=running, Green=success, Red=error, Purple=info

---

## Notes for Implementation

### Important Considerations:

1. **State Cleanup**
   - Always clear containerMeta when execution completes
   - Prevents stale metadata from showing on next run

2. **Undefined Handling**
   - Check for undefined before accessing containerMeta
   - Use optional chaining: `nodeExecutionState?.containerMeta?.currentIteration`

3. **Type Safety**
   - Ensure containerMeta type is properly defined in TypeScript
   - Avoid `any` types - use specific interfaces

4. **Backwards Compatibility**
   - Nodes without execution state should still render normally
   - Don't break existing flows without nested execution

5. **Performance**
   - Use React.memo to prevent unnecessary re-renders
   - Only update when execution state actually changes

---

## Next Steps After Phase 6

Once Phase 6 is complete:

1. **Phase 5: Property Panel Editing** - Edit nested structures via UI
2. **Phase 3: Drag & Drop** (optional) - Interactive nesting
3. **Phase 7: Advanced Features** - Focus mode, breadcrumbs, minimap

Phase 6 completion will give us a fully functional MVP for visualizing complex nested flow execution!
