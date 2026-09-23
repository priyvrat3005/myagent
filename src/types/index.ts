// Core data model types matching the spec

export type NodeType = 'trigger' | 'identity' | 'skill' | 'memory' | 'tool' | 'planner' | 'router' | 'approval' | 'output';

export interface NodePosition {
  x: number;
  y: number;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  config: Record<string, any>;
  position: NodePosition;
}

export interface WorkflowEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  condition?: string | null;
}

export interface GraphDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export type WorkflowStatus = 'draft' | 'published';

export interface Workflow {
  id: string;
  org_id: string;
  name: string;
  graph_definition: GraphDefinition;
  status: WorkflowStatus;
  current_version_id?: string;
}

export interface WorkflowVersion {
  id: string;
  workflow_id: string;
  version_number: number;
  graph_definition: GraphDefinition;
  created_by: string;
  created_at: string;
  is_rollback_of?: string;
}

export type RunStatus = 'running' | 'paused_for_approval' | 'completed' | 'failed' | 'killed';

export interface Run {
  id: string;
  workflow_id: string;
  workflow_version_id: string;
  status: RunStatus;
  started_at: string;
  completed_at?: string;
  total_tokens: number;
  total_cost_usd: number;
  triggered_by: string;
}

export type StepStatus = 'ok' | 'error' | 'escalated';

export interface RunStep {
  id: string;
  run_id: string;
  node_id: string;
  step_index: number;
  input: Record<string, any>;
  output: Record<string, any>;
  tokens_used: number;
  cost_usd: number;
  latency_ms: number;
  status: StepStatus;
  error_message?: string;
  created_at: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'timed_out';

export interface Approval {
  id: string;
  run_id: string;
  node_id: string;
  status: ApprovalStatus;
  confirm_intent: Record<string, any>;
  approver_id?: string;
  resolved_at?: string;
}

export interface EvalSet {
  id: string;
  workflow_id: string;
  name: string;
}

export interface EvalCase {
  id: string;
  eval_set_id: string;
  input: Record<string, any>;
  expected_output: Record<string, any>;
  result?: 'pass' | 'fail';
  actual_output?: Record<string, any>;
}

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export type UserRole = 'viewer' | 'editor' | 'admin';

export interface OrgMember {
  org_id: string;
  user_id: string;
  role: UserRole;
}

// WebSocket event types
export interface StreamEvent {
  type: 'step_start' | 'step_complete' | 'spend_update' | 'run_complete' | 'run_killed' | 'approval_required';
  data: any;
}

// Node type compatibility for edge validation
export const NODE_INPUT_TYPES: Record<NodeType, NodeType[]> = {
  trigger: [],
  identity: ['trigger', 'identity', 'skill', 'memory', 'router', 'approval'],
  skill: ['trigger', 'identity', 'router'],
  memory: ['trigger', 'identity', 'skill', 'router'],
  tool: ['identity', 'skill', 'router'],
  planner: ['trigger', 'identity'],
  router: ['trigger', 'identity', 'skill', 'memory', 'tool', 'planner'],
  approval: ['tool', 'identity', 'router'],
  output: ['trigger', 'identity', 'skill', 'memory', 'tool', 'planner', 'router', 'approval'],
};

export const NODE_OUTPUT_TYPES: Record<NodeType, NodeType[]> = {
  trigger: ['identity', 'skill', 'memory', 'router', 'output'],
  identity: ['identity', 'skill', 'memory', 'tool', 'router', 'approval', 'output'],
  skill: ['memory', 'tool', 'router', 'output'],
  memory: ['identity', 'tool', 'router', 'output'],
  tool: ['identity', 'router', 'approval', 'output'],
  planner: ['identity', 'tool', 'router'],
  router: ['identity', 'skill', 'memory', 'tool', 'planner', 'approval', 'output'],
  approval: ['identity', 'tool', 'output'],
  output: [],
};
