"""
The submit pipeline -- the highest-traffic, highest-stakes code in the
product. Implements the ten-step sequence documented in
docs/api/SYNC_API.md "Server-side submission pipeline": idempotency first,
then version/assignment/consent gates, then relevance-aware validation,
then one atomic write of the typed rows and the JSONB document together.
"""
from datetime import datetime, timezone as dt_timezone

from django.db import transaction
from django.utils import timezone

from apps.formlogic.validate import validate_submission
from apps.responses.answer_storage import build_answer_rows
from apps.responses.exceptions import SubmissionConflict, SubmissionRejected
from apps.responses.models import Answer, ResponseReview, SurveyResponse
from apps.responses.numbering import next_response_code
from apps.surveys.models import Survey, SurveyVersion


def _parse_dt(value) -> datetime:
    if isinstance(value, datetime):
        return value
    dt = datetime.fromisoformat(value.replace("Z", "+00:00")) if isinstance(value, str) else value
    return dt if dt.tzinfo else dt.replace(tzinfo=dt_timezone.utc)


def _resolve_version(payload: dict) -> SurveyVersion:
    try:
        version = SurveyVersion.objects.select_related("survey").get(
            id=payload["survey_version_id"], survey_id=payload["survey_id"], status="published"
        )
    except SurveyVersion.DoesNotExist as exc:
        raise SubmissionRejected("invalid_version", "This survey version does not exist or is not published.") from exc

    survey: Survey = version.survey
    if survey.status == "archived":
        raise SubmissionRejected("survey_archived", "This survey has been archived.")
    if survey.status == "closed":
        from django.conf import settings

        if survey.closed_at is None:
            raise SubmissionRejected("survey_closed", "This survey has been closed.")
        grace_deadline = survey.closed_at + timezone.timedelta(days=settings.SURVEY_CLOSE_GRACE_DAYS)
        if timezone.now() > grace_deadline:
            # An agent offline for longer than the grace window: the work is
            # rejected but not lost -- it stays queued in Sync Review for a
            # human decision, per docs/product/SURVEY_LIFECYCLE.md.
            raise SubmissionRejected(
                "survey_closed",
                f"This survey closed more than {settings.SURVEY_CLOSE_GRACE_DAYS} days ago and no longer accepts submissions.",
            )
    return version


def _assert_active_assignment(user, survey_id, started_at: datetime):
    from apps.assignments.models import SurveyAssignment
    from apps.assignments.services import user_has_active_assignment
    from apps.rbac.services import user_has_role

    # Admins have full access to every module, unconditionally -- see the
    # same rule enforced in apps.rbac.services.user_has_permission and
    # stated outright on the Roles & Permissions screen. An assignment
    # tracks an agent's field workload; it must never become a wall an
    # admin has to work around to test or fix a survey.
    if user.is_superadmin or user_has_role(user, "admin"):
        return
    if user_has_active_assignment(user.id, survey_id):
        return
    # Might have been active when the interview started and revoked since --
    # accept work done while the assignment was genuinely active.
    revoked = SurveyAssignment.objects.filter(
        survey_id=survey_id, assignee_type="user", assignee_user_id=user.id, status="revoked",
        revoked_at__gt=started_at,
    ).exists()
    if revoked:
        return
    raise SubmissionConflict("no_active_assignment", "You do not have an active assignment for this survey.")


def _assert_consent(survey: Survey, respondent_id):
    if not survey.settings.get("consent_required"):
        return
    if survey.settings.get("anonymous"):
        return
    from apps.respondents.models import ConsentRecord

    has_consent = ConsentRecord.objects.filter(
        respondent_id=respondent_id, is_withdrawn=False
    ).exists()
    if not has_consent:
        raise SubmissionRejected("consent_missing", "This survey requires consent, and none was recorded.")


@transaction.atomic
def submit_response(*, user, payload: dict) -> tuple[SurveyResponse, str, list[dict]]:
    """Returns (response, 'created'|'updated', warnings)."""
    client_ref_id = payload.get("client_ref_id")
    if client_ref_id:
        existing = SurveyResponse.objects.filter(client_ref_id=client_ref_id).first()
        if existing:
            return existing, "updated", []

    version = _resolve_version(payload)
    started_at = _parse_dt(payload["started_at"])
    submitted_at = _parse_dt(payload["submitted_at"])

    _assert_active_assignment(user, payload["survey_id"], started_at)

    respondent_id = payload.get("respondent", {}).get("id") if payload.get("respondent") else None
    _assert_consent(version.survey, respondent_id)

    outcome = validate_submission(version.schema_json, payload.get("answers", {}))
    if not outcome.is_valid:
        raise SubmissionRejected(
            "validation_failed",
            f"{len(outcome.errors)} question(s) failed validation.",
            errors=[{"question_code": e.question_code, "code": e.code, "message": e.message} for e in outcome.errors],
        )

    gps = payload.get("gps") or {}
    device = payload.get("device") or {}

    response = SurveyResponse.objects.create(
        response_code=next_response_code(),
        survey=version.survey, survey_version=version,
        assignment_id=payload.get("assignment_id"), respondent_id=respondent_id,
        collected_by_id=user.id,
        status="under_review" if version.survey.settings.get("auto_approve") is False else "submitted",
        answers=outcome.answers,
        started_at=started_at, submitted_at=submitted_at,
        duration_seconds=int((submitted_at - started_at).total_seconds()),
        gps_lat=gps.get("lat"), gps_lng=gps.get("lng"),
        gps_accuracy_m=gps.get("accuracy_m"), gps_captured_at=gps.get("captured_at"),
        device_id=device.get("id", ""), app_version=device.get("app_version", ""),
        os_version=device.get("os", ""), was_offline=payload.get("was_offline", False),
        client_ref_id=client_ref_id,
    )
    Answer.objects.bulk_create(build_answer_rows(response, version.schema_json, outcome.answers))

    version.response_count = version.responses.filter(is_deleted=False).count()
    version.save(update_fields=["response_count"])

    transaction.on_commit(lambda: _evaluate_quality_flags(response.id))
    return response, "created", outcome.warnings


def _evaluate_quality_flags(response_id):
    from apps.responses.quality import evaluate_quality_flags

    evaluate_quality_flags(response_id)


@transaction.atomic
def approve_response(response: SurveyResponse, reviewer):
    response.status = "approved"
    response.save(update_fields=["status"])
    ResponseReview.objects.create(response=response, action="approve", reviewer_id=reviewer.id)
    return response


@transaction.atomic
def reject_response(response: SurveyResponse, reviewer, *, reason_code: str, notes: str = ""):
    response.status = "rejected"
    response.save(update_fields=["status"])
    ResponseReview.objects.create(
        response=response, action="reject", reviewer_id=reviewer.id, reason_code=reason_code, notes=notes
    )
    return response
