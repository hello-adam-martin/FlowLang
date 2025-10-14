# Lesson 2: User Registration Flow

**Duration**: 60 minutes

## Learning Objectives

In this lesson, you'll learn:
- How to design a multi-step workflow
- Input validation patterns
- Database integration with FlowLang
- Conditional logic in flows
- Error handling and validation errors
- Email verification workflow

## The User Registration Workflow

### Business Requirements

When a user registers on LocalServe:
1. Validate email format and check for duplicates
2. Validate password strength
3. Hash the password securely
4. Create user record in database
5. Generate email verification token
6. Send verification email
7. Return success with user_id

### The Flow Design

Let's design this workflow in YAML first, following FlowLang's design-first approach.

## Step 1: Design the Flow (flow.yaml)

Create `user-registration-flow.yaml`:

```yaml
flow: UserRegistration
description: |
  Register a new user account with email verification.

  This flow validates input, checks for duplicate emails,
  securely hashes passwords, and sends a verification email.

inputs:
  - name: email
    type: string
    required: true
    description: User's email address

  - name: password
    type: string
    required: true
    description: User's password (will be hashed)

  - name: full_name
    type: string
    required: true
    description: User's full name

  - name: phone
    type: string
    required: false
    description: Optional phone number

steps:
  # Step 1: Validate email format
  - task: ValidateEmail
    id: validate_email
    inputs:
      email: ${inputs.email}
    outputs:
      - valid
      - normalized_email

  # Step 2: Check if email already exists
  - task: CheckEmailExists
    id: check_duplicate
    inputs:
      email: ${validate_email.normalized_email}
    outputs:
      - exists

  # Step 3: If email exists, exit with error
  - if: ${check_duplicate.exists} == true
    then:
      - exit:
          reason: "Email already registered"
          outputs:
            success: false
            error: "An account with this email already exists"
            error_code: "DUPLICATE_EMAIL"

  # Step 4: Validate password strength
  - task: ValidatePassword
    id: validate_password
    inputs:
      password: ${inputs.password}
    outputs:
      - valid
      - strength_score
      - requirements_met

  # Step 5: Hash the password
  - task: HashPassword
    id: hash_password
    inputs:
      password: ${inputs.password}
    outputs:
      - password_hash

  # Step 6: Create user record in database
  - task: CreateUser
    id: create_user
    inputs:
      email: ${validate_email.normalized_email}
      password_hash: ${hash_password.password_hash}
      full_name: ${inputs.full_name}
      phone: ${inputs.phone}
    outputs:
      - user_id
      - created_at

  # Step 7: Generate email verification token
  - task: GenerateVerificationToken
    id: generate_token
    inputs:
      user_id: ${create_user.user_id}
      email: ${validate_email.normalized_email}
    outputs:
      - verification_token
      - expires_at

  # Step 8: Send verification email
  - task: SendVerificationEmail
    id: send_email
    inputs:
      email: ${validate_email.normalized_email}
      full_name: ${inputs.full_name}
      verification_token: ${generate_token.verification_token}
    outputs:
      - email_sent
      - message_id

outputs:
  - name: success
    value: true

  - name: user_id
    value: ${create_user.user_id}

  - name: email
    value: ${validate_email.normalized_email}

  - name: email_verified
    value: false

  - name: verification_token
    value: ${generate_token.verification_token}

  - name: message
    value: "Registration successful! Please check your email to verify your account."
```

### Flow Analysis

Let's break down this flow:

**Inputs**: What data comes in
- `email`, `password`, `full_name` (required)
- `phone` (optional)

**Validation Steps** (1-2):
- Validate email format and normalize it (lowercase, trimmed)
- Check if email already exists in database

**Early Exit** (3):
- If duplicate email, exit immediately with error
- This is a control flow pattern - no need to continue

**Security Steps** (4-5):
- Validate password meets requirements (length, complexity)
- Hash password using bcrypt or similar

**Database Steps** (6-7):
- Create user record with hashed password
- Generate verification token (JWT or random token)

**Notification Step** (8):
- Send email with verification link

**Outputs**: What data comes out
- `user_id` for the new user
- `verification_token` (for testing, normally not returned)
- Success message

