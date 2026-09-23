import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { WorkflowNode, WorkflowEdge, NodeType, GraphDefinition, NODE_INPUT_TYPES, NODE_OUTPUT_TYPES } from '../types';
import { NODE_INPUT_TYPES as INPUT_COMPAT, NODE_OUTPUT_TYPES as OUTPUT_COMPAT } from '../types';

interface CanvasState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  workflowName: string;
  
  // Actions
  addNode: (type: NodeType, position: { x: number; y: number }) => void;
  removeNode: (id: string) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  updateNodeConfig: (id: string, config: Record<string, any>) => void;
  selectNode: (id: string | null) => void;
  addEdge: (sourceId: string, targetId: string, condition?: string) => { valid: boolean; error?: string };
  removeEdge: (id: string) => void;
  setWorkflowName: (name: string) => void;
  loadGraph: (graph: GraphDefinition) => void;
  getGraphDefinition: () => GraphDefinition;
  validateConnection: (sourceId: string, targetId: string) => { valid: boolean; error?: string };
}

const NODE_DEFAULT_CONFIGS: Record<NodeType, Record<string, any>> = {
  trigger: { input_schema: { type: 'object', properties: { message: { type: 'string' } } } },
  identity: { agent_name: 'Agent', system_instructions: 'You are a helpful assistant.', model: 'claude-3-sonnet', max_context_tokens: 4096 },
  skill: { skill_name: 'analysis', input_schema: {}, output_schema: {}, prompt_template: '' },
  memory: { mode: 'short_term', window_size: 5, namespace: 'default' },
  tool: { tool_name: 'search', tool_type: 'code_interpreter', timeout_ms: 30000, max_retries: 3, is_irreversible: false },
  planner: { strategy: 'decomposition', max_steps: 5 },
  router: { pattern: 'routing', routes: [] },
  approval: { action: 'confirm_action', description: 'Please confirm this action', requires_approval: true },
  output: { response_format: 'text', template: '' },
};

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  workflowName: 'Untitled Workflow',
  
  addNode: (type, position) => {
    const node: WorkflowNode = {
      id: uuidv4(),
      type,
      config: { ...NODE_DEFAULT_CONFIGS[type] },
      position,
    };
    set(state => ({ nodes: [...state.nodes, node] }));
  },
  
  removeNode: (id) => {
    set(state => ({
      nodes: state.nodes.filter(n => n.id !== id),
      edges: state.edges.filter(e => e.source_node_id !== id && e.target_node_id !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    }));
  },
  
  updateNodePosition: (id, position) => {
    set(state => ({
      nodes: state.nodes.map(n => n.id === id ? { ...n, position } : n),
    }));
  },
  
  updateNodeConfig: (id, config) => {
    set(state => ({
      nodes: state.nodes.map(n => n.id === id ? { ...n, config: { ...n.config, ...config } } : n),
    }));
  },
  
  selectNode: (id) => set({ selectedNodeId: id }),
  
  validateConnection: (sourceId, targetId) => {
    const state = get();
    const sourceNode = state.nodes.find(n => n.id === sourceId);
    const targetNode = state.nodes.find(n => n.id === targetId);
    
    if (!sourceNode || !targetNode) return { valid: false, error: 'Node not found' };
    
    // Check type compatibility
    const validTargets = OUTPUT_COMPAT[sourceNode.type] || [];
    if (!validTargets.includes(targetNode.type)) {
      return { valid: false, error: `Cannot connect ${sourceNode.type} → ${targetNode.type}. Compatible targets: ${validTargets.join(', ')}` };
    }
    
    // Check for duplicate edge
    const exists = state.edges.some(e => e.source_node_id === sourceId && e.target_node_id === targetId);
    if (exists) return { valid: false, error: 'Connection already exists' };
    
    // Check for self-loop
    if (sourceId === targetId) return { valid: false, error: 'Cannot connect node to itself' };
    
    return { valid: true };
  },
  
  addEdge: (sourceId, targetId, condition) => {
    const validation = get().validateConnection(sourceId, targetId);
    if (!validation.valid) return validation;
    
    const edge: WorkflowEdge = {
      id: uuidv4(),
      source_node_id: sourceId,
      target_node_id: targetId,
      condition: condition || null,
    };
    set(state => ({ edges: [...state.edges, edge] }));
    return { valid: true };
  },
  
  removeEdge: (id) => {
    set(state => ({ edges: state.edges.filter(e => e.id !== id) }));
  },
  
  setWorkflowName: (name) => set({ workflowName: name }),
  
  loadGraph: (graph) => {
    set({ nodes: graph.nodes, edges: graph.edges });
  },
  
  getGraphDefinition: () => {
    const state = get();
    return { nodes: state.nodes, edges: state.edges };
  },
}));
