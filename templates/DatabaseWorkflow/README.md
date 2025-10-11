# {{FLOW_NAME}}

{{FLOW_DESCRIPTION}}

This workflow demonstrates a production-ready database integration pattern with Redis caching, leveraging FlowLang's connection plugin system.

## Features

- **Database Integration**: Uses {{DB_TYPE}} for persistent storage
- **Redis Caching**: Implements caching layer for improved performance
- **Connection Pooling**: Efficient connection management
- **Error Handling**: Robust error handling with retries
- **Metrics Tracking**: Request counting and monitoring
- **Environment Variables**: Secure credential management

## Architecture

```
Input ({{PRIMARY_KEY_NAME}})
  ↓
Check Cache
  ↓
├─ Cache Hit → Return Cached Data
│                ↓
│              Process Data
│                ↓
│              Update Metrics
│                ↓
│              Return Result
│
└─ Cache Miss → Query Database
                  ↓
                Transform Data
                  ↓
                Cache Result
                  ↓
                Process Data
                  ↓
                Update Metrics
                  ↓
                Return Result
```

## Prerequisites

### 1. Install Dependencies

```bash
# Database driver (choose one)
{{DB_INSTALL_COMMAND}}

# Redis driver
pip install redis>=5.0.0

# FlowLang
pip install flowlang
```

### 2. Set Environment Variables

```bash
# Database connection
export {{DB_URL_ENV_VAR}}="{{DB_URL_EXAMPLE}}"

# Redis connection
export REDIS_URL="redis://localhost:6379/0"
```

Or create `.env` file:
```
{{DB_URL_ENV_VAR}}={{DB_URL_EXAMPLE}}
REDIS_URL=redis://localhost:6379/0
```

## Project Structure

```
{{FLOW_NAME_LOWER}}/
├── flow.yaml           # Flow definition with connections
├── flow.py             # Task implementations
├── api.py              # FastAPI server (generated)
├── README.md           # This file
├── .env                # Environment variables (gitignored)
├── tools/
│   ├── start_server.sh # Server launcher
│   └── generate.sh     # Scaffolder wrapper
└── tests/
    └── test_tasks.py   # Unit tests
```

## Quick Start

### Option 1: Run as API Server

```bash
# Start the server
./tools/start_server.sh

# Or with hot reload
./tools/start_server.sh --reload
```

API will be available at http://localhost:8000

**Test the API:**
```bash
curl -X POST http://localhost:8000/flows/{{FLOW_NAME}}/execute \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "{{PRIMARY_KEY_NAME}}": {{PRIMARY_KEY_EXAMPLE}}
    }
  }'
```

**Interactive Docs:**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Option 2: Execute Directly

```python
import asyncio
from flowlang import FlowExecutor
from flow import create_task_registry

# Load flow definition
with open('flow.yaml') as f:
    flow_yaml = f.read()

# Create executor
registry = create_task_registry()
executor = FlowExecutor(registry)

# Execute flow
async def main():
    result = await executor.execute_flow(
        flow_yaml,
        inputs={'{{PRIMARY_KEY_NAME}}': {{PRIMARY_KEY_EXAMPLE}}}
    )
    print(result)

asyncio.run(main())
```

## Implementation Guide

The template provides three main tasks to implement:

### 1. Fetch from Database (`{{FETCH_TASK_NAME}}`)

Retrieve {{ENTITY_NAME}} from database by {{PRIMARY_KEY_NAME}}.

**Location:** `flow.py:26`

**Example Implementation (PostgreSQL):**
```python
async def fetch_from_database({{PRIMARY_KEY_NAME}}: {{PRIMARY_KEY_TYPE}}, connection):
    query = """
        SELECT *
        FROM {{TABLE_NAME}}
        WHERE {{PRIMARY_KEY_COLUMN}} = $1
    """

    async with connection.transaction():
        result = await connection.fetch(query, {{PRIMARY_KEY_NAME}})

        if not result:
            raise ValueError(f"{{ENTITY_NAME}} not found: {{{PRIMARY_KEY_NAME}}}")

        return {'data': dict(result[0])}
```

