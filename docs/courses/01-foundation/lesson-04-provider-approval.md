# Lesson 4: Provider Approval Workflow

**Duration**: 60 minutes

## Learning Objectives

In this lesson, you'll learn:
- How to create and use subflows for reusable logic
- Conditional branching (approve vs reject paths)
- Admin workflows and permissions patterns
- Email notification patterns
- Status tracking and audit trails

## The Provider Approval Workflow

### Business Requirements

When an admin reviews a provider application:
1. Load the application details
2. Admin makes a decision: approve or reject
3. If approved:
   - Create provider profile
   - Grant provider permissions
   - Send welcome email with next steps
4. If rejected:
   - Update application status
   - Send rejection email with reason
5. Record review details (who, when, why)
6. Notify applicant of decision

### Why Subflows?

The approval workflow will be reused across different contexts:
- Provider applications
- Later: Job postings that need approval
- Later: Dispute resolutions
- Later: Content moderation

By creating a **reusable approval subflow**, we write the logic once and use it everywhere.

## Step 1: Understanding Subflows

### What is a Subflow?

A **subflow** is a complete flow that can be called from other flows, like a function.

```yaml
# Main flow calls subflow
steps:
  - subflow: SendEmail    # Call the SendEmail subflow
    id: send_welcome
    inputs:
      to: ${user.email}
      template: "welcome"
    outputs:
      - email_sent
      - message_id
```

### Subflow Structure

Subflows are complete flows with their own:
- Inputs
- Steps
- Outputs
- Task implementations

They live in their own directories:
```
project/
├── flow.yaml           # Main flow
├── flow.py             # Main flow tasks
└── subflows/
    └── send_email/
        ├── flow.yaml   # Subflow definition
        └── flow.py     # Subflow tasks (optional)
```

### Benefits of Subflows

1. **Reusability**: Write once, use many times
2. **Testability**: Test subflow independently
3. **Organization**: Clear separation of concerns
4. **Maintainability**: Change logic in one place

## Step 2: Create the Approval Subflow

First, let's create a generic approval subflow.

### Directory Structure

```
foundation-project/
├── flow.yaml
├── flow.py
└── subflows/
    └── approval/
        ├── flow.yaml
        └── flow.py
```

### subflows/approval/flow.yaml

```yaml
flow: GenericApproval
description: |
  Reusable approval workflow that can be used for any entity
  requiring admin review and approval/rejection.

inputs:
  - name: entity_type
    type: string
    required: true
    description: Type of entity (e.g., "provider_application", "job_posting")

  - name: entity_id
    type: string
    required: true
    description: ID of entity being reviewed

  - name: reviewer_id
    type: string
    required: true
    description: ID of admin performing review

  - name: decision
    type: string
    required: true
    description: Decision (approve or reject)

  - name: notes
    type: string
    required: false
    description: Optional review notes/feedback

steps:
  # Step 1: Validate decision
  - task: ValidateDecision
    id: validate
    inputs:
      decision: ${inputs.decision}
    outputs:
      - valid
      - normalized_decision

  # Step 2: Validate reviewer has permission
  - task: ValidateReviewer
    id: check_reviewer
    inputs:
      reviewer_id: ${inputs.reviewer_id}
      entity_type: ${inputs.entity_type}
    outputs:
      - is_admin
      - reviewer_name

  # Step 3: Record the review decision
  - task: RecordReview
    id: record
    inputs:
      entity_type: ${inputs.entity_type}
      entity_id: ${inputs.entity_id}
      reviewer_id: ${inputs.reviewer_id}
      decision: ${validate.normalized_decision}
      notes: ${inputs.notes}
    outputs:
      - review_id
      - reviewed_at

outputs:
  - name: success
    value: true

  - name: decision
    value: ${validate.normalized_decision}

  - name: review_id
    value: ${record.review_id}

  - name: reviewed_at
    value: ${record.reviewed_at}

  - name: reviewer_name
    value: ${check_reviewer.reviewer_name}
```

### subflows/approval/flow.py

