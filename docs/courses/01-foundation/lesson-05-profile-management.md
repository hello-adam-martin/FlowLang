# Lesson 5: Profile Management

**Duration**: 45 minutes

## Learning Objectives

In this lesson, you'll learn:
- CRUD operation patterns in FlowLang
- Search and filtering flows
- Pagination for large result sets
- Partial updates (PATCH operations)
- Data transformation for API responses

## Profile Management Workflows

### Business Requirements

Users and providers need to:
1. **View** their profile
2. **Update** profile information
3. **Search** for providers by service/location
4. **List** providers with pagination and filters

## Step 1: Get Profile Flow

### flow.yaml - GetProfile

```yaml
flow: GetProfile
description: Retrieve user or provider profile by ID

inputs:
  - name: user_id
    type: string
    required: true
    description: ID of user to retrieve

  - name: include_provider_info
    type: boolean
    required: false
    description: Include provider profile if user is a provider

steps:
  # Step 1: Load user profile
  - task: LoadUserProfile
    id: load_user
    inputs:
      user_id: ${inputs.user_id}
    outputs:
      - user
      - exists

  # Step 2: Check user exists
  - if: ${load_user.exists} == false
    then:
      - exit:
          reason: "User not found"
          outputs:
            success: false
            error: "User not found"
            error_code: "USER_NOT_FOUND"

  # Step 3: If requested, load provider profile
  - if: ${inputs.include_provider_info} == true
    then:
      - task: LoadProviderProfile
        id: load_provider
        inputs:
          user_id: ${inputs.user_id}
        outputs:
          - provider
          - is_provider

outputs:
  - name: success
    value: true

  - name: user
    value: ${load_user.user}

  - name: provider
    value: ${load_provider.provider}

  - name: is_provider
    value: ${load_provider.is_provider}
```

### Tasks Implementation

```python
from flowlang import TaskRegistry
import json
from typing import Optional

def create_task_registry():
    registry = TaskRegistry()

    @registry.register('LoadUserProfile', description='Load user profile')
    async def load_user_profile(user_id: str, context):
        """
        Load user profile from database.

        Returns:
            user: User profile object
            exists: True if user found
        """
        db = await context.get_connection('postgres')

        query = """
            SELECT
                id, email, full_name, phone,
                email_verified, created_at
            FROM users
            WHERE id = $1
        """

        user_row = await db.fetchrow(query, user_id)

        if not user_row:
            return {
                'user': None,
                'exists': False
            }

        # Transform to dict (exclude sensitive fields like password_hash)
        user = {
            'id': str(user_row['id']),
            'email': user_row['email'],
            'full_name': user_row['full_name'],
            'phone': user_row['phone'],
            'email_verified': user_row['email_verified'],
            'created_at': user_row['created_at'].isoformat()
        }

        return {
            'user': user,
            'exists': True
        }

    @registry.register('LoadProviderProfile', description='Load provider profile if exists')
    async def load_provider_profile(user_id: str, context):
        """
        Load provider profile if user is a provider.

        Returns:
            provider: Provider profile object (or None)
            is_provider: True if user is a provider
        """
        db = await context.get_connection('postgres')

        query = """
            SELECT
                id, user_id, business_name, bio,
                services, hourly_rate, service_area,
                rating, total_jobs, status, created_at
            FROM providers
            WHERE user_id = $1
        """

        provider_row = await db.fetchrow(query, user_id)

        if not provider_row:
            return {
                'provider': None,
                'is_provider': False
            }

        # Parse JSONB fields
        provider = {
            'id': str(provider_row['id']),
            'user_id': str(provider_row['user_id']),
            'business_name': provider_row['business_name'],
            'bio': provider_row['bio'],
            'services': json.loads(provider_row['services']),
            'hourly_rate': float(provider_row['hourly_rate']),
            'service_area': json.loads(provider_row['service_area']),
            'rating': float(provider_row['rating']),
            'total_jobs': provider_row['total_jobs'],
            'status': provider_row['status'],
            'created_at': provider_row['created_at'].isoformat()
        }

        return {
            'provider': provider,
            'is_provider': True
        }

    return registry
```

## Step 2: Update Profile Flow

### flow.yaml - UpdateProfile