**Example Implementation (MongoDB):**
```python
async def fetch_from_database({{PRIMARY_KEY_NAME}}: {{PRIMARY_KEY_TYPE}}, connection):
    collection = connection['{{COLLECTION_NAME}}']

    document = await collection.find_one({'{{PRIMARY_KEY_COLUMN}}': {{PRIMARY_KEY_NAME}}})

    if not document:
        raise ValueError(f"{{ENTITY_NAME}} not found: {{{PRIMARY_KEY_NAME}}}")

    # Convert ObjectId to string
    if '_id' in document:
        document['_id'] = str(document['_id'])

    return {'data': document}
```

### 2. Transform Data (`{{TRANSFORM_TASK_NAME}}`)

Validate and enrich raw database data.

**Location:** `flow.py:60`

**Example Implementation:**
```python
async def transform_data(raw_data: Dict[str, Any]):
    # Validate required fields
    required = ['{{PRIMARY_KEY_NAME}}', 'name', 'active']
    for field in required:
        if field not in raw_data:
            raise ValueError(f"Missing required field: {field}")

    # Transform data
    transformed = {
        **raw_data,
        'display_name': f"{raw_data['name']} (#{raw_data['{{PRIMARY_KEY_NAME}}']})",
        'is_valid': bool(raw_data.get('active', False)),
        'field_count': len(raw_data),
        'transformed_at': datetime.utcnow().isoformat()
    }

    return {'transformed': transformed}
```

### 3. Process Data (`{{PROCESS_TASK_NAME}}`)

Apply business logic and perform operations.

**Location:** `flow.py:94`

**Example Implementation:**
```python
async def process_data(data: Dict[str, Any], connection):
    # Update last accessed timestamp
    update_query = """
        UPDATE {{TABLE_NAME}}
        SET last_accessed = NOW(),
            access_count = access_count + 1
        WHERE {{PRIMARY_KEY_COLUMN}} = $1
    """
    await connection.execute(update_query, data['{{PRIMARY_KEY_NAME}}'])

    # Prepare result
    result = {
        'status': 'success',
        'data': data,
        'summary': f"Processed {data['display_name']}",
        'timestamp': datetime.utcnow().isoformat()
    }

    return {'result': result}
```

## Configuration

### Database Connection

Edit `flow.yaml` connections section:

```yaml
connections:
  {{DB_CONNECTION_NAME}}:
    type: {{DB_TYPE}}
{{DB_CONFIG_EXAMPLE}}
```

### Cache Settings

Adjust cache TTL and key prefix:

```yaml
# In flow.yaml
CACHE_KEY_PREFIX: "{{CACHE_KEY_PREFIX}}"
CACHE_TTL_SECONDS: {{CACHE_TTL_SECONDS}}
```

### Connection Pool Sizes

For high-traffic applications:

```yaml
connections:
  {{DB_CONNECTION_NAME}}:
    type: {{DB_TYPE}}
    pool_size: 50        # Increase for more concurrent requests
    min_pool_size: 10    # Maintain minimum connections

  {{CACHE_CONNECTION_NAME}}:
    type: redis
    max_connections: 100  # Increase for high throughput
```

## Testing

### Unit Tests

Run unit tests for individual tasks:

```bash
pytest tests/test_tasks.py -v
```

### Integration Tests

Test the complete flow:

```bash
# Test with live database
python -m flowlang watch flow.yaml --tasks-file flow.py

# Make changes to flow.py or flow.yaml
# Flow auto-executes on save
```

### API Tests

Test via API endpoints:

```bash
# Execute flow
curl -X POST http://localhost:8000/flows/{{FLOW_NAME}}/execute \
  -H "Content-Type: application/json" \
  -d '{"inputs": {"{{PRIMARY_KEY_NAME}}": {{PRIMARY_KEY_EXAMPLE}}}}'

# Check health
curl http://localhost:8000/health

# List tasks
curl http://localhost:8000/flows/{{FLOW_NAME}}/tasks
```

## Monitoring

### Metrics

The workflow tracks request counts in Redis:

