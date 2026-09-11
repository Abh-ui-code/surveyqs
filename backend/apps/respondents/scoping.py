"""Row-level visibility for respondents -- see docs/architecture/AUTH_AND_RBAC.md."""
from apps.rbac.services import user_has_role


def scope_respondents(qs, user):
    if user.is_superadmin or user_has_role(user, "admin") or user_has_role(user, "analyst"):
        return qs
    if user_has_role(user, "supervisor"):
        from apps.assignments.scoping import _agent_ids_for_supervisor
        from apps.responses.models import SurveyResponse

        agent_ids = list(_agent_ids_for_supervisor(user.id)) + [user.id]
        respondent_ids = SurveyResponse.objects.filter(
            collected_by_id__in=agent_ids, is_deleted=False
        ).values_list("respondent_id", flat=True)
        return qs.filter(id__in=respondent_ids) | qs.filter(created_by=user)
    # agent: respondents they created, plus any attached to their own responses
    from apps.responses.models import SurveyResponse

    respondent_ids = SurveyResponse.objects.filter(
        collected_by_id=user.id, is_deleted=False
    ).values_list("respondent_id", flat=True)
    return qs.filter(id__in=respondent_ids) | qs.filter(created_by=user)
