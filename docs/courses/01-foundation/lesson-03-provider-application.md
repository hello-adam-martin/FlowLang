# Lesson 3: Provider Application Flow

**Duration**: 60 minutes

## Learning Objectives

In this lesson, you'll learn:
- How to handle file uploads in FlowLang
- Multi-step form processing patterns
- Working with JSON fields in PostgreSQL
- Data transformation and validation
- Building complex input structures

## The Provider Application Workflow

### Business Requirements

When a user wants to become a service provider on LocalServe:
1. User must already have a registered account
2. Select service categories they offer (cleaning, plumbing, etc.)
3. Upload required documents (ID, certifications, insurance)
4. Provide business details (rates, service area, availability)
5. Submit application for admin review
6. Receive confirmation email

### Why This Flow is Important

This flow demonstrates:
- **Complex data structures** (arrays of services, nested objects)
- **File handling** (document uploads)
- **Foreign key relationships** (application → user)
- **Status tracking** (pending, under review, approved, rejected)

## Step 1: Database Schema

First, let's understand the database structure for provider applications.

```sql
-- Provider applications table
CREATE TABLE provider_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,

    -- Service information (JSONB allows flexible structure)
    services JSONB NOT NULL,
    -- Example: ["cleaning", "plumbing", "electrical"]

    -- Business details
    business_name VARCHAR(255),
    hourly_rate DECIMAL(10, 2),
    service_area JSONB,
    -- Example: {"city": "San Francisco", "radius_miles": 25, "zip_codes": ["94102", "94103"]}

    -- Certifications and documents
    certifications JSONB,
    -- Example: [{"type": "license", "number": "CA-12345", "expires": "2025-12-31"}]

    document_urls JSONB,
    -- Example: {"id_document": "s3://bucket/user123/id.pdf", "insurance": "s3://bucket/user123/insurance.pdf"}

    -- Bio and experience
    bio TEXT,
    years_experience INTEGER,

    -- Application status
    status VARCHAR(50) DEFAULT 'pending',
    -- Values: pending, under_review, approved, rejected, incomplete

    -- Review information
    admin_notes TEXT,
    reviewed_at TIMESTAMP,
    reviewed_by UUID REFERENCES users(id),

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_provider_applications_user_id ON provider_applications(user_id);
CREATE INDEX idx_provider_applications_status ON provider_applications(status);

-- Ensure user can only have one active application
CREATE UNIQUE INDEX idx_one_active_application_per_user
ON provider_applications(user_id)
WHERE status IN ('pending', 'under_review');
```

## Step 2: Design the Flow (flow.yaml)