```python
from flowlang import TaskRegistry
from datetime import datetime

def create_task_registry():
    registry = TaskRegistry()

    @registry.register('ValidateDecision', description='Validate approval decision')
    async def validate_decision(decision: str, context):
        """
        Validate decision is approve or reject.

        Returns:
            valid: True if valid decision
            normalized_decision: lowercase decision
        """
        decision_lower = decision.lower().strip()

        if decision_lower not in ['approve', 'reject']:
            raise ValueError(f"Invalid decision: {decision}. Must be 'approve' or 'reject'")

        return {
            'valid': True,
            'normalized_decision': decision_lower
        }

    @registry.register('ValidateReviewer', description='Validate reviewer permissions')
    async def validate_reviewer(reviewer_id: str, entity_type: str, context):
        """
        Validate reviewer is an admin with permission to review this entity type.

        Returns:
            is_admin: True if user is admin
            reviewer_name: Name of reviewer
        """
        db = await context.get_connection('postgres')

        # Check if reviewer exists and is admin
        query = """
            SELECT full_name, is_admin
            FROM users
            WHERE id = $1
        """
        reviewer = await db.fetchrow(query, reviewer_id)

        if not reviewer:
            raise ValueError(f"Reviewer not found: {reviewer_id}")

        if not reviewer['is_admin']:
            raise ValueError(f"User {reviewer_id} does not have admin permissions")

        return {
            'is_admin': True,
            'reviewer_name': reviewer['full_name']
        }

    @registry.register('RecordReview', description='Record review decision')
    async def record_review(
        entity_type: str,
        entity_id: str,
        reviewer_id: str,
        decision: str,
        notes: str,
        context
    ):
        """
        Record the review decision in audit log.

        Returns:
            review_id: ID of review record
            reviewed_at: Timestamp of review
        """
        db = await context.get_connection('postgres')

        query = """
            INSERT INTO reviews (
                entity_type, entity_id, reviewer_id,
                decision, notes
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, created_at
        """

        result = await db.fetchrow(
            query,
            entity_type,
            entity_id,
            reviewer_id,
            decision,
            notes
        )

        return {
            'review_id': str(result['id']),
            'reviewed_at': result['created_at'].isoformat()
        }

    return registry
```

### Database Schema for Reviews

```sql
-- Generic reviews audit table
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    reviewer_id UUID REFERENCES users(id),
    decision VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reviews_entity ON reviews(entity_type, entity_id);
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_id);

-- Add is_admin column to users table
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
```

## Step 3: Create the Provider Approval Flow

Now let's create the main flow that uses the approval subflow.

### flow.yaml (Provider Approval)

```yaml
flow: ReviewProviderApplication
description: |
  Admin workflow to review and approve/reject provider applications.

  This flow uses the generic approval subflow and handles
  provider-specific logic (creating profile, sending emails).

inputs:
  - name: application_id
    type: string
    required: true
    description: ID of provider application to review

  - name: reviewer_id
    type: string
    required: true
    description: ID of admin performing review

  - name: decision
    type: string
    required: true
    description: Decision (approve or reject)

  - name: admin_notes
    type: string
    required: false
    description: Internal notes from reviewer

  - name: rejection_reason
    type: string
    required: false
    description: Reason for rejection (sent to applicant)

steps:
  # Step 1: Load application details
  - task: LoadProviderApplication
    id: load_app
    inputs:
      application_id: ${inputs.application_id}
    outputs:
      - application
      - user_id
      - user_email
      - user_name
      - services
      - status

  # Step 2: Check application is pending review
  - if: ${load_app.status} != 'pending'
    then:
      - exit:
          reason: "Application already reviewed"
          outputs:
            success: false
            error: "This application has already been reviewed"
            current_status: ${load_app.status}

  # Step 3: Call approval subflow (reusable logic)
  - subflow: approval/GenericApproval
    id: approval
    inputs:
      entity_type: "provider_application"
      entity_id: ${inputs.application_id}
      reviewer_id: ${inputs.reviewer_id}
      decision: ${inputs.decision}
      notes: ${inputs.admin_notes}
    outputs:
      - decision
      - review_id
      - reviewed_at
      - reviewer_name

  # Step 4: Branch based on decision
  - switch: ${approval.decision}
    cases:
      # Approval path
      - when: "approve"
        do:
          # Create provider profile
          - task: CreateProviderProfile
            id: create_profile
            inputs:
              user_id: ${load_app.user_id}
              application_id: ${inputs.application_id}
              application_data: ${load_app.application}
            outputs:
              - provider_id

          # Update application status
          - task: UpdateApplicationStatus
            id: update_approved
            inputs:
              application_id: ${inputs.application_id}
              status: "approved"
              reviewed_by: ${inputs.reviewer_id}
              reviewed_at: ${approval.reviewed_at}
              admin_notes: ${inputs.admin_notes}

          # Send welcome email
          - task: SendProviderWelcomeEmail
            id: send_welcome
            inputs:
              email: ${load_app.user_email}
              name: ${load_app.user_name}
              provider_id: ${create_profile.provider_id}
              services: ${load_app.services}
            outputs:
              - email_sent

      # Rejection path
      - when: "reject"
        do:
          # Update application status
          - task: UpdateApplicationStatus
            id: update_rejected
            inputs:
              application_id: ${inputs.application_id}
              status: "rejected"
              reviewed_by: ${inputs.reviewer_id}
              reviewed_at: ${approval.reviewed_at}
              admin_notes: ${inputs.admin_notes}

          # Send rejection email
          - task: SendRejectionEmail
            id: send_rejection
            inputs:
              email: ${load_app.user_email}
              name: ${load_app.user_name}
              application_id: ${inputs.application_id}
              reason: ${inputs.rejection_reason}
            outputs:
              - email_sent

outputs:
  - name: success
    value: true

  - name: application_id
    value: ${inputs.application_id}

  - name: decision
    value: ${approval.decision}

  - name: review_id
    value: ${approval.review_id}

  - name: provider_id
    value: ${create_profile.provider_id}
    # Note: This will be null if rejected, which is fine

  - name: message
    value: "Application ${approval.decision}d successfully"
```