## Step 2: Understand Database Integration

FlowLang provides database helpers for common operations. Let's look at the database schema and how to use it.

### Database Schema

```sql
-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    token_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast email lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_verification_token ON users(verification_token);
```

### FlowLang Database Connection

In your project, configure the database connection in `project.yaml`:

```yaml
project: LocalServeFoundation
description: User and provider management system

connections:
  postgres:
    type: postgres
    host: ${DATABASE_HOST:localhost}
    port: ${DATABASE_PORT:5432}
    database: ${DATABASE_NAME:localserve}
    user: ${DATABASE_USER:postgres}
    password: ${DATABASE_PASSWORD}
```

## Step 3: Implement the Tasks (flow.py)

Now let's implement each task. FlowLang's scaffolder generates stubs, and we fill in the logic.

```python
from flowlang import TaskRegistry
import re
import bcrypt
import secrets
import jwt
from datetime import datetime, timedelta
from typing import Optional

def create_task_registry():
    """Create and configure the task registry with all task implementations"""
    registry = TaskRegistry()

    @registry.register('ValidateEmail', description='Validate email format and normalize')
    async def validate_email(email: str, context):
        """
        Validate email format and normalize it.

        Returns:
            valid: True if email format is valid
            normalized_email: Lowercase, trimmed email
        """
        # Trim whitespace
        email = email.strip()

        # Basic email regex validation
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

        if not re.match(email_pattern, email):
            raise ValueError(f"Invalid email format: {email}")

        # Normalize to lowercase
        normalized = email.lower()

        return {
            'valid': True,
            'normalized_email': normalized
        }

    @registry.register('CheckEmailExists', description='Check if email is already registered')
    async def check_email_exists(email: str, context):
        """
        Check if email already exists in database.

        Returns:
            exists: True if email is already registered
        """
        # Get database connection from context
        db = await context.get_connection('postgres')

        # Query for existing email
        query = "SELECT id FROM users WHERE email = $1"
        result = await db.fetchrow(query, email)

        return {
            'exists': result is not None
        }

    @registry.register('ValidatePassword', description='Validate password strength')
    async def validate_password(password: str, context):
        """
        Validate password meets security requirements.

        Requirements:
        - Minimum 8 characters
        - At least one uppercase letter
        - At least one lowercase letter
        - At least one digit
        - At least one special character

        Returns:
            valid: True if password meets requirements
            strength_score: 0-100 strength score
            requirements_met: Dict of requirements and whether met
        """
        requirements = {
            'min_length': len(password) >= 8,
            'has_uppercase': bool(re.search(r'[A-Z]', password)),
            'has_lowercase': bool(re.search(r'[a-z]', password)),
            'has_digit': bool(re.search(r'\d', password)),
            'has_special': bool(re.search(r'[!@#$%^&*(),.?":{}|<>]', password))
        }

        # Calculate strength score
        strength_score = sum(requirements.values()) * 20

        # Check if all requirements met
        valid = all(requirements.values())

        if not valid:
            unmet = [k for k, v in requirements.items() if not v]
            raise ValueError(
                f"Password does not meet requirements: {', '.join(unmet)}"
            )

        return {
            'valid': valid,
            'strength_score': strength_score,
            'requirements_met': requirements
        }

    @registry.register('HashPassword', description='Hash password using bcrypt')
    async def hash_password(password: str, context):
        """
        Hash password using bcrypt with salt.

        Returns:
            password_hash: Bcrypt hash of password
        """
        # Generate salt and hash password
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)

        return {
            'password_hash': hashed.decode('utf-8')
        }

    @registry.register('CreateUser', description='Create new user record in database')
    async def create_user(
        email: str,
        password_hash: str,
        full_name: str,
        phone: Optional[str],
        context
    ):
        """
        Create a new user record in the database.

        Returns:
            user_id: UUID of created user
            created_at: Timestamp of creation
        """
        db = await context.get_connection('postgres')

        # Insert new user
        query = """
            INSERT INTO users (email, password_hash, full_name, phone)
            VALUES ($1, $2, $3, $4)
            RETURNING id, created_at
        """

        result = await db.fetchrow(
            query,
            email,
            password_hash,
            full_name,
            phone
        )

        return {
            'user_id': str(result['id']),
            'created_at': result['created_at'].isoformat()
        }

    @registry.register('GenerateVerificationToken', description='Generate email verification token')
    async def generate_verification_token(user_id: str, email: str, context):
        """
        Generate a JWT token for email verification.

        Returns:
            verification_token: JWT token
            expires_at: Token expiration timestamp
        """
        # Token expires in 24 hours
        expires_at = datetime.utcnow() + timedelta(hours=24)

        # Create JWT payload
        payload = {
            'user_id': user_id,
            'email': email,
            'exp': expires_at,
            'type': 'email_verification'
        }

        # Get secret key from environment
        secret_key = context.config.get('SECRET_KEY', 'dev-secret-key')

        # Generate JWT token
        token = jwt.encode(payload, secret_key, algorithm='HS256')

        # Store token in database for verification
        db = await context.get_connection('postgres')
        await db.execute(
            """
            UPDATE users
            SET verification_token = $1, token_expires_at = $2
            WHERE id = $3
            """,
            token,
            expires_at,
            user_id
        )

        return {
            'verification_token': token,
            'expires_at': expires_at.isoformat()
        }

    @registry.register('SendVerificationEmail', description='Send verification email to user')
    async def send_verification_email(
        email: str,
        full_name: str,
        verification_token: str,
        context
    ):
        """
        Send email with verification link.

        In production, this would use SendGrid, AWS SES, etc.
        For now, we'll just log it.

        Returns:
            email_sent: True if email sent successfully
            message_id: Email message ID
        """
        # Build verification URL
        base_url = context.config.get('BASE_URL', 'http://localhost:3000')
        verification_url = f"{base_url}/verify-email?token={verification_token}"

        # Email content
        subject = "Verify your LocalServe email"
        body = f"""
        Hello {full_name},

        Thank you for registering with LocalServe!

        Please verify your email address by clicking the link below:
        {verification_url}

        This link will expire in 24 hours.

        If you did not create an account, please ignore this email.

        Best regards,
        The LocalServe Team
        """

        # TODO: In production, use email service
        # For now, log to console
        print(f"📧 Sending verification email to {email}")
        print(f"Subject: {subject}")
        print(f"Link: {verification_url}")

        # Simulate sending
        message_id = f"msg_{secrets.token_hex(8)}"

        return {
            'email_sent': True,
            'message_id': message_id
        }

    return registry
```

