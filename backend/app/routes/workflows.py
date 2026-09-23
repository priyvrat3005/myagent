"""
API Routes - Workflow CRUD and execution.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID, uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Workflow, WorkflowVersion, WorkflowStatus, Run, RunStatus
from app.auth import get_current_user, require_role
from app.engine.compiler import compile_workflow, validate_graph

router = APIRouter()


class WorkflowCreate(BaseModel):
    name: str
    graph_definition: dict = {"nodes": [], "edges": []}


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    graph_definition: Optional[dict] = None


class WorkflowResponse(BaseModel):
    id: str
    org_id: str
    name: str
    graph_definition: dict
    status: str
    current_version_id: Optional[str] = None


@router.get("", response_model=List[WorkflowResponse])
async def list_workflows(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Workflow).where(Workflow.org_id == UUID(user["org_id"]))
    )
    workflows = result.scalars().all()
    return [
        WorkflowResponse(
            id=str(w.id),
            org_id=str(w.org_id),
            name=w.name,
            graph_definition=w.graph_definition,
            status=w.status.value,
            current_version_id=str(w.current_version_id) if w.current_version_id else None,
        )
        for w in workflows
    ]


@router.post("", response_model=WorkflowResponse)
async def create_workflow(
    req: WorkflowCreate,
    user: dict = Depends(require_role("editor")),
    db: AsyncSession = Depends(get_db),
):
    workflow = Workflow(
        org_id=UUID(user["org_id"]),
        name=req.name,
        graph_definition=req.graph_definition,
        status=WorkflowStatus.draft,
    )
    db.add(workflow)
    await db.flush()
    
    return WorkflowResponse(
        id=str(workflow.id),
        org_id=str(workflow.org_id),
        name=workflow.name,
        graph_definition=workflow.graph_definition,
        status=workflow.status.value,
    )


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Workflow).where(Workflow.id == UUID(workflow_id)))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    return WorkflowResponse(
        id=str(workflow.id),
        org_id=str(workflow.org_id),
        name=workflow.name,
        graph_definition=workflow.graph_definition,
        status=workflow.status.value,
        current_version_id=str(workflow.current_version_id) if workflow.current_version_id else None,
    )


@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: str,
    req: WorkflowUpdate,
    user: dict = Depends(require_role("editor")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Workflow).where(Workflow.id == UUID(workflow_id)))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    if req.name:
        workflow.name = req.name
    if req.graph_definition:
        workflow.graph_definition = req.graph_definition
    
    return WorkflowResponse(
        id=str(workflow.id),
        org_id=str(workflow.org_id),
        name=workflow.name,
        graph_definition=workflow.graph_definition,
        status=workflow.status.value,
    )


@router.post("/{workflow_id}/publish")
async def publish_workflow(
    workflow_id: str,
    user: dict = Depends(require_role("editor")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Workflow).where(Workflow.id == UUID(workflow_id)))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Validate graph before publishing
    validation = validate_graph(workflow.graph_definition)
    if not validation.valid:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot publish: {'; '.join(validation.errors)}",
        )
    
    # Create a new version (never mutate published version in place)
    version = WorkflowVersion(
        workflow_id=workflow.id,
        version_number=(len(workflow.versions) + 1) if hasattr(workflow, 'versions') else 1,
        graph_definition=workflow.graph_definition,
        created_by=UUID(user["id"]),
    )
    db.add(version)
    await db.flush()
    
    workflow.status = WorkflowStatus.published
    workflow.current_version_id = version.id
    
    return {"status": "published", "version_id": str(version.id), "warnings": validation.warnings}


@router.post("/{workflow_id}/run")
async def run_workflow(
    workflow_id: str,
    user: dict = Depends(require_role("editor")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Workflow).where(Workflow.id == UUID(workflow_id)))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    if workflow.status != WorkflowStatus.published:
        raise HTTPException(status_code=400, detail="Workflow must be published before running")
    
    # Create run record
    run = Run(
        workflow_id=workflow.id,
        workflow_version_id=workflow.current_version_id,
        status=RunStatus.running,
        triggered_by=UUID(user["id"]),
    )
    db.add(run)
    await db.flush()
    
    # TODO: Enqueue via Arq for background execution
    # from app.tasks import execute_run
    # await arq_pool.enqueue_job("execute_run", str(run.id))
    
    return {"run_id": str(run.id), "status": "running"}
