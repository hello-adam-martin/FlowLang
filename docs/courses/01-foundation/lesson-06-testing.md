# Lesson 6: Testing Your Flows

**Duration**: 45 minutes

## Learning Objectives

In this lesson, you'll learn:
- FlowLang's testing framework
- Unit testing individual tasks
- Integration testing complete flows
- Mocking database connections
- Test fixtures and test data
- Running and organizing test suites

## Why Testing Matters

Testing ensures:
- **Correctness**: Flows work as designed
- **Reliability**: Changes don't break existing functionality
- **Documentation**: Tests show how flows should be used
- **Confidence**: Deploy without fear

## FlowLang Testing Framework

FlowLang provides `FlowTestCase` base class with utilities for testing:

```python
from flowlang.testing import FlowTestCase, MockConnection

class TestMyFlow(FlowTestCase):
    @pytest.mark.asyncio
    async def test_something(self):
        result = await self.execute_task('TaskName', inputs={...})
        assert result['output'] == expected
```

## Step 1: Project Structure

Organize tests by flow:

```
foundation-project/
├── flow.yaml
├── flow.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py                    # Shared fixtures
│   ├── test_user_registration.py     # User registration tests
│   ├── test_provider_application.py  # Provider application tests
│   ├── test_provider_approval.py     # Approval workflow tests
│   ├── test_profile_management.py    # Profile CRUD tests
│   └── fixtures/
│       ├── test_data.json            # Test data
│       └── mock_responses.py         # Mock API responses
└── pytest.ini                        # Pytest configuration
```

## Step 2: Configuration

### pytest.ini

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
markers =
    unit: Unit tests (fast, isolated)
    integration: Integration tests (require database)
    slow: Slow-running tests
addopts =
    -v
    --tb=short
    --strict-markers
```

### tests/conftest.py

```python
"""Shared test fixtures and configuration"""
import pytest
import asyncio
from flowlang.testing import MockConnection
from datetime import datetime

@pytest.fixture
def mock_db():
    """Mock database connection"""
    return MockConnection()

@pytest.fixture
def sample_user():
    """Sample user data for testing"""
    return {
        'id': 'user-123',
        'email': 'test@example.com',
        'full_name': 'Test User',
        'phone': '555-0100',
        'email_verified': False,
        'created_at': datetime.now()
    }

@pytest.fixture
def sample_provider_application():
    """Sample provider application data"""
    return {
        'id': 'app-123',
        'user_id': 'user-123',
        'services': '["cleaning", "plumbing"]',
        'business_name': 'Test Services Inc',
        'hourly_rate': 45.00,
        'service_area': '{"city": "San Francisco", "state": "CA", "radius_miles": 25}',
        'bio': 'Experienced professional',
        'years_experience': 5,
        'certifications': None,
        'document_urls': '{"id_document": "https://s3.aws.com/doc.pdf"}',
        'status': 'pending',
        'created_at': datetime.now()
    }

@pytest.fixture
def admin_user():
    """Admin user for approval tests"""
    return {
        'id': 'admin-456',
        'email': 'admin@example.com',
        'full_name': 'Admin User',
        'is_admin': True
    }
```

## Step 3: Unit Testing Tasks

Test individual tasks in isolation.

### tests/test_user_registration.py

```python
import pytest
from flowlang.testing import FlowTestCase, MockConnection
from datetime import datetime