```yaml
flow: UpdateUserProfile
description: Update user profile information

inputs:
  - name: user_id
    type: string
    required: true

  - name: full_name
    type: string
    required: false

  - name: phone
    type: string
    required: false

  # Note: Email updates should go through separate verification flow

steps:
  # Step 1: Validate user exists
  - task: ValidateUserExists
    id: validate
    inputs:
      user_id: ${inputs.user_id}
    outputs:
      - exists

  # Step 2: Build update fields (only non-null inputs)
  - task: BuildUpdateFields
    id: build_update
    inputs:
      full_name: ${inputs.full_name}
      phone: ${inputs.phone}
    outputs:
      - update_fields
      - has_updates

  # Step 3: Check if there are any updates
  - if: ${build_update.has_updates} == false
    then:
      - exit:
          reason: "No updates provided"
          outputs:
            success: false
            error: "No update fields provided"

  # Step 4: Apply updates
  - task: UpdateUser
    id: update
    inputs:
      user_id: ${inputs.user_id}
      update_fields: ${build_update.update_fields}
    outputs:
      - updated

  # Step 5: Load updated profile
  - task: LoadUserProfile
    id: load_updated
    inputs:
      user_id: ${inputs.user_id}
    outputs:
      - user

outputs:
  - name: success
    value: true

  - name: user
    value: ${load_updated.user}

  - name: message
    value: "Profile updated successfully"
```

### Tasks for Update

```python
@registry.register('ValidateUserExists', description='Check if user exists')
async def validate_user_exists(user_id: str, context):
    """
    Validate user exists before updating.

    Returns:
        exists: True if user found
    """
    db = await context.get_connection('postgres')

    result = await db.fetchrow(
        "SELECT id FROM users WHERE id = $1",
        user_id
    )

    if not result:
        raise ValueError(f"User not found: {user_id}")

    return {'exists': True}

@registry.register('BuildUpdateFields', description='Build SQL update fields')
async def build_update_fields(full_name: Optional[str], phone: Optional[str], context):
    """
    Build dict of fields to update (only non-None values).

    This implements PATCH semantics - only update provided fields.

    Returns:
        update_fields: Dict of field -> value
        has_updates: True if any fields to update
    """
    update_fields = {}

    if full_name is not None:
        # Validate name
        if len(full_name.strip()) < 2:
            raise ValueError("Name must be at least 2 characters")
        update_fields['full_name'] = full_name.strip()

    if phone is not None:
        # Validate phone (basic)
        phone_clean = phone.strip()
        if phone_clean and len(phone_clean) < 10:
            raise ValueError("Invalid phone number")
        update_fields['phone'] = phone_clean

    return {
        'update_fields': update_fields,
        'has_updates': len(update_fields) > 0
    }

@registry.register('UpdateUser', description='Update user record')
async def update_user(user_id: str, update_fields: dict, context):
    """
    Update user record with provided fields.

    Returns:
        updated: True if updated
    """
    db = await context.get_connection('postgres')

    # Build dynamic UPDATE query
    set_clauses = [f"{field} = ${i+2}" for i, field in enumerate(update_fields.keys())]
    set_clause = ", ".join(set_clauses)

    query = f"""
        UPDATE users
        SET {set_clause}, updated_at = NOW()
        WHERE id = $1
    """

    # Build params: [user_id, value1, value2, ...]
    params = [user_id] + list(update_fields.values())

    await db.execute(query, *params)

    return {'updated': True}
```

## Step 3: Search Providers Flow

### flow.yaml - SearchProviders

```yaml
flow: SearchProviders
description: Search for providers by service, location, and other criteria

inputs:
  - name: services
    type: array
    required: false
    description: Filter by service categories

  - name: city
    type: string
    required: false
    description: Filter by city

  - name: state
    type: string
    required: false
    description: Filter by state

  - name: min_rating
    type: number
    required: false
    description: Minimum rating (0-5)

  - name: max_hourly_rate
    type: number
    required: false
    description: Maximum hourly rate

  - name: page
    type: number
    required: false
    description: Page number (default 1)

  - name: page_size
    type: number
    required: false
    description: Results per page (default 20, max 100)

steps:
  # Step 1: Validate and normalize search params
  - task: ValidateSearchParams
    id: validate
    inputs:
      services: ${inputs.services}
      city: ${inputs.city}
      state: ${inputs.state}
      min_rating: ${inputs.min_rating}
      max_hourly_rate: ${inputs.max_hourly_rate}
      page: ${inputs.page}
      page_size: ${inputs.page_size}
    outputs:
      - normalized_params

  # Step 2: Search database
  - task: SearchProvidersDB
    id: search
    inputs:
      search_params: ${validate.normalized_params}
    outputs:
      - providers
      - total_count
      - page
      - page_size
      - total_pages

outputs:
  - name: success
    value: true

  - name: providers
    value: ${search.providers}

  - name: pagination
    value:
      page: ${search.page}
      page_size: ${search.page_size}
      total_count: ${search.total_count}
      total_pages: ${search.total_pages}
```

### Search Implementation

