"""
WebSocket connection manager for streaming run traces to the frontend.
"""
from typing import Dict, List
from fastapi import WebSocket
import json


class ConnectionManager:
    """Manages WebSocket connections per run for live trace streaming."""
    
    def __init__(self):
        # Map of run_id -> list of active WebSocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, run_id: str, websocket: WebSocket):
        await websocket.accept()
        if run_id not in self.active_connections:
            self.active_connections[run_id] = []
        self.active_connections[run_id].append(websocket)
    
    def disconnect(self, run_id: str, websocket: WebSocket):
        if run_id in self.active_connections:
            self.active_connections[run_id] = [
                ws for ws in self.active_connections[run_id] if ws != websocket
            ]
            if not self.active_connections[run_id]:
                del self.active_connections[run_id]
    
    async def send_event(self, run_id: str, event: dict):
        """Broadcast an event to all connections watching a run."""
        if run_id not in self.active_connections:
            return
        
        message = json.dumps(event)
        dead_connections = []
        
        for ws in self.active_connections[run_id]:
            try:
                await ws.send_text(message)
            except:
                dead_connections.append(ws)
        
        # Clean up dead connections
        for ws in dead_connections:
            self.disconnect(run_id, ws)
    
    async def broadcast_step_start(self, run_id: str, node_id: str, node_type: str, step_index: int):
        await self.send_event(run_id, {
            "type": "step_start",
            "data": {"node_id": node_id, "node_type": node_type, "step_index": step_index},
        })
    
    async def broadcast_step_complete(self, run_id: str, step_data: dict):
        await self.send_event(run_id, {
            "type": "step_complete",
            "data": {"step": step_data},
        })
    
    async def broadcast_spend_update(self, run_id: str, total_cost: float, total_tokens: int, ceiling: float):
        await self.send_event(run_id, {
            "type": "spend_update",
            "data": {"total_cost_usd": total_cost, "total_tokens": total_tokens, "ceiling": ceiling},
        })
    
    async def broadcast_run_complete(self, run_id: str, total_tokens: int, total_cost: float):
        await self.send_event(run_id, {
            "type": "run_complete",
            "data": {"total_tokens": total_tokens, "total_cost_usd": total_cost},
        })
    
    async def broadcast_run_killed(self, run_id: str, reason: str):
        await self.send_event(run_id, {
            "type": "run_killed",
            "data": {"reason": reason},
        })
    
    async def broadcast_approval_required(self, run_id: str, approval_id: str, confirm_intent: dict):
        await self.send_event(run_id, {
            "type": "approval_required",
            "data": {"approval_id": approval_id, "confirm_intent": confirm_intent},
        })
