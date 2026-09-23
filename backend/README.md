# SwarmBlocks AI Studio - Backend Reference Implementation
# This directory contains the Python/FastAPI backend code
# 
# NOTE: This is a reference implementation. The frontend (React) runs standalone
# with a mock API layer for demonstration. In production, connect to this backend.
#
# Tech Stack:
# - Python 3.11+, FastAPI
# - LangGraph for execution engine
# - SQLAlchemy + Alembic for DB
# - PostgreSQL + pgvector
# - Redis + Arq for background tasks
# - Docker SDK for sandboxed execution
#
# To run the full stack:
#   docker-compose up
#
# Backend will be available at http://localhost:8000
# API docs at http://localhost:8000/docs
