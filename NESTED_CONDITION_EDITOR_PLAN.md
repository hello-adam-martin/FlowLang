# Nested Quantified Condition Editor Plan

## Overview
Implement a recursive tree editor for nested quantified conditions in Conditional nodes, allowing users to build complex multi-level boolean logic through the UI.

## Current State

**What Works:**
- ✅ Simple conditions: `${var} > 100`
- ✅ Flat quantified conditions:
  ```yaml
  all:
    - ${credit_score} > 700
    - ${income} > 50000
    - ${assets} > 100000
  ```
- ✅ Basic add/remove condition UI
- ✅ Type selector (simple/all/any/none)

**What's Missing:**
- ❌ Nested quantified conditions (quantifiers inside quantifiers)
- ❌ Visual tree representation of nesting
- ❌ UI to add nested quantifier blocks
- ❌ Validation for deeply nested structures
- ❌ Drag-and-drop reordering within tree

## Goals

1. Support unlimited nesting depth (with warnings for 3+ levels)
2. Visual tree UI with indentation showing structure
3. Each node can be either a condition or a nested quantifier
4. Add/remove operations at any level
5. Validation to prevent invalid structures
6. Clear visual distinction between levels

## Architecture

### Data Structure

Current flat structure:
```typescript
{
  all: ["${a} > 1", "${b} > 2"]
}
```

Nested structure:
```typescript
{
  all: [
    "${credit_score} > 700",
    {
      any: [
        "${income} > 50000",
        "${assets} > 100000"
      ]
    },
    {
      none: [
        "${bankruptcy}",
        "${foreclosure}"
      ]
    }
  ]
}
```

### Component Structure

```
ConditionalNodeProperties
  └─ QuantifiedConditionEditor (new)
      └─ ConditionTreeNode (new, recursive)
          ├─ SimpleCondition (leaf node)
          └─ QuantifierNode (branch node)
              └─ ConditionTreeNode (recursive)
```

## Implementation Tasks

### Task 5.7.1: Create Base QuantifiedConditionEditor Component (~2 hours)

**File to create:**
- `web/src/components/PropertyPanel/QuantifiedConditionEditor.tsx`

**Features:**
- Replace current quantified condition UI in ConditionalNodeProperties
- Props: `value`, `onChange`, `currentNodeId`
- State: Internal tree structure representation
- Convert between flat/nested formats
- Render root-level quantifier type selector

**Data model:**
```typescript
type ConditionNode = SimpleConditionNode | QuantifierConditionNode;

interface SimpleConditionNode {
  type: 'simple';
  id: string;
  value: string; // e.g., "${credit_score} > 700"
}

interface QuantifierConditionNode {
  type: 'quantifier';
  id: string;
  quantifier: 'all' | 'any' | 'none';
  children: ConditionNode[];
}
```

### Task 5.7.2: Create Recursive ConditionTreeNode Component (~3 hours)

**File to create:**
- `web/src/components/PropertyPanel/ConditionTreeNode.tsx`

**Features:**
- Recursive component that renders itself for nested quantifiers
- Props: `node`, `depth`, `onUpdate`, `onDelete`, `onAddSibling`, `currentNodeId`
- Indentation based on depth (margin-left: depth * 20px)
- Two render modes:
  1. Simple condition: Input field with VariableSelector
  2. Quantifier: Dropdown + recursive children + add buttons

**UI Structure:**
```typescript
// For simple condition:
<div style={{ marginLeft: `${depth * 20}px` }}>
  <VariableSelector value={node.value} onChange={...} />
  <button onClick={onDelete}>✕</button>
  <button onClick={onMoveUp}>↑</button>
  <button onClick={onMoveDown}>↓</button>
</div>

// For quantifier:
<div style={{ marginLeft: `${depth * 20}px` }}>
  <select value={node.quantifier} onChange={...}>
    <option value="all">ALL must be true</option>
    <option value="any">ANY must be true</option>
    <option value="none">NONE must be true</option>
  </select>
  <button onClick={onDelete}>✕</button>

  <div className="ml-4">
    {node.children.map(child => (
      <ConditionTreeNode
        key={child.id}
        node={child}
        depth={depth + 1}
        onUpdate={...}
        onDelete={...}
      />
    ))}
  </div>

  <div className="ml-4 flex gap-2">
    <button onClick={addSimpleCondition}>+ Add Condition</button>
    <button onClick={addNestedQuantifier}>+ Add Nested ▼</button>
  </div>
</div>
```

### Task 5.7.3: Implement Tree Operations (~2 hours)