```yaml
flow: ProviderApplication
description: |
  Submit application to become a service provider.

  This flow handles the complete application process including
  service selection, document uploads, and business details.

inputs:
  # User identification
  - name: user_id
    type: string
    required: true
    description: ID of user applying to be a provider

  # Service information
  - name: services
    type: array
    required: true
    description: List of service categories (e.g., ["cleaning", "plumbing"])

  # Business details
  - name: business_name
    type: string
    required: false
    description: Optional business name

  - name: hourly_rate
    type: number
    required: true
    description: Hourly rate in USD

  - name: service_area
    type: object
    required: true
    description: Service area details (city, radius, zip codes)

  # Professional information
  - name: bio
    type: string
    required: true
    description: Professional bio/description

  - name: years_experience
    type: number
    required: true
    description: Years of professional experience

  - name: certifications
    type: array
    required: false
    description: List of certifications/licenses

  # Documents (URLs after upload)
  - name: document_urls
    type: object
    required: true
    description: URLs to uploaded documents (ID, insurance, etc.)

steps:
  # Step 1: Validate user exists and doesn't have pending application
  - task: ValidateUserForApplication
    id: validate_user
    inputs:
      user_id: ${inputs.user_id}
    outputs:
      - user_exists
      - user_email
      - user_name
      - has_pending_application

  # Step 2: If user has pending application, exit with error
  - if: ${validate_user.has_pending_application} == true
    then:
      - exit:
          reason: "User already has a pending application"
          outputs:
            success: false
            error: "You already have a pending provider application"
            error_code: "PENDING_APPLICATION_EXISTS"

  # Step 3: Validate services are valid
  - task: ValidateServices
    id: validate_services
    inputs:
      services: ${inputs.services}
    outputs:
      - valid
      - normalized_services

  # Step 4: Validate hourly rate
  - task: ValidateHourlyRate
    id: validate_rate
    inputs:
      hourly_rate: ${inputs.hourly_rate}
    outputs:
      - valid
      - rate_tier

  # Step 5: Validate service area
  - task: ValidateServiceArea
    id: validate_area
    inputs:
      service_area: ${inputs.service_area}
    outputs:
      - valid
      - normalized_area

  # Step 6: Validate documents are accessible
  - task: ValidateDocuments
    id: validate_docs
    inputs:
      document_urls: ${inputs.document_urls}
    outputs:
      - valid
      - required_documents_present
      - missing_documents

  # Step 7: Calculate application score (completeness)
  - task: CalculateApplicationScore
    id: calculate_score
    inputs:
      services: ${validate_services.normalized_services}
      certifications: ${inputs.certifications}
      years_experience: ${inputs.years_experience}
      documents: ${validate_docs.required_documents_present}
    outputs:
      - completeness_score
      - application_strength

  # Step 8: Create application record
  - task: CreateProviderApplication
    id: create_application
    inputs:
      user_id: ${inputs.user_id}
      services: ${validate_services.normalized_services}
      business_name: ${inputs.business_name}
      hourly_rate: ${inputs.hourly_rate}
      service_area: ${validate_area.normalized_area}
      bio: ${inputs.bio}
      years_experience: ${inputs.years_experience}
      certifications: ${inputs.certifications}
      document_urls: ${inputs.document_urls}
      completeness_score: ${calculate_score.completeness_score}
    outputs:
      - application_id
      - status
      - created_at

  # Step 9: Notify admins about new application
  - task: NotifyAdminsNewApplication
    id: notify_admins
    inputs:
      application_id: ${create_application.application_id}
      user_name: ${validate_user.user_name}
      user_email: ${validate_user.user_email}
      services: ${validate_services.normalized_services}
      completeness_score: ${calculate_score.completeness_score}
    outputs:
      - notification_sent

  # Step 10: Send confirmation email to applicant
  - task: SendApplicationConfirmation
    id: send_confirmation
    inputs:
      user_email: ${validate_user.user_email}
      user_name: ${validate_user.user_name}
      application_id: ${create_application.application_id}
      services: ${validate_services.normalized_services}
    outputs:
      - email_sent

outputs:
  - name: success
    value: true

  - name: application_id
    value: ${create_application.application_id}

  - name: status
    value: ${create_application.status}

  - name: completeness_score
    value: ${calculate_score.completeness_score}

  - name: message
    value: "Application submitted successfully! You'll receive an email once it's been reviewed."
```

## Step 3: Implement the Tasks

