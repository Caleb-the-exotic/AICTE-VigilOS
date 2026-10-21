# ============================================================
# campus/executor.py — Autonomous Loop Entry Point Wrapper
# ============================================================
# Delegates all execution tasks to the new stateful, planned
# Campus OS v2 kernel (campus_kernel.py).
# ============================================================

from typing import Callable, Dict, Any
from campus.campus_kernel import CampusKernel

def run(
    session_id: str,
    query_text: str,
    role: str,
    client,
    model: str,
    tavily_api_key: str = "",
    on_log: Callable[[str], None] = None,
) -> Dict[str, Any]:
    """
    Entry point for the autonomous campus workflow loop.
    Delegates compilation and execution to CampusKernel.
    """
    kernel = CampusKernel(client, model, tavily_api_key)
    return kernel.execute_request(
        session_id=session_id,
        query_text=query_text,
        role=role,
        on_log=on_log
    )
