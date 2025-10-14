"""
Example tests for HelloWorld flow using FlowTest framework

This demonstrates comprehensive testing patterns for FlowLang flows:
1. Testing with fully mocked tasks
2. Testing with real implementations
3. Testing different execution paths (if/then/else)
4. Testing error scenarios
5. Assertion patterns

Created: 2025-10-14
"""

import pytest
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path for flow module import
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "src"))

from flowlang.testing import FlowTest


class TestHelloWorld(FlowTest):
    """
    Test suite for HelloWorld flow

    This flow demonstrates:
    - Input validation
    - Conditional execution (if/then/else)
    - Multiple output paths
    """

    flow_path = str(Path(__file__).parent.parent / "flow.yaml")
    tasks_file = str(Path(__file__).parent.parent / "flow.py")

    # ========================================================================
    # MOCKED TESTS - Test flow structure without implementations
    # ========================================================================

    @pytest.mark.asyncio
    async def test_valid_user_path_with_mocks(self):
        """
        Test the happy path: valid user receives greeting

        This test mocks all tasks to verify the flow structure
        works correctly for the validation success path.
        """
        await self.setup_method()

        # Mock tasks to simulate valid user
        self.mock_task('ValidateUser', return_value={
            'is_valid': True,
            'validation_message': 'User is valid'
        })
        self.mock_task('GenerateGreeting', return_value={
            'greeting': 'Hello, Alice!',
            'timestamp': '2025-10-14T10:00:00Z'
        })

        # Execute flow with valid user input
        inputs = {'user_name': 'Alice'}
        result = await self.execute_flow(inputs)

        # Verify flow succeeded
        self.assert_success(result)

        # Verify outputs
        self.assert_output_equals(result, 'message', 'Hello, Alice!')
        self.assert_output_equals(result, 'timestamp', '2025-10-14T10:00:00Z')

        # Verify task call order
        self.assert_task_called('ValidateUser', times=1)
        self.assert_task_called('GenerateGreeting', times=1)

        # Verify ValidateUser received correct input
        self.assert_task_called_with('ValidateUser', name='Alice')

    @pytest.mark.asyncio
    async def test_invalid_user_path_with_mocks(self):
        """
        Test the error path: invalid user receives error message

        This verifies the flow correctly handles the else branch
        when validation fails.
        """
        await self.setup_method()

        # Mock tasks to simulate invalid user
        self.mock_task('ValidateUser', return_value={
            'is_valid': False,
            'validation_message': 'Name cannot be empty'
        })
        self.mock_task('GenerateErrorMessage', return_value={
            'error_message': 'Error: Name cannot be empty'
        })

        # Execute flow with invalid user input
        inputs = {'user_name': ''}
        result = await self.execute_flow(inputs)

        # Verify flow succeeded (even though validation failed)
        self.assert_success(result)

        # Verify ValidateUser was called
        self.assert_task_called('ValidateUser', times=1)

        # Verify GenerateErrorMessage was called (else branch)
        self.assert_task_called('GenerateErrorMessage', times=1)

        # Verify GenerateGreeting was NOT called (then branch skipped)
        self.assert_task_not_called('GenerateGreeting')

    @pytest.mark.asyncio
    async def test_validation_failure_with_reason(self):
        """
        Test that validation failure reason is passed to error handler

        This verifies data flows correctly through the else branch.
        """
        await self.setup_method()

        # Mock validation failure with specific reason
        validation_reason = 'Name must be at least 2 characters'
        self.mock_task('ValidateUser', return_value={
            'is_valid': False,
            'validation_message': validation_reason
        })
        self.mock_task('GenerateErrorMessage', return_value={
            'error_message': f'Error: {validation_reason}'
        })

        # Execute flow
        inputs = {'user_name': 'X'}
        result = await self.execute_flow(inputs)

        # Verify success
        self.assert_success(result)

        # Verify GenerateErrorMessage received the validation reason
        self.assert_task_called_with(
            'GenerateErrorMessage',
            reason=validation_reason
        )

    # ========================================================================
    # REAL IMPLEMENTATION TESTS - Once tasks are implemented
    # ========================================================================

    @pytest.mark.skip(reason="Remove skip when ValidateUser is implemented")
    @pytest.mark.asyncio
    async def test_validate_user_real_implementation(self):
        """
        Test ValidateUser with real implementation

        This test should be enabled once ValidateUser is implemented.
        It tests the actual validation logic without mocking.
        """
        await self.setup_method()

        # Mock only the downstream tasks
        self.mock_task('GenerateGreeting', return_value={
            'greeting': 'Hello, Bob!',
            'timestamp': '2025-10-14T10:00:00Z'
        })

        # Test with valid name
        inputs = {'user_name': 'Bob'}
        result = await self.execute_flow(inputs)

        self.assert_success(result)
        self.assert_task_called('GenerateGreeting', times=1)

    @pytest.mark.skip(reason="Remove skip when all tasks are implemented")
    @pytest.mark.asyncio
    async def test_full_flow_with_real_tasks(self):
        """
        Test complete flow with all real implementations

        This is an end-to-end test that exercises the entire flow
        without any mocking. Enable once all tasks are implemented.
        """
        await self.setup_method()

        # Test valid user
        inputs = {'user_name': 'Charlie'}
        result = await self.execute_flow(inputs)

        self.assert_success(result)

        # Verify outputs have expected structure
        self.assert_output_exists(result, 'message')
        self.assert_output_exists(result, 'timestamp')

        # Verify message contains the user's name
        message = result['outputs'].get('message', '')
        assert 'Charlie' in message, f"Expected 'Charlie' in message, got: {message}"

    # ========================================================================
    # ERROR HANDLING TESTS
    # ========================================================================

    @pytest.mark.asyncio
    async def test_validation_task_raises_exception(self):
        """
        Test flow behavior when ValidateUser raises an exception

        This verifies error handling in the flow executor.
        """
        await self.setup_method()

        # Mock ValidateUser to raise an exception
        self.mock_task(
            'ValidateUser',
            raises=ValueError("Database connection failed")
        )

        # Execute flow
        inputs = {'user_name': 'Dave'}
        result = await self.execute_flow(inputs)

        # Verify flow failed
        self.assert_failure(result)

        # Verify error message contains exception info
        self.assert_error_contains(result, 'Database connection failed')

    @pytest.mark.asyncio
    async def test_greeting_task_raises_exception(self):
        """
        Test flow behavior when GenerateGreeting raises an exception

        This tests error handling in the then branch.
        """
        await self.setup_method()

        # Mock ValidateUser to succeed
        self.mock_task('ValidateUser', return_value={
            'is_valid': True,
            'validation_message': 'Valid'
        })

        # Mock GenerateGreeting to fail
        self.mock_task(
            'GenerateGreeting',
            raises=RuntimeError("Template rendering failed")
        )

        # Execute flow
        inputs = {'user_name': 'Eve'}
        result = await self.execute_flow(inputs)

        # Verify flow failed
        self.assert_failure(result)

        # Verify error indicates which task failed
        self.assert_error_contains(result, 'Template rendering failed')

    # ========================================================================
    # SIDE EFFECT TESTS
    # ========================================================================

    @pytest.mark.asyncio
    async def test_validation_with_side_effect(self):
        """
        Test ValidateUser with side effect that modifies behavior

        This demonstrates testing tasks with complex logic
        using side effects (e.g., simulating different validation rules).
        """
        await self.setup_method()

        # Track call count to test multiple calls
        call_count = 0

        def validate_side_effect(name):
            nonlocal call_count
            call_count += 1

            # First call: strict validation
            if call_count == 1:
                if len(name) < 3:
                    return {
                        'is_valid': False,
                        'validation_message': 'Name too short'
                    }

            return {
                'is_valid': True,
                'validation_message': 'OK'
            }

        # Mock with side effect
        self.mock_task('ValidateUser', side_effect=validate_side_effect)
        self.mock_task('GenerateErrorMessage', return_value={
            'error_message': 'Error message'
        })

        # Execute flow with short name
        inputs = {'user_name': 'Al'}
        result = await self.execute_flow(inputs)

        # Verify validation was called
        assert call_count == 1
        self.assert_task_called('GenerateErrorMessage', times=1)

    # ========================================================================
    # INTEGRATION TESTS
    # ========================================================================

    @pytest.mark.asyncio
    async def test_multiple_users_sequentially(self):
        """
        Test flow with multiple different inputs

        This verifies the flow can be executed multiple times
        with different inputs.
        """
        await self.setup_method()

        # Mock tasks
        self.mock_task('ValidateUser', return_value={
            'is_valid': True,
            'validation_message': 'Valid'
        })
        self.mock_task('GenerateGreeting', return_value={
            'greeting': 'Hello!',
            'timestamp': '2025-10-14T10:00:00Z'
        })

        # Test multiple users
        users = ['Alice', 'Bob', 'Charlie']

        for user in users:
            result = await self.execute_flow({'user_name': user})
            self.assert_success(result)

        # Verify each task was called once per user
        self.assert_task_called('ValidateUser', times=len(users))
        self.assert_task_called('GenerateGreeting', times=len(users))

    @pytest.mark.asyncio
    async def test_flow_execution_performance(self):
        """
        Test flow execution completes within reasonable time

        This is useful for performance regression testing.
        """
        await self.setup_method()

        # Mock tasks with instant responses
        self.mock_task('ValidateUser', return_value={
            'is_valid': True,
            'validation_message': 'Valid'
        })
        self.mock_task('GenerateGreeting', return_value={
            'greeting': 'Hello!',
            'timestamp': '2025-10-14T10:00:00Z'
        })

        # Execute flow
        inputs = {'user_name': 'Frank'}
        result = await self.execute_flow(inputs)

        # Verify success
        self.assert_success(result)

        # Verify execution time is reasonable (< 1 second for mocked flow)
        self.assert_execution_time_under(1.0)


# ========================================================================
# STANDALONE TEST FUNCTIONS (optional)
# ========================================================================

@pytest.mark.asyncio
async def test_flow_can_be_instantiated():
    """
    Simple test to verify FlowTest can be instantiated

    This is useful for debugging test infrastructure issues.
    """
    test = TestHelloWorld()
    await test.setup_method()
    assert test.executor is not None
    assert test.registry is not None


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