```python
from flowlang import TaskRegistry
import json
from typing import List, Dict, Optional, Any
from datetime import datetime

def create_task_registry():
    registry = TaskRegistry()

    @registry.register('ValidateUserForApplication', description='Validate user can apply')
    async def validate_user_for_application(user_id: str, context):
        """
        Check if user exists and doesn't have pending application.

        Returns:
            user_exists: True if user found
            user_email: User's email
            user_name: User's name
            has_pending_application: True if pending application exists
        """
        db = await context.get_connection('postgres')

        # Check if user exists
        user_query = "SELECT email, full_name FROM users WHERE id = $1"
        user = await db.fetchrow(user_query, user_id)

        if not user:
            raise ValueError(f"User not found: {user_id}")

        # Check for pending application
        app_query = """
            SELECT id FROM provider_applications
            WHERE user_id = $1 AND status IN ('pending', 'under_review')
        """
        pending_app = await db.fetchrow(app_query, user_id)

        return {
            'user_exists': True,
            'user_email': user['email'],
            'user_name': user['full_name'],
            'has_pending_application': pending_app is not None
        }

    @registry.register('ValidateServices', description='Validate service categories')
    async def validate_services(services: List[str], context):
        """
        Validate service categories are valid and normalize them.

        Returns:
            valid: True if all services are valid
            normalized_services: Cleaned service list
        """
        # Available service categories
        VALID_SERVICES = {
            'cleaning': 'House Cleaning',
            'plumbing': 'Plumbing',
            'electrical': 'Electrical',
            'carpentry': 'Carpentry',
            'painting': 'Painting',
            'landscaping': 'Landscaping',
            'hvac': 'HVAC',
            'handyman': 'Handyman',
            'moving': 'Moving Services',
            'pest_control': 'Pest Control',
            'appliance_repair': 'Appliance Repair',
            'locksmith': 'Locksmith',
            'roofing': 'Roofing',
            'flooring': 'Flooring',
            'tutoring': 'Tutoring',
            'pet_care': 'Pet Care'
        }

        if not services or len(services) == 0:
            raise ValueError("At least one service must be selected")

        if len(services) > 5:
            raise ValueError("Maximum 5 services allowed")

        # Normalize and validate
        normalized = []
        for service in services:
            service_lower = service.lower().strip()
            if service_lower not in VALID_SERVICES:
                raise ValueError(f"Invalid service category: {service}")
            normalized.append(service_lower)

        # Remove duplicates
        normalized = list(set(normalized))

        return {
            'valid': True,
            'normalized_services': normalized
        }

    @registry.register('ValidateHourlyRate', description='Validate hourly rate')
    async def validate_hourly_rate(hourly_rate: float, context):
        """
        Validate hourly rate is reasonable.

        Returns:
            valid: True if rate is valid
            rate_tier: budget, standard, or premium
        """
        if hourly_rate < 15:
            raise ValueError("Hourly rate must be at least $15")

        if hourly_rate > 500:
            raise ValueError("Hourly rate cannot exceed $500")

        # Determine rate tier
        if hourly_rate < 30:
            tier = 'budget'
        elif hourly_rate < 75:
            tier = 'standard'
        else:
            tier = 'premium'

        return {
            'valid': True,
            'rate_tier': tier
        }

    @registry.register('ValidateServiceArea', description='Validate service area')
    async def validate_service_area(service_area: Dict[str, Any], context):
        """
        Validate and normalize service area information.

        Expected format:
        {
            "city": "San Francisco",
            "state": "CA",
            "radius_miles": 25,
            "zip_codes": ["94102", "94103"]  # optional
        }

        Returns:
            valid: True if valid
            normalized_area: Cleaned service area object
        """
        # Required fields
        if 'city' not in service_area or 'state' not in service_area:
            raise ValueError("Service area must include city and state")

        city = service_area['city'].strip()
        state = service_area['state'].strip().upper()

        if len(city) < 2:
            raise ValueError("City name too short")

        if len(state) != 2:
            raise ValueError("State must be 2-letter code (e.g., CA, NY)")

        # Radius
        radius = service_area.get('radius_miles', 25)
        if radius < 5:
            raise ValueError("Service radius must be at least 5 miles")
        if radius > 100:
            raise ValueError("Service radius cannot exceed 100 miles")

        # Normalize
        normalized = {
            'city': city,
            'state': state,
            'radius_miles': radius
        }

        # Optional zip codes
        if 'zip_codes' in service_area:
            zip_codes = service_area['zip_codes']
            if not isinstance(zip_codes, list):
                raise ValueError("zip_codes must be an array")
            # Validate each zip
            for zip_code in zip_codes:
                if not isinstance(zip_code, str) or len(zip_code) != 5:
                    raise ValueError(f"Invalid zip code: {zip_code}")
            normalized['zip_codes'] = zip_codes

        return {
            'valid': True,
            'normalized_area': normalized
        }

    @registry.register('ValidateDocuments', description='Validate required documents')
    async def validate_documents(document_urls: Dict[str, str], context):
        """
        Validate required documents are present.

        Required documents:
        - id_document: Government-issued ID
        - insurance: Liability insurance (for certain services)
        - certifications: Professional certifications (optional)

        Returns:
            valid: True if required docs present
            required_documents_present: Dict of doc types and presence
            missing_documents: List of missing required docs
        """
        REQUIRED_DOCS = ['id_document']
        OPTIONAL_DOCS = ['insurance', 'certifications', 'business_license']

        present = {}
        missing = []

        # Check required documents
        for doc_type in REQUIRED_DOCS:
            if doc_type in document_urls and document_urls[doc_type]:
                present[doc_type] = True
            else:
                present[doc_type] = False
                missing.append(doc_type)

        # Check optional documents
        for doc_type in OPTIONAL_DOCS:
            present[doc_type] = doc_type in document_urls and bool(document_urls[doc_type])

        if missing:
            raise ValueError(f"Missing required documents: {', '.join(missing)}")

        return {
            'valid': True,
            'required_documents_present': present,
            'missing_documents': []
        }

    @registry.register('CalculateApplicationScore', description='Calculate application completeness')
    async def calculate_application_score(
        services: List[str],
        certifications: Optional[List[Dict]],
        years_experience: int,
        documents: Dict[str, bool],
        context
    ):
        """
        Calculate application strength score (0-100).

        Scoring:
        - Services: 20 points (4 per service, max 5 services)
        - Certifications: 25 points
        - Experience: 25 points
        - Documents: 30 points

        Returns:
            completeness_score: 0-100
            application_strength: weak, good, strong, excellent
        """
        score = 0

        # Services (up to 20 points)
        score += min(len(services) * 4, 20)

        # Certifications (up to 25 points)
        if certifications and len(certifications) > 0:
            score += min(len(certifications) * 8, 25)

        # Experience (up to 25 points)
        if years_experience >= 10:
            score += 25
        elif years_experience >= 5:
            score += 20
        elif years_experience >= 2:
            score += 15
        elif years_experience >= 1:
            score += 10
        else:
            score += 5

        # Documents (up to 30 points)
        doc_score = sum(10 if present else 0 for present in documents.values())
        score += min(doc_score, 30)

        # Determine strength
        if score >= 85:
            strength = 'excellent'
        elif score >= 70:
            strength = 'strong'
        elif score >= 50:
            strength = 'good'
        else:
            strength = 'weak'

        return {
            'completeness_score': score,
            'application_strength': strength
        }

    @registry.register('CreateProviderApplication', description='Create application record')
    async def create_provider_application(
        user_id: str,
        services: List[str],
        business_name: Optional[str],
        hourly_rate: float,
        service_area: Dict[str, Any],
        bio: str,
        years_experience: int,
        certifications: Optional[List[Dict]],
        document_urls: Dict[str, str],
        completeness_score: int,
        context
    ):
        """
        Create provider application record in database.

        Returns:
            application_id: UUID of created application
            status: Application status (pending)
            created_at: Timestamp
        """
        db = await context.get_connection('postgres')

        query = """
            INSERT INTO provider_applications (
                user_id, services, business_name, hourly_rate,
                service_area, bio, years_experience, certifications,
                document_urls, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
            RETURNING id, status, created_at
        """

        result = await db.fetchrow(
            query,
            user_id,
            json.dumps(services),
            business_name,
            hourly_rate,
            json.dumps(service_area),
            bio,
            years_experience,
            json.dumps(certifications) if certifications else None,
            json.dumps(document_urls),
        )

        return {
            'application_id': str(result['id']),
            'status': result['status'],
            'created_at': result['created_at'].isoformat()
        }

    @registry.register('NotifyAdminsNewApplication', description='Notify admins of new application')
    async def notify_admins_new_application(
        application_id: str,
        user_name: str,
        user_email: str,
        services: List[str],
        completeness_score: int,
        context
    ):
        """
        Send notification to admins about new provider application.

        Returns:
            notification_sent: True if notification sent
        """
        # In production, this would send to admin dashboard/email/Slack
        print(f"📢 New Provider Application")
        print(f"   Applicant: {user_name} ({user_email})")
        print(f"   Services: {', '.join(services)}")
        print(f"   Score: {completeness_score}/100")
        print(f"   Application ID: {application_id}")
        print(f"   Review at: http://admin.localserve.com/applications/{application_id}")

        return {
            'notification_sent': True
        }

    @registry.register('SendApplicationConfirmation', description='Send confirmation email')
    async def send_application_confirmation(
        user_email: str,
        user_name: str,
        application_id: str,
        services: List[str],
        context
    ):
        """
        Send confirmation email to applicant.

        Returns:
            email_sent: True if email sent
        """
        print(f"📧 Sending application confirmation to {user_email}")
        print(f"Subject: Your LocalServe Provider Application")
        print(f"Body:")
        print(f"  Hello {user_name},")
        print(f"")
        print(f"  Thank you for applying to become a LocalServe provider!")
        print(f"")
        print(f"  Services: {', '.join(services)}")
        print(f"  Application ID: {application_id}")
        print(f"")
        print(f"  We'll review your application within 2-3 business days.")
        print(f"  You'll receive an email once the review is complete.")
        print(f"")
        print(f"  Best regards,")
        print(f"  The LocalServe Team")

        return {
            'email_sent': True
        }

    return registry
```