## Step 4: Implement Provider-Specific Tasks

```python
from flowlang import TaskRegistry
import json
from typing import Dict, Any

def create_task_registry():
    registry = TaskRegistry()

    @registry.register('LoadProviderApplication', description='Load application details')
    async def load_provider_application(application_id: str, context):
        """
        Load full provider application from database.

        Returns:
            application: Full application object
            user_id: Applicant's user ID
            user_email: Applicant's email
            user_name: Applicant's name
            services: List of services
            status: Current status
        """
        db = await context.get_connection('postgres')

        query = """
            SELECT
                pa.*,
                u.email as user_email,
                u.full_name as user_name
            FROM provider_applications pa
            JOIN users u ON pa.user_id = u.id
            WHERE pa.id = $1
        """

        app = await db.fetchrow(query, application_id)

        if not app:
            raise ValueError(f"Application not found: {application_id}")

        # Parse JSONB fields
        return {
            'application': dict(app),
            'user_id': str(app['user_id']),
            'user_email': app['user_email'],
            'user_name': app['user_name'],
            'services': json.loads(app['services']) if app['services'] else [],
            'status': app['status']
        }

    @registry.register('CreateProviderProfile', description='Create provider profile')
    async def create_provider_profile(
        user_id: str,
        application_id: str,
        application_data: Dict[str, Any],
        context
    ):
        """
        Create provider profile from approved application.

        Returns:
            provider_id: ID of created provider profile
        """
        db = await context.get_connection('postgres')

        # Extract data from application
        services = json.loads(application_data['services'])
        service_area = json.loads(application_data['service_area'])

        query = """
            INSERT INTO providers (
                user_id,
                business_name,
                bio,
                services,
                hourly_rate,
                service_area,
                rating,
                total_jobs,
                status
            )
            VALUES ($1, $2, $3, $4, $5, $6, 0.0, 0, 'active')
            RETURNING id
        """

        result = await db.fetchrow(
            query,
            user_id,
            application_data.get('business_name'),
            application_data['bio'],
            application_data['services'],  # Already JSON string
            application_data['hourly_rate'],
            application_data['service_area']  # Already JSON string
        )

        return {
            'provider_id': str(result['id'])
        }

    @registry.register('UpdateApplicationStatus', description='Update application status')
    async def update_application_status(
        application_id: str,
        status: str,
        reviewed_by: str,
        reviewed_at: str,
        admin_notes: str,
        context
    ):
        """
        Update application status and review information.

        Returns:
            updated: True if updated
        """
        db = await context.get_connection('postgres')

        query = """
            UPDATE provider_applications
            SET
                status = $1,
                reviewed_by = $2,
                reviewed_at = $3,
                admin_notes = $4,
                updated_at = NOW()
            WHERE id = $5
        """

        await db.execute(
            query,
            status,
            reviewed_by,
            reviewed_at,
            admin_notes,
            application_id
        )

        return {'updated': True}

    @registry.register('SendProviderWelcomeEmail', description='Send welcome email to new provider')
    async def send_provider_welcome_email(
        email: str,
        name: str,
        provider_id: str,
        services: list,
        context
    ):
        """
        Send welcome email with onboarding information.

        Returns:
            email_sent: True if sent
        """
        base_url = context.config.get('BASE_URL', 'http://localhost:3000')

        print(f"📧 Sending provider welcome email to {email}")
        print(f"Subject: Welcome to LocalServe - You're Now a Provider!")
        print(f"")
        print(f"Hello {name},")
        print(f"")
        print(f"Congratulations! Your application has been approved.")
        print(f"")
        print(f"You're now a LocalServe provider for: {', '.join(services)}")
        print(f"")
        print(f"Next steps:")
        print(f"1. Complete your provider profile: {base_url}/provider/profile")
        print(f"2. Set your availability: {base_url}/provider/calendar")
        print(f"3. Start browsing jobs: {base_url}/provider/jobs")
        print(f"")
        print(f"Your provider ID: {provider_id}")
        print(f"")
        print(f"Best regards,")
        print(f"The LocalServe Team")

        return {'email_sent': True}

    @registry.register('SendRejectionEmail', description='Send rejection email')
    async def send_rejection_email(
        email: str,
        name: str,
        application_id: str,
        reason: str,
        context
    ):
        """
        Send rejection email with feedback.

        Returns:
            email_sent: True if sent
        """
        print(f"📧 Sending application rejection email to {email}")
        print(f"Subject: LocalServe Provider Application Update")
        print(f"")
        print(f"Hello {name},")
        print(f"")
        print(f"Thank you for your interest in becoming a LocalServe provider.")
        print(f"")
        print(f"After careful review, we're unable to approve your application at this time.")
        print(f"")
        if reason:
            print(f"Reason: {reason}")
            print(f"")
        print(f"You're welcome to reapply after addressing the feedback above.")
        print(f"")
        print(f"Application ID: {application_id}")
        print(f"")
        print(f"Best regards,")
        print(f"The LocalServe Team")

        return {'email_sent': True}

    return registry
```

