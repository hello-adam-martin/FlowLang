# Course 1 Project: Complete Foundation System

This directory contains the complete, working code for the LocalServe Foundation system covered in Course 1.

## What's Included

This project implements a complete user and provider management system with:

✅ User registration with email verification
✅ Provider application workflow
✅ Admin approval system with reusable subflows
✅ Profile management (CRUD operations)
✅ Provider search with filters and pagination
✅ Comprehensive test suite
✅ Production-ready code

## Quick Start

### 1. Set Up Database

```bash
# Using Docker (recommended)
docker run --name localserve-db \
  -e POSTGRES_PASSWORD=localserve_dev \
  -e POSTGRES_DB=localserve \
  -p 5432:5432 \
  -d postgres:15

# Or use local PostgreSQL
createdb localserve
```

### 2. Create Database Schema

```bash
psql -h localhost -U postgres -d localserve -f schema.sql
```

### 3. Set Environment Variables

Create `.env` file:
```bash
DATABASE_URL=postgresql://postgres:localserve_dev@localhost:5432/localserve
SECRET_KEY=your-secret-key-change-in-production
BASE_URL=http://localhost:3000
```

### 4. Install Dependencies

```bash
pip install flowlang pytest pytest-asyncio pytest-cov
```

### 5. Run Tests

```bash
# All tests
pytest tests/ -v

# With coverage
pytest tests/ --cov=. --cov-report=html

# Only unit tests (fast)
pytest tests/ -m unit -v
```

### 6. Start the Server

```bash
python -m flowlang.server --project . --port 8000 --reload
```

Access:
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

## Project Structure

```
project/
├── README.md                   # This file
├── project.yaml                # Project configuration
├── schema.sql                  # Database schema
├── .env.example                # Environment variables template
│
├── flows/                      # Main flows
│   ├── user_registration/
│   │   ├── flow.yaml          # User registration flow
│   │   └── flow.py            # Task implementations
│   │
│   ├── provider_application/
│   │   ├── flow.yaml          # Provider application flow
│   │   └── flow.py            # Task implementations
│   │
│   ├── provider_approval/
│   │   ├── flow.yaml          # Approval workflow
│   │   └── flow.py            # Task implementations
│   │
│   └── profile_management/
│       ├── flow.yaml          # Profile CRUD operations
│       └── flow.py            # Task implementations
│
├── subflows/                   # Reusable subflows
│   └── approval/
│       ├── flow.yaml          # Generic approval subflow
│       └── flow.py            # Approval tasks
│
└── tests/                      # Test suite
    ├── conftest.py            # Shared fixtures
    ├── test_user_registration.py
    ├── test_provider_application.py
    ├── test_provider_approval.py
    └── test_profile_management.py
```

## Available Flows

### 1. UserRegistration

Register a new user account.

**Endpoint**: `POST /flows/UserRegistration/execute`

**Example**:
```bash
curl -X POST http://localhost:8000/flows/UserRegistration/execute \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "email": "alice@example.com",
      "password": "SecureP@ss123",
      "full_name": "Alice Smith",
      "phone": "555-0100"
    }
  }'
```

**Response**:
```json
{
  "success": true,
  "outputs": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "alice@example.com",
    "email_verified": false,
    "verification_token": "eyJ...",
    "message": "Registration successful! Please check your email..."
  }
}
```

### 2. ProviderApplication

Submit application to become a provider.

**Endpoint**: `POST /flows/ProviderApplication/execute`

**Example**:
```bash
curl -X POST http://localhost:8000/flows/ProviderApplication/execute \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "services": ["cleaning", "plumbing"],
      "hourly_rate": 45.00,
      "service_area": {
        "city": "San Francisco",
        "state": "CA",
        "radius_miles": 25
      },
      "bio": "Experienced professional with 5 years in the industry.",
      "years_experience": 5,
      "certifications": [],
      "document_urls": {
        "id_document": "https://s3.aws.com/docs/id.pdf"
      }
    }
  }'
```

### 3. ReviewProviderApplication

Admin reviews and approves/rejects application.

**Endpoint**: `POST /flows/ReviewProviderApplication/execute`

**Example (Approve)**:
```bash
curl -X POST http://localhost:8000/flows/ReviewProviderApplication/execute \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "application_id": "app-123",
      "reviewer_id": "admin-456",
      "decision": "approve",
      "admin_notes": "Application looks good"
    }
  }'
```

