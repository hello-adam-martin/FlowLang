/**
 * FlowLang TypeScript Client - Basic Usage Examples
 *
 * Run these examples against a running FlowLang server:
 * cd flows/HelloWorld
 * ./tools/start_server.sh
 */

import { FlowLangClient, FlowExecutionError, FlowNotReadyError } from '../src';

// Example 1: Basic flow execution
async function example1_basic() {
  console.log('\n=== Example 1: Basic Flow Execution ===');

  const client = new FlowLangClient({
    baseUrl: 'http://localhost:8000',
  });

  try {
    const result = await client.executeFlow('HelloWorld', {
      user_name: 'Alice',
    });

    console.log('✅ Success!');
    console.log('Outputs:', result.outputs);
    console.log(`⏱️  Execution time: ${result.executionTimeMs}ms`);
  } catch (error) {
    if (error instanceof FlowExecutionError) {
      console.error('❌ Flow execution failed:', error.message);
    } else {
      console.error('❌ Error:', error);
    }
  }
}

// Example 2: Streaming execution with events
async function example2_streaming() {
  console.log('\n=== Example 2: Streaming Execution ===');

  const client = new FlowLangClient({
    baseUrl: 'http://localhost:8000',
  });

  try {
    const result = await client.executeFlowStream(
      'HelloWorld',
      { user_name: 'Bob' },
      {
        onEvent: (eventType, data) => {
          if (eventType === 'flow_started') {
            console.log(`▶️  Flow started: ${data.flow}`);
          } else if (eventType === 'step_started') {
            console.log(`   ⏩ Step started: ${data.step_id} (${data.task})`);
          } else if (eventType === 'step_completed') {
            const duration = data.duration_ms || 0;
            console.log(`   ✅ Step completed: ${data.step_id} (${duration.toFixed(1)}ms)`);
          } else if (eventType === 'step_failed') {
            console.log(`   ❌ Step failed: ${data.step_id} - ${data.error}`);
          } else if (eventType === 'flow_completed') {
            console.log('🎉 Flow completed!');
          }
        },
      }
    );

    console.log('Final output:', result.outputs);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Example 3: List flows and get info
async function example3_listFlows() {
  console.log('\n=== Example 3: List Flows ===');

  const client = new FlowLangClient({
    baseUrl: 'http://localhost:8000',
  });

  try {
    // List all flows
    const flows = await client.listFlows();
    console.log(`Available flows (${flows.length}):`);
    for (const flow of flows) {
      console.log(`  - ${flow.name}: ${flow.description || 'No description'}`);
    }

    if (flows.length > 0) {
      // Get detailed info for first flow
      const flowInfo = await client.getFlowInfo(flows[0].name);
      console.log(`\nFlow details: ${flowInfo.name}`);
      console.log(`  Inputs: ${flowInfo.inputs.map((i) => i.name).join(', ')}`);
      console.log(`  Outputs: ${flowInfo.outputs.map((o) => o.name).join(', ')}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Example 4: Health check
async function example4_healthCheck() {
  console.log('\n=== Example 4: Health Check ===');

  const client = new FlowLangClient({
    baseUrl: 'http://localhost:8000',
  });

  try {
    const health = await client.healthCheck();
    console.log(`Server status: ${health.status}`);
    console.log(`Ready: ${health.ready}`);

    if (!health.ready) {
      const pending = health.tasksPending || 0;
      const total = health.tasksTotal || 0;
      console.log(`⚠️  ${pending}/${total} tasks not yet implemented`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Example 5: Custom configuration
async function example5_customConfig() {
  console.log('\n=== Example 5: Custom Configuration ===');

  const client = new FlowLangClient({
    baseUrl: 'http://localhost:8000',
    timeout: 60000,           // 60 second timeout
    retryAttempts: 5,         // 5 retry attempts
    retryDelay: 2000,         // 2 second initial delay
    retryBackoff: 3.0,        // 3x backoff multiplier
    headers: {
      'X-Custom-Header': 'value',
    },
  });

  try {
    const result = await client.executeFlow('HelloWorld', {
      user_name: 'Charlie',
    });
    console.log('✅ Success:', result.outputs);
  } catch (error) {
    console.error('❌ Failed after retries:', error);
  }
}

// Example 6: Error handling
async function example6_errorHandling() {
  console.log('\n=== Example 6: Error Handling ===');

  const client = new FlowLangClient({
    baseUrl: 'http://localhost:8000',
  });

  try {
    // Try to execute a flow that doesn't exist
    await client.executeFlow('NonExistentFlow', {});
  } catch (error) {
    if (error instanceof FlowNotReadyError) {
      console.log(`⚠️  Flow not ready: ${error.progress}`);
      console.log(`   Pending tasks: ${error.pendingTasks.join(', ')}`);
    } else if (error instanceof FlowExecutionError) {
      console.log(`❌ Execution error: ${error.message}`);
      if (error.errorDetails) {
        console.log(`   Details: ${error.errorDetails}`);
      }
    } else {
      console.log(`❌ Unexpected error: ${error}`);
    }
  }
}

// Example 7: Type-safe execution with generics
async function example7_typeS

afe() {
  console.log('\n=== Example 7: Type-Safe Execution ===');

  // Define the expected output type
  interface HelloWorldOutput {
    message: string;
  }

  const client = new FlowLangClient({
    baseUrl: 'http://localhost:8000',
  });

  try {
    const result = await client.executeFlow<HelloWorldOutput>(
      'HelloWorld',
      { user_name: 'Diana' }
    );

    // TypeScript knows that result.outputs has a 'message' property!
    console.log('✅ Success!');
    console.log('Message:', result.outputs?.message); // Autocomplete works!
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run all examples
async function main() {
  console.log('=' .repeat(60));
  console.log('FlowLang TypeScript Client - Examples');
  console.log('=' .repeat(60));
  console.log('\nMake sure you have a FlowLang server running:');
  console.log('  cd flows/HelloWorld');
  console.log('  ./tools/start_server.sh');
  console.log();

  try {
    await example1_basic();
    await example2_streaming();
    await example3_listFlows();
    await example4_healthCheck();
    await example5_customConfig();
    await example6_errorHandling();
    await example7_typeSafe();
  } catch (error) {
    console.error('\n❌ Error running examples:', error);
    console.error('\nMake sure the FlowLang server is running on http://localhost:8000');
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}