class TestUserRegistration(FlowTestCase):
    """Unit tests for user registration flow"""

    #
    # Validation Tests
    #

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_validate_email_success(self):
        """Test email validation with valid email"""
        result = await self.execute_task(
            'ValidateEmail',
            inputs={'email': '  Test@Example.COM  '}
        )

        assert result['valid'] is True
        assert result['normalized_email'] == 'test@example.com'

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_validate_email_invalid_format(self):
        """Test email validation with invalid format"""
        with pytest.raises(ValueError, match="Invalid email format"):
            await self.execute_task(
                'ValidateEmail',
                inputs={'email': 'not-an-email'}
            )

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_validate_email_missing_domain(self):
        """Test email validation with missing domain"""
        with pytest.raises(ValueError):
            await self.execute_task(
                'ValidateEmail',
                inputs={'email': 'test@'}
            )

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_validate_password_strong(self):
        """Test password validation with strong password"""
        result = await self.execute_task(
            'ValidatePassword',
            inputs={'password': 'StrongP@ss123'}
        )

        assert result['valid'] is True
        assert result['strength_score'] == 100
        assert all(result['requirements_met'].values())

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_validate_password_weak_no_uppercase(self):
        """Test password validation fails without uppercase"""
        with pytest.raises(ValueError, match="has_uppercase"):
            await self.execute_task(
                'ValidatePassword',
                inputs={'password': 'weakpass123!'}
            )

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_validate_password_weak_too_short(self):
        """Test password validation fails if too short"""
        with pytest.raises(ValueError, match="min_length"):
            await self.execute_task(
                'ValidatePassword',
                inputs={'password': 'Sh0rt!'}
            )

    #
    # Database Tests
    #

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_check_email_exists_not_found(self, mock_db):
        """Test email check when email doesn't exist"""
        # Mock: No user found
        mock_db.add_query_result(
            "SELECT id FROM users WHERE email = $1",
            None
        )

        result = await self.execute_task(
            'CheckEmailExists',
            inputs={'email': 'new@example.com'},
            connections={'postgres': mock_db}
        )

        assert result['exists'] is False

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_check_email_exists_found(self, mock_db):
        """Test email check when email exists"""
        # Mock: User found
        mock_db.add_query_result(
            "SELECT id FROM users WHERE email = $1",
            {'id': 'existing-user-123'}
        )

        result = await self.execute_task(
            'CheckEmailExists',
            inputs={'email': 'existing@example.com'},
            connections={'postgres': mock_db}
        )

        assert result['exists'] is True

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_hash_password(self):
        """Test password hashing"""
        result = await self.execute_task(
            'HashPassword',
            inputs={'password': 'MyPassword123!'}
        )

        assert 'password_hash' in result
        assert len(result['password_hash']) > 0
        # Hash should be different from password
        assert result['password_hash'] != 'MyPassword123!'

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_create_user(self, mock_db):
        """Test user creation"""
        # Mock: User creation
        mock_db.add_query_result(
            "INSERT INTO users",
            {
                'id': 'user-123',
                'created_at': datetime.now()
            }
        )

        result = await self.execute_task(
            'CreateUser',
            inputs={
                'email': 'test@example.com',
                'password_hash': 'hashed_password',
                'full_name': 'Test User',
                'phone': '555-0100'
            },
            connections={'postgres': mock_db}
        )

        assert result['user_id'] == 'user-123'
        assert 'created_at' in result

    #
    # Integration Tests
    #

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_full_registration_success(self, mock_db):
        """Test complete registration flow end-to-end"""
        # Mock: Email doesn't exist
        mock_db.add_query_result(
            "SELECT id FROM users WHERE email = $1",
            None
        )

        # Mock: User creation
        mock_db.add_query_result(
            "INSERT INTO users",
            {'id': 'user-789', 'created_at': datetime.now()}
        )

        # Execute full flow
        result = await self.execute_flow(
            'UserRegistration',
            inputs={
                'email': 'newuser@example.com',
                'password': 'SecureP@ss123',
                'full_name': 'New User',
                'phone': '555-0200'
            },
            connections={'postgres': mock_db}
        )

        # Verify success
        assert result['success'] is True
        assert result['user_id'] == 'user-789'
        assert result['email'] == 'newuser@example.com'
        assert result['email_verified'] is False
        assert 'verification_token' in result
        assert 'Registration successful' in result['message']

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_registration_duplicate_email(self, mock_db):
        """Test registration fails with duplicate email"""
        # Mock: Email already exists
        mock_db.add_query_result(
            "SELECT id FROM users WHERE email = $1",
            {'id': 'existing-user'}
        )

        # Execute flow
        result = await self.execute_flow(
            'UserRegistration',
            inputs={
                'email': 'existing@example.com',
                'password': 'SecureP@ss123',
                'full_name': 'Duplicate User'
            },
            connections={'postgres': mock_db}
        )

        # Should exit early with error
        assert result['success'] is False
        assert result['error_code'] == 'DUPLICATE_EMAIL'
        assert 'already exists' in result['error']

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_registration_weak_password(self, mock_db):
        """Test registration fails with weak password"""
        # Mock: Email doesn't exist
        mock_db.add_query_result(
            "SELECT id FROM users WHERE email = $1",
            None
        )

        # Execute flow with weak password
        with pytest.raises(ValueError, match="does not meet requirements"):
            await self.execute_flow(
                'UserRegistration',
                inputs={
                    'email': 'test@example.com',
                    'password': 'weak',  # Too weak
                    'full_name': 'Test User'
                },
                connections={'postgres': mock_db}
            )
```

## Step 4: Testing Provider Application

### tests/test_provider_application.py

```python
import pytest
from flowlang.testing import FlowTestCase, MockConnection
from datetime import datetime

