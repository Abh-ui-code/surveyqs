"""
Row-level visibility for surveys -- the same "admin/analyst see
everything; a supervisor sees their team's; an agent sees only their own"
rule as apps.responses.scoping and apps.respondents.scoping, applied to
which *surveys* show up at all. "Own" for a survey means "assigned to
me" -- see apps.assignments.scoping.scope_assignments for the read-side
equivalent and apps.responses.services._assert_active_assignment for the
write-side rule this mirrors.
"""
from django.db.models import Q

from apps.rbac.services import user_has_role


def scope_surveys(qs, user):
    if user.is_superadmin or user_has_role(user, "admin") or user_has_role(user, "analyst"):
        return qs

    from apps.assignments.models import SurveyAssignment

    if user_has_role(user, "supervisor"):
        from apps.assignments.scoping import _agent_ids_for_supervisor

        agent_ids = list(_agent_ids_for_supervisor(user.id)) + [user.id]
        survey_ids = SurveyAssignment.objects.filter(status="active").filter(
            Q(assignee_type="user", assignee_user_id__in=agent_ids)
            | Q(assignee_type="team", assignee_team__supervisor_user_id=user.id)
        ).values_list("survey_id", flat=True)
        return qs.filter(id__in=survey_ids)

    # agent: only surveys assigned to them, direct or via a team they belong to
    survey_ids = SurveyAssignment.objects.filter(status="active").filter(
        Q(assignee_type="user", assignee_user_id=user.id)
        | Q(assignee_type="team", assignee_team__members__user_id=user.id)
    ).values_list("survey_id", flat=True)
    return qs.filter(id__in=survey_ids)
