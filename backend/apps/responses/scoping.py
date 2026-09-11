"""
Row-level visibility for responses -- the mechanism that makes "an admin
sees every response across every survey; an agent sees only their own"
true. Permissions (HasPermission) answer *may*; this answers *which*, and
it is always applied in `get_queryset`, never trusted to the client.

A record outside a caller's scope is unreachable by id as well as by list
-- the detail view calls this same function, so requesting a foreign
response's id returns 404, never 403 (confirming a record exists but
belongs to someone else is an unnecessary leak).
"""
from apps.rbac.services import user_has_role


def scope_responses(qs, user):
    if user.is_superadmin or user_has_role(user, "admin") or user_has_role(user, "analyst"):
        return qs
    if user_has_role(user, "supervisor"):
        from apps.assignments.scoping import _agent_ids_for_supervisor

        return qs.filter(collected_by_id__in=list(_agent_ids_for_supervisor(user.id)) + [user.id])
    return qs.filter(collected_by_id=user.id)  # agent: their own, and only their own