## Step 5: Understanding Switch/Case

### Switch Statement in FlowLang

```yaml
- switch: ${approval.decision}
  cases:
    - when: "approve"
      do:
        - task: DoApprovalThing
    - when: "reject"
      do:
        - task: DoRejectionThing
    - when: ["pending", "review"]  # Multiple values
      do:
        - task: DoOtherThing
  default:  # Optional fallback
    - task: HandleUnexpected
```

### Switch vs If/Else

**Use if/else for binary decisions**:
```yaml
- if: ${user.age} >= 18
  then: [...]
  else: [...]
```

**Use switch for multi-way branches**:
```yaml
- switch: ${order.status}
  cases:
    - when: "pending"
      do: [...]
    - when: "processing"
      do: [...]
    - when: "shipped"
      do: [...]
    - when: "delivered"
      do: [...]
```

## Step 6: Testing with Subflows

### Testing the Subflow Independently

```python
class TestApprovalSubflow(FlowTestCase):

    @pytest.mark.asyncio
    async def test_approval_success(self):
        """Test approval subflow with approve decision"""
        mock_db = MockConnection()

        # Mock reviewer
        mock_db.add_query_result(
            "SELECT full_name, is_admin FROM users WHERE id = $1",
            {'full_name': 'Admin User', 'is_admin': True}
        )

        # Mock review recording
        mock_db.add_query_result(
            "INSERT INTO reviews",
            {'id': 'review-123', 'created_at': datetime.now()}
        )

        result = await self.execute_flow(
            'subflows/approval/GenericApproval',
            inputs={
                'entity_type': 'provider_application',
                'entity_id': 'app-123',
                'reviewer_id': 'admin-456',
                'decision': 'approve',
                'notes': 'Looks good'
            },
            connections={'postgres': mock_db}
        )

        assert result['success'] is True
        assert result['decision'] == 'approve'
        assert result['review_id'] == 'review-123'
```

### Testing the Main Flow with Subflow