class TestProviderApplication(FlowTestCase):
    """Tests for provider application flow"""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_validate_services_success(self):
        """Test service validation with valid services"""
        result = await self.execute_task(
            'ValidateServices',
            inputs={'services': ['Cleaning', 'PLUMBING', '  electrical  ']}
        )

        assert result['valid'] is True
        assert set(result['normalized_services']) == {
            'cleaning', 'plumbing', 'electrical'
        }

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_validate_services_invalid(self):
        """Test service validation rejects invalid service"""
        with pytest.raises(ValueError, match="Invalid service category"):
            await self.execute_task(
                'ValidateServices',
                inputs={'services': ['cleaning', 'invalid_service']}
            )

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_validate_services_too_many(self):
        """Test service validation rejects too many services"""
        with pytest.raises(ValueError, match="Maximum 5 services"):
            await self.execute_task(
                'ValidateServices',
                inputs={
                    'services': [
                        'cleaning', 'plumbing', 'electrical',
                        'carpentry', 'painting', 'landscaping'  # 6 services
                    ]
                }
            )

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_validate_hourly_rate(self):
        """Test hourly rate validation"""
        # Valid rate
        result = await self.execute_task(
            'ValidateHourlyRate',
            inputs={'hourly_rate': 45.00}
        )
        assert result['valid'] is True
        assert result['rate_tier'] == 'standard'

        # Budget tier
        result = await self.execute_task(
            'ValidateHourlyRate',
            inputs={'hourly_rate': 20.00}
        )
        assert result['rate_tier'] == 'budget'

        # Premium tier
        result = await self.execute_task(
            'ValidateHourlyRate',
            inputs={'hourly_rate': 100.00}
        )
        assert result['rate_tier'] == 'premium'

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_validate_hourly_rate_too_low(self):
        """Test rate validation rejects too low rate"""
        with pytest.raises(ValueError, match="at least"):
            await self.execute_task(
                'ValidateHourlyRate',
                inputs={'hourly_rate': 10.00}
            )

    @pytest.mark.unit
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
                    'certifications': False
                }
            }
        )

        assert 'completeness_score' in result
        assert result['completeness_score'] > 0
        assert result['application_strength'] in [
            'weak', 'good', 'strong', 'excellent'
        ]

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_full_application_flow(self, mock_db, sample_user):
        """Test complete provider application submission"""
        # Mock: User exists
        mock_db.add_query_result(
            "SELECT email, full_name FROM users WHERE id = $1",
            {
                'email': sample_user['email'],
                'full_name': sample_user['full_name']
            }
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
                'user_id': sample_user['id'],
                'services': ['cleaning', 'plumbing'],
                'hourly_rate': 45.00,
                'service_area': {
                    'city': 'San Francisco',
                    'state': 'CA',
                    'radius_miles': 25
                },
                'bio': 'Experienced provider with 5 years in the industry.',
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
        assert result['completeness_score'] > 0
```

## Step 5: Testing Subflows

### tests/test_provider_approval.py

```python
import pytest
from flowlang.testing import FlowTestCase, MockConnection
from datetime import datetime

class TestProviderApproval(FlowTestCase):
    """Tests for provider approval workflow"""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_approval_subflow_approve(self, mock_db, admin_user):
        """Test generic approval subflow with approve decision"""
        # Mock: Reviewer validation
        mock_db.add_query_result(
            "SELECT full_name, is_admin FROM users WHERE id = $1",
            {
                'full_name': admin_user['full_name'],
                'is_admin': True
            }
        )

        # Mock: Review recording
        mock_db.add_query_result(
            "INSERT INTO reviews",
            {
                'id': 'review-123',
                'created_at': datetime.now()
            }
        )

        result = await self.execute_flow(
            'subflows/approval/GenericApproval',
            inputs={
                'entity_type': 'provider_application',
                'entity_id': 'app-123',
                'reviewer_id': admin_user['id'],
                'decision': 'approve',
                'notes': 'Application looks good'
            },
            connections={'postgres': mock_db}
        )

        assert result['success'] is True
        assert result['decision'] == 'approve'
        assert result['review_id'] == 'review-123'
        assert result['reviewer_name'] == admin_user['full_name']

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_full_approval_flow(
        self,
        mock_db,
        sample_provider_application,
        sample_user,
        admin_user
    ):
        """Test complete provider approval workflow"""
        # Mock: Load application
        mock_db.add_query_result(
            "SELECT pa.*, u.email, u.full_name FROM provider_applications pa",
            {
                **sample_provider_application,
                'user_email': sample_user['email'],
                'user_name': sample_user['full_name']
            }
        )

        # Mock: Reviewer validation (subflow)
        mock_db.add_query_result(
            "SELECT full_name, is_admin FROM users WHERE id = $1",
            {
                'full_name': admin_user['full_name'],
                'is_admin': True
            }
        )

        # Mock: Review recording (subflow)
        mock_db.add_query_result(
            "INSERT INTO reviews",
            {'id': 'review-456', 'created_at': datetime.now()}
        )

        # Mock: Provider creation
        mock_db.add_query_result(
            "INSERT INTO providers",
            {'id': 'provider-789'}
        )

        # Execute approval flow
        result = await self.execute_flow(
            'ReviewProviderApplication',
            inputs={
                'application_id': sample_provider_application['id'],
                'reviewer_id': admin_user['id'],
                'decision': 'approve'
            },
            connections={'postgres': mock_db}
        )

        assert result['success'] is True
        assert result['decision'] == 'approve'
        assert result['provider_id'] == 'provider-789'

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_rejection_flow(
        self,
        mock_db,
        sample_provider_application,
        sample_user,
        admin_user
    ):
        """Test provider rejection workflow"""
        # Similar mocks...
        # Mock application load, reviewer validation, review recording

        # Execute rejection
        result = await self.execute_flow(
            'ReviewProviderApplication',
            inputs={
                'application_id': sample_provider_application['id'],
                'reviewer_id': admin_user['id'],
                'decision': 'reject',
                'rejection_reason': 'Insufficient documentation'
            },
            connections={'postgres': mock_db}
        )

        assert result['success'] is True
        assert result['decision'] == 'reject'
        assert result['provider_id'] is None  # No provider created
```

## Step 6: Running Tests

### Run All Tests

```bash
pytest tests/ -v
```

### Run Specific Test File

```bash
pytest tests/test_user_registration.py -v
```

### Run Specific Test

```bash
pytest tests/test_user_registration.py::TestUserRegistration::test_validate_email_success -v
```

### Run by Marker

```bash
# Run only unit tests (fast)
pytest tests/ -m unit -v

# Run only integration tests
pytest tests/ -m integration -v

# Run all except slow tests
pytest tests/ -m "not slow" -v
```

### With Coverage

```bash
pytest tests/ --cov=flow --cov-report=html --cov-report=term
```

This generates:
- Terminal coverage summary
- HTML report in `htmlcov/index.html`

## Best Practices

### ✅ Do: Test Happy Path and Error Cases

```python
# Happy path
async def test_success():
    result = await self.execute_task(...)
    assert result['success'] is True

# Error cases
async def test_invalid_input():
    with pytest.raises(ValueError):
        await self.execute_task(...)
```

### ✅ Do: Use Descriptive Test Names

```python
# Good
async def test_registration_fails_with_duplicate_email():
    ...

# Bad
async def test_registration():
    ...
```

### ✅ Do: One Assert Per Concept

```python
# Good
assert result['success'] is True
assert result['user_id'] is not None
assert result['email'] == 'test@example.com'

# Avoid
assert result['success'] and result['user_id'] and result['email']
```

### ✅ Do: Use Fixtures for Common Data

```python
@pytest.fixture
def sample_user():
    return {'id': 'user-123', ...}

async def test_with_user(sample_user):
    # Use sample_user
    ...
```

### ❌ Don't: Test Implementation Details

Test behavior, not implementation.

### ❌ Don't: Use Real Database in Unit Tests

Always mock for unit tests. Use real database only for integration tests.

## Summary

In this lesson, you learned:

✅ FlowLang testing framework (`FlowTestCase`)
✅ Unit testing individual tasks
✅ Integration testing complete flows
✅ Mocking database connections
✅ Using fixtures for test data
✅ Organizing and running test suites
✅ Test markers and coverage

**Next**: [Project: Complete Foundation System](./project/)

In the project section, you'll find working code for all flows covered in this course.

---

## Quick Reference

### Test Structure

```python
import pytest
from flowlang.testing import FlowTestCase, MockConnection

class TestMyFlow(FlowTestCase):

    @pytest.mark.asyncio
    async def test_something(self, mock_db):
        # Arrange
        mock_db.add_query_result("SELECT ...", {...})

        # Act
        result = await self.execute_flow(
            'FlowName',
            inputs={...},
            connections={'postgres': mock_db}
        )

        # Assert
        assert result['success'] is True
```

### Mocking Database

```python
mock_db = MockConnection()

# Mock query result
mock_db.add_query_result(
    "SELECT * FROM users WHERE id = $1",
    {'id': 'user-123', 'name': 'Test'}
)

# Mock no result
mock_db.add_query_result(
    "SELECT * FROM users WHERE email = $1",
    None
)

# Use in test
result = await self.execute_task(
    'TaskName',
    inputs={...},
    connections={'postgres': mock_db}
)
```

### Running Tests

```bash
# All tests
pytest

# Specific file
pytest tests/test_user_registration.py

# Specific test
pytest tests/test_user_registration.py::TestUserRegistration::test_validate_email

# With markers
pytest -m unit
pytest -m integration
pytest -m "not slow"

# With coverage
pytest --cov=flow --cov-report=html
```
