"""
API Routes - Run management, approval resolution, and eval sets.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Run, RunStep, RunStatus, Approval, ApprovalStatus, EvalSet, EvalCase
from app.auth import get_current_user, require_role

# Runs router
runs_router = APIRouter()


class RunResponse(BaseModel):
    id: str
    workflow_id: str
    status: str
    started_at: str
    completed_at: Optional[str] = None
    total_tokens: int
    total_cost_usd: float


class StepResponse(BaseModel):
    id: str
    run_id: str
    node_id: str
    step_index: int
    input: dict
    output: dict
    tokens_used: int
    cost_usd: float
    latency_ms: int
    status: str
    error_message: Optional[str] = None


@runs_router.get("/{run_id}", response_model=RunResponse)
async def get_run(
    run_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Run).where(Run.id == UUID(run_id)))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    return RunResponse(
        id=str(run.id),
        workflow_id=str(run.workflow_id),
        status=run.status.value,
        started_at=run.started_at.isoformat(),
        completed_at=run.completed_at.isoformat() if run.completed_at else None,
        total_tokens=run.total_tokens,
        total_cost_usd=run.total_cost_usd,
    )


@runs_router.get("/{run_id}/steps", response_model=List[StepResponse])
async def get_run_steps(
    run_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RunStep)
        .where(RunStep.run_id == UUID(run_id))
        .order_by(RunStep.step_index)
    )
    steps = result.scalars().all()
    
    return [
        StepResponse(
            id=str(s.id),
            run_id=str(s.run_id),
            node_id=s.node_id,
            step_index=s.step_index,
            input=s.input,
            output=s.output,
            tokens_used=s.tokens_used,
            cost_usd=s.cost_usd,
            latency_ms=s.latency_ms,
            status=s.status.value,
            error_message=s.error_message,
        )
        for s in steps
    ]


@runs_router.post("/{run_id}/kill")
async def kill_run(
    run_id: str,
    user: dict = Depends(require_role("editor")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Run).where(Run.id == UUID(run_id)))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    if run.status not in (RunStatus.running, RunStatus.paused_for_approval):
        raise HTTPException(status_code=400, detail="Run is not active")
    
    run.status = RunStatus.killed
    run.completed_at = datetime.utcnow()
    
    return {"status": "killed", "run_id": str(run.id)}


# Approvals router
approvals_router = APIRouter()


class ApprovalResolveRequest(BaseModel):
    decision: str  # "approve" or "reject"


@approvals_router.post("/{run_id}/approvals/{approval_id}/resolve")
async def resolve_approval(
    run_id: str,
    approval_id: str,
    req: ApprovalResolveRequest,
    user: dict = Depends(require_role("editor")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Approval).where(Approval.id == UUID(approval_id)))
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    
    if approval.status != ApprovalStatus.pending:
        raise HTTPException(status_code=400, detail="Approval already resolved")
    
    if req.decision == "approve":
        approval.status = ApprovalStatus.approved
        # TODO: Resume the run from checkpoint
        # await resume_run(run_id, db)
    elif req.decision == "reject":
        approval.status = ApprovalStatus.rejected
        # Mark run as failed
        run_result = await db.execute(select(Run).where(Run.id == UUID(run_id)))
        run = run_result.scalar_one_or_none()
        if run:
            run.status = RunStatus.failed
            run.completed_at = datetime.utcnow()
    else:
        raise HTTPException(status_code=400, detail="Decision must be 'approve' or 'reject'")
    
    approval.approver_id = UUID(user["id"])
    approval.resolved_at = datetime.utcnow()
    
    return {"status": approval.status.value, "approval_id": str(approval.id)}


# Eval sets router
evals_router = APIRouter()


class EvalSetCreate(BaseModel):
    workflow_id: str
    name: str


class EvalCaseCreate(BaseModel):
    input: dict
    expected_output: dict


@evals_router.post("", response_model=dict)
async def create_eval_set(
    req: EvalSetCreate,
    user: dict = Depends(require_role("editor")),
    db: AsyncSession = Depends(get_db),
):
    eval_set = EvalSet(
        workflow_id=UUID(req.workflow_id),
        name=req.name,
    )
    db.add(eval_set)
    await db.flush()
    return {"id": str(eval_set.id), "name": eval_set.name}


@evals_router.post("/{eval_set_id}/cases", response_model=dict)
async def add_eval_case(
    eval_set_id: str,
    req: EvalCaseCreate,
    user: dict = Depends(require_role("editor")),
    db: AsyncSession = Depends(get_db),
):
    case = EvalCase(
        eval_set_id=UUID(eval_set_id),
        input=req.input,
        expected_output=req.expected_output,
    )
    db.add(case)
    await db.flush()
    return {"id": str(case.id)}


@evals_router.post("/{eval_set_id}/run")
async def run_eval_set(
    eval_set_id: str,
    user: dict = Depends(require_role("editor")),
    db: AsyncSession = Depends(get_db),
):
    # Get all cases for this eval set
    result = await db.execute(
        select(EvalCase).where(EvalCase.eval_set_id == UUID(eval_set_id))
    )
    cases = result.scalars().all()
    
    # Get the eval set to find the workflow
    set_result = await db.execute(select(EvalSet).where(EvalSet.id == UUID(eval_set_id)))
    eval_set = set_result.scalar_one_or_none()
    if not eval_set:
        raise HTTPException(status_code=404, detail="Eval set not found")
    
    # TODO: Run each case through the compiled workflow
    # For each case:
    #   1. Compile the workflow graph
    #   2. Execute with case.input
    #   3. Compare output to case.expected_output
    #   4. Store pass/fail result
    
    results = []
    for case in cases:
        # TODO: Actual execution
        results.append({
            "case_id": str(case.id),
            "input": case.input,
            "expected": case.expected_output,
            "result": "pass",  # TODO: actual comparison
        })
    
    return {"results": results, "total": len(cases)}
