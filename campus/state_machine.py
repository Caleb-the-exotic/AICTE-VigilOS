import datetime
from campus.db import get_conn, add_audit

# Lifecycle states
STATES = {
    "CREATED": 0,
    "CLASSIFIED": 1,
    "PENDING_APPROVAL": 2,
    "APPROVED": 3,
    "REJECTED": 3,
    "ESCALATED": 3,
    "COMPLETED": 4
}

# Define valid transitions
VALID_TRANSITIONS = {
    "CREATED": {"CLASSIFIED", "PENDING_APPROVAL", "REJECTED"},
    "CLASSIFIED": {"PENDING_APPROVAL", "APPROVED", "REJECTED", "ESCALATED"},
    "PENDING_APPROVAL": {"APPROVED", "REJECTED", "ESCALATED"},
    "APPROVED": {"COMPLETED", "ESCALATED"},
    "REJECTED": {"COMPLETED"},
    "ESCALATED": {"PENDING_APPROVAL", "APPROVED", "REJECTED"},
    "COMPLETED": set() # Terminal state
}

class RequestStateMachine:
    @staticmethod
    def can_transition(current_state: str, target_state: str) -> bool:
        """Verify if a state transition is valid."""
        if current_state not in VALID_TRANSITIONS:
            return False
        return target_state in VALID_TRANSITIONS[current_state]

    @staticmethod
    def transition_to(request_id: str, target_state: str, actor_role: str, action_taken: str) -> bool:
        """
        Transition a request to a new state, updating the DB and writing to the audit log.
        """
        if target_state not in STATES:
            raise ValueError(f"Invalid state: {target_state}")

        conn = get_conn()
        cursor = conn.cursor()
        
        # Get current state
        cursor.execute("SELECT status, session_id FROM requests WHERE id = ?", (request_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            raise ValueError(f"Request with ID {request_id} not found")
            
        current_state = row[0] or "CREATED"
        session_id = row[1] or ""

        # Validate transition
        if not RequestStateMachine.can_transition(current_state, target_state):
            conn.close()
            return False

        # Perform transition
        now = datetime.datetime.now().isoformat()
        cursor.execute(
            "UPDATE requests SET status = ?, updated_at = ? WHERE id = ?",
            (target_state, now, request_id)
        )
        conn.commit()
        conn.close()

        # Audit log transition
        add_audit(
            session_id=session_id,
            actor_role=actor_role,
            action=action_taken,
            target=f"request:{request_id}",
            result=f"State transitioned from {current_state} to {target_state}"
        )

        return True
