"""
FlowLang Python Client SDK - Usage Examples

This file demonstrates how to use the FlowLang Python Client SDK to call flows.
"""

import asyncio
from flowlang import FlowLangClient, FlowNotReadyError, FlowExecutionError


# Example 1: Basic async usage with context manager
async def example_async_basic():
    """Execute a flow asynchronously"""
    print("\n=== Example 1: Basic Async Usage ===")

    async with FlowLangClient("http://localhost:8000") as client:
        try:
            result = await client.execute_flow(
                "HelloWorld",
                {"user_name": "Alice"}
            )
            print(f"✅ Success! Output: {result.outputs}")
            print(f"⏱️  Execution time: {result.execution_time_ms:.2f}ms")
        except FlowExecutionError as e:
            print(f"❌ Flow execution failed: {e}")
        except FlowNotReadyError as e:
            print(f"⚠️  Flow not ready: {e}")
            print(f"   Pending tasks: {e.pending_tasks}")


# Example 2: Sync usage (for non-async code)
def example_sync():
    """Execute a flow synchronously"""
    print("\n=== Example 2: Sync Usage ===")

    with FlowLangClient("http://localhost:8000") as client:
        try:
            result = client.execute_flow_sync(
                "HelloWorld",
                {"user_name": "Bob"}
            )
            print(f"✅ Success! Output: {result.outputs}")
        except FlowExecutionError as e:
            print(f"❌ Flow execution failed: {e}")


# Example 3: Streaming execution with events
async def example_streaming():
    """Execute a flow with streaming events"""
    print("\n=== Example 3: Streaming Execution ===")

    def handle_event(event_type: str, data: dict):
        """Handle streaming events"""
        if event_type == 'flow_started':
            print(f"▶️  Flow started: {data.get('flow')}")
        elif event_type == 'step_started':
            print(f"   ⏩ Step started: {data.get('step_id')} ({data.get('task')})")
        elif event_type == 'step_completed':
            duration = data.get('duration_ms', 0)
            print(f"   ✅ Step completed: {data.get('step_id')} ({duration:.1f}ms)")
        elif event_type == 'step_failed':
            print(f"   ❌ Step failed: {data.get('step_id')} - {data.get('error')}")
        elif event_type == 'flow_completed':
            print(f"🎉 Flow completed!")

    async with FlowLangClient("http://localhost:8000") as client:
        try:
            result = await client.execute_flow_stream(
                "HelloWorld",
                {"user_name": "Charlie"},
                on_event=handle_event
            )
            print(f"Final output: {result.outputs}")
        except FlowExecutionError as e:
            print(f"❌ Flow execution failed: {e}")


# Example 4: List flows and get flow info
async def example_list_flows():
    """List available flows and get info"""
    print("\n=== Example 4: List Flows ===")

    async with FlowLangClient("http://localhost:8000") as client:
        # List all flows
        flows = await client.list_flows()
        print(f"Available flows ({len(flows)}):")
        for flow in flows:
            print(f"  - {flow.name}: {flow.description or 'No description'}")

        if flows:
            # Get detailed info for first flow
            flow_info = await client.get_flow_info(flows[0].name)
            print(f"\nFlow details: {flow_info.name}")
            print(f"  Inputs: {[inp['name'] for inp in flow_info.inputs]}")
            print(f"  Outputs: {[out['name'] for out in flow_info.outputs]}")


# Example 5: Health check
async def example_health_check():
    """Check server health"""
    print("\n=== Example 5: Health Check ===")

    async with FlowLangClient("http://localhost:8000") as client:
        health = await client.health_check()
        print(f"Server status: {health.get('status')}")
        print(f"Ready: {health.get('ready')}")

        if not health.get('ready'):
            pending = health.get('tasks_pending', 0)
            total = health.get('tasks_total', 0)
            print(f"⚠️  {pending}/{total} tasks not yet implemented")


# Example 6: Custom retry configuration
async def example_custom_retry():
    """Use custom retry configuration"""
    print("\n=== Example 6: Custom Retry Configuration ===")

    # Create client with custom retry settings
    client = FlowLangClient(
        "http://localhost:8000",
        retry_attempts=5,           # Try 5 times
        retry_delay=2.0,            # Start with 2 second delay
        retry_backoff=3.0,          # Triple delay on each retry
        timeout=60.0,               # 60 second timeout
        headers={"X-Custom": "value"}  # Custom headers
    )

    try:
        result = await client.execute_flow("HelloWorld", {"user_name": "Dave"})
        print(f"✅ Success: {result.outputs}")
    except FlowExecutionError as e:
        print(f"❌ Failed after retries: {e}")
    finally:
        await client.close_async()


# Example 7: Error handling
async def example_error_handling():
    """Demonstrate comprehensive error handling"""
    print("\n=== Example 7: Error Handling ===")

    async with FlowLangClient("http://localhost:8000") as client:
        try:
            # Try to execute a flow that doesn't exist
            result = await client.execute_flow("NonExistentFlow", {})
        except FlowNotReadyError as e:
            print(f"⚠️  Flow not ready: {e.progress}")
            print(f"   Pending tasks: {', '.join(e.pending_tasks)}")
        except FlowExecutionError as e:
            print(f"❌ Execution error: {e}")
            if e.error_details:
                print(f"   Details: {e.error_details}")
        except Exception as e:
            print(f"❌ Unexpected error: {e}")


# Example 8: Real-world TodoManager flow
async def example_todo_manager():
    """Real-world example: TodoManager flow"""
    print("\n=== Example 8: TodoManager Flow ===")

    async with FlowLangClient("http://localhost:8000") as client:
        try:
            # Create a new todo
            result = await client.execute_flow(
                "TodoManager",
                {
                    "action": "create",
                    "title": "Write Python client docs",
                    "description": "Document the FlowLang Python client SDK"
                }
            )

            todo_id = result.outputs.get("todo_id")
            print(f"✅ Created todo: {todo_id}")

            # Mark it as complete
            result = await client.execute_flow(
                "TodoManager",
                {
                    "action": "complete",
                    "todo_id": todo_id
                }
            )
            print(f"✅ Marked todo as complete: {result.outputs.get('status')}")

        except FlowExecutionError as e:
            print(f"❌ Error: {e}")


# Run all examples
async def main():
    """Run all examples"""
    print("=" * 60)
    print("FlowLang Python Client SDK - Examples")
    print("=" * 60)
    print("\nMake sure you have a FlowLang server running:")
    print("  cd flows/hello_world")
    print("  ./tools/start_server.sh")
    print()

    try:
        await example_async_basic()
        example_sync()  # Note: not awaited (it's sync)
        await example_streaming()
        await example_list_flows()
        await example_health_check()
        await example_custom_retry()
        await example_error_handling()
        # await example_todo_manager()  # Uncomment if you have TodoManager flow
    except Exception as e:
        print(f"\n❌ Error running examples: {e}")
        print("\nMake sure the FlowLang server is running on http://localhost:8000")


if __name__ == "__main__":
    asyncio.run(main())