```bash
# Get total requests
redis-cli GET "metrics:{{METRIC_NAME}}"
```

### Cache Hit Rate

Monitor cache effectiveness:

```python
cache_hits = redis_client.get("metrics:{{METRIC_NAME}}:cache_hits")
total_requests = redis_client.get("metrics:{{METRIC_NAME}}")
hit_rate = (cache_hits / total_requests) * 100
```

### Database Connection Pool

Check pool status (PostgreSQL example):

```sql
SELECT
    count(*) as active_connections,
    max_conn as max_connections
FROM pg_stat_activity
CROSS JOIN (SELECT setting::int as max_conn FROM pg_settings WHERE name = 'max_connections') s;
```

## Performance Optimization

### 1. Cache Strategy

- **Cache hit rate > 80%**: Good performance
- **Cache hit rate < 50%**: Consider increasing TTL or cache size
- **Cache misses**: Monitor and optimize query performance

### 2. Database Indexes

Ensure indexes on frequently queried columns:

```sql
-- PostgreSQL
CREATE INDEX idx_{{TABLE_NAME}}_{{PRIMARY_KEY_COLUMN}} ON {{TABLE_NAME}}({{PRIMARY_KEY_COLUMN}});
CREATE INDEX idx_{{TABLE_NAME}}_lookup ON {{TABLE_NAME}}(commonly_queried_field);
```

### 3. Connection Pool Tuning

Adjust based on traffic:

- **Low traffic** (< 10 RPS): pool_size = 5-10
- **Medium traffic** (10-100 RPS): pool_size = 20-50
- **High traffic** (> 100 RPS): pool_size = 50-100

### 4. Query Optimization

- Use EXPLAIN ANALYZE to identify slow queries
- Add appropriate indexes
- Limit result sets with LIMIT/TOP
- Use pagination for large datasets

## Deployment

### Production Checklist

- [ ] Set environment variables securely
- [ ] Configure appropriate pool sizes
- [ ] Set up monitoring and alerting
- [ ] Enable SSL/TLS for database connections
- [ ] Configure Redis password authentication
- [ ] Set up connection pool monitoring
- [ ] Configure request timeouts
- [ ] Set up log aggregation
- [ ] Enable health check endpoints
- [ ] Configure auto-scaling based on metrics

### Docker Deployment

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{FLOW_NAME_LOWER}}
spec:
  replicas: 3
  selector:
    matchLabels:
      app: {{FLOW_NAME_LOWER}}
  template:
    metadata:
      labels:
        app: {{FLOW_NAME_LOWER}}
    spec:
      containers:
      - name: api
        image: {{FLOW_NAME_LOWER}}:latest
        ports:
        - containerPort: 8000
        env:
        - name: {{DB_URL_ENV_VAR}}
          valueFrom:
            secretKeyRef:
              name: database-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: url
```

## Troubleshooting

### Connection Errors

```
ConnectionError: Failed to connect to {{DB_TYPE}}
```

**Solution:**
- Verify {{DB_URL_ENV_VAR}} is set correctly
- Check database is running and accessible
- Verify credentials are correct
- Check firewall/security group rules

### Cache Errors

```
ConnectionError: Failed to connect to Redis
```

**Solution:**
- Verify REDIS_URL is set correctly
- Check Redis is running: `redis-cli ping`
- Verify Redis password if configured

### Pool Exhaustion

```
TimeoutError: Could not acquire connection from pool
```

**Solution:**
- Increase pool_size in connection config
- Check for connection leaks (not releasing connections)
- Monitor slow queries
- Scale horizontally (add more instances)

## Learn More

- [FlowLang Documentation](https://github.com/yourusername/FlowLang)
- [Database Integration Guide](../docs/database-integration.md)
- [Creating Connection Plugins](../docs/creating-connection-plugins.md)
- [Connection Plugins Reference](../docs/connections.md)

## Support

For issues or questions:
- GitHub Issues: [FlowLang Issues](https://github.com/yourusername/FlowLang/issues)
- Documentation: [FlowLang Docs](https://github.com/yourusername/FlowLang/tree/main/docs)

## License

[Your License Here]
