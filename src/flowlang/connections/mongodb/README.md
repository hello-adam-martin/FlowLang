# MongoDB Connection Plugin

Production-ready MongoDB NoSQL database integration for FlowLang with async operations, aggregation pipelines, and built-in CRUD tasks.

## Features

- ✅ Async connection with Motor (PyMongo async driver)
- ✅ 7 built-in tasks for document operations
- ✅ Aggregation pipeline support
- ✅ Flexible query filters and projections
- ✅ Configurable connection pooling
- ✅ Environment variable support
- ✅ Comprehensive error handling

## Installation

```bash
pip install motor>=3.3.0
```

Or: `flowlang connection install mongodb`

## Quick Start

```yaml
connections:
  db:
    type: mongodb
    url: ${env.MONGODB_URL}
    database: ${env.MONGODB_DATABASE}
    max_pool_size: 100

steps:
  - mongo_find:
      id: fetch_users
      connection: db
      collection: users
      filter: {active: true}
      limit: 100
      outputs:
        - documents
```

## Configuration

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `url` | Yes | - | MongoDB connection URL |
| `database` | Yes | - | Database name |
| `max_pool_size` | No | 100 | Max connections |
| `min_pool_size` | No | 0 | Min connections |

## Built-in Tasks

### mongo_find - List documents

```yaml
- mongo_find:
    id: fetch
    connection: db
    collection: users
    filter: {active: true, age: {$gt: 18}}
    sort: [["name", 1]]
    limit: 100
    outputs:
      - documents
      - count
```

### mongo_find_one - Get single document

```yaml
- mongo_find_one:
    id: get_user
    connection: db
    collection: users
    filter: {_id: "${inputs.user_id}"}
    outputs:
      - document
      - found
```

### mongo_insert - Create documents

```yaml
- mongo_insert:
    id: create_user
    connection: db
    collection: users
    documents:
      - name: "${inputs.name}"
        email: "${inputs.email}"
        active: true
    outputs:
      - inserted_ids
```

### mongo_update - Update documents

```yaml
- mongo_update:
    id: update_user
    connection: db
    collection: users
    filter: {_id: "${inputs.user_id}"}
    update: {$set: {active: false}}
    many: false
    upsert: false
    outputs:
      - modified_count
```

### mongo_delete - Delete documents

```yaml
- mongo_delete:
    id: delete_user
    connection: db
    collection: users
    filter: {_id: "${inputs.user_id}"}
    many: false
    outputs:
      - deleted_count
```

### mongo_count - Count documents

```yaml
- mongo_count:
    id: count_active
    connection: db
    collection: users
    filter: {active: true}
    outputs:
      - count
```

### mongo_aggregate - Run aggregation pipeline

```yaml
- mongo_aggregate:
    id: user_stats
    connection: db
    collection: users
    pipeline:
      - {$match: {active: true}}
      - {$group: {_id: "$country", count: {$sum: 1}}}
      - {$sort: {count: -1}}
    outputs:
      - documents
```

## MongoDB Query Operators

### Comparison
- `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`

### Logical
- `$and`, `$or`, `$not`, `$nor`

### Element
- `$exists`, `$type`

### Array
- `$all`, `$elemMatch`, `$size`

## Best Practices

1. **Index frequently queried fields**
   ```javascript
   db.users.createIndex({email: 1}, {unique: true})
   ```

2. **Use projections to limit data**
   ```yaml
   projection: {name: 1, email: 1, _id: 0}
   ```

3. **Limit result sets**
   ```yaml
   limit: 1000
   ```

4. **Use aggregation for complex queries**

## CLI Commands

```bash
flowlang connection info mongodb
flowlang connection install mongodb
flowlang connection scaffold mongodb
flowlang connection example mongodb
```

## Related Documentation

- [Database Integration Guide](../../../docs/database-integration.md)
- [MongoDB Documentation](https://docs.mongodb.com/)

## License

Part of FlowLang - MIT License
