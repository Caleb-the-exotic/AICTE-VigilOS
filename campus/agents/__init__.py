# campus/agents — Multi-Agent Kernel for CampusGPT OS
# Each agent has a single responsibility.
from campus.agents.classifier_agent import ClassifierAgent
from campus.agents.policy_agent import PolicyAgent
from campus.agents.academic_agent import AcademicAgent
from campus.agents.reviewer_agent import ReviewerAgent

__all__ = ["ClassifierAgent", "PolicyAgent", "AcademicAgent", "ReviewerAgent"]
