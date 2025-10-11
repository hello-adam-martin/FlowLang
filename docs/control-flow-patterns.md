# FlowLang Control Flow Patterns

## Early Termination / Stop Processing Patterns

### The Problem

In FlowLang, steps execute sequentially. If you want to "stop processing" when a condition fails (like rejecting a loan application), you need to be intentional about your flow structure.

**❌ Anti-Pattern (Incorrect)**:
```yaml
steps:
  - if: ${should_reject}
    then:
      - task: RejectApplication
    else:
      - task: ApproveApplication

  # ❌ This step runs REGARDLESS of rejection!
  - task: ContinueProcessing

  # ❌ This also runs after rejection!
  - task: FinalizeProcess
```

In the above example, both `ContinueProcessing` and `FinalizeProcess` will execute even if the application was rejected. This is because FlowLang executes all steps in sequence unless they're nested inside a conditional.

### Solution Patterns

#### Pattern 1: Single Gate (Recommended for Simple Cases)

Nest all subsequent processing inside the approval branch:

```yaml
steps:
  - if: ${should_reject}
    then:
      # Rejection path - terminates here
      - task: RejectApplication
      - task: SendRejectionNotice
      - task: LogRejection
    else:
      # Approval path - continues processing
      - task: ApproveApplication
      - task: ContinueProcessing  # ✅ Only runs if approved
      - task: FinalizeProcess     # ✅ Only runs if approved
      - task: SendApproval        # ✅ Only runs if approved
```

**When to use**: Simple flows with a single approval/rejection decision point.

**Pros**:
- Clear and explicit
- Easy to understand
- Rejection stops processing immediately

**Cons**:
- Deep nesting if you have many steps
- Can become hard to read with very long approval paths

#### Pattern 2: Multi-Stage Gates

For complex flows, use multiple conditional checks where each stage verifies the previous stage succeeded:

```yaml
steps:
  # Stage 1: Initial check
  - if: ${passed_initial_check}
    then:
      - task: PerformStage1
        id: stage1
        outputs:
          - stage1_passed

      # Stage 2: Only if stage 1 passed
      - if: ${stage1.stage1_passed} == true
        then:
          - task: PerformStage2
            id: stage2
            outputs:
              - stage2_passed

          # Stage 3: Only if stage 2 passed
          - if: ${stage2.stage2_passed} == true
            then:
              - task: PerformStage3
            else:
              - task: HandleStage2Failure
        else:
          - task: HandleStage1Failure
    else:
      - task: HandleInitialFailure
```

**When to use**: Multi-stage processes where each stage can fail independently.

**Pros**:
- Clear stage boundaries
- Each stage can have its own error handling
- Easier to debug which stage failed

**Cons**:
- More verbose
- Deeper nesting

#### Pattern 3: Switch/Case for Multiple Terminal States

When you have multiple mutually exclusive outcomes:

```yaml
steps:
  - task: DetermineOutcome
    id: outcome
    outputs:
      - status  # "approved", "rejected", "pending", "blocked"

  - switch: ${outcome.status}
    cases:
      - when: "approved"
        do:
          # Full approval flow
          - task: ProcessApproval
          - task: SendConfirmation

      - when: "rejected"
        do:
          # Rejection flow - terminates here
          - task: LogRejection
          - task: SendRejection

      - when: "pending"
        do:
          # Queue for review - terminates here
          - task: QueueForReview
          - task: NotifyReviewer

      - when: "blocked"
        do:
          # Security block - terminates here
          - task: LogSecurityBlock
          - task: AlertSecurity
```

**When to use**: Multiple distinct terminal states (not just approve/reject).

**Pros**:
- Very clear and readable
- Each outcome path is independent
- Easy to add new outcomes
- No deep nesting

**Cons**:
- Requires a task to determine the outcome first
- All outcome logic must be inside case blocks

#### Pattern 4: Guard Clauses with Quantifiers

Use quantified conditionals for complex validation logic:

```yaml
steps:
  - task: FetchChecks
    id: checks
    outputs:
      - has_fraud_alert
      - has_disputes
      - account_locked

  # Only proceed if NONE of the red flags exist
  - if:
      none:
        - ${checks.has_fraud_alert} == true
        - ${checks.has_disputes} == true
        - ${checks.account_locked} == true
    then:
      # Passed all checks - continue
      - task: ProcessTransaction
      - task: UpdateRecords
      - task: SendConfirmation
    else:
      # Failed checks - terminate
      - task: BlockTransaction
      - task: NotifySecurity
```

**When to use**: Complex validation with multiple failure conditions.

**Pros**:
- Very readable validation logic
- Clear intent (NONE means "passed all checks")
- Easy to add more validation rules
- Leverages quantified conditionals

**Cons**:
- Requires understanding of quantifiers

## Best Practices

### 1. Design Flows with Termination in Mind

Ask yourself: "If this condition fails, should the rest of the flow stop?"

- **Yes** → Nest remaining steps inside the success branch
- **No** → Keep steps at the same level

### 2. Use Descriptive Step IDs

