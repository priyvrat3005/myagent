"""
Node execution functions for each node type.

Each function takes the GraphState and returns updated state.
These map to LangGraph node functions in the compiled graph.
"""
from typing import Any, Dict
import time
import json


async def execute_trigger(state: Dict[str, Any], node_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Trigger node: normalizes incoming payload against input_schema.
    """
    # TODO: Implement JSON schema validation of input
    input_data = state.get("messages", [{}])[-1].get("content", {})
    
    return {
        "messages": state["messages"] + [{"role": "system", "content": "Input validated", "data": input_data}],
        "node_outputs": {**state.get("node_outputs", {}), "trigger": input_data},
    }


async def execute_identity(state: Dict[str, Any], node_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Identity node: calls the LLM via LLMClient abstraction.
    Uses system_instructions, tools, and max_context_tokens.
    """
    # TODO: Implement actual LLM call via LLMClient
    # client = LLMClient(provider="anthropic")
    # response = await client.messages(
    #     system=node_config.get("system_instructions", ""),
    #     messages=truncate_context(state["messages"], node_config.get("max_context_tokens", 4096)),
    #     tools=node_config.get("tools", []),
    # )
    
    start_time = time.time()
    
    # Simulated response
    response_text = f"Processed by {node_config.get('agent_name', 'Agent')}"
    tokens_used = len(response_text.split()) * 2  # Rough estimate
    
    latency_ms = int((time.time() - start_time) * 1000)
    cost_usd = tokens_used * 0.00003  # Approximate cost
    
    return {
        "messages": state["messages"] + [{"role": "assistant", "content": response_text}],
        "total_tokens": state.get("total_tokens", 0) + tokens_used,
        "total_cost_usd": state.get("total_cost_usd", 0.0) + cost_usd,
        "node_outputs": {**state.get("node_outputs", {}), "identity": {"response": response_text}},
    }


async def execute_skill(state: Dict[str, Any], node_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Skill node: templated prompt call with structured I/O validation.
    """
    # TODO: Implement template rendering and schema validation
    prompt_template = node_config.get("prompt_template", "")
    input_schema = node_config.get("input_schema", {})
    output_schema = node_config.get("output_schema", {})
    
    # Simulated execution
    result = {"summary": f"Skill '{node_config.get('skill_name', 'unknown')}' executed"}
    
    return {
        "messages": state["messages"] + [{"role": "system", "content": json.dumps(result)}],
        "node_outputs": {**state.get("node_outputs", {}), "skill": result},
    }


async def execute_memory(state: Dict[str, Any], node_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Memory node: read/write to short-term buffer or long-term pgvector store.
    """
    mode = node_config.get("mode", "short_term")
    
    if mode == "short_term":
        # Windowed buffer in state
        window_size = node_config.get("window_size", 5)
        recent = state.get("messages", [])[-window_size:]
        return {
            "messages": state["messages"],
            "node_outputs": {**state.get("node_outputs", {}), "memory": {"mode": "short_term", "window": recent}},
        }
    else:
        # TODO: Implement pgvector long-term memory
        # namespace = f"{org_id}:{node_config.get('namespace', 'default')}"
        # memories = await vector_store.query(namespace, query_embedding, top_k=5)
        return {
            "messages": state["messages"],
            "node_outputs": {**state.get("node_outputs", {}), "memory": {"mode": "long_term", "matches": []}},
        }


async def execute_tool(state: Dict[str, Any], node_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Tool node: dispatches to sandbox runner with validation, retry, timeout.
    On repeated failure or irreversible action, routes to approval node.
    """
    tool_type = node_config.get("tool_type", "code_interpreter")
    is_irreversible = node_config.get("is_irreversible", False)
    max_retries = node_config.get("max_retries", 3)
    timeout_ms = node_config.get("timeout_ms", 30000)
    
    # TODO: Implement actual tool dispatch
    # if tool_type == "code_interpreter":
    #     result = await docker_runner.execute(code, timeout_ms=timeout_ms)
    # elif tool_type == "api_call":
    #     result = await api_tool.execute(config)
    # etc.
    
    # Simulated result
    result = {"status": "success", "output": f"Tool '{node_config.get('tool_name', 'unknown')}' executed"}
    
    # If irreversible, signal approval needed
    if is_irreversible:
        return {
            "pending_approval": {
                "action": node_config.get("tool_name", "unknown"),
                "type": "irreversible_tool",
                "details": result,
            },
            "node_outputs": {**state.get("node_outputs", {}), "tool": result},
        }
    
    return {
        "messages": state["messages"] + [{"role": "tool", "content": json.dumps(result)}],
        "node_outputs": {**state.get("node_outputs", {}), "tool": result},
    }


async def execute_router(state: Dict[str, Any], node_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Router node: implements routing and prompt_chaining patterns.
    Other patterns (parallelization, orchestrator_workers, etc.) are TODO-stubbed.
    """
    pattern = node_config.get("pattern", "routing")
    
    if pattern == "routing":
        # TODO: Implement LLM-based routing decision
        return {
            "messages": state["messages"],
            "current_node": state.get("current_node", ""),
            "node_outputs": {**state.get("node_outputs", {}), "router": {"decision": "default_route"}},
        }
    elif pattern == "prompt_chaining":
        # Sequential chaining - just pass through
        return {
            "messages": state["messages"],
            "node_outputs": {**state.get("node_outputs", {}), "router": {"pattern": "prompt_chaining"}},
        }
    elif pattern == "parallelization":
        # TODO: Implement parallel execution pattern for swarm layer
        raise NotImplementedError("Parallelization pattern - implement in swarm layer")
    elif pattern == "orchestrator_workers":
        # TODO: Implement orchestrator-workers pattern for swarm layer
        raise NotImplementedError("Orchestrator-workers pattern - implement in swarm layer")
    elif pattern == "evaluator_optimizer":
        # TODO: Implement evaluator-optimizer pattern for swarm layer
        raise NotImplementedError("Evaluator-optimizer pattern - implement in swarm layer")
    elif pattern == "handoff":
        # TODO: Implement handoff pattern for swarm layer
        raise NotImplementedError("Handoff pattern - implement in swarm layer")
    else:
        raise ValueError(f"Unknown routing pattern: {pattern}")


async def execute_approval(state: Dict[str, Any], node_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Approval node: pauses the run and waits for human resolution.
    The engine persists state and sets run status to paused_for_approval.
    """
    # This function is called when the run is resumed after approval
    # The actual pausing is handled by the engine runner
    
    return {
        "messages": state["messages"] + [{"role": "system", "content": "Approval granted, resuming execution"}],
        "pending_approval": None,
        "node_outputs": {**state.get("node_outputs", {}), "approval": {"status": "approved"}},
    }


async def execute_output(state: Dict[str, Any], node_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Output node: formats the final response per response_format.
    """
    response_format = node_config.get("response_format", "text")
    template = node_config.get("template", "")
    
    # Collect all node outputs for formatting
    all_outputs = state.get("node_outputs", {})
    
    # TODO: Implement template rendering
    if template:
        formatted = template
        for key, value in all_outputs.items():
            formatted = formatted.replace(f"{{{{{key}}}}}", str(value))
    else:
        formatted = json.dumps(all_outputs, indent=2)
    
    return {
        "messages": state["messages"] + [{"role": "assistant", "content": formatted, "format": response_format}],
        "node_outputs": {**state.get("node_outputs", {}), "output": {"formatted": formatted, "format": response_format}},
    }


# Registry mapping node types to execution functions
NODE_EXECUTORS = {
    "trigger": execute_trigger,
    "identity": execute_identity,
    "skill": execute_skill,
    "memory": execute_memory,
    "tool": execute_tool,
    "router": execute_router,
    "approval": execute_approval,
    "output": execute_output,
    # TODO: planner will be implemented in swarm layer
    # "planner": execute_planner,
}


def get_node_function(node: Dict[str, Any]):
    """Get the execution function for a node based on its type."""
    node_type = node.get("type")
    executor = NODE_EXECUTORS.get(node_type)
    if not executor:
        raise ValueError(f"No executor for node type: {node_type}")
    
    config = node.get("config", {})
    
    async def node_fn(state: GraphState) -> Dict[str, Any]:
        return await executor(state, config)
    
    return node_fn
