"""
FlowLang Scaffolder Demo

This example shows how to use the scaffolder to generate task stubs
from a flow definition (TDD-style workflow development).
"""
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from flowlang import FlowScaffolder


def main():
    """Demonstrate the scaffolder"""
    print("\n" + "="*60)
    print("FlowLang Scaffolder Demo")
    print("="*60)
    print("\nThis demo shows how to scaffold a project from a flow definition.")
    print("We'll use the todo_flow.yaml example.\n")

    # Load the example flow
    flow_file = Path(__file__).parent / 'todo_flow.yaml'
    with open(flow_file) as f:
        flow_yaml = f.read()

    print(f"📄 Loaded flow: {flow_file}\n")

    # Create scaffolder
    scaffolder = FlowScaffolder()

    # Scaffold the project
    output_dir = Path(__file__).parent / 'todo_project'

    print(f"🏗️  Scaffolding project to: {output_dir}\n")

    scaffolder.scaffold(flow_yaml, str(output_dir))

    print("\n" + "="*60)
    print("✨ Demo Complete!")
    print("="*60)
    print(f"\nGenerated files:")
    print(f"  - {output_dir}/flow.yaml")
    print(f"  - {output_dir}/tasks.py")
    print(f"  - {output_dir}/test_tasks.py")
    print(f"  - {output_dir}/README.md")
    print(f"\nTry it out:")
    print(f"  cd {output_dir}")
    print(f"  python tasks.py")
    print()


if __name__ == '__main__':
    main()
