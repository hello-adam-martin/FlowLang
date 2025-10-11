# @flowlang/client

TypeScript/JavaScript client for FlowLang workflow orchestration.

## Installation

```bash
npm install @flowlang/client
```

## Requirements

- Node.js 18+ (for native fetch API)
- or any modern browser

## Quick Start

### TypeScript

```typescript
import { FlowLangClient } from '@flowlang/client';

const client = new FlowLangClient({
  baseUrl: 'http://localhost:8000',
});

// Execute a flow
const result = await client.executeFlow('HelloWorld', {
  user_name: 'Alice',
});

console.log(result.outputs);
```

### JavaScript (CommonJS)

```javascript
const { FlowLangClient } = require('@flowlang/client');

const client = new FlowLangClient({
  baseUrl: 'http://localhost:8000',
});

// Execute a flow
const result = await client.executeFlow('HelloWorld', {
  user_name: 'Alice',
});

console.log(result.outputs);
```

### Browser (ES Modules)

```html
<script type="module">
  import { FlowLangClient } from 'https://unpkg.com/@flowlang/client';

  const client = new FlowLangClient({
    baseUrl: 'http://localhost:8000',
  });

  const result = await client.executeFlow('HelloWorld', {
    user_name: 'Alice',
  });

  console.log(result.outputs);
</script>
```

## Features

- **Full TypeScript Support** - Complete type definitions with generics
- **Promise-based API** - Modern async/await syntax
- **Automatic Retry** - Exponential backoff for failed requests
- **Streaming Events** - Real-time Server-Sent Events support
- **Error Handling** - Rich error classes for different failure modes
- **Browser & Node.js** - Works in both environments
- **Zero Dependencies** - Uses native fetch API
- **Tree-shakeable** - Minimal bundle size

## API Reference

### FlowLangClient

#### Constructor

```typescript
new FlowLangClient(config: ClientConfig)
```

**Config Options:**
- `baseUrl` (required): Base URL of the FlowLang API server
- `timeout` (optional): Request timeout in milliseconds (default: 30000)
- `retryAttempts` (optional): Number of retry attempts (default: 3)
- `retryDelay` (optional): Initial retry delay in milliseconds (default: 1000)
- `retryBackoff` (optional): Backoff multiplier (default: 2.0)
- `headers` (optional): Custom headers for requests

#### Methods

##### executeFlow()

Execute a flow and return the result.

```typescript
async executeFlow<T = Record<string, any>>(
  flowName: string,
  inputs?: Record<string, any>,
  options?: ExecuteOptions
): Promise<FlowExecutionResult<T>>
```

**Example:**
```typescript
const result = await client.executeFlow<{ message: string }>(
  'HelloWorld',
  { user_name: 'Alice' }
);

console.log(result.outputs.message); // Type-safe!
```

##### executeFlowStream()

Execute a flow with real-time streaming events.

```typescript
async executeFlowStream<T = Record<string, any>>(
  flowName: string,
  inputs?: Record<string, any>,
  options?: StreamOptions
): Promise<FlowExecutionResult<T>>
```

**Example:**
```typescript
const result = await client.executeFlowStream(
  'HelloWorld',
  { user_name: 'Alice' },
  {
    onEvent: (eventType, data) => {
      if (eventType === 'step_completed') {
        console.log(`Completed step: ${data.step_id}`);
      }
    },
  }
);
```

##### listFlows()

List all available flows.

```typescript
async listFlows(): Promise<FlowInfo[]>
```

##### getFlowInfo()

Get information about a specific flow.

```typescript
async getFlowInfo(flowName: string): Promise<FlowInfo>
```

##### healthCheck()

Check API server health and readiness.

```typescript
async healthCheck(): Promise<HealthCheckResponse>
```

## Error Handling

The client provides specific error classes for different failure modes:

### FlowExecutionError

Thrown when a flow execution fails.

```typescript
try {
  await client.executeFlow('MyFlow', { input: 'value' });
} catch (error) {
  if (error instanceof FlowExecutionError) {
    console.error('Flow failed:', error.message);
    console.error('Details:', error.errorDetails);
    console.error('Flow:', error.flow);
  }
}
```

### FlowNotReadyError

Thrown when a flow has unimplemented tasks.

