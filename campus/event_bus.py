# ============================================================
# campus/event_bus.py — Lightweight In-Process Event Bus
# ============================================================
# Implements an event-driven architecture for CampusGPT OS.
# Events flow: request → dispatcher → worker → DB update → UI
#
# Design: async-ready but works synchronously today.
# Upgrade path: swap _queue for Redis streams for multi-process.
# ============================================================

import queue
import threading
import datetime
import traceback
from typing import Callable, Dict, List, Any


# ── EVENT TYPES ──────────────────────────────────────────────────
class Events:
    REQUEST_CREATED      = "request.created"
    REQUEST_CLASSIFIED   = "request.classified"
    REQUEST_POLICY_DONE  = "request.policy_done"
    REQUEST_APPROVED     = "request.approved"
    REQUEST_REJECTED     = "request.rejected"
    REQUEST_ESCALATED    = "request.escalated"
    REQUEST_COMPLETED    = "request.completed"
    AGENT_STEP_DONE      = "agent.step_done"
    NOTIFICATION_SENT    = "notification.sent"
    ERROR_OCCURRED       = "error.occurred"
    SYSTEM_AUDIT         = "system.audit"


class Event:
    """A typed event payload that flows through the bus."""
    def __init__(self, event_type: str, payload: dict, session_id: str = "", request_id: str = ""):
        self.event_type = event_type
        self.payload = payload
        self.session_id = session_id
        self.request_id = request_id
        self.timestamp = datetime.datetime.now().isoformat()
        self.id = f"{event_type}:{session_id}:{self.timestamp}"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "event_type": self.event_type,
            "payload": self.payload,
            "session_id": self.session_id,
            "request_id": self.request_id,
            "timestamp": self.timestamp,
        }


class EventBus:
    """
    Thread-safe in-process event bus.
    
    Supports:
    - publish(event): fire and forget
    - subscribe(event_type, handler): register a handler
    - start_worker(): run background event processing thread
    - stop(): graceful shutdown
    """

    def __init__(self):
        self._queue: queue.Queue = queue.Queue(maxsize=1000)
        self._handlers: Dict[str, List[Callable]] = {}
        self._worker_thread: threading.Thread | None = None
        self._running = False
        self._event_log: list = []  # In-memory ring buffer (last 500 events)
        self._log_lock = threading.Lock()

    def subscribe(self, event_type: str, handler: Callable) -> None:
        """Register a handler for an event type. Supports wildcards via '*'."""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)

    def publish(self, event: Event) -> None:
        """Publish an event to the bus (non-blocking). Drops if queue full."""
        try:
            self._queue.put_nowait(event)
            self._log_event(event)
        except queue.Full:
            pass  # Graceful degradation if bus is overloaded

    def emit(self, event_type: str, payload: dict, session_id: str = "", request_id: str = "") -> Event:
        """Convenience method to create and publish an event."""
        event = Event(event_type, payload, session_id, request_id)
        self.publish(event)
        return event

    def start_worker(self) -> None:
        """Start the background event processing thread."""
        if self._worker_thread and self._worker_thread.is_alive():
            return
        self._running = True
        self._worker_thread = threading.Thread(
            target=self._process_loop,
            daemon=True,
            name="EventBusWorker",
        )
        self._worker_thread.start()

    def stop(self) -> None:
        """Stop the background worker gracefully."""
        self._running = False
        # Poison pill to unblock the queue
        self._queue.put(None)
        if self._worker_thread:
            self._worker_thread.join(timeout=5)

    def _process_loop(self) -> None:
        """Background thread: dequeue and dispatch events."""
        while self._running:
            try:
                event = self._queue.get(timeout=1)
                if event is None:  # Poison pill
                    break
                self._dispatch(event)
                self._queue.task_done()
            except queue.Empty:
                continue
            except Exception:
                pass  # Never crash the worker

    def _dispatch(self, event: Event) -> None:
        """Fire all registered handlers for this event type."""
        handlers = []
        # Exact match handlers
        handlers.extend(self._handlers.get(event.event_type, []))
        # Wildcard handlers (subscribed to "*")
        handlers.extend(self._handlers.get("*", []))

        for handler in handlers:
            try:
                handler(event)
            except Exception as e:
                pass  # Handler errors must not crash the bus

    def _log_event(self, event: Event) -> None:
        """Append to in-memory event log (ring buffer, max 500)."""
        with self._log_lock:
            self._event_log.append(event.to_dict())
            if len(self._event_log) > 500:
                self._event_log = self._event_log[-500:]

    def get_recent_events(self, session_id: str = None, limit: int = 50) -> list:
        """Return recent events, optionally filtered by session."""
        with self._log_lock:
            events = list(reversed(self._event_log))
        if session_id:
            events = [e for e in events if e.get("session_id") == session_id]
        return events[:limit]

    def get_stats(self) -> dict:
        """Return bus health stats."""
        return {
            "queue_size": self._queue.qsize(),
            "worker_alive": bool(self._worker_thread and self._worker_thread.is_alive()),
            "registered_event_types": list(self._handlers.keys()),
            "total_events_logged": len(self._event_log),
        }


# ── SINGLETON BUS INSTANCE ────────────────────────────────────────
# Import this from anywhere in the app to share the same event bus.
bus = EventBus()


def setup_default_handlers() -> None:
    """
    Register default audit-logging handlers for the global bus.
    Called once at app startup.
    """
    from campus import db

    def on_any_event(event: Event):
        """Log all events to the DB audit table."""
        try:
            db.add_audit(
                session_id=event.session_id or "system",
                actor_role="SYSTEM",
                action=event.event_type,
                target=event.request_id or "–",
                result=str(event.payload.get("result", event.payload.get("status", "–"))),
            )
        except Exception:
            pass

    def on_request_completed(event: Event):
        """Log a completion entry."""
        try:
            if event.payload.get("log_fn"):
                event.payload["log_fn"](f"EVENT: {event.event_type} — request {event.request_id} completed")
        except Exception:
            pass

    bus.subscribe("*", on_any_event)
    bus.subscribe(Events.REQUEST_COMPLETED, on_request_completed)


def start() -> None:
    """Start the event bus worker and register default handlers."""
    setup_default_handlers()
    bus.start_worker()