```python
class TestProviderApproval(FlowTestCase):

    @pytest.mark.asyncio
    async def test_approve_application(self):
        """Test full approval flow"""
        mock_db = MockConnection()

        # Mock application load
        mock_db.add_query_result(
            "SELECT pa.*, u.email, u.full_name FROM provider_applications pa",
            {
                'id': 'app-123',
                'user_id': 'user-789',
                'user_email': 'provider@example.com',
                'user_name': 'Provider Name',
                'services': '["cleaning"]',
                'status': 'pending',
                'bio': 'Experienced cleaner',
                'hourly_rate': 45.00,
                'service_area': '{"city": "SF", "state": "CA"}'
            }
        )

        # Mock reviewer validation (subflow)
        mock_db.add_query_result(
            "SELECT full_name, is_admin FROM users",
            {'full_name': 'Admin', 'is_admin': True}
        )

        # Mock review recording (subflow)
        mock_db.add_query_result(
            "INSERT INTO reviews",
            {'id': 'review-123', 'created_at': datetime.now()}
        )

        # Mock provider creation
        mock_db.add_query_result(
            "INSERT INTO providers",
            {'id': 'provider-456'}
        )

        result = await self.execute_flow(
            'ReviewProviderApplication',
            inputs={
                'application_id': 'app-123',
                'reviewer_id': 'admin-123',
                'decision': 'approve'
            },
            connections={'postgres': mock_db}
        )

        assert result['success'] is True
        assert result['decision'] == 'approve'
        assert result['provider_id'] == 'provider-456'
```

## Key Concepts Learned

### 1. Subflow Composition
Break complex workflows into reusable pieces.

### 2. Switch/Case for Multi-way Branching
Handle multiple decision paths cleanly.

### 3. Audit Trails
Record all reviews for compliance and debugging.

### 4. Conditional Outputs
Some outputs only exist in certain paths (provider_id only on approve).

### 5. Role-Based Permissions
Validate user has permission before allowing action.

## Best Practices

### ✅ Do: Make Subflows Generic
```yaml
# Generic - can be reused
flow: GenericApproval
inputs:
  - name: entity_type
  - name: entity_id
```

### ✅ Do: Keep Subflow Logic Focused
Subflow should do ONE thing well (approval logic), not everything.

### ✅ Do: Pass Only What's Needed
```yaml
- subflow: Approval
  inputs:
    entity_id: ${load.id}  # Only pass ID, not entire object
```

### ❌ Don't: Duplicate Logic
If you're copy-pasting, create a subflow instead.

### ❌ Don't: Create Deep Nesting
Subflow calls subflow calls subflow = hard to debug.
Keep it max 2-3 levels deep.

## Exercises

### Exercise 1: Add Bulk Approval
Create a flow that approves multiple applications:
- Takes array of application IDs
- Uses `for_each` to loop
- Calls `ReviewProviderApplication` for each
- Returns summary (approved count, rejected count)

### Exercise 2: Add Appeal Process
Design a flow for rejected applicants to appeal:
- Load rejected application
- Add new documents/information
- Submit for re-review
- Creates new review record

### Exercise 3: Add Approval Workflow
Create a two-step approval:
- First review: Junior admin (initial screening)
- Second review: Senior admin (final approval)
- Both must approve before creating provider

## Summary

In this lesson, you learned:

✅ How to create reusable subflows
✅ Calling subflows from main flows
✅ Switch/case for multi-way branching
✅ Role-based permission checking
✅ Audit trail patterns
✅ Testing flows with subflows

**Next**: [Lesson 5: Profile Management](./lesson-05-profile-management.md)

In the next lesson, we'll build CRUD operations for user and provider profiles.

---

## Quick Reference

### Subflow Call
```yaml
- subflow: path/to/FlowName
  id: step_id
  inputs:
    param: ${inputs.value}
  outputs:
    - output_name
```

### Switch/Case
```yaml
- switch: ${variable}
  cases:
    - when: "value1"
      do: [steps...]
    - when: ["value2", "value3"]
      do: [steps...]
  default:
    - task: DefaultHandler
```

### Audit Pattern
```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY,
    entity_type VARCHAR(100),
    entity_id UUID,
    action VARCHAR(50),
    actor_id UUID,
    created_at TIMESTAMP
);
```
