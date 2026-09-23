# SwarmBlocks AI Studio

A visual, node-based builder for AI agent workflows. Build single-agent and multi-agent (swarm) workflows using a drag-and-drop canvas, then run them with live tracing, human-in-the-loop approval gates, and evaluation sets.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                    │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Canvas   │  │ Run Inspector│  │  Approval Inbox      │  │
│  │ (React    │  │ (WebSocket   │  │  + Eval Sets         │  │
│  │  Flow)    │  │  Streaming)  │  │                      │  │
│  └──────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ REST + WebSocket
┌────────────────────────┴────────────────────────────────────┐
│                   Backend (FastAPI)                           │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Auth +   │  │  Execution   │  │  Sandboxed Tool      │  │
│  │  RBAC     │  │  Engine      │  │  Runner (Docker)     │  │
│  │  (JWT)    │  │  (LangGraph) │  │                      │  │
│  └──────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│  PostgreSQL + pgvector  │  Redis + Arq  │  Secrets (Fernet) │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Frontend Only (Demo Mode)

```bash
npm install
npm run dev
```

The frontend runs with a built-in mock API that simulates the full backend behavior.

### Full Stack (Docker Compose)

```bash
# Set your Anthropic API key (optional - demo mode works without it)
export ANTHROPIC_API_KEY=sk-ant-...

docker-compose up
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Features (MVP)

### ✅ Implemented

1. **Visual Canvas** - Drag-and-drop node-based workflow builder with React Flow
   - 9 node types: trigger, identity, skill, memory, tool, planner, router, approval, output
   - Type-compatible connection validation
   - Per-node configuration panels

2. **Execution Engine** - Graph compilation and execution
   - LangGraph-based StateGraph compilation
   - Node type compatibility validation
   - Reachability and cycle detection
   - Hard cost ceiling ($0.50) and iteration limit (10)

3. **Live Run Tracing** - WebSocket streaming of execution steps
   - Real-time step timeline with input/output
   - Token count, cost, and latency per step
   - Live spend meter against cost ceiling
   - Kill switch for active runs

4. **Approval Gates** - Human-in-the-loop for irreversible actions
   - Pause/resume flow with persisted state
   - Structured confirm_intent payload
   - Approval inbox with approve/reject actions

5. **Evaluation Sets** - Test workflows against expected I/O
   - Create eval sets with input/expected-output cases
   - Run eval sets and see pass/fail per case

6. **Auth + RBAC** - JWT-based authentication
   - Register/login with email + password
   - Role hierarchy: viewer < editor < admin
   - FastAPI dependency injection on all mutating routes

7. **Sandboxed Execution** - Docker-based code interpreter
   - No network access, read-only root FS
   - Hard CPU/memory/wall-clock limits
   - Retry logic with loop detection

### 🔜 Coming Soon (Swarm Layer)

- Swarm Canvas (multi-agent orchestration)
- MCP/A2A protocol support
- CI/CD promotion pipeline
- Marketplace
- Collaboration features
- Parallelization, orchestrator-workers, evaluator-optimizer, handoff patterns

## Data Model

All nodes and edges live inside `graph_definition` JSONB on the `workflows` table:

```json
{
  "nodes": [
    {
      "id": "uuid",
      "type": "trigger|identity|skill|memory|tool|planner|router|approval|output",
      "config": { /* type-specific */ },
      "position": { "x": 100, "y": 200 }
    }
  ],
  "edges": [
    {
      "id": "uuid",
      "source_node_id": "...",
      "target_node_id": "...",
      "condition": null
    }
  ]
}
```

## Project Structure

```
├── src/                    # React frontend
│   ├── App.tsx            # Router + layout
│   ├── api/mock.ts        # Mock API (simulates backend)
│   ├── stores/            # Zustand state management
│   ├── pages/             # Page components
│   ├── components/        # Reusable components
│   └── types/             # TypeScript types
├── backend/               # Python backend (reference)
│   ├── app/
│   │   ├── main.py       # FastAPI app
│   │   ├── models.py     # SQLAlchemy models
│   │   ├── auth.py       # JWT + RBAC
│   │   ├── secrets.py    # SecretsVault (Fernet/HashiCorp)
│   │   ├── engine/       # Execution engine
│   │   │   ├── compiler.py    # Graph → LangGraph
│   │   │   ├── nodes.py       # Node executors
│   │   │   ├── llm_client.py  # LLM abstraction
│   │   │   └── websocket_manager.py
│   │   ├── sandbox/      # Docker sandbox
│   │   └── routes/       # API endpoints
│   ├── alembic/          # DB migrations
│   └── requirements.txt
├── docker-compose.yml
└── Dockerfile.frontend
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, React Flow, Zustand, Tailwind CSS |
| Backend | Python 3.11+, FastAPI, LangGraph |
| Database | PostgreSQL + pgvector |
| Queue | Redis + Arq |
| Auth | JWT (python-jose + passlib) |
| Secrets | Fernet encryption (swappable to HashiCorp Vault) |
| Sandbox | Docker (per-invocation containers) |
| Realtime | FastAPI WebSocket |
