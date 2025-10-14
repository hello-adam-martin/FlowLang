"""
Tests for subflow composition and execution
"""

import pytest
import asyncio
from pathlib import Path
import tempfile
import shutil

from flowlang import FlowExecutor, TaskRegistry, SubflowLoader
from flowlang.exceptions import FlowExecutionError


@pytest.fixture
def temp_flow_dir():
    """Create a temporary directory for test flows"""
    temp_dir = Path(tempfile.mkdtemp())
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest.fixture
def registry():
    """Create a task registry with test tasks"""
    reg = TaskRegistry()

    @reg.register('AddNumbers', description='Add two numbers')
    async def add_numbers(a: int, b: int):
        return {'sum': a + b}

    @reg.register('MultiplyNumbers', description='Multiply two numbers')
    async def multiply_numbers(a: int, b: int):
        return {'product': a * b}

    @reg.register('ValidateUser', description='Validate user data')
    async def validate_user(user_id: str):
        # Simple validation logic
        is_valid = len(user_id) > 0 and user_id.isalnum()
        return {'is_valid': is_valid, 'user_id': user_id}

    @reg.register('ProcessData', description='Process some data')
    async def process_data(data: dict):
        return {'processed': True, 'count': len(data)}

    return reg


@pytest.mark.asyncio
async def test_basic_subflow_execution(temp_flow_dir, registry):
    """Test basic subflow execution"""
    # Create a subflow
    subflow_dir = temp_flow_dir / "calculate"
    subflow_dir.mkdir()

    subflow_yaml = """
flow: Calculate
description: Calculate sum and product

inputs:
  - name: a
    type: integer
    required: true
  - name: b
    type: integer
    required: true

steps:
  - task: AddNumbers
    id: sum
    inputs:
      a: ${inputs.a}
      b: ${inputs.b}
    outputs:
      - sum

  - task: MultiplyNumbers
    id: product
    inputs:
      a: ${inputs.a}
      b: ${inputs.b}
    outputs:
      - product

outputs:
  - name: sum
    value: ${sum.sum}
  - name: product
    value: ${product.product}
"""

    (subflow_dir / "flow.yaml").write_text(subflow_yaml)

    # Create main flow that uses the subflow
    main_flow_yaml = """
flow: MainFlow
description: Main flow using subflow

inputs:
  - name: x
    type: integer
  - name: y
    type: integer

steps:
  - subflow: calculate
    id: calc
    inputs:
      a: ${inputs.x}
      b: ${inputs.y}
    outputs:
      - sum
      - product

outputs:
  - name: result_sum
    value: ${calc.sum}
  - name: result_product
    value: ${calc.product}
"""

    # Execute the main flow
    loader = SubflowLoader(temp_flow_dir)
    executor = FlowExecutor(registry, loader)

    result = await executor.execute_flow(main_flow_yaml, inputs={'x': 5, 'y': 3})

    assert result['success'] is True
    assert result['outputs']['result_sum'] == 8
    assert result['outputs']['result_product'] == 15


@pytest.mark.asyncio
async def test_nested_subflows(temp_flow_dir, registry):
    """Test nested subflow execution (subflow calling another subflow)"""
    # Create Level 2 subflow
    level2_dir = temp_flow_dir / "add"
    level2_dir.mkdir()

    level2_yaml = """
flow: Add
description: Simple addition

inputs:
  - name: a
    type: integer
  - name: b
    type: integer

steps:
  - task: AddNumbers
    id: sum
    inputs:
      a: ${inputs.a}
      b: ${inputs.b}
    outputs:
      - sum

outputs:
  - name: result
    value: ${sum.sum}
"""

    (level2_dir / "flow.yaml").write_text(level2_yaml)

    # Create Level 1 subflow that uses Level 2
    level1_dir = temp_flow_dir / "calculate"
    level1_dir.mkdir()

    level1_yaml = """
flow: Calculate
description: Calculate using subflows

inputs:
  - name: x
    type: integer
  - name: y
    type: integer
  - name: z
    type: integer

steps:
  - subflow: add
    id: step1
    inputs:
      a: ${inputs.x}
      b: ${inputs.y}
    outputs:
      - result

  - subflow: add
    id: step2
    inputs:
      a: ${step1.result}
      b: ${inputs.z}
    outputs:
      - result

outputs:
  - name: final_sum
    value: ${step2.result}
"""

    (level1_dir / "flow.yaml").write_text(level1_yaml)

    # Create main flow
    main_yaml = """
flow: MainFlow

inputs:
  - name: a
    type: integer
  - name: b
    type: integer
  - name: c
    type: integer

steps:
  - subflow: calculate
    id: calc
    inputs:
      x: ${inputs.a}
      y: ${inputs.b}
      z: ${inputs.c}
    outputs:
      - final_sum

outputs:
  - name: total
    value: ${calc.final_sum}
"""

    loader = SubflowLoader(temp_flow_dir)
    executor = FlowExecutor(registry, loader)

    result = await executor.execute_flow(main_yaml, inputs={'a': 1, 'b': 2, 'c': 3})

    assert result['success'] is True
    assert result['outputs']['total'] == 6  # 1 + 2 + 3