## Step 4: Understanding Complex Data Types

### Working with Arrays

```yaml
# Input
inputs:
  - name: services
    type: array  # Array of strings

# In task
async def validate_services(services: List[str], context):
    for service in services:
        print(service)
```

### Working with Objects (Dicts)

```yaml
# Input
inputs:
  - name: service_area
    type: object  # Dictionary

# In task
async def validate_area(service_area: Dict[str, Any], context):
    city = service_area['city']
    radius = service_area.get('radius_miles', 25)
```

### Storing JSON in PostgreSQL

```python
import json

# Insert JSON
await db.execute(
    "INSERT INTO table (json_field) VALUES ($1)",
    json.dumps({"key": "value"})
)

# Query JSON
result = await db.fetchrow("SELECT json_field FROM table WHERE id = $1", id)
data = json.loads(result['json_field'])

# Or use JSONB directly (PostgreSQL parses it)
await db.execute(
    "INSERT INTO table (jsonb_field) VALUES ($1)",
    '{"key": "value"}'  # PostgreSQL handles parsing
)
```

## Step 5: File Upload Handling

In a real application, file uploads happen in two steps:

### Step 1: Upload to Storage (Separate Endpoint)

```python
# Separate endpoint for file upload
@app.post("/upload-document")
async def upload_document(
    file: UploadFile,
    document_type: str,
    user_id: str
):
    """Upload document to S3 and return URL"""
    # Validate file
    if file.content_type not in ['application/pdf', 'image/jpeg', 'image/png']:
        raise ValueError("Invalid file type")

    # Upload to S3
    s3_key = f"applications/{user_id}/{document_type}/{file.filename}"
    await s3_client.upload_fileobj(file.file, bucket, s3_key)

    # Return URL
    url = f"https://s3.amazonaws.com/{bucket}/{s3_key}"
    return {"document_url": url, "document_type": document_type}
```

