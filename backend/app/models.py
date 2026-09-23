"""
SQLAlchemy ORM models matching the spec's data model.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Float, Enum as SAEnum, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
import enum

from app.database import Base


# Enums
class WorkflowStatus(str, enum.Enum):
    draft = "draft"
    published = "published"


class RunStatus(str, enum.Enum):
    running = "running"
    paused_for_approval = "paused_for_approval"
    completed = "completed"
    failed = "failed"
    killed = "killed"


class StepStatus(str, enum.Enum):
    ok = "ok"
    error = "error"
    escalated = "escalated"


class ApprovalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    timed_out = "timed_out"


class UserRole(str, enum.Enum):
    viewer = "viewer"
    editor = "editor"
    admin = "admin"


# Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    org_memberships = relationship("OrgMember", back_populates="user")


class Organization(Base):
    __tablename__ = "organizations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    
    members = relationship("OrgMember", back_populates="organization")
    workflows = relationship("Workflow", back_populates="organization")
    secrets = relationship("Secret", back_populates="organization")


class OrgMember(Base):
    __tablename__ = "org_members"
    
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    role = Column(SAEnum(UserRole), nullable=False, default=UserRole.editor)
    
    organization = relationship("Organization", back_populates="members")
    user = relationship("User", back_populates="org_memberships")


class Workflow(Base):
    __tablename__ = "workflows"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String(255), nullable=False)
    graph_definition = Column(JSONB, nullable=False, default={"nodes": [], "edges": []})
    status = Column(SAEnum(WorkflowStatus), default=WorkflowStatus.draft)
    current_version_id = Column(UUID(as_uuid=True), nullable=True)
    
    organization = relationship("Organization", back_populates="workflows")
    versions = relationship("WorkflowVersion", back_populates="workflow")
    runs = relationship("Run", back_populates="workflow")


class WorkflowVersion(Base):
    __tablename__ = "workflow_versions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    graph_definition = Column(JSONB, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_rollback_of = Column(UUID(as_uuid=True), nullable=True)
    
    workflow = relationship("Workflow", back_populates="versions")


class Run(Base):
    __tablename__ = "runs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id"), nullable=False)
    workflow_version_id = Column(UUID(as_uuid=True), nullable=False)
    status = Column(SAEnum(RunStatus), default=RunStatus.running)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    total_tokens = Column(Integer, default=0)
    total_cost_usd = Column(Float, default=0.0)
    triggered_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    workflow = relationship("Workflow", back_populates="runs")
    steps = relationship("RunStep", back_populates="run", order_by="RunStep.step_index")
    approvals = relationship("Approval", back_populates="run")


class RunStep(Base):
    __tablename__ = "run_steps"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("runs.id"), nullable=False)
    node_id = Column(String(255), nullable=False)
    step_index = Column(Integer, nullable=False)
    input = Column(JSONB, nullable=False)
    output = Column(JSONB, nullable=False)
    tokens_used = Column(Integer, default=0)
    cost_usd = Column(Float, default=0.0)
    latency_ms = Column(Integer, default=0)
    status = Column(SAEnum(StepStatus), nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    run = relationship("Run", back_populates="steps")


class Approval(Base):
    __tablename__ = "approvals"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("runs.id"), nullable=False)
    node_id = Column(String(255), nullable=False)
    status = Column(SAEnum(ApprovalStatus), default=ApprovalStatus.pending)
    confirm_intent = Column(JSONB, nullable=False)
    approver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    
    run = relationship("Run", back_populates="approvals")


class EvalSet(Base):
    __tablename__ = "eval_sets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id"), nullable=False)
    name = Column(String(255), nullable=False)
    
    cases = relationship("EvalCase", back_populates="eval_set")


class EvalCase(Base):
    __tablename__ = "eval_cases"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    eval_set_id = Column(UUID(as_uuid=True), ForeignKey("eval_sets.id"), nullable=False)
    input = Column(JSONB, nullable=False)
    expected_output = Column(JSONB, nullable=False)
    
    eval_set = relationship("EvalSet", back_populates="cases")


class Secret(Base):
    __tablename__ = "secrets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    key_name = Column(String(255), nullable=False)
    encrypted_value = Column(Text, nullable=False)  # Fernet-encrypted
    created_at = Column(DateTime, default=datetime.utcnow)
    
    organization = relationship("Organization", back_populates="secrets")