**Operations to support:**

1. **Add simple condition**: Insert new SimpleConditionNode
2. **Add nested quantifier**: Insert new QuantifierConditionNode with one empty child
3. **Delete node**: Remove from parent's children array
4. **Update node**: Replace value or quantifier type
5. **Reorder**: Move up/down within parent's children array

**Implementation approach:**
```typescript
// Immutable tree updates using recursion
function updateNodeInTree(
  tree: ConditionNode,
  nodeId: string,
  updater: (node: ConditionNode) => ConditionNode
): ConditionNode {
  if (tree.id === nodeId) {
    return updater(tree);
  }

  if (tree.type === 'quantifier') {
    return {
      ...tree,
      children: tree.children.map(child =>
        updateNodeInTree(child, nodeId, updater)
      )
    };
  }

  return tree;
}

// Similar functions for delete, add, reorder
```

### Task 5.8: Nested Quantifier Dropdown UI (~2 hours)

**Features:**
- "Add Nested Quantifier" button shows dropdown menu
- Options: "All (AND)", "Any (OR)", "None (NOT)"
- On select:
  - Create new QuantifierConditionNode
  - Add one empty SimpleConditionNode as child
  - Insert into parent's children array
  - Render with increased indentation

**UI Mockup:**
```
ALL must be true:
  ├─ ${credit_score} > 700           [✕][↑][↓]
  ├─ [+ Add Condition] [+ Add Nested ▼]
  │                         └─ All (AND)
  │                         └─ Any (OR)
  │                         └─ None (NOT)
```

### Task 5.9: Validation (~2 hours)

**Validation Rules:**

1. **Empty quantifiers**: Each QuantifierConditionNode must have ≥1 child
   ```typescript
   function validateTree(node: ConditionNode, errors: string[]): void {
     if (node.type === 'quantifier') {
       if (node.children.length === 0) {
         errors.push(`Quantifier "${node.quantifier}" must have at least one condition`);
       }
       node.children.forEach(child => validateTree(child, errors));
     } else {
       if (!node.value.trim()) {
         errors.push('Condition cannot be empty');
       }
       // Validate variable syntax: ${...}
       if (node.value.includes('$') && !node.value.match(/\$\{[^}]+\}/)) {
         errors.push(`Invalid variable syntax in: ${node.value}`);
       }
     }
   }
   ```

2. **Depth warnings**: Warn if depth > 2
   ```typescript
   function getMaxDepth(node: ConditionNode, currentDepth = 0): number {
     if (node.type === 'simple') return currentDepth;
     return Math.max(
       ...node.children.map(child => getMaxDepth(child, currentDepth + 1))
     );
   }
   ```

3. **Complexity warnings**: Warn if total conditions > 10
   ```typescript
   function countConditions(node: ConditionNode): number {
     if (node.type === 'simple') return 1;
     return node.children.reduce((sum, child) => sum + countConditions(child), 0);
   }
   ```

**UI for errors:**
- Inline red text below invalid nodes
- Disable "Save" or show warning banner at top
- Show all errors in a list

### Task 5.10: Integration with ConditionalNodeProperties (~1 hour)

**Changes needed:**

1. Replace existing quantified condition UI with new QuantifiedConditionEditor
2. Convert between old flat format and new tree format
3. Maintain backward compatibility with existing flows
4. Update useEffect to sync with new structure

**Conversion functions:**
```typescript
// Convert old flat format to tree
function flatToTree(quantifier: 'all' | 'any' | 'none', conditions: string[]): QuantifierConditionNode {
  return {
    type: 'quantifier',
    id: generateId(),
    quantifier,
    children: conditions.map(cond => ({
      type: 'simple',
      id: generateId(),
      value: cond
    }))
  };
}

// Convert tree to YAML format
function treeToYaml(node: ConditionNode): any {
  if (node.type === 'simple') {
    return node.value;
  }

  return {
    [node.quantifier]: node.children.map(child => treeToYaml(child))
  };
}
```

## Visual Design

### Color Coding by Depth
- **Depth 0 (root)**: Amber background
- **Depth 1**: Light blue background
- **Depth 2**: Light green background
- **Depth 3+**: Light red background (warning)

### Indentation
- Each level indents 20px more than parent
- Visual line connecting parent to children (CSS border-left)

### Icons
- 📋 Simple condition
- 🔗 ALL quantifier
- 🔀 ANY quantifier
- 🚫 NONE quantifier