### Step 2: Submit Application with URLs

```json
{
  "inputs": {
    "user_id": "user-123",
    "services": ["cleaning", "plumbing"],
    "document_urls": {
      "id_document": "https://s3.amazonaws.com/bucket/applications/user-123/id/license.pdf",
      "insurance": "https://s3.amazonaws.com/bucket/applications/user-123/insurance/policy.pdf"
    },
    ...
  }
}
```

### Why Separate?

- File upload is a different concern than flow execution
- Allows progress tracking for large files
- Better error handling
- Can validate files before submitting application

## Step 6: Testing the Flow

```python
import pytest
from flowlang.testing import FlowTestCase, MockConnection

class TestProviderApplication(FlowTestCase):

    @pytest.mark.asyncio
    async def test_validate_services_success(self):
        """Test service validation with valid services"""
        result = await self.execute_task(
            'ValidateServices',
            inputs={'services': ['cleaning', 'plumbing', 'ELECTRICAL']}
        )

        assert result['valid'] is True
        assert set(result['normalized_services']) == {'cleaning', 'plumbing', 'electrical'}

    @pytest.mark.asyncio
    async def test_validate_services_invalid(self):
        """Test service validation with invalid service"""
        with pytest.raises(ValueError, match="Invalid service category"):
            await self.execute_task(
                'ValidateServices',
                inputs={'services': ['cleaning', 'invalid_service']}
            )

    @pytest.mark.asyncio
    async def test_validate_service_area(self):
        """Test service area validation"""
        result = await self.execute_task(
            'ValidateServiceArea',
            inputs={
                'service_area': {
                    'city': 'San Francisco',
                    'state': 'CA',
                    'radius_miles': 25,
                    'zip_codes': ['94102', '94103']
                }
            }
        )

        assert result['valid'] is True
        assert result['normalized_area']['city'] == 'San Francisco'
        assert result['normalized_area']['state'] == 'CA'

    @pytest.mark.asyncio
    async def test_calculate_application_score(self):
        """Test application score calculation"""
        result = await self.execute_task(
            'CalculateApplicationScore',
            inputs={
                'services': ['cleaning', 'plumbing'],
                'certifications': [
                    {'type': 'license', 'number': 'CA-12345'}
                ],
                'years_experience': 5,
                'documents': {
                    'id_document': True,
                    'insurance': True,
                    'certifications': True
                }
            }
        )

        assert result['completeness_score'] > 0
        assert result['application_strength'] in ['weak', 'good', 'strong', 'excellent']

    @pytest.mark.asyncio
    async def test_full_application_flow(self):
        """Test complete application submission"""
        mock_db = MockConnection()

        # Mock: User exists
        mock_db.add_query_result(
            "SELECT email, full_name FROM users WHERE id = $1",
            {'email': 'alice@example.com', 'full_name': 'Alice Smith'}
        )

        # Mock: No pending application
        mock_db.add_query_result(
            "SELECT id FROM provider_applications WHERE user_id = $1",
            None
        )

        # Mock: Application creation
        mock_db.add_query_result(
            "INSERT INTO provider_applications",
            {
                'id': 'app-123',
                'status': 'pending',
                'created_at': datetime.now()
            }
        )

        # Execute flow
        result = await self.execute_flow(
            'ProviderApplication',
            inputs={
                'user_id': 'user-123',
                'services': ['cleaning', 'plumbing'],
                'hourly_rate': 45.00,
                'service_area': {
                    'city': 'San Francisco',
                    'state': 'CA',
                    'radius_miles': 25
                },
                'bio': 'Experienced cleaner with 5 years in the industry.',
                'years_experience': 5,
                'certifications': [],
                'document_urls': {
                    'id_document': 'https://s3.aws.com/docs/id.pdf'
                }
            },
            connections={'postgres': mock_db}
        )

        assert result['success'] is True
        assert result['application_id'] == 'app-123'
        assert result['status'] == 'pending'
```

