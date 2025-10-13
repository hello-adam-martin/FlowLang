# FlowLang Triggers - Event-Driven Flow Execution

Triggers enable FlowLang flows to execute automatically in response to external events. This guide covers everything you need to know about implementing and using triggers in your flows.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Webhook Triggers](#webhook-triggers)
4. [Schedule Triggers](#schedule-triggers)
5. [Configuration](#configuration)
6. [Authentication](#authentication)
7. [Input Mapping](#input-mapping)
8. [Execution Modes](#execution-modes)
9. [Monitoring & Management](#monitoring--management)
10. [Examples](#examples)
11. [Best Practices](#best-practices)
12. [Future Trigger Types](#future-trigger-types)

## Overview

Triggers allow flows to be executed in response to events rather than requiring manual invocation. This enables:

- **Reactive workflows**: Respond to external events in real-time
- **Integration**: Connect flows with external systems via webhooks
- **Automation**: Execute flows on schedules or from message queues (planned)
- **Event-driven architecture**: Build loosely-coupled, scalable systems

### Supported Trigger Types

Currently supported:
- **Webhook triggers**: Execute flows via HTTP requests
- **Schedule triggers**: Execute flows automatically on a cron schedule

Planned for future releases:
- **Queue triggers**: Execute flows from message brokers (RabbitMQ, Kafka, etc.)

## Architecture

### Core Components

#### 1. Trigger (Abstract Base Class)

All triggers inherit from the `Trigger` base class (src/flowlang/triggers/base.py):

```python
class Trigger(ABC):
    """Base class for all triggers"""

    async def start(self):
        """Start the trigger"""

    async def stop(self):
        """Stop the trigger"""

    def get_status(self) -> Dict[str, Any]:
        """Get trigger status"""

    async def execute_flow(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the associated flow"""
```

Features:
- Lifecycle management (start/stop)
- Flow execution with automatic metrics tracking
- Execution count and error tracking
- Last execution time recording

#### 2. TriggerManager

Manages multiple triggers for a flow or server:

```python
class TriggerManager:
    """Manages multiple triggers"""

    def register_trigger_type(self, trigger_type: str, factory: Callable):
        """Register a trigger type factory"""

    def create_trigger(self, config: TriggerConfig, flow_name: str, executor: Callable) -> Trigger:
        """Create a trigger from configuration"""

    async def start_all(self):
        """Start all registered triggers"""

    async def stop_all(self):
        """Stop all triggers"""

    def list_triggers(self) -> List[Dict[str, Any]]:
        """Get status of all triggers"""
```

#### 3. Server Integration

Triggers are automatically loaded and started when:
- FlowServer starts (single-flow mode)
- MultiFlowServer discovers flows (multi-flow mode)

The server:
1. Parses `triggers:` section from flow.yaml
2. Creates trigger instances via TriggerManager
3. Mounts trigger routers (for webhook triggers)
4. Starts all triggers
5. Provides management endpoints

## Webhook Triggers

Webhook triggers create HTTP endpoints that execute flows when called.

### Basic Configuration

```yaml
flow: MyFlow
description: Example flow with webhook trigger

triggers:
  - type: webhook
    path: /webhooks/my-flow
    method: POST

inputs:
  - name: message
    type: string
    required: true

steps:
  - task: ProcessMessage
    id: process
    inputs:
      message: ${inputs.message}

outputs:
  - name: result
    value: ${process.result}
```

When this flow is loaded, it creates an HTTP endpoint at:
```
POST http://localhost:8000/webhooks/my-flow
```

### HTTP Methods

Webhook triggers support multiple HTTP methods:

```yaml
triggers:
  - type: webhook
    path: /webhooks/get-data
    method: GET

  - type: webhook
    path: /webhooks/create-resource
    method: POST

  - type: webhook
    path: /webhooks/update-resource
    method: PUT

  - type: webhook
    path: /webhooks/delete-resource
    method: DELETE

  - type: webhook
    path: /webhooks/patch-resource
    method: PATCH
```

### Path Configuration

Paths can be any valid URL path:

```yaml
triggers:
  - type: webhook
    path: /webhooks/v1/orders/created
    method: POST

  - type: webhook
    path: /api/events/user-signup
    method: POST
```

**Note**: Paths are automatically normalized to start with `/` if not already present.

## Configuration

### Complete Configuration Options

```yaml
triggers:
  - type: webhook                    # Trigger type (required)
    path: /webhooks/my-flow         # URL path (required)
    method: POST                     # HTTP method (default: POST)
    id: my-webhook-trigger          # Optional unique identifier
    enabled: true                    # Whether trigger is enabled (default: true)

    # Authentication (optional)
    auth:
      type: api_key                  # Authentication type: api_key or bearer
      header: X-API-Key              # Header name for API key (default: X-API-Key)
      key: ${SECRET_KEY}             # Expected key value (supports env vars)

    # Input mapping (optional)
    input_mapping: body              # Where to extract inputs from (default: body)
                                     # Options: body, query, headers, path, all

    # Execution mode (optional)
    async: false                     # Sync (false) or async (true) execution (default: true)
```

### Environment Variables

Use environment variable substitution for sensitive data:

```yaml
triggers:
  - type: webhook
    path: /webhooks/secure
    auth:
      type: bearer
      key: ${WEBHOOK_SECRET}  # Loaded from environment
```

## Authentication

Webhook triggers support two authentication methods:

### 1. API Key Authentication

Uses a custom header to pass an API key:

```yaml
triggers:
  - type: webhook
    path: /webhooks/protected
    method: POST
    auth:
      type: api_key
      header: X-API-Key            # Custom header name
      key: your-secret-key-here    # Expected value
```

**Request example:**
```bash
curl -X POST http://localhost:8000/webhooks/protected \
  -H "X-API-Key: your-secret-key-here" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'
```

**Security features:**
- Constant-time comparison prevents timing attacks
- Returns 401 if header is missing or incorrect
- Auth context available to tasks via `${inputs._auth}`

### 2. Bearer Token Authentication

Uses the standard Authorization header with Bearer scheme:

```yaml
triggers:
  - type: webhook
    path: /webhooks/bearer-auth
    method: POST
    auth:
      type: bearer
      key: your-bearer-token-here
```

**Request example:**
```bash
curl -X POST http://localhost:8000/webhooks/bearer-auth \
  -H "Authorization: Bearer your-bearer-token-here" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'
```

**Security features:**
- Validates Bearer scheme format
- Constant-time token comparison
- Returns 401 with descriptive error messages

### Authentication Context

Tasks can access authentication information:

```python
@registry.register('ProcessAuthenticatedRequest')
async def process_authenticated_request(**inputs):
    # Check if authenticated
    if '_auth' in inputs:
        auth_type = inputs['_auth']['auth_type']  # 'api_key' or 'bearer'
        authenticated = inputs['_auth']['authenticated']  # True

    # Rest of task logic
    return {'result': 'processed'}
```

## Input Mapping

Input mapping controls how flow inputs are extracted from the HTTP request.

### body (default)

Extract inputs from the JSON request body:

```yaml
triggers:
  - type: webhook
    path: /webhooks/process
    input_mapping: body
```

**Request:**
```bash
curl -X POST http://localhost:8000/webhooks/process \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "priority": 1}'
```

**Flow inputs:**
```python
{
  'message': 'Hello',
  'priority': 1,
  '_webhook': {'method': 'POST', 'path': '/webhooks/process', ...}
}
```

### query

Extract inputs from query parameters:

```yaml
triggers:
  - type: webhook
    path: /webhooks/search
    method: GET
    input_mapping: query
```

**Request:**
```bash
curl "http://localhost:8000/webhooks/search?q=test&limit=10"
```

**Flow inputs:**
```python
{
  'q': 'test',
  'limit': '10',
  '_webhook': {...}
}
```

### headers

Extract inputs from request headers:

```yaml
triggers:
  - type: webhook
    path: /webhooks/header-data
    input_mapping: headers
```

**Request:**
```bash
curl http://localhost:8000/webhooks/header-data \
  -H "X-User-ID: 12345" \
  -H "X-Session-ID: abc123"
```

**Flow inputs:**
```python
{
  'x-user-id': '12345',
  'x-session-id': 'abc123',
  '_webhook': {...}
}
```

### path

Extract inputs from path parameters (requires FastAPI path parameters):

```yaml
triggers:
  - type: webhook
    path: /webhooks/users/{user_id}/orders/{order_id}
    input_mapping: path
```

**Flow inputs:**
```python
{
  'user_id': '123',
  'order_id': '456',
  '_webhook': {...}
}
```

### all

Combine all sources into a structured input:

```yaml
triggers:
  - type: webhook
    path: /webhooks/combined
    input_mapping: all
```

**Flow inputs:**
```python
{
  'body': {'message': 'Hello'},
  'query': {'filter': 'active'},
  'headers': {'x-user-id': '123'},
  'path': {},
  '_webhook': {...}
}
```

### Webhook Metadata

All input mapping strategies include `_webhook` metadata:

```python
{
  '_webhook': {
    'method': 'POST',
    'path': '/webhooks/my-flow',
    'client': '127.0.0.1',
    'trigger_id': 'webhook-trigger-id'
  }
}
```

## Execution Modes

Webhook triggers support two execution modes:

### Synchronous Execution (async: false)

Wait for flow completion and return results:

```yaml
triggers:
  - type: webhook
    path: /webhooks/sync
    async: false  # Wait for completion
```

**Behavior:**
- HTTP request blocks until flow completes
- Returns full flow results
- Status code 200 on success, 500 on failure

**Response example:**
```json
{
  "success": true,
  "outputs": {
    "result": "processed",
    "timestamp": "2025-10-14T12:00:00Z"
  },
  "flow": "MyFlow",
  "execution": "sync"
}
```

**Use cases:**
- Request-response patterns
- When caller needs immediate results
- Synchronous APIs

### Asynchronous Execution (async: true, default)

Return immediately and execute in background:

```yaml
triggers:
  - type: webhook
    path: /webhooks/async
    async: true  # Execute in background (default)
```

**Behavior:**
- HTTP request returns immediately (202 Accepted)
- Flow executes in background task
- No flow results returned

**Response example:**
```json
{
  "success": true,
  "message": "Flow MyFlow triggered successfully",
  "flow": "MyFlow",
  "execution": "async"
}
```

**Use cases:**
- Long-running workflows
- Fire-and-forget operations
- High-throughput event processing

## Monitoring & Management

### Trigger Status Tracking

Every trigger tracks execution metrics:

```python
{
  'id': 'webhook-1',
  'flow': 'MyFlow',
  'type': 'webhook',
  'running': True,
  'executions': 150,          # Total executions
  'errors': 3,                 # Total errors
  'last_execution_time': 0.45, # Seconds
  'last_error': None,
  # Webhook-specific fields
  'method': 'POST',
  'path': '/webhooks/my-flow',
  'auth_enabled': True,
  'auth_type': 'api_key',
  'async_execution': False
}
```

### REST API Endpoints

#### List All Triggers for a Flow

```bash
GET /flows/{flow_name}/triggers
```

**Response:**
```json
{
  "flow": "MyFlow",
  "triggers": [
    {
      "id": "webhook-1",
      "type": "webhook",
      "running": true,
      "executions": 150,
      "errors": 3
    }
  ],
  "count": 1
}
```

#### Get Specific Trigger Status

```bash
GET /flows/{flow_name}/triggers/{trigger_id}
```

**Response:**
```json
{
  "id": "webhook-1",
  "flow": "MyFlow",
  "type": "webhook",
  "running": true,
  "executions": 150,
  "errors": 3,
  "last_execution_time": 0.45,
  "method": "POST",
  "path": "/webhooks/my-flow",
  "auth_enabled": true,
  "async_execution": false
}
```

### Server Logs

Triggers emit structured logs:

```
INFO - Trigger webhook-1 executing flow MyFlow
INFO - Trigger webhook-1 flow executed successfully in 0.45s
ERROR - Trigger webhook-1 flow execution failed: Task not found
```

### Hot Reload Support

Triggers support hot reload:
- Changes to `triggers:` in flow.yaml automatically reload
- Triggers are stopped and restarted with new configuration
- No server restart required

## Examples

### Example 1: Simple Webhook

Minimal webhook configuration:

```yaml
flow: SimpleWebhook
description: Process incoming messages

triggers:
  - type: webhook
    path: /webhooks/message

inputs:
  - name: message
    type: string
    required: true

steps:
  - task: ProcessMessage
    id: process
    inputs:
      message: ${inputs.message}

outputs:
  - name: result
    value: ${process.result}
```

### Example 2: Authenticated Webhook with Async Execution

Secure, high-throughput webhook:

```yaml
flow: SecureWebhook
description: Authenticated async webhook

triggers:
  - type: webhook
    path: /webhooks/secure
    method: POST
    auth:
      type: api_key
      header: X-API-Key
      key: ${WEBHOOK_SECRET}
    async: true  # Execute in background
    input_mapping: body

inputs:
  - name: data
    type: object
    required: true

steps:
  - task: ValidateData
    id: validate
    inputs:
      data: ${inputs.data}

  - task: ProcessData
    id: process
    inputs:
      data: ${validate.validated_data}

  - task: SendNotification
    id: notify
    inputs:
      result: ${process.result}

outputs:
  - name: status
    value: ${process.status}
```

### Example 3: Multiple Webhooks for Same Flow

Different HTTP methods for CRUD operations:

```yaml
flow: ResourceManager
description: Manage resources via webhooks

triggers:
  # Create resource
  - type: webhook
    id: create-resource
    path: /webhooks/resources
    method: POST
    async: false
    input_mapping: body

  # Get resource
  - type: webhook
    id: get-resource
    path: /webhooks/resources/{id}
    method: GET
    async: false
    input_mapping: path

  # Update resource
  - type: webhook
    id: update-resource
    path: /webhooks/resources/{id}
    method: PUT
    async: false
    input_mapping: all  # Combine path and body

  # Delete resource
  - type: webhook
    id: delete-resource
    path: /webhooks/resources/{id}
    method: DELETE
    async: false
    input_mapping: path

inputs:
  - name: id
    type: string
    required: false
  - name: data
    type: object
    required: false

steps:
  - switch: ${inputs._webhook.method}
    cases:
      - when: POST
        do:
          - task: CreateResource
            id: result
            inputs:
              data: ${inputs.data}

      - when: GET
        do:
          - task: GetResource
            id: result
            inputs:
              id: ${inputs.id}

      - when: PUT
        do:
          - task: UpdateResource
            id: result
            inputs:
              id: ${inputs.id}
              data: ${inputs.body.data}

      - when: DELETE
        do:
          - task: DeleteResource
            id: result
            inputs:
              id: ${inputs.id}

outputs:
  - name: result
    value: ${result.output}
```

### Example 4: Query Parameter Webhook

Search endpoint with query parameters:

```yaml
flow: SearchFlow
description: Search via webhook query parameters

triggers:
  - type: webhook
    path: /webhooks/search
    method: GET
    input_mapping: query
    async: false

inputs:
  - name: q
    type: string
    required: true
    description: Search query
  - name: limit
    type: integer
    required: false
  - name: offset
    type: integer
    required: false

steps:
  - task: Search
    id: search
    inputs:
      query: ${inputs.q}
      limit: ${inputs.limit}
      offset: ${inputs.offset}

outputs:
  - name: results
    value: ${search.results}
  - name: count
    value: ${search.count}
```

**Usage:**
```bash
curl "http://localhost:8000/webhooks/search?q=flowlang&limit=10&offset=0"
```

## Schedule Triggers

Schedule triggers execute flows automatically based on cron expressions, enabling time-based automation without manual intervention.

### Basic Configuration

```yaml
flow: ScheduledReportFlow
description: Generate reports on a schedule

triggers:
  - type: schedule
    cron: "0 * * * *"  # Every hour
    timezone: UTC

inputs: []

steps:
  - task: GenerateReport
    id: generate
    outputs:
      - report_id

outputs:
  - name: report_id
    value: ${generate.report_id}
```

When this flow is loaded, it automatically executes every hour without any external trigger.

### Cron Expression Format

Schedule triggers use the standard 5-field cron format:

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-6, Sunday=0)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

### Common Cron Examples

```yaml
triggers:
  # Every minute
  - type: schedule
    cron: "* * * * *"
    timezone: UTC

  # Every 5 minutes
  - type: schedule
    cron: "*/5 * * * *"
    timezone: UTC

  # Every hour at minute 0
  - type: schedule
    cron: "0 * * * *"
    timezone: UTC

  # Every day at 9 AM
  - type: schedule
    cron: "0 9 * * *"
    timezone: America/New_York

  # Every weekday at 9 AM
  - type: schedule
    cron: "0 9 * * 1-5"
    timezone: UTC

  # Every Monday at midnight
  - type: schedule
    cron: "0 0 * * 1"
    timezone: UTC

  # First day of every month at noon
  - type: schedule
    cron: "0 12 1 * *"
    timezone: UTC

  # Every 15 minutes during business hours (9 AM - 5 PM)
  - type: schedule
    cron: "*/15 9-17 * * *"
    timezone: America/New_York
```

### Complete Configuration Options

```yaml
triggers:
  - type: schedule                 # Trigger type (required)
    id: hourly-report             # Optional unique identifier
    cron: "0 * * * *"             # Cron expression (required)
    timezone: America/New_York    # Timezone (default: UTC)
    max_instances: 1              # Max concurrent executions (default: 1)
    enabled: true                 # Whether trigger is enabled (default: true)
```

### Timezone Support

Schedule triggers support all IANA timezone names:

```yaml
triggers:
  # UTC (default)
  - type: schedule
    cron: "0 9 * * *"
    timezone: UTC

  # US timezones
  - type: schedule
    cron: "0 9 * * *"
    timezone: America/New_York

  - type: schedule
    cron: "0 9 * * *"
    timezone: America/Los_Angeles

  # European timezones
  - type: schedule
    cron: "0 9 * * *"
    timezone: Europe/London

  - type: schedule
    cron: "0 9 * * *"
    timezone: Europe/Paris

  # Asian timezones
  - type: schedule
    cron: "0 9 * * *"
    timezone: Asia/Tokyo

  - type: schedule
    cron: "0 9 * * *"
    timezone: Asia/Singapore
```

**Important**: All times are interpreted in the specified timezone. For example, "0 9 * * *" with timezone "America/New_York" executes at 9 AM Eastern Time every day.

### Overlap Prevention

Use `max_instances` to prevent overlapping executions:

```yaml
triggers:
  # Only one instance can run at a time
  - type: schedule
    cron: "*/5 * * * *"
    max_instances: 1  # If previous execution still running, skip

  # Allow up to 3 concurrent instances
  - type: schedule
    cron: "* * * * *"
    max_instances: 3  # Execute even if previous still running
```

**Behavior**:
- When an execution is due and `running_instances < max_instances`, the flow executes
- When `running_instances >= max_instances`, the execution is skipped with a warning
- The next execution time is always calculated, even if skipped

### Schedule Metadata Injection

Schedule triggers automatically inject metadata into flow inputs via the `_schedule` key:

```python
{
  '_schedule': {
    'trigger_id': 'hourly-report',
    'cron': '0 * * * *',
    'scheduled_time': '2025-10-14T12:00:00+00:00',  # When it was scheduled
    'execution_time': '2025-10-14T12:00:01+00:00',  # When it actually ran
    'timezone': 'UTC'
  }
}
```

### Accessing Schedule Metadata in Tasks

Tasks can access schedule information through inputs:

```python
@registry.register('GenerateReport', description='Generate scheduled report')
async def generate_report(trigger_info: dict = None):
    """
    Generate a report with schedule metadata.

    Args:
        trigger_info: Schedule metadata from ${inputs._schedule}
    """
    report_id = str(uuid.uuid4())

    # Extract schedule info if available
    if trigger_info:
        scheduled_time = trigger_info.get('scheduled_time')
        cron = trigger_info.get('cron')
        timezone = trigger_info.get('timezone')

        logger.info(f"Report {report_id} scheduled at {scheduled_time} ({cron})")

    # Generate report...
    return {'report_id': report_id, 'data': {...}}
```

**Flow YAML:**
```yaml
steps:
  - task: GenerateReport
    id: generate
    inputs:
      trigger_info: ${inputs._schedule}  # Pass schedule metadata
    outputs:
      - report_id
      - data
```

### Multiple Schedule Triggers

A flow can have multiple schedule triggers with different schedules:

```yaml
flow: MultiScheduleFlow
description: Flow with multiple schedules

triggers:
  # Quick check every minute
  - type: schedule
    id: quick_check
    cron: "* * * * *"
    timezone: UTC
    enabled: true

  # Hourly summary
  - type: schedule
    id: hourly_summary
    cron: "0 * * * *"
    timezone: UTC
    enabled: true

  # Daily report
  - type: schedule
    id: daily_report
    cron: "0 9 * * *"
    timezone: America/New_York
    enabled: true

  # Weekly cleanup (disabled by default)
  - type: schedule
    id: weekly_cleanup
    cron: "0 0 * * 0"
    timezone: UTC
    enabled: false
```

Each trigger executes the same flow independently with its own schedule metadata.

### Enabling/Disabling Triggers

Use the `enabled` flag to control trigger activation:

```yaml
triggers:
  # Active trigger
  - type: schedule
    id: active_schedule
    cron: "0 * * * *"
    enabled: true

  # Disabled trigger (configured but not running)
  - type: schedule
    id: disabled_schedule
    cron: "*/5 * * * *"
    enabled: false
```

**Use cases for disabled triggers**:
- Temporarily disable during maintenance
- Keep configuration for seasonal schedules
- Enable/disable via environment-based configuration

### Schedule Trigger Lifecycle

1. **Server Start**:
   - Schedule triggers are created from flow.yaml
   - Cron expression is validated
   - Timezone is validated
   - Next execution time is calculated
   - Background scheduler task starts

2. **Running**:
   - Scheduler loop checks execution time every second
   - When current time >= next execution time:
     - Checks if `running_instances < max_instances`
     - Executes flow in background if allowed
     - Calculates next execution time
     - Skips with warning if max instances reached

3. **Server Stop**:
   - Scheduler task is cancelled
   - Running executions continue (no forced termination)
   - Trigger stops accepting new executions

### Monitoring Schedule Triggers

#### Get Trigger Status

```bash
GET /flows/{flow_name}/triggers
```

**Response:**
```json
{
  "flow": "ScheduledReportFlow",
  "triggers": [
    {
      "id": "hourly-report",
      "type": "schedule",
      "running": true,
      "executions": 24,
      "errors": 0,
      "last_execution_time": 1.23,
      "cron": "0 * * * *",
      "timezone": "UTC",
      "next_execution": "2025-10-14T13:00:00+00:00",
      "last_scheduled": "2025-10-14T12:00:00+00:00",
      "max_instances": 1,
      "running_instances": 0
    }
  ],
  "count": 1
}
```

#### Get Specific Trigger

```bash
GET /flows/{flow_name}/triggers/{trigger_id}
```

**Response:**
```json
{
  "id": "hourly-report",
  "flow": "ScheduledReportFlow",
  "type": "schedule",
  "running": true,
  "executions": 24,
  "errors": 0,
  "last_execution_time": 1.23,
  "last_error": null,
  "cron": "0 * * * *",
  "timezone": "UTC",
  "next_execution": "2025-10-14T13:00:00+00:00",
  "last_scheduled": "2025-10-14T12:00:00+00:00",
  "max_instances": 1,
  "running_instances": 0
}
```

### Schedule Examples

#### Example 1: Hourly Report Generation

```yaml
flow: HourlyReportFlow
description: Generate reports every hour

triggers:
  - type: schedule
    id: hourly_report
    cron: "0 * * * *"
    timezone: UTC
    max_instances: 1

inputs: []

steps:
  - task: GetCurrentTime
    id: get_time
    outputs:
      - timestamp

  - task: GenerateReport
    id: generate
    inputs:
      timestamp: ${get_time.timestamp}
      schedule_info: ${inputs._schedule}
    outputs:
      - report_id

  - task: SaveReport
    id: save
    inputs:
      report_id: ${generate.report_id}

outputs:
  - name: report_id
    value: ${generate.report_id}
```

#### Example 2: Weekday Business Hours Monitoring

```yaml
flow: BusinessHoursMonitoring
description: Monitor systems during business hours

triggers:
  - type: schedule
    id: business_hours_check
    cron: "*/15 9-17 * * 1-5"  # Every 15 min, 9 AM-5 PM, Mon-Fri
    timezone: America/New_York
    max_instances: 1

inputs: []

steps:
  - task: CheckSystemHealth
    id: health
    outputs:
      - status
      - metrics

  - if: ${health.status} != "healthy"
    then:
      - task: SendAlert
        id: alert
        inputs:
          status: ${health.status}
          metrics: ${health.metrics}

outputs:
  - name: status
    value: ${health.status}
```

#### Example 3: Daily Cleanup with Retry

```yaml
flow: DailyCleanupFlow
description: Clean up old data daily

triggers:
  - type: schedule
    id: daily_cleanup
    cron: "0 2 * * *"  # 2 AM daily
    timezone: UTC
    max_instances: 1

inputs: []

steps:
  - task: IdentifyOldData
    id: identify
    outputs:
      - record_ids

  - task: DeleteRecords
    id: delete
    inputs:
      record_ids: ${identify.record_ids}
    retry:
      max_attempts: 3
      backoff_multiplier: 2
    on_error:
      - task: LogCleanupFailure
        inputs:
          error: ${context.last_error}
      - task: SendAdminAlert
        inputs:
          message: "Daily cleanup failed"

outputs:
  - name: deleted_count
    value: ${delete.count}
```

#### Example 4: Multiple Schedules for Same Flow

```yaml
flow: DataSyncFlow
description: Sync data at different intervals

triggers:
  # Quick sync every 5 minutes
  - type: schedule
    id: quick_sync
    cron: "*/5 * * * *"
    timezone: UTC
    max_instances: 2

  # Full sync every hour
  - type: schedule
    id: full_sync
    cron: "0 * * * *"
    timezone: UTC
    max_instances: 1

inputs:
  - name: sync_type
    type: string
    required: false

steps:
  # Determine sync type from trigger or default
  - task: DetermineSync Type
    id: sync_config
    inputs:
      trigger_id: ${inputs._schedule.trigger_id}
    outputs:
      - sync_type

  - task: SyncData
    id: sync
    inputs:
      sync_type: ${sync_config.sync_type}
    outputs:
      - records_synced

outputs:
  - name: records_synced
    value: ${sync.records_synced}
```

### Hot Reload Support

Schedule triggers support hot reload:
- Changes to trigger configuration in flow.yaml automatically reload
- Triggers are stopped, recreated with new config, and restarted
- Next execution time is recalculated based on new cron expression
- No server restart required

**Example workflow:**
1. Edit flow.yaml to change cron expression
2. Save file (hot reload detects change)
3. Server logs show trigger reload
4. New schedule takes effect immediately

### Server Logs

Schedule triggers emit structured logs:

```
INFO - Schedule trigger hourly-report started: 0 * * * * (timezone: UTC, next: 2025-10-14T13:00:00+00:00)
INFO - Schedule trigger hourly-report executing flow ScheduledReportFlow (scheduled: 2025-10-14T13:00:00+00:00)
INFO - Trigger hourly-report flow executed successfully in 1.23s
WARNING - Schedule trigger hourly-report skipping execution: max instances (1) reached
```

### Best Practices for Schedule Triggers

#### 1. Timezone Management

- **Use explicit timezones**: Always specify timezone, don't rely on defaults
- **Consider DST**: Be aware of daylight saving time transitions
- **UTC for simplicity**: Use UTC for schedules that don't need local time awareness
- **Local time for business**: Use local timezones (e.g., America/New_York) for business-hour schedules

```yaml
# Good: Explicit timezone
triggers:
  - type: schedule
    cron: "0 9 * * 1-5"
    timezone: America/New_York  # Explicit

# Avoid: Relying on default
triggers:
  - type: schedule
    cron: "0 9 * * 1-5"
    # timezone defaults to UTC, may not be what you want
```

#### 2. Overlap Prevention

- **Use max_instances: 1 for long-running flows**: Prevent resource exhaustion
- **Monitor running_instances**: Check trigger status to detect long executions
- **Add timeouts**: Implement task-level timeouts for safety

```yaml
triggers:
  - type: schedule
    cron: "*/5 * * * *"
    max_instances: 1  # Prevent overlap

steps:
  - task: LongRunningTask
    timeout: 240  # 4 minute timeout (less than 5 min schedule interval)
```

#### 3. Error Handling

- **Add retry logic**: Handle transient failures
- **Implement on_error handlers**: Log and alert on failures
- **Monitor error counts**: Check trigger status for error metrics

```yaml
steps:
  - task: ScheduledTask
    retry:
      max_attempts: 3
      backoff_multiplier: 2
    on_error:
      - task: LogError
        inputs:
          error: ${context.last_error}
          schedule_info: ${inputs._schedule}
```

#### 4. Testing

- **Test with short intervals**: Use `* * * * *` (every minute) during development
- **Verify timezone behavior**: Test around DST transitions if using local timezones
- **Check overlap handling**: Test with max_instances and artificially slow tasks
- **Monitor logs**: Watch server logs to confirm execution times

```yaml
# Development: Test every minute
triggers:
  - type: schedule
    cron: "* * * * *"
    timezone: UTC
    enabled: true

# Production: Once it works, change to desired schedule
# triggers:
#   - type: schedule
#     cron: "0 9 * * *"
#     timezone: America/New_York
#     enabled: true
```

#### 5. Documentation

- Document schedule purpose and frequency
- Note timezone and business context
- Explain overlap prevention strategy
- Provide examples of schedule metadata usage

## Best Practices

### 1. Security

- **Always use authentication** for production webhooks
- **Use environment variables** for secrets, never hardcode
- **Validate inputs** in your task implementations
- **Use HTTPS** in production (configure reverse proxy)
- **Implement rate limiting** at the reverse proxy level

### 2. Error Handling

- Add `on_error` handlers to your flows
- Use `retry` configuration for transient failures
- Log errors with context for debugging
- Return meaningful error messages

```yaml
steps:
  - task: ProcessWebhook
    id: process
    inputs:
      data: ${inputs.data}
    retry:
      max_attempts: 3
      backoff_multiplier: 2
    on_error:
      - task: LogError
        inputs:
          error: ${context.last_error}
      - task: SendAlert
        inputs:
          message: "Webhook processing failed"
```

### 3. Performance

- Use **async execution** for long-running flows
- Implement **timeout handling** in tasks
- Monitor **execution metrics** via API
- Consider **message queues** for high throughput

### 4. Testing

- Test webhooks with curl or Postman
- Use the `/docs` endpoint for interactive testing
- Write unit tests for trigger configurations
- Test authentication and error scenarios

```bash
# Test authenticated webhook
curl -X POST http://localhost:8000/webhooks/test \
  -H "X-API-Key: test-key" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}' \
  -v

# Test async webhook (returns 202)
curl -X POST http://localhost:8000/webhooks/async \
  -H "Content-Type: application/json" \
  -d '{"data": "test"}' \
  -i

# Check trigger status
curl http://localhost:8000/flows/MyFlow/triggers
```

### 5. Documentation

- Document webhook endpoints in your README
- Specify required headers and body format
- Provide example requests
- Document expected responses

## Future Trigger Types

### Queue Triggers (Planned)

Execute flows from message queues:

```yaml
triggers:
  - type: queue
    provider: rabbitmq
    queue: flow-events
    connection: ${RABBITMQ_URL}
```

## Troubleshooting

### Common Issues

#### 1. Trigger Not Starting

**Symptom**: Webhook endpoint returns 404

**Solutions**:
- Check flow.yaml syntax is valid
- Verify `triggers:` section is present
- Check server logs for trigger creation errors
- Ensure path doesn't conflict with other endpoints

#### 2. Authentication Failures

**Symptom**: 401 Unauthorized responses

**Solutions**:
- Verify header name matches configuration
- Check API key/token value is correct
- Ensure no extra whitespace in keys
- Verify environment variables are loaded

#### 3. Input Mapping Issues

**Symptom**: Flow receives empty or incorrect inputs

**Solutions**:
- Verify `input_mapping` matches request format
- Check Content-Type header for body mapping
- Ensure query parameters are URL-encoded
- Use `input_mapping: all` to debug

#### 4. Async Execution Not Working

**Symptom**: Webhook blocks despite async: true

**Solutions**:
- Verify FastAPI BackgroundTasks is working
- Check for synchronous code in tasks
- Ensure all tasks are properly async
- Review server configuration

#### 5. Schedule Trigger Not Executing

**Symptom**: Scheduled flow never executes

**Solutions**:
- Verify `enabled: true` in trigger configuration
- Check cron expression is valid (test with online cron validator)
- Verify timezone is correct (check server timezone vs. configured timezone)
- Check trigger status endpoint to see next execution time
- Review server logs for schedule trigger startup messages
- Ensure server time is synchronized (NTP)

#### 6. Schedule Trigger Executing at Wrong Time

**Symptom**: Flow executes at unexpected times

**Solutions**:
- Verify timezone configuration matches intent
- Check for daylight saving time transitions
- Validate cron expression with online tools
- Compare server time with expected timezone
- Review next_execution time from trigger status

#### 7. Schedule Trigger Skipping Executions

**Symptom**: Warning about "max instances reached"

**Solutions**:
- Check if previous execution is still running (long-running flow)
- Increase `max_instances` if concurrent execution is safe
- Add task-level timeouts to prevent hung executions
- Reduce execution frequency (increase cron interval)
- Monitor `running_instances` in trigger status

### Debug Mode

Enable detailed logging:

```python
import logging
logging.getLogger('flowlang.triggers').setLevel(logging.DEBUG)
```

### Getting Help

- Check logs in server output
- Use `/docs` endpoint for API testing
- Review example flows:
  - Webhook: `flows/examples/webhook_example/`
  - Schedule: `flows/examples/schedule_example/`
- Run unit tests: `pytest tests/test_triggers.py -v`
- Check trigger status via REST API: `GET /flows/{name}/triggers`

## Conclusion

Triggers enable powerful event-driven and time-based workflows in FlowLang:

- **Webhook triggers** for event-driven flows (HTTP requests, webhooks, API endpoints)
- **Schedule triggers** for time-based automation (cron schedules, periodic tasks)

Start with simple triggers and gradually add:
- Authentication for security
- Multiple triggers for different use cases
- Input mapping for flexible data extraction
- Error handling and retry logic
- Monitoring and alerting

For more information:
- See `CLAUDE.md` for development guidelines
- Check example flows:
  - `flows/examples/webhook_example/` - Webhook trigger with auth
  - `flows/examples/schedule_example/` - Schedule trigger with multiple schedules
- Review `tests/test_triggers.py` for trigger usage patterns
- Explore FastAPI documentation for advanced webhook patterns
- Check cron expression resources for schedule trigger patterns