## Step 4: Understanding Context and Connections

### What is Context?

The `context` object provides access to:
- **Flow inputs**: `context.inputs['email']`
- **Step outputs**: `context.get_step_output('step_id', 'field')`
- **Connections**: `context.get_connection('postgres')`
- **Configuration**: `context.config.get('SECRET_KEY')`

### Database Connection

```python
# Get connection
db = await context.get_connection('postgres')

# Execute query (no return)
await db.execute("DELETE FROM users WHERE id = $1", user_id)

# Fetch single row
row = await db.fetchrow("SELECT * FROM users WHERE email = $1", email)
if row:
    user_id = row['id']

# Fetch multiple rows
rows = await db.fetch("SELECT * FROM users WHERE email_verified = $1", True)
for row in rows:
    print(row['email'])
```

### Configuration

Configuration comes from:
1. Environment variables (`.env` file)
2. `project.yaml` settings
3. Runtime config

```python
# Get config value with default
secret = context.config.get('SECRET_KEY', 'default-value')
base_url = context.config.get('BASE_URL', 'http://localhost:3000')
```

## Step 5: Testing the Flow

### Unit Testing Individual Tasks

Create `tests/test_user_registration.py`:

```python
import pytest
from flowlang.testing import FlowTestCase, MockConnection

class TestUserRegistration(FlowTestCase):
    """Test suite for user registration flow"""

    @pytest.mark.asyncio
    async def test_validate_email_success(self):
        """Test email validation with valid email"""
        result = await self.execute_task(
            'ValidateEmail',
            inputs={'email': '  Alice@Example.COM  '}
        )

        assert result['valid'] is True
        assert result['normalized_email'] == 'alice@example.com'

    @pytest.mark.asyncio
    async def test_validate_email_invalid(self):
        """Test email validation with invalid email"""
        with pytest.raises(ValueError, match="Invalid email format"):
            await self.execute_task(
                'ValidateEmail',
                inputs={'email': 'not-an-email'}
            )

    @pytest.mark.asyncio
    async def test_check_email_exists_not_found(self):
        """Test checking for email that doesn't exist"""
        # Mock database to return no results
        mock_db = MockConnection()
        mock_db.add_query_result(
            "SELECT id FROM users WHERE email = $1",
            None  # No result found
        )

        result = await self.execute_task(
            'CheckEmailExists',
            inputs={'email': 'new@example.com'},
            connections={'postgres': mock_db}
        )

        assert result['exists'] is False

    @pytest.mark.asyncio
    async def test_check_email_exists_found(self):
        """Test checking for email that already exists"""
        mock_db = MockConnection()
        mock_db.add_query_result(
            "SELECT id FROM users WHERE email = $1",
            {'id': 'user-123'}  # User found
        )

        result = await self.execute_task(
            'CheckEmailExists',
            inputs={'email': 'existing@example.com'},
            connections={'postgres': mock_db}
        )

        assert result['exists'] is True

    @pytest.mark.asyncio
    async def test_validate_password_strong(self):
        """Test password validation with strong password"""
        result = await self.execute_task(
            'ValidatePassword',
            inputs={'password': 'StrongPass123!'}
        )

        assert result['valid'] is True
        assert result['strength_score'] == 100

    @pytest.mark.asyncio
    async def test_validate_password_weak(self):
        """Test password validation with weak password"""
        with pytest.raises(ValueError, match="does not meet requirements"):
            await self.execute_task(
                'ValidatePassword',
                inputs={'password': 'weak'}
            )
```

