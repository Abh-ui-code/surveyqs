"""
Row-level visibility for assignments. Permissions answer *may*; this
answers *which*. Always applied in `get_queryset`, never in the client.
"""
from django.db.models import Q

from apps.rbac.services import user_has_role


def scope_assignments(qs, user):
    if user.is_superadmin or user_has_role(user, "admin") or user_has_role(user, "analyst"):
        return qs
    if user_has_role(user, "supervisor"):
        return qs.filter(
            Q(assignee_type="user", assignee_user_id__in=_agent_ids_for_supervisor(user.id))
            | Q(assignee_type="team", assignee_team__supervisor_user_id=user.id)
        )
    # agent: only their own, direct or via a team they belong to
    return qs.filter(
        Q(assignee_type="user", assignee_user_id=user.id)
        | Q(assignee_type="team", assignee_team__members__user_id=user.id)
    ).distinct()


def _agent_ids_for_supervisor(supervisor_id):
    from apps.assignments.models import TeamMembership

    return TeamMembership.objects.filter(team__supervisor_user_id=supervisor_id).values_list(
        "user_id", flat=True
    )
