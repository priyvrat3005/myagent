"""
Execution Engine - Compiles graph definitions into LangGraph StateGraphs.

This module implements the core execution engine that:
1. Validates graph structure (type compatibility, reachability, cycles)
2. Compiles the graph into a LangGraph StateGraph
3. Executes nodes with proper state management
4. Enforces cost ceilings and iteration limits
"""
from typing import Any, Dict, List, Optional, TypedDict
from dataclasses import dataclass

# TODO: In production, import from langgraph
# from langgraph.graph import StateGraph, END
# from langgraph.checkpoint import MemorySaver


class GraphState(TypedDict):
    """State that flows through the LangGraph execution."""
    messages: List[Dict[str, Any]]
    current_node: str
    iteration_count: int
    total_tokens: int
    total_cost_usd: float
    node_outputs: Dict[str, Any]
    pending_approval: Optional[Dict[str, Any]]


@dataclass
class CompilationResult:
    valid: bool
    errors: List[str]
    warnings: List[str]


# Node type compatibility matrix
NODE_OUTPUT_COMPAT = {
    "trigger": ["identity", "skill", "memory", "router", "output"],
    "identity": ["identity", "skill", "memory", "tool", "router", "approval", "output"],
    "skill": ["memory", "tool", "router", "output"],
    "memory": ["identity", "tool", "router", "output"],
    "tool": ["identity", "router", "approval", "output"],
    "planner": ["identity", "tool", "router"],
    "router": ["identity", "skill", "memory", "tool", "planner", "approval", "output"],
    "approval": ["identity", "tool", "output"],
    "output": [],
}

# Default limits
DEFAULT_MAX_ITERATIONS = 10
DEFAULT_COST_CEILING_USD = 0.50


def validate_graph(graph_definition: Dict[str, Any]) -> CompilationResult:
    """
    Validate a graph definition before compilation.
    
    Checks:
    1. Every edge connects type-compatible nodes
    2. No unreachable nodes from trigger
    3. Cycles have max_iterations set on the router causing them
    4. Has exactly one trigger and at least one output
    """
    errors = []
    warnings = []
    
    nodes = graph_definition.get("nodes", [])
    edges = graph_definition.get("edges", [])
    
    if not nodes:
        errors.append("Graph has no nodes")
        return CompilationResult(valid=False, errors=errors, warnings=warnings)
    
    node_map = {n["id"]: n for n in nodes}
    node_ids = set(node_map.keys())
    
    # Check for trigger node
    trigger_nodes = [n for n in nodes if n["type"] == "trigger"]
    if len(trigger_nodes) == 0:
        errors.append("Graph must have exactly one trigger node")
    elif len(trigger_nodes) > 1:
        errors.append("Graph must have exactly one trigger node (found multiple)")
    
    # Check for output node
    output_nodes = [n for n in nodes if n["type"] == "output"]
    if len(output_nodes) == 0:
        errors.append("Graph must have at least one output node")
    
    # Validate edges
    for edge in edges:
        source_id = edge.get("source_node_id")
        target_id = edge.get("target_node_id")
        
        if source_id not in node_ids:
            errors.append(f"Edge {edge.get('id')}: source node '{source_id}' not found")
            continue
        if target_id not in node_ids:
            errors.append(f"Edge {edge.get('id')}: target node '{target_id}' not found")
            continue
        
        source_type = node_map[source_id]["type"]
        target_type = node_map[target_id]["type"]
        
        # Check type compatibility
        valid_targets = NODE_OUTPUT_COMPAT.get(source_type, [])
        if target_type not in valid_targets:
            errors.append(
                f"Edge {edge.get('id')}: cannot connect {source_type} → {target_type}. "
                f"Compatible targets for {source_type}: {', '.join(valid_targets)}"
            )
    
    # Check reachability from trigger
    if trigger_nodes:
        trigger_id = trigger_nodes[0]["id"]
        reachable = set()
        queue = [trigger_id]
        
        while queue:
            current = queue.pop(0)
            if current in reachable:
                continue
            reachable.add(current)
            
            out_edges = [e for e in edges if e.get("source_node_id") == current]
            for e in out_edges:
                target = e.get("target_node_id")
                if target and target not in reachable:
                    queue.append(target)
        
        for node in nodes:
            if node["id"] not in reachable:
                errors.append(f"Node '{node['id']}' ({node['type']}) is unreachable from trigger")
    
    # Check for cycles without max_iterations
    # Simple cycle detection using DFS
    adj = {}
    for edge in edges:
        src = edge.get("source_node_id")
        tgt = edge.get("target_node_id")
        if src and tgt:
            adj.setdefault(src, []).append(tgt)
    
    # Detect back edges (cycles)
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {nid: WHITE for nid in node_ids}
    cycle_nodes = set()
    
    def dfs(node):
        color[node] = GRAY
        for neighbor in adj.get(node, []):
            if color[neighbor] == GRAY:
                # Back edge = cycle
                cycle_nodes.add(node)
            elif color[neighbor] == WHITE:
                dfs(neighbor)
        color[node] = BLACK
    
    for nid in node_ids:
        if color[nid] == WHITE:
            dfs(nid)
    
    # Check that cycle-causing routers have max_iterations
    for nid in cycle_nodes:
        node = node_map[nid]
        if node["type"] == "router":
            max_iter = node.get("config", {}).get("max_iterations")
            if not max_iter:
                warnings.append(
                    f"Router node '{nid}' causes a cycle but has no max_iterations set. "
                    f"Default ({DEFAULT_MAX_ITERATIONS}) will be used."
                )
    
    return CompilationResult(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
    )


def compile_workflow(graph_definition: Dict[str, Any]) -> Any:
    """
    Compile a validated graph definition into a LangGraph CompiledGraph.
    
    TODO: Implement full LangGraph compilation. For the MVP, this validates
    the graph and returns a callable that simulates execution.
    
    In production, this would:
    1. Create a StateGraph with GraphState
    2. Add nodes for each node in the graph definition
    3. Add edges with conditions for router nodes
    4. Set the entry point to the trigger node
    5. Compile with a checkpointer for pause/resume
    """
    result = validate_graph(graph_definition)
    if not result.valid:
        raise ValueError(f"Graph validation failed: {'; '.join(result.errors)}")
    
    # TODO: Replace with actual LangGraph compilation
    # graph = StateGraph(GraphState)
    # for node in graph_definition["nodes"]:
    #     graph.add_node(node["id"], get_node_function(node))
    # for edge in graph_definition["edges"]:
    #     if edge.get("condition"):
    #         graph.add_conditional_edges(edge["source_node_id"], ...)
    #     else:
    #         graph.add_edge(edge["source_node_id"], edge["target_node_id"])
    # graph.set_entry_point(trigger_node_id)
    # return graph.compile(checkpointer=MemorySaver())
    
    return SimulatedCompiledGraph(graph_definition)


class SimulatedCompiledGraph:
    """
    Simulated compiled graph for development/testing.
    In production, this would be a real LangGraph CompiledGraph.
    """
    
    def __init__(self, graph_definition: Dict[str, Any]):
        self.graph_definition = graph_definition
        self.max_iterations = DEFAULT_MAX_ITERATIONS
        self.cost_ceiling = DEFAULT_COST_CEILING_USD
    
    async def ainvoke(self, inputs: Dict[str, Any], config: Optional[Dict] = None) -> Dict[str, Any]:
        """Simulate async invocation of the compiled graph."""
        # This is a placeholder - real implementation uses LangGraph
        return {
            "messages": [{"role": "assistant", "content": "Execution complete"}],
            "total_tokens": 0,
            "total_cost_usd": 0.0,
        }
