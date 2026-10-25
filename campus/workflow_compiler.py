# ============================================================
# campus/workflow_compiler.py — Workflow DAG Compiler
# ============================================================
# Converts natural language requests into structured execution plans
# represented as Directed Acyclic Graphs (DAGs) before execution.
# ============================================================

import json
from typing import List, Dict, Any

class WorkflowStep:
    def __init__(
        self,
        step_id: str,
        agent_role: str,
        depends_on: List[str] = None,
        input_payload: Dict[str, Any] = None
    ):
        self.id = step_id
        self.agent_role = agent_role
        self.depends_on = depends_on or []
        self.status = "PENDING"  # PENDING, RUNNING, COMPLETED, FAILED, SKIPPED
        self.input_payload = input_payload or {}
        self.output_payload = None
        self.confidence_score = 1.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "agent_role": self.agent_role,
            "depends_on": self.depends_on,
            "status": self.status,
            "input_payload": self.input_payload,
            "output_payload": self.output_payload,
            "confidence_score": self.confidence_score,
        }


class WorkflowPlan:
    def __init__(self, workflow_type: str, steps: List[WorkflowStep]):
        self.workflow_type = workflow_type
        self.steps = steps

    def to_dict(self) -> Dict[str, Any]:
        return {
            "workflow_type": self.workflow_type,
            "steps": [s.to_dict() for s in self.steps]
        }


class WorkflowCompiler:
    """
    Compiles natural language requests into ordered DAG execution plans.
    Combines template-based structure for speed/accuracy with LLM routing.
    """

    def __init__(self, client=None, model: str = ""):
        self.client = client
        self.model = model

    def compile(self, query_text: str, role: str = "citizen", username: str = "STU001") -> WorkflowPlan:
        """
        Compile a query into a DAG WorkflowPlan.
        First, determines the intent type. Then builds the corresponding graph structure.
        """
        workflow_type = self._determine_workflow_type(query_text, role)

        # Build template graph steps based on compiled intent
        steps = []
        if workflow_type == "web_search":
            steps = [
                WorkflowStep("classify_request", "CLASSIFIER", input_payload={"query": query_text, "role": role}),
                WorkflowStep("web_search_query", "ACADEMIC", depends_on=["classify_request"]),
                WorkflowStep("synthesize_answer", "REVIEWER", depends_on=["web_search_query"])
            ]
        elif workflow_type == "leave_request":
            steps = [
                WorkflowStep("classify_request", "CLASSIFIER", input_payload={"query": query_text, "role": role}),
                WorkflowStep("validate_schedule", "ACADEMIC", depends_on=["classify_request"]),
                WorkflowStep("check_policy", "POLICY", depends_on=["classify_request", "validate_schedule"]),
                WorkflowStep("final_review", "REVIEWER", depends_on=["check_policy"])
            ]
        elif workflow_type in ("lab_booking", "room_booking"):
            steps = [
                WorkflowStep("classify_request", "CLASSIFIER", input_payload={"query": query_text, "role": role}),
                WorkflowStep("validate_schedule", "ACADEMIC", depends_on=["classify_request"]),
                WorkflowStep("check_policy", "POLICY", depends_on=["classify_request", "validate_schedule"]),
                WorkflowStep("final_review", "REVIEWER", depends_on=["check_policy"])
            ]
        elif workflow_type == "complaint":
            steps = [
                WorkflowStep("classify_request", "CLASSIFIER", input_payload={"query": query_text, "role": role}),
                WorkflowStep("route_technician", "ACADEMIC", depends_on=["classify_request"]),
                WorkflowStep("check_policy", "POLICY", depends_on=["classify_request", "route_technician"]),
                WorkflowStep("final_review", "REVIEWER", depends_on=["check_policy"])
            ]
        else:
            # Fallback default plan
            steps = [
                WorkflowStep("classify_request", "CLASSIFIER", input_payload={"query": query_text, "role": role}),
                WorkflowStep("check_policy", "POLICY", depends_on=["classify_request"]),
                WorkflowStep("final_review", "REVIEWER", depends_on=["check_policy"])
            ]

        return WorkflowPlan(workflow_type, steps)

    def _determine_workflow_type(self, query_text: str, role: str) -> str:
        """Helper to identify workflow type from text input using heuristics & classification triggers."""
        text = query_text.lower()
        if any(k in text for k in ["lab", "computer lab", "electronics lab", "physics lab", "cad lab"]):
            return "lab_booking"
        if any(k in text for k in ["leave", "sick", "medical", "fever", "on duty", "od", "hackathon", "absent"]):
            return "leave_request"
        if any(k in text for k in ["seminar", "hall", "conference", "room", "auditorium"]):
            return "room_booking"
        if any(k in text for k in ["complaint", "broken", "not working", "maintenance", "wifi", "ac", "fan"]):
            return "complaint"
        if any(k in text for k in ["who", "what", "why", "how", "search", "google", "find"]):
            return "web_search"
        
        # Fallback to LLM if available to classify correctly
        if self.client and self.model:
            try:
                from campus.agents.classifier_agent import ClassifierAgent
                agent = ClassifierAgent(self.client, self.model, role)
                schema = agent.classify(query_text)
                return schema.get("workflow_type", "web_search")
            except Exception:
                pass
        
        return "web_search"
