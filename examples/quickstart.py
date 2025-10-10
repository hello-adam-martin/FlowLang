"""
FlowLang Quick Start Example

This example demonstrates basic FlowLang usage with a simple hello world flow.
"""
import asyncio
from pathlib import Path
import sys

# Add src to path for development
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from flowlang import FlowExecutor, TaskRegistry


# Create a task registry
registry = TaskRegistry()


# Register some simple tasks
@registry.register('Greet', description='Greet a user by name')
async def greet(name: str):
    """Greet a user"""
    message = f"Hello, {name}!"
    print(f"  [Greet] {message}")
    return {'greeting': message}


@registry.register('GetExcited', description='Add excitement to a message')
async def get_excited(message: str):
    """Make a message more exciting"""
    excited = message.upper() + '!!! 🎉'
    print(f"  [GetExcited] {excited}")
    return {'excited_message': excited}


@registry.register('SayGoodbye', description='Say goodbye to a user')
async def say_goodbye(name: str):
    """Say goodbye"""
    message = f"Goodbye, {name}! See you next time!"
    print(f"  [SayGoodbye] {message}")
    return {'farewell': message}


# Define a simple flow in YAML
HELLO_WORLD_FLOW = """
flow: HelloWorld
description: A simple greeting flow

inputs:
  - name: user_name
    type: string
    required: true

steps:
  - task: Greet
    id: greet_step
    inputs:
      name: ${inputs.user_name}

  - task: GetExcited
    id: excited_step
    inputs:
      message: ${greet_step.greeting}

  - task: SayGoodbye
    id: goodbye_step
    inputs:
      name: ${inputs.user_name}

outputs:
  - name: final_message
    value: ${excited_step.excited_message}
  - name: farewell
    value: ${goodbye_step.farewell}
"""


# More complex flow with conditionals
CONDITIONAL_FLOW = """
flow: ConditionalGreeting
description: Greet users differently based on their name

inputs:
  - name: user_name
    type: string
    required: true

steps:
  - task: Greet
    id: greet_step
    inputs:
      name: ${inputs.user_name}

  - if: ${inputs.user_name} == Alice
    then:
      - task: GetExcited
        id: special_greeting
        inputs:
          message: ${greet_step.greeting}
    else:
      - task: SayGoodbye
        id: normal_goodbye
        inputs:
          name: ${inputs.user_name}

outputs:
  - name: message
    value: ${greet_step.greeting}
"""


async def run_hello_world():
    """Run the hello world example"""
    print("\n" + "="*60)
    print("Example 1: Hello World Flow")
    print("="*60)

    executor = FlowExecutor(registry)

    result = await executor.execute_flow(
        HELLO_WORLD_FLOW,
        inputs={'user_name': 'Alice'}
    )

    print(f"\nResult: {result}")


async def run_conditional():
    """Run the conditional flow example"""
    print("\n" + "="*60)
    print("Example 2: Conditional Flow (Alice)")
    print("="*60)

    executor = FlowExecutor(registry)

    result = await executor.execute_flow(
        CONDITIONAL_FLOW,
        inputs={'user_name': 'Alice'}
    )

    print(f"\nResult: {result}")

    print("\n" + "="*60)
    print("Example 3: Conditional Flow (Bob)")
    print("="*60)

    result = await executor.execute_flow(
        CONDITIONAL_FLOW,
        inputs={'user_name': 'Bob'}
    )

    print(f"\nResult: {result}")


async def show_task_status():
    """Show the task implementation status"""
    print("\n" + "="*60)
    print("Task Registry Status")
    print("="*60)

    status = registry.get_implementation_status()
    print(f"\nTasks: {status['progress']}")
    print(f"Implemented: {status['implemented']}")
    print(f"Unimplemented: {status['unimplemented_count']}")
    print(f"Progress: {status['percentage']:.1f}%")

    print("\nRegistered Tasks:")
    for name, meta in registry.list_tasks().items():
        status_icon = "✅" if meta['implemented'] else "❌"
        print(f"  {status_icon} {name}: {meta['description']}")


async def main():
    """Run all examples"""
    print("\n🚀 FlowLang Quick Start Examples\n")

    await show_task_status()
    await run_hello_world()
    await run_conditional()

    print("\n" + "="*60)
    print("✨ Quick Start Complete!")
    print("="*60)
    print("\nNext steps:")
    print("  1. Create your own flow YAML file")
    print("  2. Register tasks with @registry.register()")
    print("  3. Run with: executor.execute_flow(your_flow, inputs)")
    print("\n")


if __name__ == '__main__':
    asyncio.run(main())