### Integration Testing the Full Flow

```python
@pytest.mark.asyncio
async def test_user_registration_success(self):
    """Test complete registration flow with valid inputs"""
    # Mock database
    mock_db = MockConnection()

    # Mock: Email doesn't exist
    mock_db.add_query_result(
        "SELECT id FROM users WHERE email = $1",
        None
    )

    # Mock: User creation
    mock_db.add_query_result(
        "INSERT INTO users",
        {'id': 'user-123', 'created_at': '2024-01-01T00:00:00'}
    )

    # Execute full flow
    result = await self.execute_flow(
        'UserRegistration',
        inputs={
            'email': 'alice@example.com',
            'password': 'StrongPass123!',
            'full_name': 'Alice Smith',
            'phone': '555-0100'
        },
        connections={'postgres': mock_db}
    )

    # Verify outputs
    assert result['success'] is True
    assert result['user_id'] == 'user-123'
    assert result['email'] == 'alice@example.com'
    assert 'verification_token' in result

@pytest.mark.asyncio
async def test_user_registration_duplicate_email(self):
    """Test registration with duplicate email"""
    mock_db = MockConnection()

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
            'password': 'StrongPass123!',
            'full_name': 'Bob Jones'
        },
        connections={'postgres': mock_db}
    )

    # Should exit early with error
    assert result['success'] is False
    assert result['error_code'] == 'DUPLICATE_EMAIL'
```

### Running Tests

```bash
# Run all tests
pytest tests/test_user_registration.py -v

# Run specific test
pytest tests/test_user_registration.py::TestUserRegistration::test_validate_email_success -v

# Run with coverage
pytest tests/test_user_registration.py --cov=flow --cov-report=html
```

## Step 6: Running the Flow via API

### Start the Server

```bash
python -m flowlang.server --project . --port 8000 --reload
```

### Test via HTTP