```typescript
try {
  await client.executeFlow('MyFlow', {});
} catch (error) {
  if (error instanceof FlowNotReadyError) {
    console.log('Not ready:', error.progress);
    console.log('Pending tasks:', error.pendingTasks);
  }
}
```

### FlowNotFoundError

Thrown when a flow doesn't exist.

```typescript
try {
  await client.executeFlow('NonExistent', {});
} catch (error) {
  if (error instanceof FlowNotFoundError) {
    console.log('Flow not found:', error.flowName);
  }
}
```

## Streaming Events

When using `executeFlowStream()`, you'll receive these event types:

- `flow_started` - Flow execution started
- `step_started` - Task step started
- `step_completed` - Task step completed successfully
- `step_failed` - Task step failed
- `flow_completed` - Flow completed successfully
- `flow_failed` - Flow failed with error

**Example:**
```typescript
await client.executeFlowStream('MyFlow', { input: 'value' }, {
  onEvent: async (eventType, data) => {
    switch (eventType) {
      case 'flow_started':
        console.log('Flow started:', data.flow);
        break;
      case 'step_completed':
        console.log(`Step ${data.step_id} completed in ${data.duration_ms}ms`);
        break;
      case 'flow_completed':
        console.log('Flow completed!', data.outputs);
        break;
    }
  },
});
```

## Integration Examples

### Express.js

```typescript
import express from 'express';
import { FlowLangClient } from '@flowlang/client';

const app = express();
const flowClient = new FlowLangClient({ baseUrl: 'http://localhost:8000' });

app.post('/api/process', async (req, res) => {
  try {
    const result = await flowClient.executeFlow('ProcessData', req.body);
    res.json(result.outputs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

### React

```typescript
import { useState } from 'react';
import { FlowLangClient, FlowExecutionResult } from '@flowlang/client';

const client = new FlowLangClient({ baseUrl: 'http://localhost:8000' });

function MyComponent() {
  const [result, setResult] = useState<FlowExecutionResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExecute = async () => {
    setLoading(true);
    try {
      const result = await client.executeFlow('HelloWorld', {
        user_name: 'Alice',
      });
      setResult(result);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleExecute} disabled={loading}>
        Execute Flow
      </button>
      {result && <pre>{JSON.stringify(result.outputs, null, 2)}</pre>}
    </div>
  );
}
```

### Next.js API Route

```typescript
import { FlowLangClient } from '@flowlang/client';
import type { NextApiRequest, NextApiResponse } from 'next';

const client = new FlowLangClient({ baseUrl: 'http://localhost:8000' });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await client.executeFlow('MyFlow', req.body);
    res.status(200).json(result.outputs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

## Advanced Configuration

### Custom Retry Strategy

```typescript
const client = new FlowLangClient({
  baseUrl: 'http://localhost:8000',
  retryAttempts: 5,          // Try 5 times
  retryDelay: 2000,          // Start with 2 second delay
  retryBackoff: 3.0,         // Triple delay each time
  timeout: 60000,            // 60 second timeout
});
```

### Custom Headers (Authentication)

```typescript
const client = new FlowLangClient({
  baseUrl: 'http://api.example.com',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'X-API-Key': 'YOUR_API_KEY',
  },
});
```

## Examples

See the `examples/` directory for complete working examples:

- `basic-usage.ts` - Basic flow execution patterns
- `advanced-usage.ts` - Advanced patterns and integrations

## Documentation

For complete documentation, see [docs/README.md](docs/README.md).

## TypeScript Support

This package includes full TypeScript definitions. For best type safety, use generics:

```typescript
interface MyFlowOutput {
  result: string;
  count: number;
}

const result = await client.executeFlow<MyFlowOutput>('MyFlow', { input: 'test' });

// TypeScript knows the shape of result.outputs!
console.log(result.outputs.result); // ✅ Type-safe
console.log(result.outputs.count);  // ✅ Type-safe
```

## Browser Support

- Chrome/Edge 90+
- Firefox 90+
- Safari 15.4+
- Or any browser with native `fetch` and `ReadableStream` support

## License

MIT

## Contributing

See the main [FlowLang repository](https://github.com/hello-adam-martin/FlowLang) for contributing guidelines.