```python
@registry.register('ValidateSearchParams', description='Validate search parameters')
async def validate_search_params(
    services: Optional[list],
    city: Optional[str],
    state: Optional[str],
    min_rating: Optional[float],
    max_hourly_rate: Optional[float],
    page: Optional[int],
    page_size: Optional[int],
    context
):
    """
    Validate and normalize search parameters.

    Returns:
        normalized_params: Clean search parameters
    """
    params = {}

    # Services
    if services:
        if not isinstance(services, list):
            raise ValueError("services must be an array")
        params['services'] = [s.lower().strip() for s in services]

    # Location
    if city:
        params['city'] = city.strip()
    if state:
        if len(state) != 2:
            raise ValueError("state must be 2-letter code")
        params['state'] = state.upper()

    # Rating
    if min_rating is not None:
        if min_rating < 0 or min_rating > 5:
            raise ValueError("min_rating must be between 0 and 5")
        params['min_rating'] = min_rating

    # Rate
    if max_hourly_rate is not None:
        if max_hourly_rate < 0:
            raise ValueError("max_hourly_rate must be positive")
        params['max_hourly_rate'] = max_hourly_rate

    # Pagination
    params['page'] = max(1, page or 1)
    params['page_size'] = max(1, min(100, page_size or 20))

    return {'normalized_params': params}

@registry.register('SearchProvidersDB', description='Search providers in database')
async def search_providers_db(search_params: dict, context):
    """
    Search providers with filters and pagination.

    Returns:
        providers: List of provider profiles
        total_count: Total matching providers
        page: Current page
        page_size: Results per page
        total_pages: Total pages
    """
    db = await context.get_connection('postgres')

    # Build WHERE clauses
    where_clauses = ["status = 'active'"]  # Only active providers
    params = []
    param_idx = 1

    # Filter by services (JSONB array contains)
    if 'services' in search_params:
        services_json = json.dumps(search_params['services'])
        where_clauses.append(f"services @> ${param_idx}::jsonb")
        params.append(services_json)
        param_idx += 1

    # Filter by city
    if 'city' in search_params:
        where_clauses.append(f"service_area->>'city' ILIKE ${param_idx}")
        params.append(f"%{search_params['city']}%")
        param_idx += 1

    # Filter by state
    if 'state' in search_params:
        where_clauses.append(f"service_area->>'state' = ${param_idx}")
        params.append(search_params['state'])
        param_idx += 1

    # Filter by rating
    if 'min_rating' in search_params:
        where_clauses.append(f"rating >= ${param_idx}")
        params.append(search_params['min_rating'])
        param_idx += 1

    # Filter by rate
    if 'max_hourly_rate' in search_params:
        where_clauses.append(f"hourly_rate <= ${param_idx}")
        params.append(search_params['max_hourly_rate'])
        param_idx += 1

    where_clause = " AND ".join(where_clauses)

    # Count total results
    count_query = f"SELECT COUNT(*) FROM providers WHERE {where_clause}"
    total_count = await db.fetchval(count_query, *params)

    # Calculate pagination
    page = search_params['page']
    page_size = search_params['page_size']
    total_pages = (total_count + page_size - 1) // page_size
    offset = (page - 1) * page_size

    # Search query with pagination
    search_query = f"""
        SELECT
            p.id, p.user_id, p.business_name, p.bio,
            p.services, p.hourly_rate, p.service_area,
            p.rating, p.total_jobs,
            u.full_name, u.email
        FROM providers p
        JOIN users u ON p.user_id = u.id
        WHERE {where_clause}
        ORDER BY p.rating DESC, p.total_jobs DESC
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
    """

    params.extend([page_size, offset])
    rows = await db.fetch(search_query, *params)

    # Transform to dicts
    providers = []
    for row in rows:
        providers.append({
            'id': str(row['id']),
            'user_id': str(row['user_id']),
            'name': row['full_name'],
            'business_name': row['business_name'],
            'bio': row['bio'],
            'services': json.loads(row['services']),
            'hourly_rate': float(row['hourly_rate']),
            'service_area': json.loads(row['service_area']),
            'rating': float(row['rating']),
            'total_jobs': row['total_jobs']
        })

    return {
        'providers': providers,
        'total_count': total_count,
        'page': page,
        'page_size': page_size,
        'total_pages': total_pages
    }
```

## Step 4: Update Provider Profile

Similar to user update, but for provider-specific fields:

