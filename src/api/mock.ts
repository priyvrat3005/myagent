// Mock API layer - simulates the FastAPI backend
// TODO: Replace with real API calls when backend is deployed
import { v4 as uuidv4 } from 'uuid';
import type {
  Workflow, Run, RunStep, Approval, EvalSet, EvalCase, User,
  GraphDefinition, RunStatus, StreamEvent
} from '../types';

// In-memory storage (simulates PostgreSQL)
const store = {
  users: [] as (User & { password: string })[],
  workflows: [] as Workflow[],
  runs: [] as Run[],
  runSteps: [] as RunStep[],
  approvals: [] as Approval[],
  evalSets: [] as EvalSet[],
  evalCases: [] as EvalCase[],
  currentUser: null as User | null,
  wsListeners: new Map<string, ((event: StreamEvent) => void)[]>(),
};

// Auth
export async function register(email: string, password: string): Promise<User> {
  if (store.users.find(u => u.email === email)) {
    throw new Error('Email already registered');
  }
  const user: User & { password: string } = {
    id: uuidv4(),
    email,
    password,
    created_at: new Date().toISOString(),
  };
  store.users.push(user);
  store.currentUser = { id: user.id, email: user.email, created_at: user.created_at };
  return { id: user.id, email: user.email, created_at: user.created_at };
}

export async function login(email: string, password: string): Promise<User> {
  const user = store.users.find(u => u.email === email && u.password === password);
  if (!user) {
    // Auto-create for demo
    const newUser: User & { password: string } = {
      id: uuidv4(),
      email,
      password,
      created_at: new Date().toISOString(),
    };
    store.users.push(newUser);
    store.currentUser = { id: newUser.id, email: newUser.email, created_at: newUser.created_at };
    return { id: newUser.id, email: newUser.email, created_at: newUser.created_at };
  }
  store.currentUser = { id: user.id, email: user.email, created_at: user.created_at };
  return { id: user.id, email: user.email, created_at: user.created_at };
}

export function getCurrentUser(): User | null {
  return store.currentUser;
}

// Workflows
export async function listWorkflows(): Promise<Workflow[]> {
  return store.workflows;
}

export async function getWorkflow(id: string): Promise<Workflow | undefined> {
  return store.workflows.find(w => w.id === id);
}

export async function createWorkflow(name: string, graphDefinition: GraphDefinition): Promise<Workflow> {
  const workflow: Workflow = {
    id: uuidv4(),
    org_id: 'default-org',
    name,
    graph_definition: graphDefinition,
    status: 'draft',
  };
  store.workflows.push(workflow);
  return workflow;
}

export async function updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow> {
  const idx = store.workflows.findIndex(w => w.id === id);
  if (idx === -1) throw new Error('Workflow not found');
  store.workflows[idx] = { ...store.workflows[idx], ...updates };
  return store.workflows[idx];
}

export async function publishWorkflow(id: string): Promise<Workflow> {
  const wf = store.workflows.find(w => w.id === id);
  if (!wf) throw new Error('Workflow not found');
  
  // Validate graph
  const validation = validateGraph(wf.graph_definition);
  if (!validation.valid) {
    throw new Error(`Cannot publish: ${validation.errors.join(', ')}`);
  }
  
  wf.status = 'published';
  wf.current_version_id = uuidv4();
  return wf;
}