### Example Visual
```
🔗 ALL must be true:                           [amber bg]
  │
  ├─ 📋 ${credit_score} > 700        [✕][↑][↓]
  │
  ├─ 🔀 ANY must be true:                      [light blue bg]
  │   │
  │   ├─ 📋 ${income} > 50000        [✕][↑][↓]
  │   ├─ 📋 ${assets} > 100000       [✕][↑][↓]
  │   │
  │   └─ [+ Condition] [+ Nested ▼]
  │
  ├─ 🚫 NONE must be true:                     [light blue bg]
  │   │
  │   ├─ 📋 ${bankruptcy}            [✕][↑][↓]
  │   ├─ 📋 ${foreclosure}           [✕][↑][↓]
  │   │
  │   └─ [+ Condition] [+ Nested ▼]
  │
  └─ [+ Condition] [+ Nested ▼]
```

## Testing Strategy

### Unit Tests
- Tree traversal and update operations
- Validation logic
- Conversion between formats
- Depth calculation
- Condition counting

### Integration Tests
- Add/remove simple conditions
- Add/remove nested quantifiers
- Reorder conditions
- Type changes (all → any → none)
- Save and reload complex trees

### User Acceptance Tests
- Build 3-level nested condition
- Validate error messages appear correctly
- Confirm YAML export matches structure
- Test with existing flat conditions (backward compatibility)

## Timeline Estimate

- **Task 5.7.1:** 2 hours (Base component)
- **Task 5.7.2:** 3 hours (Recursive tree node)
- **Task 5.7.3:** 2 hours (Tree operations)
- **Task 5.8:** 2 hours (Nested quantifier UI)
- **Task 5.9:** 2 hours (Validation)
- **Task 5.10:** 1 hour (Integration)

**Total:** 12 hours (~1.5 days)

## Success Criteria

**Must Have:**
- ✅ Support nested quantified conditions (all/any/none inside each other)
- ✅ Visual tree representation with indentation
- ✅ Add/remove conditions at any level
- ✅ Add/remove nested quantifiers at any level
- ✅ Validation prevents empty quantifiers
- ✅ Backward compatible with existing flat conditions

**Should Have:**
- ✅ Depth warnings (3+ levels)
- ✅ Complexity warnings (10+ conditions)
- ✅ Reorder conditions (up/down arrows)
- ✅ Clear visual distinction between levels

**Nice to Have:**
- ⚠️ Drag-and-drop reordering
- ⚠️ Collapse/expand nested quantifiers
- ⚠️ Syntax highlighting in condition inputs
- ⚠️ Auto-complete for variables

## Example Use Cases

### Use Case 1: Loan Approval
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

Logic: "Credit score must be good AND (high income OR high assets) AND NO red flags"

### Use Case 2: Premium Feature Access
```yaml
if:
  any:
    - ${subscription} == "premium"
    - all:
        - ${subscription} == "standard"
        - ${trial_days_remaining} > 0
    - ${is_admin} == true
```

Logic: "Premium subscriber OR (standard subscriber with trial remaining) OR admin"

### Use Case 3: Complex Eligibility
```yaml
if:
  all:
    - ${age} >= 18
    - any:
        - all:
            - ${country} == "US"
            - ${state} != "NY"
        - all:
            - ${country} == "CA"
            - ${province} != "QC"
    - none:
        - ${banned}
        - ${suspended}
```

Logic: "Adult AND (US except NY OR Canada except Quebec) AND not banned/suspended"

## Notes

- Start simple: Get basic nesting working first, then add polish
- Prioritize UX: Clear visual hierarchy is more important than features
- Keep it performant: Use React.memo for tree nodes
- Consider accessibility: Keyboard navigation for add/remove operations
- Document examples: Include real-world nested condition examples in docs

## Open Questions

1. **Max depth limit?** Should we enforce a hard limit (e.g., 5 levels)?
2. **Drag-and-drop?** Is reordering critical, or are up/down arrows sufficient?
3. **Collapse/expand?** Should deeply nested sections be collapsible?
4. **Templates?** Pre-built complex condition patterns for common use cases?
5. **Export format?** Should we support exporting to JavaScript/Python boolean expressions?

## Migration Strategy

**Backward Compatibility:**
- Existing flows with flat conditions continue to work
- UI automatically converts flat → tree on load
- Tree → flat conversion only if depth = 1
- Deep trees export as nested YAML

**Migration path:**
1. Deploy new UI with feature flag (disabled by default)
2. Test with power users
3. Enable for all users
4. Monitor for issues
5. Add documentation and examples