```yaml
flow: UpdateProviderProfile
description: Update provider-specific profile fields

inputs:
  - name: provider_id
    type: string
    required: true

  - name: bio
    type: string
    required: false

  - name: hourly_rate
    type: number
    required: false

  - name: service_area
    type: object
    required: false

  - name: services
    type: array
    required: false

steps:
  - task: ValidateProviderExists
    id: validate
    inputs:
      provider_id: ${inputs.provider_id}

  - task: BuildProviderUpdateFields
    id: build_update
    inputs:
      bio: ${inputs.bio}
      hourly_rate: ${inputs.hourly_rate}
      service_area: ${inputs.service_area}
      services: ${inputs.services}
    outputs:
      - update_fields
      - has_updates

  - if: ${build_update.has_updates} == false
    then:
      - exit:
          outputs:
            success: false
            error: "No updates provided"

  - task: UpdateProvider
    id: update
    inputs:
      provider_id: ${inputs.provider_id}
      update_fields: ${build_update.update_fields}

  - task: LoadProviderProfileById
    id: load_updated
    inputs:
      provider_id: ${inputs.provider_id}
    outputs:
      - provider

outputs:
  - name: success
    value: true
  - name: provider
    value: ${load_updated.provider}
```

## Key Concepts Learned

### 1. CRUD Pattern

**C**reate: UserRegistration, ProviderApplication
**R**ead: GetProfile, SearchProviders
**U**pdate: UpdateUserProfile, UpdateProviderProfile
**D**elete: (Exercise - implement soft delete)

### 2. Partial Updates (PATCH)

Only update fields that are provided, leave others unchanged.

```python
# Build update_fields from only non-None inputs
update_fields = {k: v for k, v in inputs.items() if v is not None}
```

### 3. Pagination

For large result sets, return pages:
```python
offset = (page - 1) * page_size
LIMIT page_size OFFSET offset
```

### 4. Dynamic SQL

Build queries dynamically based on filters:
```python
where_clauses = []
if 'city' in params:
    where_clauses.append("city = $1")
where_clause = " AND ".join(where_clauses)
```

### 5. JSONB Queries in PostgreSQL

```sql
-- Check if array contains value
WHERE services @> '["cleaning"]'::jsonb

-- Extract field from JSON
WHERE service_area->>'city' = 'San Francisco'
```

## Best Practices

### ✅ Do: Validate Before Updating
Always check entity exists before updating.

### ✅ Do: Return Updated Object
After update, return the fresh object so client has latest data.

### ✅ Do: Use Pagination
Never return unbounded result sets.

### ✅ Do: Index Search Fields
```sql
CREATE INDEX idx_providers_rating ON providers(rating);
CREATE INDEX idx_providers_service_area_city ON providers((service_area->>'city'));
```

### ❌ Don't: Allow Updating Sensitive Fields
Email, password should have separate flows with verification.

### ❌ Don't: Return All Fields
Exclude sensitive fields from search results (email, phone).

## Exercises

### Exercise 1: Implement Soft Delete
Create `DeactivateUserAccount` flow that:
- Sets user status to 'inactive'
- Doesn't actually delete the record
- Requires password confirmation

### Exercise 2: Add Favorite Providers
Create flows for:
- `AddFavoriteProvider` - User bookmarks a provider
- `ListFavoriteProviders` - Get user's favorites
- Database table: `user_favorites(user_id, provider_id, created_at)`

### Exercise 3: Provider Stats
Create `GetProviderStats` flow that returns:
- Total jobs completed
- Average rating
- Revenue earned
- Response time metrics

## Summary

In this lesson, you learned:

✅ CRUD operation patterns
✅ GET, UPDATE flows
✅ Search with filters and pagination
✅ Partial updates (PATCH semantics)
✅ Dynamic SQL query building
✅ JSONB querying in PostgreSQL

**Next**: [Lesson 6: Testing Your Flows](./lesson-06-testing.md)

In the final lesson, we'll create a comprehensive test suite for all our flows.

---

## Quick Reference

### Pagination
```python
page = 1
page_size = 20
offset = (page - 1) * page_size
total_pages = (total_count + page_size - 1) // page_size

query = "SELECT * FROM table LIMIT $1 OFFSET $2"
await db.fetch(query, page_size, offset)
```

### JSONB Queries
```sql
-- Contains
WHERE jsonb_field @> '{"key": "value"}'::jsonb

-- Extract text
WHERE jsonb_field->>'key' = 'value'

-- Extract number
WHERE (jsonb_field->>'key')::int > 100

-- Array contains
WHERE jsonb_array @> '["value"]'::jsonb
```

### Dynamic SQL
```python
where_clauses = []
params = []
param_idx = 1

if filter1:
    where_clauses.append(f"field1 = ${param_idx}")
    params.append(filter1)
    param_idx += 1

where = " AND ".join(where_clauses)
query = f"SELECT * FROM table WHERE {where}"
await db.fetch(query, *params)
```