## Key Concepts Learned

### 1. Complex Data Structures
FlowLang handles arrays, objects, and nested structures naturally.

### 2. JSONB in PostgreSQL
Store flexible data structures without rigid schema.

### 3. Data Validation at Multiple Levels
- Format validation (email, zip codes)
- Business logic validation (rate limits, service area)
- Relational validation (user exists, no duplicate application)

### 4. Score Calculation
Quantify application strength for prioritization.

### 5. Separation of Concerns
File upload happens separately from flow execution.

## Best Practices

### ✅ Do: Normalize Data
```python
service_lower = service.lower().strip()
state = state.upper()
```

### ✅ Do: Validate Early
```yaml
- task: ValidateUser      # Fail fast if user invalid
- task: ValidateServices  # Fail before processing
- task: ValidateDocuments # Then proceed with creation
```

### ✅ Do: Use Descriptive Error Messages
```python
raise ValueError(f"Invalid service category: {service}")
raise ValueError("Service area must include city and state")
```

### ❌ Don't: Store Files in Database
Use S3/cloud storage, store URLs in database.

### ❌ Don't: Accept Arbitrary JSON
Always validate structure and required fields.

## Exercises

### Exercise 1: Add Certification Validation
Create a `ValidateCertifications` task that checks:
- Each certification has required fields (type, number, expires)
- Expiration date is in the future
- Certification number format is valid

### Exercise 2: Add Background Check
Design a new step that initiates a background check:
- Calls external API (mock it)
- Stores check ID in database
- Updates application status to "under_review"

### Exercise 3: Add Application Preview
Create a `GetApplicationPreview` flow that:
- Takes application data as input
- Validates everything
- Returns what the admin will see
- Does NOT save to database (dry run)

## Summary

In this lesson, you learned:

✅ How to handle complex data structures (arrays, objects)
✅ JSONB in PostgreSQL for flexible schemas
✅ Multi-level data validation
✅ File upload patterns (separate from flow)
✅ Application scoring and strength calculation
✅ Testing complex flows with mock data

**Next**: [Lesson 4: Provider Approval Workflow](./lesson-04-provider-approval.md)

In the next lesson, we'll build the admin review workflow using subflows for reusable approval logic.

---

## Quick Reference

### JSONB Operations

```python
# Insert JSON
import json
data = {'key': 'value'}
await db.execute("INSERT INTO table (field) VALUES ($1)", json.dumps(data))

# Query JSON field
result = await db.fetchrow("SELECT field FROM table WHERE id = $1", id)
data = json.loads(result['field'])

# Query inside JSON (PostgreSQL)
await db.fetch("SELECT * FROM table WHERE field->>'key' = $1", 'value')
```

### Array Validation

```python
from typing import List

def validate_array(items: List[str]):
    if not items:
        raise ValueError("Array cannot be empty")
    if len(items) > 10:
        raise ValueError("Too many items")
    return [item.strip().lower() for item in items]
```

### Object Validation

```python
from typing import Dict, Any

def validate_object(obj: Dict[str, Any]):
    required_fields = ['field1', 'field2']
    for field in required_fields:
        if field not in obj:
            raise ValueError(f"Missing required field: {field}")
    return obj
```