**Example (Reject)**:
```bash
curl -X POST http://localhost:8000/flows/ReviewProviderApplication/execute \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "application_id": "app-123",
      "reviewer_id": "admin-456",
      "decision": "reject",
      "rejection_reason": "Insufficient documentation",
      "admin_notes": "Missing insurance certificate"
    }
  }'
```

### 4. GetProfile

Retrieve user profile (optionally with provider info).

**Endpoint**: `POST /flows/GetProfile/execute`

**Example**:
```bash
curl -X POST http://localhost:8000/flows/GetProfile/execute \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "include_provider_info": true
    }
  }'
```

### 5. UpdateUserProfile

Update user profile fields.

**Endpoint**: `POST /flows/UpdateUserProfile/execute`

**Example**:
```bash
curl -X POST http://localhost:8000/flows/UpdateUserProfile/execute \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "full_name": "Alice M. Smith",
      "phone": "555-0199"
    }
  }'
```

### 6. SearchProviders

Search for providers with filters.

**Endpoint**: `POST /flows/SearchProviders/execute`

**Example**:
```bash
curl -X POST http://localhost:8000/flows/SearchProviders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "services": ["cleaning"],
      "city": "San Francisco",
      "state": "CA",
      "min_rating": 4.0,
      "max_hourly_rate": 60.00,
      "page": 1,
      "page_size": 20
    }
  }'
```

**Response**:
```json
{
  "success": true,
  "outputs": {
    "providers": [
      {
        "id": "provider-789",
        "name": "Alice Smith",
        "business_name": "Alice's Cleaning",
        "services": ["cleaning", "plumbing"],
        "hourly_rate": 45.00,
        "rating": 4.8,
        "total_jobs": 42
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total_count": 15,
      "total_pages": 1
    }
  }
}
```

## Database Schema

The project uses the following database tables:

### users
Core user accounts (both customers and providers).

### providers
Provider profiles (only for approved providers).

### provider_applications
Pending provider applications awaiting review.

### reviews
Audit log for all approval decisions.

See `schema.sql` for complete schema definition.

## Testing

### Run All Tests
```bash
pytest tests/ -v
```

### Test Coverage
```bash
pytest tests/ --cov=. --cov-report=html
open htmlcov/index.html
```

### Test Markers
```bash
# Unit tests only (fast, no database)
pytest tests/ -m unit -v

# Integration tests only (with mocked database)
pytest tests/ -m integration -v
```

## Development Workflow

### 1. Make Changes

Edit `flow.yaml` or `flow.py` files.

### 2. Run Tests

```bash
pytest tests/ -v
```

### 3. Start Server with Hot Reload

```bash
python -m flowlang.server --project . --port 8000 --reload
```

Server automatically reloads when you save changes.

### 4. Test via API

```bash
curl -X POST http://localhost:8000/flows/FlowName/execute \
  -H "Content-Type: application/json" \
  -d '{"inputs": {...}}'
```

## Common Issues

### Database Connection Failed

**Error**: `connection refused` or `could not connect to server`

**Solution**: Verify PostgreSQL is running:
```bash
docker ps  # Check if container is running
# Or
pg_isready -h localhost
```

### Import Errors

**Error**: `ModuleNotFoundError: No module named 'flowlang'`

**Solution**: Install FlowLang:
```bash
pip install flowlang
```

### Test Failures

**Error**: Tests fail with database errors

**Solution**: Tests use mocked database, don't require real database. Check that mock setup is correct in `conftest.py`.

## Next Steps

After completing this course:

1. **Customize**: Modify flows for your use case
2. **Deploy**: Deploy to production (see deployment guide)
3. **Course 2**: Continue with Job Posting & Discovery
4. **Explore**: Check out other FlowLang examples

## Resources

- [FlowLang Documentation](https://docs.flowlang.com)
- [FlowLang Testing Guide](../../testing.md)
- [Database Integration Guide](../../database-integration.md)
- [Course 2: Job Posting & Discovery](../../02-job-posting/) (coming soon)

## Support

Having issues? Check:
1. Run `flowlang doctor` to check environment
2. Review error messages carefully
3. Check FlowLang documentation
4. Open an issue on GitHub

---

**Congratulations!** 🎉

You've completed Course 1 and built a complete user and provider management system. You now understand:

✅ FlowLang core concepts (flows, tasks, steps)
✅ Multi-step workflows with validation
✅ Database integration patterns
✅ Subflow composition for reusable logic
✅ CRUD operations
✅ Testing with FlowLang framework
✅ Production-ready patterns

Ready for **Course 2: Job Posting & Discovery**!
