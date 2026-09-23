"""
SwarmBlocks AI Studio - FastAPI Backend Entry Point

This module initializes the FastAPI application with all routes,
middleware, and dependency injection for authentication and RBAC.
"""
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, engine, Base
from app.auth import get_current_user, require_role
from app.routes import auth, workflows
from app.routes.runs import runs_router, approvals_router, evals_router
from app.engine.websocket_manager import ConnectionManager

app = FastAPI(
    title="SwarmBlocks AI Studio",
    description="Visual node-based builder for AI agent workflows",
    version="0.1.0-mvp",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include route modules
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(workflows.router, prefix="/workflows", tags=["workflows"])
app.include_router(runs_router, prefix="/runs", tags=["runs"])
app.include_router(approvals_router, prefix="/runs", tags=["approvals"])
app.include_router(evals_router, prefix="/eval-sets", tags=["evals"])

# WebSocket manager for run streaming
ws_manager = ConnectionManager()


@app.on_event("startup")
async def startup():
    """Create database tables on startup (dev only - use Alembic in production)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.websocket("/runs/{run_id}/stream")
async def run_stream(websocket: WebSocket, run_id: str):
    """WebSocket endpoint for live run trace streaming."""
    await ws_manager.connect(run_id, websocket)
    try:
        while True:
            # Keep connection alive, listen for client messages
            data = await websocket.receive_text()
            # Client can send ping/pong or control messages
    except WebSocketDisconnect:
        ws_manager.disconnect(run_id, websocket)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0-mvp"}
