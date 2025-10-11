"""
Cancellation endpoint code to be added to FlowServer._register_routes()

Add this after the visualize endpoint:
"""

# Add this endpoint in FlowServer._register_routes() method:

"""
        @self.app.post(
            "/flows/{flow_name}/executions/{execution_id}/cancel",
            tags=["Execution"],
            responses={
                200: {"description": "Execution cancelled successfully"},
                404: {"description": "Execution not found"},
            }
        )
        async def cancel_execution(flow_name: str, execution_id: str):
            '''
            Cancel a running flow execution.

            Returns success if the execution was cancelled, or error if not found.
            '''
            if flow_name != self.flow_name:
                raise HTTPException(status_code=404, detail=f"Flow not found: {flow_name}")

            # Find the execution
            if execution_id not in self.executions:
                raise HTTPException(
                    status_code=404,
                    detail=f"Execution not found: {execution_id}"
                )

            handle = self.executions[execution_id]

            # Check if already completed
            if handle.status != "running":
                return {
                    "success": False,
                    "message": f"Execution already {handle.status}",
                    "execution_id": execution_id,
                    "status": handle.status
                }

            # Cancel the execution
            await handle.cancel("Cancelled by user request")

            return {
                "success": True,
                "message": "Execution cancellation requested",
                "execution_id": execution_id,
                "flow": flow_name
            }

        @self.app.get(
            "/flows/{flow_name}/executions",
            tags=["Execution"],
            responses={
                200: {"description": "List of executions"},
                404: {"description": "Flow not found"},
            }
        )
        async def list_executions(flow_name: str):
            '''
            List all executions for a flow (running and completed).

            Shows status, start time, and other execution metadata.
            '''
            if flow_name != self.flow_name:
                raise HTTPException(status_code=404, detail=f"Flow not found: {flow_name}")

            executions_list = [handle.to_dict() for handle in self.executions.values()]

            return {
                "flow": flow_name,
                "executions": executions_list,
                "count": len(executions_list)
            }

        @self.app.get(
            "/flows/{flow_name}/executions/{execution_id}",
            tags=["Execution"],
            responses={
                200: {"description": "Execution details"},
                404: {"description": "Execution not found"},
            }
        )
        async def get_execution_status(flow_name: str, execution_id: str):
            '''
            Get status and details of a specific execution.

            Returns execution metadata including status, timing, and results.
            '''
            if flow_name != self.flow_name:
                raise HTTPException(status_code=404, detail=f"Flow not found: {flow_name}")

            if execution_id not in self.executions:
                raise HTTPException(
                    status_code=404,
                    detail=f"Execution not found: {execution_id}"
                )

            handle = self.executions[execution_id]
            return handle.to_dict()
"""

# ALSO UPDATE: In execute_flow endpoint, add after line "start_time = time.time()":
"""
            # Create cancellation token and execution handle
            execution_id = str(uuid.uuid4())
            cancellation_token = CancellationToken()
            handle = ExecutionHandle(execution_id, flow_name, cancellation_token)
            self.executions[execution_id] = handle
"""

# AND UPDATE: Pass cancellation_token to executor.execute_flow():
"""
                result = await self.executor.execute_flow(
                    self.flow_yaml,
                    inputs=inputs_dict,
                    cancellation_token=cancellation_token  # ADD THIS
                )
"""

# AND UPDATE: Mark handle status based on result
"""
                # After getting result, mark status:
                if result['success']:
                    handle.mark_completed(result)
                elif result.get('cancelled'):
                    handle.mark_cancelled()
                else:
                    handle.mark_failed(result.get('error', 'Unknown error'))
"""

# AND ADD: Mark failed in exception handlers:
"""
            except NotImplementedTaskError as e:
                handle.mark_failed(str(e))  # ADD THIS
                ...
            except FlowLangError as e:
                handle.mark_failed(str(e))  # ADD THIS
                ...
            except Exception as e:
                handle.mark_failed(str(e))  # ADD THIS
                ...
"""