```bash
# Successful registration
curl -X POST http://localhost:8000/flows/UserRegistration/execute \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "email": "alice@example.com",
      "password": "StrongPass123!",
      "full_name": "Alice Smith",
      "phone": "555-0100"
    }
  }'

# Expected response:
{
  "success": true,
  "outputs": {
    "success": true,
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "alice@example.com",
    "email_verified": false,
    "message": "Registration successful! Please check your email..."
  }
}

# Duplicate email (should fail)
curl -X POST http://localhost:8000/flows/UserRegistration/execute \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "email": "alice@example.com",
      "password": "AnotherPass456!",
      "full_name": "Alice Duplicate"
    }
  }'

# Expected response:
{
  "success": false,
  "outputs": {
    "success": false,
    "error": "An account with this email already exists",
    "error_code": "DUPLICATE_EMAIL"
  },
  "termination_reason": "Email already registered"
}
```

## Key Concepts Learned

### 1. Multi-Step Workflows
Each step builds on previous steps using `${step_id.output}` syntax.

### 2. Early Exit Pattern
```yaml
- if: ${check_duplicate.exists} == true
  then:
    - exit:
        reason: "Error message"
        outputs: {...}
```
Use `exit` to terminate flow early when needed.

### 3. Database Integration
```python
db = await context.get_connection('postgres')
result = await db.fetchrow(query, param1, param2)
```
FlowLang handles connection pooling and cleanup.

### 4. Error Handling
- **Validation errors**: Raise `ValueError` with clear message
- **Database errors**: Let them propagate, FlowLang handles them
- **Business logic errors**: Use early exit pattern

### 5. Security Best Practices
- Always normalize email (lowercase)
- Validate password strength
- Hash passwords with bcrypt (never store plaintext)
- Use JWT tokens for verification
- Set token expiration

## Common Pitfalls

### ❌ Don't: Return sensitive data
```python
return {
    'password': password,  # NEVER!
    'password_hash': hashed  # Also don't return this
}
```

### ✅ Do: Return only what's needed
```python
return {
    'user_id': user_id,
    'created': True
}
```

### ❌ Don't: Hardcode configuration
```python
secret_key = "my-secret-key"  # Bad!
```

### ✅ Do: Use context config
```python
secret_key = context.config.get('SECRET_KEY')
```

### ❌ Don't: Validate in one big function
```python
def validate_all(email, password, name):
    # 100 lines of validation
    pass
```

### ✅ Do: One task per validation
```yaml
- task: ValidateEmail
- task: ValidatePassword
- task: ValidateName
```

## Exercises

### Exercise 1: Add Email Verification Flow
Create a new flow `EmailVerification` that:
1. Takes `user_id` and `verification_token` as inputs
2. Validates the token hasn't expired
3. Marks user's email as verified
4. Returns success

### Exercise 2: Add Name Validation
Create a `ValidateName` task that:
- Checks name is at least 2 characters
- Checks name doesn't contain numbers
- Trims whitespace

Add it to the registration flow.

### Exercise 3: Password Reset Flow
Design a `PasswordReset` flow that:
1. Takes email as input
2. Checks if user exists
3. Generates reset token
4. Sends reset email

Don't implement yet - just design the YAML.

## Summary

In this lesson, you learned:

✅ How to design multi-step workflows in YAML
✅ Input validation patterns (email, password)
✅ Database integration with FlowLang
✅ Early exit pattern for error handling
✅ Security best practices (hashing, tokens)
✅ Testing with mocks
✅ Running flows via REST API

**Next**: [Lesson 3: Provider Application Flow](./lesson-03-provider-application.md)

In the next lesson, we'll build the provider application system, including file uploads and multi-step applications.

---

## Quick Reference

### Database Queries
```python
# Fetch one
row = await db.fetchrow("SELECT * FROM users WHERE id = $1", user_id)

# Fetch many
rows = await db.fetch("SELECT * FROM users WHERE active = $1", True)

# Execute (no return)
await db.execute("UPDATE users SET email_verified = TRUE WHERE id = $1", user_id)

# Transaction
async with db.transaction():
    await db.execute(...)
    await db.execute(...)
```

### Early Exit
```yaml
- if: ${condition} == true
  then:
    - exit:
        reason: "Why we're exiting"
        outputs:
          success: false
          error: "Error message"
```

### Password Hashing
```python
import bcrypt

# Hash
hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

# Verify
valid = bcrypt.checkpw(password.encode('utf-8'), stored_hash)
```
