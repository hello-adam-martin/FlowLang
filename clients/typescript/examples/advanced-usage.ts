/**
 * FlowLang TypeScript Client - Advanced Usage Examples
 *
 * Advanced patterns and integration examples
 */

import { FlowLangClient, FlowExecutionError, type FlowExecutionResult } from '../src';

// Example 1: Integration with Express.js
async function example1_expressIntegration() {
  console.log('\n=== Example 1: Express.js Integration ===');

  // Example Express route handler
  const flowClient = new FlowLangClient({
    baseUrl: 'http://localhost:8000',
  });

  async function processOrderHandler(req: any, res: any) {
    try {
      const result = await flowClient.executeFlow('ProcessOrder', {
        order_id: req.body.order_id,
        user_id: req.body.user_id,
      });

      res.json({
        success: true,
        data: result.outputs,
      });
    } catch (error) {
      if (error instanceof FlowExecutionError) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  console.log('Express integration example ready');
}

// Example 2: Parallel flow execution
async function example2_parallelExecution() {
  console.log('\n=== Example 2: Parallel Flow Execution ===');

  const client = new FlowLangClient({
    baseUrl: 'http://localhost:8000',
  });

  try {
    // Execute multiple flows in parallel
    const results = await Promise.all([
      client.executeFlow('Flow1', { input: 'a' }),
      client.executeFlow('Flow2', { input: 'b' }),
      client.executeFlow('Flow3', { input: 'c' }),
    ]);

    console.log('All flows completed:');
    results.forEach((result, i) => {
      console.log(`  Flow ${i + 1}: ${result.success ? '✅' : '❌'}`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Example 3: Streaming with progress tracking
async function example3_streamingWithProgress() {
  console.log('\n=== Example 3: Streaming with Progress Tracking ===');

  const client = new FlowLangClient({
    baseUrl: 'http://localhost:8000',
  });

  let totalSteps = 0;
  let completedSteps = 0;

  try {
    const result = await client.executeFlowStream(
      'HelloWorld',
      { user_name: 'Eve' },
      {
        onEvent: (eventType, data) => {
          if (eventType === 'step_started') {
            totalSteps++;
          } else if (eventType === 'step_completed') {
            completedSteps++;
            const progress = (completedSteps / totalSteps) * 100;
            console.log(`Progress: ${progress.toFixed(0)}% (${completedSteps}/${totalSteps})`);
          }
        },
      }
    );

    console.log('✅ Completed:', result.outputs);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Example 4: Retry with custom backoff
async function example4_customRetry() {
  console.log('\n=== Example 4: Custom Retry Strategy ===');

  const client = new FlowLangClient({
    baseUrl: 'http://localhost:8000',
    retryAttempts: 10,        // Many retries
    retryDelay: 500,          // Start with 500ms
    retryBackoff: 1.5,        // Gradual backoff
  });

  try {
    const result = await client.executeFlow('HelloWorld', {
      user_name: 'Frank',
    });
    console.log('✅ Success after retries');
  } catch (error) {
    console.error('❌ Failed after all retries');
  }
}

// Example 5: Batch processing with error handling
async function example5_batchProcessing() {
  console.log('\n=== Example 5: Batch Processing ===');

  const client = new FlowLangClient({
    baseUrl: 'http://localhost:8000',
  });

  const users = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
  const results: Array<{ user: string; success: boolean; error?: string }> = [];

  for (const user of users) {
    try {
      await client.executeFlow('HelloWorld', { user_name: user });
      results.push({ user, success: true });
      console.log(`✅ Processed: ${user}`);
    } catch (error) {
      results.push({
        user,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.log(`❌ Failed: ${user}`);
    }
  }

  const successful = results.filter((r) => r.success).length;
  console.log(`\nBatch complete: ${successful}/${users.length} successful`);
}

// Example 6: Conditional execution based on health
async function example6_conditionalExecution() {
  console.log('\n=== Example 6: Conditional Execution ===');

  const client = new FlowLangClient({
    baseUrl: 'http://localhost:8000',
  });

  try {
    // Check health first
    const health = await client.healthCheck();

    if (!health.ready) {
      console.log('⚠️  Server not ready, skipping execution');
      console.log(`   Progress: ${health.tasksImplemented}/${health.tasksTotal}`);
      return;
    }

    // Server is ready, proceed with execution
    const result = await client.executeFlow('HelloWorld', {
      user_name: 'Grace',
    });
    console.log('✅ Execution completed:', result.outputs);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Example 7: Caching flow results
class CachedFlowClient {
  private client: FlowLangClient;
  private cache: Map<string, FlowExecutionResult>;

  constructor(baseUrl: string) {
    this.client = new FlowLangClient({ baseUrl });
    this.cache = new Map();
  }

  private getCacheKey(flowName: string, inputs: Record<string, any>): string {
    return `${flowName}:${JSON.stringify(inputs)}`;
  }

  async executeFlow<T = Record<string, any>>(
    flowName: string,
    inputs?: Record<string, any>
  ): Promise<FlowExecutionResult<T>> {
    const key = this.getCacheKey(flowName, inputs || {});

    // Check cache
    if (this.cache.has(key)) {
      console.log('📦 Cache hit!');
      return this.cache.get(key) as FlowExecutionResult<T>;
    }

    // Execute and cache
    console.log('🔄 Cache miss, executing...');
    const result = await this.client.executeFlow<T>(flowName, inputs);
    this.cache.set(key, result);
    return result;
  }
}

async function example7_caching() {
  console.log('\n=== Example 7: Caching Results ===');

  const client = new CachedFlowClient('http://localhost:8000');

  try {
    // First call - cache miss
    await client.executeFlow('HelloWorld', { user_name: 'Henry' });

    // Second call with same inputs - cache hit
    await client.executeFlow('HelloWorld', { user_name: 'Henry' });

    // Different inputs - cache miss
    await client.executeFlow('HelloWorld', { user_name: 'Iris' });
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Example 8: React integration (pseudo-code)
function example8_reactIntegration() {
  console.log('\n=== Example 8: React Integration (Pseudo-code) ===');

  // Example React hook for flow execution
  const useFlowExecution = (flowName: string) => {
    // In a real React app:
    // const [loading, setLoading] = useState(false);
    // const [result, setResult] = useState(null);
    // const [error, setError] = useState(null);

    const client = new FlowLangClient({
      baseUrl: 'http://localhost:8000',
    });

    const executeFlow = async (inputs: Record<string, any>) => {
      try {
        // setLoading(true);
        const result = await client.executeFlow(flowName, inputs);
        // setResult(result);
        return result;
      } catch (err) {
        // setError(err);
        throw err;
      } finally {
        // setLoading(false);
      }
    };

    return { executeFlow };
  };

  console.log('React integration pattern shown');
}

// Run all examples
async function main() {
  console.log('=' .repeat(60));
  console.log('FlowLang TypeScript Client - Advanced Examples');
  console.log('=' .repeat(60));

  try {
    await example1_expressIntegration();
    await example2_parallelExecution();
    await example3_streamingWithProgress();
    await example4_customRetry();
    await example5_batchProcessing();
    await example6_conditionalExecution();
    await example7_caching();
    example8_reactIntegration();
  } catch (error) {
    console.error('\n❌ Error running examples:', error);
  }
}

if (require.main === module) {
  main();
}
