"""
Arq worker settings and background task definitions.

Tasks are enqueued from the API routes and executed by the worker process.
"""
from arq import cron
from arq.connections import RedisSettings


class WorkerSettings:
    """Arq worker configuration."""
    functions = []  # Will be populated with task functions
    redis_settings = RedisSettings(host="redis", port=6379)
    max_jobs = 10
    job_timeout = 300  # 5 minutes max per job
    
    # TODO: Add cron jobs for cleanup, timeout enforcement
    # cron_jobs = [
    #     cron(cleanup_stale_runs, minute={0, 15, 30, 45}),
    #     cron(timeout_approvals, minute={5, 20, 35, 50}),
    # ]


async def execute_run(ctx: dict, run_id: str):
    """
    Background task: execute a workflow run.
    
    This is enqueued when POST /workflows/{id}/run is called.
    It:
    1. Loads the workflow graph definition
    2. Compiles it via the engine
    3. Executes step by step, writing run_steps
    4. Streams events over WebSocket
    5. Enforces cost ceiling and iteration limits
    6. Handles approval pauses and resumptions
    """
    # TODO: Implement full execution flow
    # from app.engine.compiler import compile_workflow
    # from app.database import async_session
    # from app.models import Run, Workflow
    # from app.engine.websocket_manager import ConnectionManager
    #
    # async with async_session() as db:
    #     run = await db.get(Run, run_id)
    #     workflow = await db.get(Workflow, run.workflow_id)
    #     compiled = compile_workflow(workflow.graph_definition)
    #     
    #     # Execute with state management
    #     state = {"messages": [], "total_tokens": 0, "total_cost_usd": 0.0}
    #     # ... step-by-step execution loop
    pass


async def cleanup_stale_runs(ctx: dict):
    """Periodic task: kill runs that have been stuck for too long."""
    # TODO: Find runs with status='running' started > 30 minutes ago
    # Mark them as 'killed' with reason 'timeout'
    pass


async def timeout_approvals(ctx: dict):
    """Periodic task: time out approvals that haven't been resolved."""
    # TODO: Find approvals with status='pending' created > 24 hours ago
    # Mark them as 'timed_out' and fail the associated run
    pass
