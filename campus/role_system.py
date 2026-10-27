# ============================================================
# campus/role_system.py — Native Role System
# ============================================================
# Defines native role behaviors, tones, and access controls
# for the VigilOS platform.
# ============================================================

from typing import Optional

# ── ROLE DEFINITIONS ────────────────────────────────────────────────

ROLES = {
    "citizen": {
        "name": "Citizen",
        "display_name": "Citizen / Complainant",
        "description": "Public complainant filing grievances and tracking complaint progress.",
        "tone": "friendly, supportive, simple",
        "language_level": "non-technical",
        "behavior": "Guide, explain clearly with step-by-step help, confirm grievance details",
        "icon": "user",
    },
    "nodal_officer": {
        "name": "Nodal Officer",
        "display_name": "Regional Nodal Officer",
        "description": "State and regional institutional liaison officer handling field investigations and regional liaison.",
        "tone": "professional, investigative, collaborative",
        "language_level": "moderately technical",
        "behavior": "Provide institutional liaison updates, coordinate state/regional actions",
        "icon": "globe",
    },
    "approval_officer": {
        "name": "Approval Officer",
        "display_name": "Approval Officer",
        "description": "Grievance case handler and investigator handling complaints, inspections, and evidence review.",
        "tone": "thorough, analytical, administrative",
        "language_level": "professional and compliance-oriented",
        "behavior": "Review grievances, verify evidence, issue orders, manage hearings and compliance",
        "icon": "clipboard-check",
    },
    "bureau_head": {
        "name": "Bureau Head",
        "display_name": "Bureau Head",
        "description": "Bureau chief (RB / PGRC / Regional Offices) supervising case resolution and escalation decisions.",
        "tone": "authoritative, strategic, regulatory",
        "language_level": "executive and regulatory",
        "behavior": "Oversee bureau caseload, resolve cross-bureau conflicts, approve escalated actions",
        "icon": "landmark",
    },
    "super_admin": {
        "name": "Super Admin",
        "display_name": "Super Admin",
        "description": "Central Vigilance and Platform Administrator with full operational governance across all bureaus.",
        "tone": "concise, authoritative, operational",
        "language_level": "technical and system-oriented",
        "behavior": "System-wide oversight, cross-bureau arbitration, role management, audit logging",
        "icon": "key-round",
    },
}

DEFAULT_ROLE = "citizen"


# ── ROLE-BASED SYSTEM PROMPTS ────────────────────────────────────────

def get_role_system_prompt(role: str, context: Optional[dict] = None) -> str:
    """
    Generate a role-specific system prompt that gets injected into every LLM call.
    
    Args:
        role: The current user role (citizen, nodal_officer, approval_officer, bureau_head, super_admin)
        context: Optional context about the current workflow (workflow_type, etc.)
    
    Returns:
        A complete system prompt with role injection
    """
    role_info = ROLES.get(role, ROLES[DEFAULT_ROLE])
    
    base_prompt = f"""You are VigilOS's autonomous complaint intelligence and cross-bureau assistant."""
    
    role_instruction = f"""
## ROLE CONTEXT
You are responding as: **{role_info['display_name']}**
- **Tone**: {role_info['tone']}
- **Language Level**: {role_info['language_level']}
- **Behavior**: {role_info['behavior']}

### Role-Specific Guidelines:

"""
    
    if role == "citizen":
        role_instruction += """\
**For CITIZENS / COMPLAINANTS:**
- Use friendly, conversational language that is easy to understand
- Explain technical and regulatory terms when you use them
- Provide step-by-step guidance for filing or checking grievances
- Be encouraging and supportive
- Always explain the "why" behind decisions
- When complaints are received, clearly state the next procedural step
- Suggest alternatives or support channels if a request cannot be processed
"""
    elif role == "nodal_officer":
        role_instruction += """\
**For REGIONAL NODAL OFFICERS:**
- Focus on regional liaison, institution coordination, and state-level compliance
- Include institutional identifiers (AICTE PID, region, state) in responses
- Highlight geographic overlap patterns and regional inspection status
- Coordinate communication between institutions and AICTE headquarters
"""
    elif role == "approval_officer":
        role_instruction += """\
**For APPROVAL OFFICERS:**
- Maintain an investigative, compliance-oriented, and thorough tone
- Be concise but rigorous — officers need actionable evidence and facts
- Reference AICTE Approval Process Handbook (APH) regulations and grievance norms
- Provide clear findings, violation citations, and recommended actions
- Highlight case overlap and duplicate inspection risks
"""
    elif role == "bureau_head":
        role_instruction += """\
**For BUREAU HEADS (RB / PGRC / Regional Offices):**
- Be authoritative, strategic, and governance-focused
- Focus on cross-bureau coordination, SLA deadlines, and escalated decisions
- Provide summary assessments across multiple related complaints
- Highlight jurisdictional overlap and recommend arbitration paths
"""
    elif role == "super_admin":
        role_instruction += """\
**For SUPER ADMINISTRATORS:**
- Be concise, authoritative, and operational
- Focus on platform-wide insights, cross-bureau KPIs, and security/audit trails
- Include system IDs, timestamps, and confidence scores
- Highlight anomalies, policy violations, and unacknowledged overlaps
- Provide override capabilities and audit context
"""

    if context:
        workflow = context.get("workflow_type", "")
        if workflow:
            role_instruction += f"""
### Current Workflow Context
You are currently handling a **{workflow.replace('_', ' ').title()}** workflow.
"""

    return base_prompt + role_instruction


# ── ROLE-BASED RESPONSE MODULATION ────────────────────────────────────