function validateGraph(graph: GraphDefinition): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const nodeIds = new Set(graph.nodes.map(n => n.id));
  
  // Check for trigger node
  const hasTrigger = graph.nodes.some(n => n.type === 'trigger');
  if (!hasTrigger) errors.push('Graph must have a trigger node');
  
  // Check for output node
  const hasOutput = graph.nodes.some(n => n.type === 'output');
  if (!hasOutput) errors.push('Graph must have an output node');
  
  // Check edges reference valid nodes
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source_node_id)) {
      errors.push(`Edge ${edge.id}: source node ${edge.source_node_id} not found`);
    }
    if (!nodeIds.has(edge.target_node_id)) {
      errors.push(`Edge ${edge.id}: target node ${edge.target_node_id} not found`);
    }
  }
  
  // Check reachability from trigger
  if (hasTrigger && graph.nodes.length > 1) {
    const triggerNode = graph.nodes.find(n => n.type === 'trigger');
    const reachable = new Set<string>();
    const queue = [triggerNode!.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (reachable.has(current)) continue;
      reachable.add(current);
      const outEdges = graph.edges.filter(e => e.source_node_id === current);
      for (const e of outEdges) {
        if (!reachable.has(e.target_node_id)) queue.push(e.target_node_id);
      }
    }
    for (const node of graph.nodes) {
      if (!reachable.has(node.id)) {
        errors.push(`Node ${node.id} (${node.type}) is unreachable from trigger`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// Runs
export async function startRun(workflowId: string): Promise<{ run: Run; simulation: Promise<void> }> {
  const wf = store.workflows.find(w => w.id === workflowId);
  if (!wf) throw new Error('Workflow not found');
  
  const run: Run = {
    id: uuidv4(),
    workflow_id: workflowId,
    workflow_version_id: wf.current_version_id || uuidv4(),
    status: 'running',
    started_at: new Date().toISOString(),
    total_tokens: 0,
    total_cost_usd: 0,
    triggered_by: store.currentUser?.id || 'system',
  };
  store.runs.push(run);
  
  // Simulate execution
  const simulation = simulateRun(run, wf.graph_definition);
  
  return { run, simulation };
}

async function simulateRun(run: Run, graph: GraphDefinition): Promise<void> {
  const COST_CEILING = 0.50;
  const MAX_ITERATIONS = 10;
  
  // Topological-ish execution following edges
  const triggerNode = graph.nodes.find(n => n.type === 'trigger');
  if (!triggerNode) return;
  
  let stepIndex = 0;
  let currentNodes = [triggerNode];
  let iterations = 0;
  let totalCost = 0;
  let totalTokens = 0;
  
  const visited = new Set<string>();
  
  while (currentNodes.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    const nextNodes: typeof currentNodes = [];
    
    for (const node of currentNodes) {
      if (visited.has(node.id) && node.type !== 'router') continue;
      visited.add(node.id);
      
      // Check cost ceiling
      if (totalCost >= COST_CEILING) {
        run.status = 'killed';
        run.completed_at = new Date().toISOString();
        emitStreamEvent(run.id, {
          type: 'run_killed',
          data: { reason: `Cost ceiling exceeded: $${totalCost.toFixed(4)} >= $${COST_CEILING}` }
        });
        return;
      }
      
      // Emit step start
      emitStreamEvent(run.id, {
        type: 'step_start',
        data: { node_id: node.id, node_type: node.type, step_index: stepIndex }
      });
      
      // Simulate work
      const tokens = Math.floor(Math.random() * 200) + 50;
      const cost = tokens * 0.00003;
      const latency = Math.floor(Math.random() * 2000) + 200;
      totalTokens += tokens;
      totalCost += cost;
      
      // Check for approval node
      if (node.type === 'approval') {
        const approval: Approval = {
          id: uuidv4(),
          run_id: run.id,
          node_id: node.id,
          status: 'pending',
          confirm_intent: {
            action: node.config.action || 'destructive_api_call',
            target: node.config.target || 'production_database',
            description: node.config.description || 'This action will modify production data. Proceed?',
          },
        };
        store.approvals.push(approval);
        run.status = 'paused_for_approval';
        
        const step: RunStep = {
          id: uuidv4(),
          run_id: run.id,
          node_id: node.id,
          step_index: stepIndex,
          input: { pending_approval: true },
          output: {},
          tokens_used: tokens,
          cost_usd: cost,
          latency_ms: latency,
          status: 'escalated',
          created_at: new Date().toISOString(),
        };
        store.runSteps.push(step);
        
        emitStreamEvent(run.id, {
          type: 'approval_required',
          data: { approval_id: approval.id, confirm_intent: approval.confirm_intent }
        });
        emitStreamEvent(run.id, {
          type: 'step_complete',
          data: { step }
        });
        emitStreamEvent(run.id, {
          type: 'spend_update',
          data: { total_cost_usd: totalCost, total_tokens: totalTokens, ceiling: COST_CEILING }
        });
        
        // Wait for approval (simulated - will be resolved externally)
        stepIndex++;
        return; // Pause here
      }
      
      // Simulate output based on node type
      const output = simulateNodeOutput(node);
      
      const step: RunStep = {
        id: uuidv4(),
        run_id: run.id,
        node_id: node.id,
        step_index: stepIndex,
        input: { payload: node.type === 'trigger' ? { message: 'Hello, process this request' } : {} },
        output,
        tokens_used: tokens,
        cost_usd: cost,
        latency_ms: latency,
        status: 'ok',
        created_at: new Date().toISOString(),
      };
      store.runSteps.push(step);
      
      emitStreamEvent(run.id, {
        type: 'step_complete',
        data: { step }
      });
      emitStreamEvent(run.id, {
        type: 'spend_update',
        data: { total_cost_usd: totalCost, total_tokens: totalTokens, ceiling: COST_CEILING }
      });
      
      // Find next nodes
      const outEdges = graph.edges.filter(e => e.source_node_id === node.id);
      for (const edge of outEdges) {
        const target = graph.nodes.find(n => n.id === edge.target_node_id);
        if (target) nextNodes.push(target);
      }
      
      stepIndex++;
      
      // Simulate latency
      await new Promise(r => setTimeout(r, 800));
    }
    
    currentNodes = nextNodes;
  }
  
  // Run complete
  run.status = 'completed';
  run.completed_at = new Date().toISOString();
  run.total_tokens = totalTokens;
  run.total_cost_usd = totalCost;
  
  emitStreamEvent(run.id, {
    type: 'run_complete',
    data: { total_tokens: totalTokens, total_cost_usd: totalCost }
  });
}

function simulateNodeOutput(node: { type: string; config: Record<string, any> }): Record<string, any> {
  switch (node.type) {
    case 'trigger':
      return { normalized_input: { message: 'User request received', timestamp: new Date().toISOString() } };
    case 'identity':
      return { response: `Processed by agent: ${node.config.agent_name || 'Default Agent'}. I've analyzed your request and here's my response based on the context provided.`, model: 'claude-3-sonnet' };
    case 'skill':
      return { result: `Skill "${node.config.skill_name || 'analysis'}" executed successfully`, structured_output: { summary: 'Task completed' } };
    case 'memory':
      return { memories_retrieved: 3, context_window: 'Last 5 interactions', long_term_matches: 2 };
    case 'tool':
      return { tool_result: `Tool "${node.config.tool_name || 'search'}" returned results`, status: 'success' };
    case 'router':
      return { decision: 'route_to_output', confidence: 0.92 };
    case 'output':
      return { formatted_response: 'Task completed successfully. Here is the final output based on all processing steps.', format: node.config.response_format || 'text' };
    default:
      return { result: 'processed' };
  }
}

// Resume after approval
export async function resolveApproval(runId: string, approvalId: string, decision: 'approve' | 'reject'): Promise<void> {
  const approval = store.approvals.find(a => a.id === approvalId);
  if (!approval) throw new Error('Approval not found');
  
  approval.status = decision === 'approve' ? 'approved' : 'rejected';
  approval.approver_id = store.currentUser?.id;
  approval.resolved_at = new Date().toISOString();
  
  const run = store.runs.find(r => r.id === runId);
  if (!run) throw new Error('Run not found');
  
  if (decision === 'approve') {
    run.status = 'running';
    // Continue simulation from after the approval node
    const wf = store.workflows.find(w => w.id === run.workflow_id);
    if (wf) {
      const approvalNode = wf.graph_definition.nodes.find(n => n.id === approval.node_id);
      if (approvalNode) {
        // Find nodes after approval
        const outEdges = wf.graph_definition.edges.filter(e => e.source_node_id === approval.node_id);
        const nextNodes = outEdges.map(e => wf.graph_definition.nodes.find(n => n.id === e.target_node_id)).filter(Boolean);
        
        // Continue execution
        let stepIndex = store.runSteps.filter(s => s.run_id === runId).length;
        let totalCost = run.total_cost_usd;
        let totalTokens = run.total_tokens;
        
        for (const node of nextNodes) {
          if (!node) continue;
          const tokens = Math.floor(Math.random() * 200) + 50;
          const cost = tokens * 0.00003;
          const latency = Math.floor(Math.random() * 2000) + 200;
          totalTokens += tokens;
          totalCost += cost;
          
          const step: RunStep = {
            id: uuidv4(),
            run_id: runId,
            node_id: node.id,
            step_index: stepIndex,
            input: { resumed_after_approval: true },
            output: simulateNodeOutput(node),
            tokens_used: tokens,
            cost_usd: cost,
            latency_ms: latency,
            status: 'ok',
            created_at: new Date().toISOString(),
          };
          store.runSteps.push(step);
          
          emitStreamEvent(runId, { type: 'step_start', data: { node_id: node.id, node_type: node.type, step_index: stepIndex } });
          await new Promise(r => setTimeout(r, 500));
          emitStreamEvent(runId, { type: 'step_complete', data: { step } });
          emitStreamEvent(runId, { type: 'spend_update', data: { total_cost_usd: totalCost, total_tokens: totalTokens, ceiling: 0.50 } });
          stepIndex++;
        }
        
        run.status = 'completed';
        run.completed_at = new Date().toISOString();
        run.total_tokens = totalTokens;
        run.total_cost_usd = totalCost;
        emitStreamEvent(runId, { type: 'run_complete', data: { total_tokens: totalTokens, total_cost_usd: totalCost } });
      }
    }
  } else {
    run.status = 'failed';
    run.completed_at = new Date().toISOString();
    emitStreamEvent(runId, { type: 'run_killed', data: { reason: 'Approval rejected by user' } });
  }
}

// Kill run
export async function killRun(runId: string): Promise<void> {
  const run = store.runs.find(r => r.id === runId);
  if (!run) throw new Error('Run not found');
  run.status = 'killed';
  run.completed_at = new Date().toISOString();
  emitStreamEvent(runId, { type: 'run_killed', data: { reason: 'Manually killed by user' } });
}

// Get runs
export async function getRun(id: string): Promise<Run | undefined> {
  return store.runs.find(r => r.id === id);
}

export async function getRunSteps(runId: string): Promise<RunStep[]> {
  return store.runSteps.filter(s => s.run_id === runId).sort((a, b) => a.step_index - b.step_index);
}

export async function getWorkflowRuns(workflowId: string): Promise<Run[]> {
  return store.runs.filter(r => r.workflow_id === workflowId);
}

// Approvals
export async function getPendingApprovals(): Promise<Approval[]> {
  return store.approvals.filter(a => a.status === 'pending');
}

// Eval sets
export async function createEvalSet(workflowId: string, name: string): Promise<EvalSet> {
  const evalSet: EvalSet = { id: uuidv4(), workflow_id: workflowId, name };
  store.evalSets.push(evalSet);
  return evalSet;
}

export async function getEvalSets(workflowId: string): Promise<EvalSet[]> {
  return store.evalSets.filter(e => e.workflow_id === workflowId);
}

export async function addEvalCase(evalSetId: string, input: Record<string, any>, expectedOutput: Record<string, any>): Promise<EvalCase> {
  const evalCase: EvalCase = { id: uuidv4(), eval_set_id: evalSetId, input, expected_output: expectedOutput };
  store.evalCases.push(evalCase);
  return evalCase;
}

export async function getEvalCases(evalSetId: string): Promise<EvalCase[]> {
  return store.evalCases.filter(c => c.eval_set_id === evalSetId);
}

export async function runEvalSet(evalSetId: string): Promise<EvalCase[]> {
  const cases = store.evalCases.filter(c => c.eval_set_id === evalSetId);
  const evalSet = store.evalSets.find(e => e.id === evalSetId);
  if (!evalSet) throw new Error('Eval set not found');
  
  // Simulate running each case
  for (const c of cases) {
    await new Promise(r => setTimeout(r, 500));
    // Simulate pass/fail - first case passes, rest have 50% chance
    const pass = cases.indexOf(c) === 0 || Math.random() > 0.5;
    c.result = pass ? 'pass' : 'fail';
    c.actual_output = pass ? c.expected_output : { result: 'incorrect output' };
  }
  
  return cases;
}

// WebSocket simulation
function emitStreamEvent(runId: string, event: StreamEvent): void {
  const listeners = store.wsListeners.get(runId) || [];
  for (const listener of listeners) {
    listener(event);
  }
}

export function subscribeToRun(runId: string, callback: (event: StreamEvent) => void): () => void {
  if (!store.wsListeners.has(runId)) {
    store.wsListeners.set(runId, []);
  }
  store.wsListeners.get(runId)!.push(callback);
  
  return () => {
    const listeners = store.wsListeners.get(runId) || [];
    const idx = listeners.indexOf(callback);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}
