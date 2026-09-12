from django.db import transaction
from django.utils import timezone

from apps.assignments.models import SurveyAssignment


def user_has_active_assignment(user_id, survey_id) -> bool:
    """
    The assignment gate: may this agent work with this survey at all. Reads
    are scoped separately (see apps.responses.scoping) -- this only governs
    downloading a form package, starting a response, and submitting one.
    """
    direct = SurveyAssignment.objects.filter(
        survey_id=survey_id, assignee_type="user", assignee_user_id=user_id, status="active"
    ).exists()
    if direct:
        return True
    return SurveyAssignment.objects.filter(
        survey_id=survey_id, assignee_type="team", status="active",
        assignee_team__members__user_id=user_id,
    ).exists()


def assignments_for_agent(user_id):
    """Every active assignment (direct or via team) covering this agent."""
    from django.db.models import Q

    return SurveyAssignment.objects.filter(status="active").filter(
        Q(assignee_type="user", assignee_user_id=user_id)
        | Q(assignee_type="team", assignee_team__members__user_id=user_id)
    ).distinct()


@transaction.atomic
def create_assignments(*, survey, assignees: list[dict], target_count, due_date, priority, instructions, assigned_by):
    """
    `assignees` is a list of {"type": "user"|"team", "id": <uuid>}. Creates
    one assignment per assignee in a single call, matching
    docs/api/API_REFERENCE.md POST /api/assignments/.
    """
    created = []
    for assignee in assignees:
        kwargs = dict(
            survey=survey, assignee_type=assignee["type"],
            target_count=target_count, due_date=due_date, priority=priority,
            instructions=instructions, assigned_by_id=assigned_by.id, status="active",
        )
        if assignee["type"] == "user":
            kwargs["assignee_user_id"] = assignee["id"]
        else:
            kwargs["assignee_team_id"] = assignee["id"]
        assignment, _ = SurveyAssignment.objects.update_or_create(
            survey=survey, assignee_type=assignee["type"],
            assignee_user_id=assignee.get("id") if assignee["type"] == "user" else None,
            assignee_team_id=assignee.get("id") if assignee["type"] == "team" else None,
            defaults=kwargs,
        )
        created.append(assignment)
    return created


def revoke_assignment(assignment: SurveyAssignment, actor):
    assignment.status = "revoked"
    assignment.revoked_by_id = actor.id
    assignment.revoked_at = timezone.now()
    assignment.save(update_fields=["status", "revoked_by_id", "revoked_at"])
    return assignment


def assignment_progress(assignment: SurveyAssignment) -> dict:
    from apps.responses.models import SurveyResponse

    qs = SurveyResponse.objects.filter(assignment=assignment, is_deleted=False)
    counts = {
        "submitted": qs.count(),
        "approved": qs.filter(status="approved").count(),
        "rejected": qs.filter(status="rejected").count(),
        "under_review": qs.filter(status="under_review").count(),
    }
    return {
        "target_count": assignment.target_count,
        **counts,
        "percent_complete": (
            round(min(counts["submitted"], assignment.target_count) / assignment.target_count * 100)
            if assignment.target_count else None
        ),
    }