def modulate_response(base_response: str, role: str, workflow_type: str = "") -> str:
    """
    Modulate a response based on the current role.
    
    Args:
        base_response: The original response content
        role: The current user role
        workflow_type: The current workflow type
    
    Returns:
        A modulated response string
    """
    role_info = ROLES.get(role, ROLES[DEFAULT_ROLE])
    
    if role == "super_admin" and workflow_type:
        admin_footer = f"""
---
*[{role_info['icon']} View in Admin Portal for audit trail, cross-bureau graph, and KPIs.]*"""
        return base_response + admin_footer
    
    elif role == "citizen":
        citizen_footer = f"""
---
{role_info['icon']} Need help with another grievance or inquiry? Feel free to ask!"""
        return base_response + citizen_footer
    
    elif role in ("approval_officer", "bureau_head", "nodal_officer"):
        officer_footer = f"""
---
{role_info['icon']} View full case details and evidence in the Cases tab."""
        return base_response + officer_footer
    
    return base_response


# ── ROLE-BASED DATA ACCESS CONTROL ────────────────────────────────────

def get_visible_fields(role: str, data_type: str) -> list[str]:
    """
    Get the list of fields visible to a specific role for a given data type.
    
    Args:
        role: The current user role
        data_type: The type of data being accessed (e.g., 'request', 'session', 'kpi')
    
    Returns:
        List of field names that are visible to this role
    """
    basic_fields = ["id", "type", "status", "created_at"]
    
    if data_type == "request":
        if role == "citizen":
            return basic_fields + ["workflow_type", "policy_result", "policy_reason"]
        elif role in ("nodal_officer", "approval_officer"):
            return basic_fields + ["workflow_type", "policy_result", "policy_reason", 
                                   "schema_json", "alternatives", "actor_role"]
        else:  # bureau_head, super_admin
            return basic_fields + ["workflow_type", "policy_result", "policy_reason", 
                                   "schema_json", "alternatives", "actor_role", "audit_trail"]
    
    elif data_type == "session":
        if role == "citizen":
            return basic_fields + ["title", "workflow_type"]
        elif role in ("nodal_officer", "approval_officer"):
            return basic_fields + ["title", "workflow_type", "role"]
        else:  # bureau_head, super_admin
            return basic_fields + ["title", "workflow_type", "role", "all_metadata"]
    
    elif data_type == "kpi":
        if role == "citizen":
            return []
        elif role in ("nodal_officer", "approval_officer"):
            return ["total_requests", "resolution_rate_pct"]
        else:  # bureau_head, super_admin
            return ["total_requests", "resolution_rate_pct", "avg_resolution_mins",
                    "resolved", "by_workflow", "escalation_rate", "rejection_rate"]
    
    elif data_type == "logs":
        if role == "citizen":
            return ["timestamp", "message"]
        elif role in ("nodal_officer", "approval_officer", "bureau_head"):
            return ["timestamp", "message", "level"]
        else:  # super_admin
            return ["timestamp", "message", "level", "stack_trace", "metadata"]
    
    return basic_fields


def can_access(role: str, resource: str, action: str = "read") -> bool:
    """
    Check if a role has permission to access a resource for a given action.
    
    Args:
        role: The current user role
        resource: The type of resource being accessed
        action: The action being performed (read, write, delete, admin)
    
    Returns:
        True if access is allowed, False otherwise
    """
    permissions = {
        "citizen": {
            "request": ["read", "write"],
            "session": ["read", "write"],
            "logs": ["read"],
            "kpi": [],
            "admin": [],
        },
        "nodal_officer": {
            "request": ["read", "write"],
            "session": ["read", "write"],
            "logs": ["read", "write"],
            "kpi": ["read"],
            "admin": [],
        },
        "approval_officer": {
            "request": ["read", "write", "admin"],
            "session": ["read", "write"],
            "logs": ["read", "write"],
            "kpi": ["read"],
            "admin": [],
        },
        "bureau_head": {
            "request": ["read", "write", "delete", "admin"],
            "session": ["read", "write", "delete"],
            "logs": ["read", "write"],
            "kpi": ["read", "admin"],
            "admin": [],
        },
        "super_admin": {
            "request": ["read", "write", "delete", "admin"],
            "session": ["read", "write", "delete"],
            "logs": ["read", "write", "delete"],
            "kpi": ["read", "admin"],
            "admin": ["read", "write", "delete", "admin"],
        },
    }
    
    role_perms = permissions.get(role, {})
    resource_perms = role_perms.get(resource, [])
    
    return action in resource_perms


def get_access_denied_message(role: str, resource: str, action: str) -> str:
    """Return a role-appropriate message when access is denied."""
    messages = {
        "citizen": {
            "kpi": "Analytics and KPI data are only available to authorized AICTE officials.",
            "admin": "Super Admin privileges are required to access administrative functions.",
        },
        "nodal_officer": {
            "admin": "Super Admin privileges are required to access administrative functions.",
        },
        "approval_officer": {
            "admin": "Super Admin privileges are required to access administrative functions.",
        },
        "bureau_head": {
            "admin": "Super Admin privileges are required to access administrative functions.",
        },
        "super_admin": {},
    }
    
    return messages.get(role, {}).get(resource, 
        f"Access denied: You don't have permission to {action} {resource}.")


# ── ROLE SWITCHING & HELPERS ──────────────────────────────────────────

def validate_role(role: str) -> bool:
    """Check if a role is valid in the native role system."""
    return role in ROLES


def get_role_choices() -> list[tuple[str, str]]:
    """Return list of (role_key, display_name) tuples for UI dropdowns."""
    return [(key, val["display_name"]) for key, val in ROLES.items()]


def get_role_icon(role: str) -> str:
    """Get the icon for a role."""
    return ROLES.get(role, ROLES[DEFAULT_ROLE]).get("icon", "user")
