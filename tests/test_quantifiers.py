"""
Quick test to verify quantifier conditionals work correctly
"""
import asyncio
from src.flowlang import FlowExecutor, TaskRegistry

def create_test_registry():
    """Create registry with test tasks"""
    registry = TaskRegistry()

    @registry.register('SetValues', implemented=True)
    async def set_values(a, b, c):
        return {'a': a, 'b': b, 'c': c}

    @registry.register('AllTrue', implemented=True)
    async def all_true():
        return {'result': 'ALL conditions were true'}

    @registry.register('AnyTrue', implemented=True)
    async def any_true():
        return {'result': 'ANY condition was true'}

    @registry.register('NoneTrue', implemented=True)
    async def none_true():
        return {'result': 'NONE of the conditions were true'}

    @registry.register('NestedTrue', implemented=True)
    async def nested_true():
        return {'result': 'Nested quantifier condition was true'}

    return registry


# Test 1: ALL quantifier - all must be true
test_all_flow = """
flow: TestAll
description: Test ALL quantifier

inputs:
  - name: a
    type: number
  - name: b
    type: number
  - name: c
    type: number

steps:
  - task: SetValues
    id: values
    inputs:
      a: ${inputs.a}
      b: ${inputs.b}
      c: ${inputs.c}
    outputs:
      - a
      - b
      - c

  - if:
      all:
        - ${values.a} > 0
        - ${values.b} > 0
        - ${values.c} > 0
    then:
      - task: AllTrue
        id: result

outputs:
  - name: message
    value: ${result.result}
"""

# Test 2: ANY quantifier - at least one must be true
test_any_flow = """
flow: TestAny
description: Test ANY quantifier

inputs:
  - name: a
    type: number
  - name: b
    type: number
  - name: c
    type: number

steps:
  - task: SetValues
    id: values
    inputs:
      a: ${inputs.a}
      b: ${inputs.b}
      c: ${inputs.c}
    outputs:
      - a
      - b
      - c

  - if:
      any:
        - ${values.a} > 10
        - ${values.b} > 10
        - ${values.c} > 10
    then:
      - task: AnyTrue
        id: result

outputs:
  - name: message
    value: ${result.result}
"""

# Test 3: NONE quantifier - none must be true
test_none_flow = """
flow: TestNone
description: Test NONE quantifier

inputs:
  - name: a
    type: number
  - name: b
    type: number
  - name: c
    type: number

steps:
  - task: SetValues
    id: values
    inputs:
      a: ${inputs.a}
      b: ${inputs.b}
      c: ${inputs.c}
    outputs:
      - a
      - b
      - c

  - if:
      none:
        - ${values.a} < 0
        - ${values.b} < 0
        - ${values.c} < 0
    then:
      - task: NoneTrue
        id: result

outputs:
  - name: message
    value: ${result.result}
"""

# Test 4: Nested quantifiers
test_nested_flow = """
flow: TestNested
description: Test nested quantifiers

inputs:
  - name: a
    type: number
  - name: b
    type: number
  - name: c
    type: number

steps:
  - task: SetValues
    id: values
    inputs:
      a: ${inputs.a}
      b: ${inputs.b}
      c: ${inputs.c}
    outputs:
      - a
      - b
      - c

  - if:
      all:
        - ${values.a} > 0
        - any:
            - ${values.b} > 5
            - ${values.c} > 5
    then:
      - task: NestedTrue
        id: result

outputs:
  - name: message
    value: ${result.result}
"""


async def run_tests():
    """Run all quantifier tests"""
    registry = create_test_registry()
    executor = FlowExecutor(registry)

    print("=" * 60)
    print("Testing Quantified Conditionals")
    print("=" * 60)

    # Test 1: ALL - should pass (all > 0)
    print("\n1. Testing ALL quantifier (all values > 0)...")
    result = await executor.execute_flow(test_all_flow, {'a': 1, 'b': 2, 'c': 3})
    print(f"   Input: a=1, b=2, c=3")
    print(f"   Result: {result['outputs']['message']}")
    assert result['success'] and result['outputs']['message'] == 'ALL conditions were true'
    print("   ✅ PASS")

    # Test 2: ANY - should pass (c > 10)
    print("\n2. Testing ANY quantifier (at least one value > 10)...")
    result = await executor.execute_flow(test_any_flow, {'a': 1, 'b': 2, 'c': 15})
    print(f"   Input: a=1, b=2, c=15")
    print(f"   Result: {result['outputs']['message']}")
    assert result['success'] and result['outputs']['message'] == 'ANY condition was true'
    print("   ✅ PASS")

    # Test 3: NONE - should pass (none < 0)
    print("\n3. Testing NONE quantifier (no values < 0)...")
    result = await executor.execute_flow(test_none_flow, {'a': 1, 'b': 2, 'c': 3})
    print(f"   Input: a=1, b=2, c=3")
    print(f"   Result: {result['outputs']['message']}")
    assert result['success'] and result['outputs']['message'] == 'NONE of the conditions were true'
    print("   ✅ PASS")

    # Test 4: Nested - should pass (a > 0 AND (b > 5 OR c > 5))
    print("\n4. Testing nested quantifiers (a > 0 AND (b > 5 OR c > 5))...")
    result = await executor.execute_flow(test_nested_flow, {'a': 1, 'b': 2, 'c': 10})
    print(f"   Input: a=1, b=2, c=10")
    print(f"   Result: {result['outputs']['message']}")
    assert result['success'] and result['outputs']['message'] == 'Nested quantifier condition was true'
    print("   ✅ PASS")

    # Test 5: ALL - should fail (not all > 0)
    print("\n5. Testing ALL quantifier failure (not all values > 0)...")
    result = await executor.execute_flow(test_all_flow, {'a': -1, 'b': 2, 'c': 3})
    print(f"   Input: a=-1, b=2, c=3")
    # The flow will fail because output references ${result.result} which doesn't exist
    # This is expected - the condition was false, so 'result' step never executed
    if not result['success']:
        print(f"   Result: Flow failed (correctly) because output references non-existent variable")
        print(f"   Error: {result.get('error', 'Unknown')}")
        print("   ✅ PASS (correctly evaluated ALL as false and skipped 'then' branch)")
    else:
        print(f"   ⚠️  Unexpected success: {result}")
        raise AssertionError("Expected flow to fail when conditional step is skipped")

    print("\n" + "=" * 60)
    print("All tests passed! ✅")
    print("=" * 60)
    print("\nQuantifier feature is working correctly:")
    print("  - ANY: At least one condition must be true")
    print("  - ALL: All conditions must be true")
    print("  - NONE: No conditions should be true")
    print("  - Nested: Quantifiers can be combined")
    print("=" * 60)


if __name__ == '__main__':
    asyncio.run(run_tests())
