# ============================================================
# campus/notifier.py — Formspree Email Trigger
# ============================================================
# Sends campus notifications via Formspree (no SMTP required).
# ============================================================

import json
try:
    import requests as _requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

FORMSPREE_URL_ADMIN = "https://formspree.io/f/mdapedkq"
FORMSPREE_URL_STUDENT = "https://formspree.io/f/mqegqzdw"

def _build_body(workflow_type: str, schema: dict, policy: dict, role: str, target: str = "super_admin") -> dict:
    """Build the Formspree POST payload."""
    result = policy.get("result", "UNKNOWN")
    reason = policy.get("reason", "")
    alts   = policy.get("alternatives", [])

    subject_map = {
        "lab_booking":   "VigilOS: Lab Booking Request",
        "leave_request": "VigilOS: Leave Request",
        "room_booking":  "VigilOS: Room Booking Request",
        "complaint":     "VigilOS: Grievance Case Filed",
    }
    base_subject = subject_map.get(workflow_type, "VigilOS: AICTE Case Notice")
    workflow_title = workflow_type.replace('_', ' ').title()

    if target == "super_admin":
        subject = f"[Action Needed] {base_subject}" if result == "ESCALATED" else f"[Notice] {base_subject}"
        body_lines = [
            f"Dear Central Vigilance Authority / Bureau Head,",
            "",
            f"A new {workflow_title} has been processed by the VigilOS autonomous system.",
            "",
            f"System Decision: {result}",
            f"Reasoning: {reason}",
            "",
            "--- Request Details ---",
            f"Submitted by Role: {role}",
            json.dumps(schema, indent=2),
            "-----------------------"
        ]
        if result == "ESCALATED":
            body_lines.append("\nThis case has been ESCALATED and requires official review and approval.")
    else:
        subject = f"Update on your {base_subject}"
        body_lines = [
            f"Hello,",
            "",
            f"We are writing to update you on your recent {workflow_title}.",
            "",
            f"Status: {result}",
            f"Details: {reason}",
            "",
        ]
        if result == "APPROVED":
            body_lines.append("Your request has been approved. No further action is required.")
        elif result == "REJECTED":
            body_lines.append("Unfortunately, your request could not be approved at this time.")
            if alts:
                body_lines += ["", "You might want to consider the following alternatives:", *[f"  - {a}" for a in alts]]
        elif result == "ESCALATED":
            body_lines.append("Your case necessitates further review and has been routed to the respective bureau head. We will notify you once a final decision is made.")

        body_lines.extend([
            "",
            "For your records, here are the details of your submission:",
            json.dumps(schema, indent=2),
            "",
            "Best Regards,",
            "VigilOS Central Intelligence System"
        ])

    return {
        "_subject": subject,
        "message": "\n".join(body_lines),
        "workflow": workflow_type,
        "decision": result,
        "target": target,
    }


def notify(workflow_type: str, schema: dict, policy: dict,
           role: str = "citizen") -> dict:
    """
    Send a notification via Formspree to both Super Admin and Citizen.
    Returns {"status": "sent"|"simulated"|"error", ...}
    """
    if not REQUESTS_AVAILABLE:
        return {"status": "simulated", "note": "requests library not installed"}

    responses = {}
    errors = []
    
    for target, url in [("super_admin", FORMSPREE_URL_ADMIN), ("citizen", FORMSPREE_URL_STUDENT)]:
        payload = _build_body(workflow_type, schema, policy, role, target=target)
        try:
            resp = _requests.post(
                url,
                data=payload,
                headers={"Accept": "application/json"},
                timeout=10,
            )
            if resp.status_code == 200:
                responses[target] = resp.json()
            else:
                errors.append(f"{target} HTTP {resp.status_code}: {resp.text[:100]}")
        except Exception as e:
            errors.append(f"{target} Error: {str(e)}")

    if not errors:
        return {"status": "sent", "responses": responses}
    return {
        "status": "error" if len(errors) == 2 else "sent",
        "errors": errors,
        "responses": responses
    }

def notify_simulated(workflow_type: str, schema: dict, policy: dict,
                     role: str = "citizen") -> dict:
    """Return a simulated notification result without making an HTTP call."""
    return {
        "status": "simulated",
        "note": "Formspree call skipped in simulation mode",
        "would_send_super_admin": _build_body(workflow_type, schema, policy, role, target="super_admin"),
        "would_send_citizen": _build_body(workflow_type, schema, policy, role, target="citizen"),
    }
