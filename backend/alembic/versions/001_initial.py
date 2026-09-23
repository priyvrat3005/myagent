"""
Alembic migration - Initial schema creation.

This creates all tables defined in app.models.

To generate migrations in development:
    alembic revision --autogenerate -m "description"
    alembic upgrade head
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers
revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    
    # Users table
    op.create_table(
        'users',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False, index=True),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    
    # Organizations table
    op.create_table(
        'organizations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
    )
    
    # Org members table
    op.create_table(
        'org_members',
        sa.Column('org_id', UUID(as_uuid=True), sa.ForeignKey('organizations.id'), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('role', sa.Enum('viewer', 'editor', 'admin', name='userrole'), nullable=False, server_default='editor'),
    )
    
    # Workflows table
    op.create_table(
        'workflows',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('org_id', UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('graph_definition', JSONB(), nullable=False, server_default='{"nodes":[],"edges":[]}'),
        sa.Column('status', sa.Enum('draft', 'published', name='workflowstatus'), server_default='draft'),
        sa.Column('current_version_id', UUID(as_uuid=True), nullable=True),
    )
    
    # Workflow versions table
    op.create_table(
        'workflow_versions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('workflow_id', UUID(as_uuid=True), sa.ForeignKey('workflows.id'), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('graph_definition', JSONB(), nullable=False),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('is_rollback_of', UUID(as_uuid=True), nullable=True),
    )
    
    # Runs table
    op.create_table(
        'runs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('workflow_id', UUID(as_uuid=True), sa.ForeignKey('workflows.id'), nullable=False),
        sa.Column('workflow_version_id', UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.Enum('running', 'paused_for_approval', 'completed', 'failed', 'killed', name='runstatus'), server_default='running'),
        sa.Column('started_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('total_tokens', sa.Integer(), server_default='0'),
        sa.Column('total_cost_usd', sa.Float(), server_default='0.0'),
        sa.Column('triggered_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
    )
    
    # Run steps table (the trace)
    op.create_table(
        'run_steps',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('run_id', UUID(as_uuid=True), sa.ForeignKey('runs.id'), nullable=False),
        sa.Column('node_id', sa.String(255), nullable=False),
        sa.Column('step_index', sa.Integer(), nullable=False),
        sa.Column('input', JSONB(), nullable=False),
        sa.Column('output', JSONB(), nullable=False),
        sa.Column('tokens_used', sa.Integer(), server_default='0'),
        sa.Column('cost_usd', sa.Float(), server_default='0.0'),
        sa.Column('latency_ms', sa.Integer(), server_default='0'),
        sa.Column('status', sa.Enum('ok', 'error', 'escalated', name='stepstatus'), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    
    # Approvals table
    op.create_table(
        'approvals',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('run_id', UUID(as_uuid=True), sa.ForeignKey('runs.id'), nullable=False),
        sa.Column('node_id', sa.String(255), nullable=False),
        sa.Column('status', sa.Enum('pending', 'approved', 'rejected', 'timed_out', name='approvalstatus'), server_default='pending'),
        sa.Column('confirm_intent', JSONB(), nullable=False),
        sa.Column('approver_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
    )
    
    # Eval sets table
    op.create_table(
        'eval_sets',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('workflow_id', UUID(as_uuid=True), sa.ForeignKey('workflows.id'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
    )
    
    # Eval cases table
    op.create_table(
        'eval_cases',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('eval_set_id', UUID(as_uuid=True), sa.ForeignKey('eval_sets.id'), nullable=False),
        sa.Column('input', JSONB(), nullable=False),
        sa.Column('expected_output', JSONB(), nullable=False),
    )
    
    # Secrets table
    op.create_table(
        'secrets',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('org_id', UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('key_name', sa.String(255), nullable=False),
        sa.Column('encrypted_value', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    
    # Indexes
    op.create_index('ix_runs_workflow_id', 'runs', ['workflow_id'])
    op.create_index('ix_run_steps_run_id', 'run_steps', ['run_id'])
    op.create_index('ix_approvals_run_id', 'approvals', ['run_id'])
    op.create_index('ix_approvals_status', 'approvals', ['status'])


def downgrade() -> None:
    op.drop_table('secrets')
    op.drop_table('eval_cases')
    op.drop_table('eval_sets')
    op.drop_table('approvals')
    op.drop_table('run_steps')
    op.drop_table('runs')
    op.drop_table('workflow_versions')
    op.drop_table('workflows')
    op.drop_table('org_members')
    op.drop_table('organizations')
    op.drop_table('users')
    op.execute("DROP EXTENSION IF EXISTS vector")
