# FlowLang Connections

FlowLang provides a plugin-based connection system that allows flows to integrate with external services and databases. Connection plugins handle lifecycle management, provide built-in task types, and include scaffolding commands for quick setup.

## Connection Plugin System

FlowLang uses a **plugin-based architecture** that allows:
- **Core integrations**: Built-in database and service plugins maintained by FlowLang
- **Third-party plugins**: Community-developed plugins distributed via pip
- **Self-contained plugins**: Each plugin includes connection logic, built-in tasks, and scaffolding
- **Automatic discovery**: Plugins are discovered via subdirectories and setuptools entry points

### Using Connections in Flows

Define connections in your `flow.yaml`:

```yaml
connections:
  db:
    type: postgres
    url: ${env.DATABASE_URL}
    pool_size: 10

steps:
  # Use built-in task from plugin
  - pg_query:
      id: fetch_users
      connection: db
      query: "SELECT * FROM users WHERE active = $1"
      params: [true]
      outputs:
        - rows

  # Custom task with connection injection
  - task: ProcessUsers
    id: process
    connection: db
    inputs:
      users: ${fetch_users.rows}
```

### CLI Commands

```bash
# List all available plugins
flowlang connection list

# Show plugin details
flowlang connection info postgres

# Check/install dependencies
flowlang connection deps postgres --check
flowlang connection install postgres

# Generate connection config
flowlang connection scaffold postgres --name primary_db

# Generate example flow
flowlang connection example postgres
```

For detailed documentation, see:
- [Database Integration Guide](./database-integration.md)
- [Creating Connection Plugins](./creating-connection-plugins.md)

---

## Done

### Databases
- **PostgreSQL** - asyncpg-based connection with pooling
  - Built-in tasks: `pg_query`, `pg_execute`, `pg_transaction`
  - Full transaction support
  - Parameterized queries for SQL injection prevention

- **MySQL** - aiomysql-based connection with pooling
  - Built-in tasks: `mysql_query`, `mysql_execute`, `mysql_transaction`
  - Character set configuration
  - Transaction support

- **MongoDB** - Motor-based async connection
  - Built-in tasks: `mongo_find`, `mongo_find_one`, `mongo_insert`, `mongo_update`, `mongo_delete`, `mongo_count`, `mongo_aggregate`
  - Aggregation pipeline support
  - Flexible document operations

- **Redis** - redis-py async connection with pooling
  - Built-in tasks: `redis_get`, `redis_set`, `redis_delete`, `redis_exists`, `redis_expire`, `redis_incr`, `redis_hgetall`, `redis_hset`
  - String, hash, list, set, sorted set operations
  - TTL and expiration support

- **SQLite** - aiosqlite file-based database
  - Built-in tasks: `sqlite_query`, `sqlite_execute`, `sqlite_transaction`
  - In-memory database support
  - Foreign key enforcement

---

## Backlog

### Payment Processing
- Stripe
- PayPal
- Square

### Cloud Storage
- Google Drive
- Dropbox
- AWS S3

### Communication
- Email (SMTP)
- SendGrid
- Slack
- Twilio (SMS/Voice)
- Discord


### AI/ML Services
- OpenAI (GPT)
- Anthropic (Claude)
- Hugging Face
- Azure OpenAI
- Google Vertex AI

### CRM & Sales
- Salesforce
- HubSpot
- Zoho CRM

### Project Management
- GitHub
- GitLab

### Analytics
- Google Analytics

### Calendar & Scheduling
- Google Calendar
- Calendly

### E-commerce
- Shopify

### Authentication
- Auth0
- Firebase Auth

### Message Queues
- Redis Streams

### Forms & Surveys
- Typeform
- Google Forms

### Accounting
- Xero
- Stripe Billing

### Social Media
- Twitter/X
- Facebook

### Document Processing
- Google Docs
- DocuSign

---

**Note:** This is a living document. As integrations progress through stages (Backlog → Todo → Done), they'll be moved between sections.
