"""
Thread-local storage for "who is making this request", read by the audit
signal handlers when a tracked model saves. Set by AuditActorMiddleware
(request-response cycle) and re-set by TenantScopedMixin.initial() once DRF
authentication has actually resolved the user -- middleware alone only knows
about Django's session-based `request.user`, which is irrelevant for a
JWT-only API.
"""
import threading

_local = threading.local()


def set_actor(user=None, ip_address: str | None = None, user_agent: str = "", request_id: str = ""):
    _local.user = user
    _local.ip_address = ip_address
    _local.user_agent = user_agent
    _local.request_id = request_id


def get_actor() -> dict:
    return {
        "user": getattr(_local, "user", None),
        "ip_address": getattr(_local, "ip_address", None),
        "user_agent": getattr(_local, "user_agent", ""),
        "request_id": getattr(_local, "request_id", ""),
    }


def clear_actor():
    for attr in ("user", "ip_address", "user_agent", "request_id"):
        if hasattr(_local, attr):
            delattr(_local, attr)
