"""
Docker-based sandboxed code execution.

Each invocation:
- Spins up a fresh Docker container
- --network none (no network access)
- Read-only root filesystem
- Writable tmpfs scratch directory
- Hard CPU/memory/wall-clock limits
- Streams stdout/stderr back
- Cleans up container regardless of outcome
"""
import asyncio
import uuid
from typing import Optional
from dataclasses import dataclass


@dataclass
class ExecutionResult:
    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool
    duration_ms: int


# Default resource limits
DEFAULT_MEMORY_LIMIT = "256m"
DEFAULT_CPU_LIMIT = "1.0"
DEFAULT_TIMEOUT_SECONDS = 30
DEFAULT_IMAGE = "python:3.11-slim"


async def execute_code(
    code: str,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
    memory_limit: str = DEFAULT_MEMORY_LIMIT,
    cpu_limit: str = DEFAULT_CPU_LIMIT,
    image: str = DEFAULT_IMAGE,
) -> ExecutionResult:
    """
    Execute Python code in a sandboxed Docker container.
    
    Security measures:
    - No network access (--network none)
    - Read-only root filesystem (--read-only)
    - Writable tmpfs at /tmp (tmpfs)
    - Memory limit (--memory)
    - CPU limit (--cpus)
    - Wall-clock timeout (kills container if exceeded)
    """
    container_name = f"sandbox-{uuid.uuid4().hex[:12]}"
    
    # TODO: In production, use the Docker SDK for Python
    # import docker
    # client = docker.from_env()
    
    try:
        # Build docker run command
        cmd = [
            "docker", "run",
            "--rm",  # Auto-remove on exit
            "--name", container_name,
            "--network", "none",  # No network access
            "--read-only",  # Read-only root filesystem
            "--tmpfs", "/tmp:size=64m",  # Writable scratch space
            "--memory", memory_limit,
            "--cpus", cpu_limit,
            "--pids-limit", "64",  # Limit process count
            "--security-opt", "no-new-privileges",
            image,
            "python", "-c", code,
        ]
        
        # Execute with timeout
        start_time = asyncio.get_event_loop().time()
        timed_out = False
        
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout_seconds,
            )
            
            exit_code = process.returncode or 0
            
        except asyncio.TimeoutError:
            timed_out = True
            # Kill the container
            await asyncio.create_subprocess_exec("docker", "kill", container_name)
            stdout = b""
            stderr = f"Execution timed out after {timeout_seconds} seconds".encode()
            exit_code = -1
        
        duration_ms = int((asyncio.get_event_loop().time() - start_time) * 1000)
        
        return ExecutionResult(
            stdout=stdout.decode() if isinstance(stdout, bytes) else str(stdout),
            stderr=stderr.decode() if isinstance(stderr, bytes) else str(stderr),
            exit_code=exit_code,
            timed_out=timed_out,
            duration_ms=duration_ms,
        )
    
    except Exception as e:
        # Ensure cleanup
        try:
            await asyncio.create_subprocess_exec("docker", "rm", "-f", container_name)
        except:
            pass
        
        return ExecutionResult(
            stdout="",
            stderr=str(e),
            exit_code=-1,
            timed_out=False,
            duration_ms=0,
        )


async def execute_with_retry(
    code: str,
    max_retries: int = 3,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
) -> ExecutionResult:
    """
    Execute code with retry logic.
    
    Retries on failure, but stops if:
    - max_retries exceeded
    - Output hasn't changed between attempts (loop detection)
    """
    last_result = None
    last_output = ""
    
    for attempt in range(max_retries):
        result = await execute_code(code, timeout_seconds=timeout_seconds)
        
        # Check if output changed from last attempt
        current_output = result.stdout + result.stderr
        if current_output == last_output and last_result is not None:
            # Same output = likely a loop, stop retrying
            break
        
        last_output = current_output
        last_result = result
        
        if result.exit_code == 0:
            return result
    
    return last_result or ExecutionResult(
        stdout="", stderr="All retries exhausted", exit_code=-1, timed_out=False, duration_ms=0
    )