@pytest.mark.asyncio
async def test_circular_dependency_detection(temp_flow_dir, registry):
    """Test that circular dependencies are detected"""
    # Create flow A that calls flow B
    flow_a_dir = temp_flow_dir / "flow_a"
    flow_a_dir.mkdir()

    flow_a_yaml = """
flow: FlowA

inputs:
  - name: value
    type: integer

steps:
  - subflow: flow_b
    id: call_b
    inputs:
      value: ${inputs.value}

outputs:
  - name: result
    value: ${call_b.result}
"""

    (flow_a_dir / "flow.yaml").write_text(flow_a_yaml)

    # Create flow B that calls flow A (circular!)
    flow_b_dir = temp_flow_dir / "flow_b"
    flow_b_dir.mkdir()

    flow_b_yaml = """
flow: FlowB

inputs:
  - name: value
    type: integer

steps:
  - subflow: flow_a
    id: call_a
    inputs:
      value: ${inputs.value}

outputs:
  - name: result
    value: ${call_a.result}
"""

    (flow_b_dir / "flow.yaml").write_text(flow_b_yaml)

    # Try to execute - should detect circular dependency
    loader = SubflowLoader(temp_flow_dir)
    executor = FlowExecutor(registry, loader)

    result = await executor.execute_flow(flow_a_yaml, inputs={'value': 5})

    # Should fail with error message containing "Circular"
    assert result['success'] is False
    assert "circular" in result['error'].lower()


@pytest.mark.asyncio
async def test_subflow_error_propagation(temp_flow_dir, registry):
    """Test that errors in subflows propagate correctly"""
    # Create a subflow that will fail
    subflow_dir = temp_flow_dir / "failing_flow"
    subflow_dir.mkdir()

    subflow_yaml = """
flow: FailingFlow

inputs:
  - name: value
    type: string

steps:
  - task: NonExistentTask
    id: fail
    inputs:
      data: ${inputs.value}

outputs:
  - name: result
    value: ${fail.output}
"""

    (subflow_dir / "flow.yaml").write_text(subflow_yaml)

    # Create main flow
    main_yaml = """
flow: MainFlow

inputs:
  - name: input_value
    type: string

steps:
  - subflow: failing_flow
    id: sub
    inputs:
      value: ${inputs.input_value}

outputs:
  - name: result
    value: ${sub.result}
"""

    loader = SubflowLoader(temp_flow_dir)
    executor = FlowExecutor(registry, loader)

    result = await executor.execute_flow(main_yaml, inputs={'input_value': 'test'})

    # Should fail
    assert result['success'] is False
    assert 'error' in result


@pytest.mark.asyncio
async def test_subflow_with_conditionals(temp_flow_dir, registry):
    """Test subflow execution with conditional logic in parent"""
    # Create validation subflow
    validate_dir = temp_flow_dir / "validate"
    validate_dir.mkdir()

    validate_yaml = """
flow: Validate

inputs:
  - name: user_id
    type: string

steps:
  - task: ValidateUser
    id: check
    inputs:
      user_id: ${inputs.user_id}
    outputs:
      - is_valid
      - user_id

outputs:
  - name: is_valid
    value: ${check.is_valid}
  - name: user_id
    value: ${check.user_id}
"""

    (validate_dir / "flow.yaml").write_text(validate_yaml)

    # Main flow with conditional
    main_yaml = """
flow: MainFlow

inputs:
  - name: user_id
    type: string

steps:
  - subflow: validate
    id: validation
    inputs:
      user_id: ${inputs.user_id}
    outputs:
      - is_valid
      - user_id

  - if: ${validation.is_valid} == true
    then:
      - task: ProcessData
        id: process
        inputs:
          data:
            user: ${validation.user_id}
    else:
      - task: ProcessData
        id: reject
        inputs:
          data:
            error: "invalid"

outputs:
  - name: is_valid
    value: ${validation.is_valid}
"""

    loader = SubflowLoader(temp_flow_dir)
    executor = FlowExecutor(registry, loader)

    # Test with valid user_id
    result = await executor.execute_flow(main_yaml, inputs={'user_id': 'user123'})
    assert result['success'] is True
    assert result['outputs']['is_valid'] is True

    # Test with invalid user_id
    result2 = await executor.execute_flow(main_yaml, inputs={'user_id': ''})
    assert result2['success'] is True
    assert result2['outputs']['is_valid'] is False


@pytest.mark.asyncio
async def test_subflow_discovery_methods(temp_flow_dir, registry):
    """Test different subflow discovery methods"""
    # Method 1: Subdirectory with flow.yaml
    method1_dir = temp_flow_dir / "method1"
    method1_dir.mkdir()
    (method1_dir / "flow.yaml").write_text("""
flow: Method1
inputs: []
steps: []
outputs: []
""")

    # Method 2: Direct YAML file
    (temp_flow_dir / "method2.yaml").write_text("""
flow: Method2
inputs: []
steps: []
outputs: []
""")

    loader = SubflowLoader(temp_flow_dir)

    # Both should be discoverable
    subflows = loader.list_available_subflows()
    assert 'method1' in subflows
    assert 'method2' in subflows


@pytest.mark.asyncio
async def test_subflow_not_found(temp_flow_dir, registry):
    """Test error when subflow is not found"""
    main_yaml = """
flow: MainFlow

inputs: []

steps:
  - subflow: nonexistent_flow
    id: sub

outputs: []
"""

    loader = SubflowLoader(temp_flow_dir)
    executor = FlowExecutor(registry, loader)

    result = await executor.execute_flow(main_yaml, inputs={})

    assert result['success'] is False
    assert "not found" in result['error'].lower()


@pytest.mark.asyncio
async def test_subflow_without_loader(registry):
    """Test that subflow without loader raises appropriate error"""
    flow_yaml = """
flow: MainFlow

steps:
  - subflow: some_flow
    id: sub

outputs: []
"""

    # Create executor WITHOUT subflow loader
    executor = FlowExecutor(registry)

    result = await executor.execute_flow(flow_yaml, inputs={})

    assert result['success'] is False
    assert "no subflow loader" in result['error'].lower()
