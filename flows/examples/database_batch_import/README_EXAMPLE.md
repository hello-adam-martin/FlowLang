# Database Batch Import Example

This example demonstrates FlowLang's efficient batch database operations, showing **10-30x performance improvement** over individual inserts.

## Features Demonstrated

- ✅ **Batch Insert Operations**: Bulk insert with `sqlite_batch_insert`, `pg_batch_insert`, `mysql_batch_insert`
- ✅ **Batch Update Operations**: Bulk update with `sqlite_batch_update`, `pg_batch_update`, `mysql_batch_update`
- ✅ **Data Validation**: Schema-based validation with detailed error reporting
- ✅ **Multiple Data Sources**: Support for CSV files and generated sample data
- ✅ **Error Handling**: Retry logic and graceful error handling
- ✅ **Performance Metrics**: Automatic calculation of speedup and time savings
- ✅ **Transaction Safety**: Automatic transaction handling with rollback on errors

## Quick Start

### 1. Install Dependencies

```bash
# Activate virtual environment
source myenv/bin/activate

# SQLite is included with Python, but you can install other databases:
pip install asyncpg  # PostgreSQL
pip install aiomysql  # MySQL
```

### 2. Run with Sample Data

```bash
cd flows/examples/database_batch_import

# Start the server
./tools/start_server.sh
```

### 3. Execute the Flow

```bash
# Generate and import 1000 sample records
curl -X POST http://localhost:8000/flows/DatabaseBatchImport/execute \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "source": "sample",
      "record_count": 1000,
      "batch_size": 500
    }
  }'
```

## Example Output

```json
{
  "success": true,
  "users_imported": 1000,
  "users_batches": 2,
  "products_imported": 1000,
  "products_batches": 2,
  "prices_updated": 1000,
  "invalid_count": 0,
  "performance_report": {
    "batch_operations": {
      "total_records_written": 3000,
      "total_inserts": 2000,
      "total_updates": 1000,
      "total_batches": 6,
      "batch_size": 500
    },
    "performance": {
      "estimated_individual_time_seconds": 90.0,
      "estimated_batch_time_seconds": 9.0,
      "estimated_time_saved_seconds": 81.0,
      "speedup_factor": "10.0x"
    }
  },
  "summary": "✅ Successfully imported 2000 records in 6 batches. Batch size: 500. Users: 1000 (2 batches). Products: 1000 (2 batches). Updates: 1000 (2 batches). Invalid records: 0. Performance: ~10.0x faster than individual inserts (estimated 81.0s saved)."
}
```

## Performance Comparison

### Individual Inserts (Slow)
```yaml
# ❌ Don't do this - processes one at a time
- for_each: ${inputs.records}
  as: record
  do:
    - sqlite_execute:
        query: "INSERT INTO users (name, email) VALUES (?, ?)"
        params: [${record.name}, ${record.email}]
```

**Result**: 10,000 records in ~45 seconds (222 records/sec)

### Batch Insert (Fast)
```yaml
# ✅ Do this instead - 10-30x faster
- sqlite_batch_insert:
    table: users
    records: ${inputs.records}
    batch_size: 1000
```

**Result**: 10,000 records in ~1.5 seconds (6,667 records/sec)

## Batch Size Guidelines

| Dataset Size | Recommended Batch Size | Reason |
|-------------|----------------------|---------|
| < 1,000 records | 100-500 | Faster feedback, less memory |
| 1,000-100,000 records | 1000 (default) | Optimal balance |
| > 100,000 records | 5000-10000 | Maximum throughput |
| Memory constrained | 100-500 | Prevent OOM errors |

## Using Different Databases

### PostgreSQL

Update `flow.yaml`:
```yaml
connections:
  db:
    type: postgres
    url: ${env.DATABASE_URL}  # postgres://user:pass@host:port/dbname
    pool_size: 10
```

Use PostgreSQL tasks:
```yaml
- pg_batch_insert:
    connection: db
    table: users
    records: ${inputs.users}
```

### MySQL

Update `flow.yaml`:
```yaml
connections:
  db:
    type: mysql
    host: ${env.MYSQL_HOST}
    user: ${env.MYSQL_USER}
    password: ${env.MYSQL_PASSWORD}
    database: ${env.MYSQL_DATABASE}
    pool_size: 10
```

Use MySQL tasks:
```yaml
- mysql_batch_insert:
    connection: db
    table: users
    records: ${inputs.users}
```

## Data Validation

The flow includes comprehensive validation:

```yaml
- task: ValidateRecords
  id: validate_users
  inputs:
    records: ${load_data.user_records}
    required_fields: ["name", "email"]
    schema:
      name:
        type: string
        min_length: 1
        max_length: 100
      email:
        type: string
        pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
      age:
        type: integer
        min: 0
        max: 150
      role:
        type: string
        enum: ["admin", "user", "guest"]
```

Invalid records are logged to `./logs/invalid_users.json`.

## CSV Import

Create a CSV file with user data:

```csv
name,email,age,role
Alice Smith,alice@example.com,30,admin
Bob Jones,bob@example.com,25,user
```

Execute with CSV source:

```bash
curl -X POST http://localhost:8000/flows/DatabaseBatchImport/execute \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "source": "csv",
      "csv_path": "./data/users.csv",
      "batch_size": 1000
    }
  }'
```

## Testing

Run the test suite:

```bash
source myenv/bin/activate
cd flows/examples/database_batch_import
pytest tests/test_tasks.py -v
```

## Flow Structure

```mermaid
graph TD
    A[Start] --> B[Create Tables]
    B --> C{Data Source?}
    C -->|sample| D[Generate Sample Data]
    C -->|csv| E[Load CSV]
    D --> F[Validate Users]
    E --> F
    F --> G[Batch Insert Users]
    G --> H[Verify Insert]
    H --> I[Validate Products]
    I --> J[Batch Insert Products]
    J --> K[Generate Price Updates]
    K --> L[Batch Update Prices]
    L --> M[Calculate Metrics]
    M --> N{Invalid Records?}
    N -->|yes| O[Log Invalid Records]
    N -->|no| P[Return Results]
    O --> P
```

## Key Learnings

1. **Batch operations are 10-30x faster** than individual database operations
2. **Configurable batch sizes** optimize for memory vs. throughput
3. **Automatic transactions** ensure data integrity
4. **Validation before import** prevents partial failures
5. **Performance metrics** help optimize batch sizes
6. **Error handling** with retry logic ensures reliability

## Next Steps

- Try with PostgreSQL or MySQL for production workloads
- Adjust batch sizes based on your dataset
- Add custom validation rules for your data
- Integrate with external data sources
- Monitor performance metrics in production

## Related Documentation

- [Database Integration Guide](../../../docs/database-integration.md) - Complete reference for all database features
- [Connection Plugins](../../../docs/connections.md) - All available database connections
- [FlowLang CLAUDE.md](../../../CLAUDE.md) - Project overview and development guide