When you have multiple branches, use clear IDs to show what happened:

```yaml
# ❌ Confusing
id: result

# ✅ Clear
id: approval_result
id: rejection_result
id: pending_review
```

### 3. Document Terminal States

Add comments to show where processing stops:

```yaml
else:
  # Application rejected - flow terminates here
  - task: RejectApplication
  - task: SendRejection
```

### 4. Be Careful with Shared Output Variables

If both branches produce outputs, make sure they have compatible schemas or use different variable names:

```yaml
# ❌ Problematic - both use same ID
then:
  - task: Approve
    id: decision  # Outputs: approval_id, terms
else:
  - task: Reject
    id: decision  # Outputs: rejection_reason, code

# Output references ${decision.???} - what field exists?

# ✅ Better - use different IDs
then:
  - task: Approve
    id: approval
else:
  - task: Reject
    id: rejection

# Clear what exists: ${approval.terms} or ${rejection.reason}
```

### 5. Consider Using a Status Task

For complex flows, create a final status task that handles both paths:

```yaml
then:
  - task: ApproveApplication
    id: approval
  - task: RecordOutcome
    id: final_status
    inputs:
      outcome: "approved"
      details: ${approval}
else:
  - task: RejectApplication
    id: rejection
  - task: RecordOutcome
    id: final_status
    inputs:
      outcome: "rejected"
      details: ${rejection}

outputs:
  - name: status
    value: ${final_status.outcome}
```

## Common Mistakes

### Mistake 1: Continuing After Rejection

```yaml
# ❌ Wrong
- if: ${should_reject}
  then:
    - task: Reject
  else:
    - task: Approve

- task: SendEmail  # Runs for both paths!
```

**Fix**: Nest the email task inside each branch with appropriate logic:

```yaml
# ✅ Correct
- if: ${should_reject}
  then:
    - task: Reject
    - task: SendRejectionEmail
  else:
    - task: Approve
    - task: SendApprovalEmail
```

### Mistake 2: Assuming Switch Cases Stop Execution

```yaml
# ❌ Misleading
- switch: ${status}
  cases:
    - when: "reject"
      do:
        - task: Reject

- task: ContinueAnyway  # This WILL run after rejection!
```

Switch cases don't stop execution of subsequent steps. If you need to prevent further execution, nest everything inside the switch:

```yaml
# ✅ Correct - everything inside switch
- switch: ${status}
  cases:
    - when: "reject"
      do:
        - task: Reject
        - task: CleanupRejection
    - when: "approve"
      do:
        - task: Approve
        - task: ContinueProcessing  # Only runs for approve
```

### Mistake 3: Forgetting Edge Cases

Always handle the "else" or "default" case:

```yaml
# ❌ What happens if condition is false?
- if: ${score} > 700
  then:
    - task: Approve

# ✅ Always handle both paths
- if: ${score} > 700
  then:
    - task: Approve
  else:
    - task: Reject
```

## Examples

See these example flows for practical demonstrations:

- `flows/early_termination_pattern.yaml` - All structural patterns (1-4) in one place
- `flows/loan_approval_v2.yaml` - Proper loan approval with early termination
- `flows/exit_example.yaml` - Exit step examples and guard clause patterns (Pattern 5)

#### Pattern 5: Explicit Exit Step (Optional Alternative)

For simple guard clauses where you want to explicitly terminate the flow:

```yaml
steps:
  - task: FetchUser
    id: user
    outputs:
      - found
      - active

  # Guard clause 1: Exit if not found
  - if: ${user.found} == false
    then:
      - exit:
          reason: "User not found"
          outputs:
            status: "error"
            error_code: "USER_NOT_FOUND"

  # Guard clause 2: Exit if inactive
  - if: ${user.active} == false
    then:
      - exit:
          reason: "User inactive"
          outputs:
            status: "inactive"

  # Continue processing - only runs if all guards passed
  - task: ProcessUser
    id: result
```

**When to use**: Simple guard clauses where explicit termination is clearer than nesting.

**Pros**:
- Very clear termination intent
- Clean guard clause pattern
- Less nesting for simple cases
- Explicit outputs on termination

**Cons**:
- Less visible in flow structure
- Requires understanding of exit step
- Can make flow harder to visualize

**⚠️ IMPORTANT**: The exit step is an **escape hatch** for simple cases. The recommended approach is still to use structural nesting (Patterns 1-4) as they make the flow structure more visible and easier to understand.

## Summary

**Key Principle**: In FlowLang, steps execute sequentially unless nested inside conditionals or switch cases. To "stop processing" after a failure, you must nest all subsequent steps inside the success branch.

**Quick Decision Tree**:
1. Single decision point? → Use Pattern 1 (Single Gate)
2. Multiple stages? → Use Pattern 2 (Multi-Stage Gates)
3. Multiple terminal outcomes? → Use Pattern 3 (Switch/Case)
4. Complex validation? → Use Pattern 4 (Guard Clauses with Quantifiers)
5. Simple guard clauses? → Consider Pattern 5 (Exit Step) as alternative
