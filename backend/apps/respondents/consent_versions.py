"""
Read-only "Consent versions" views: per survey, the history of its consent
document (v1, v2, ...), how many consents were captured against each, the
captured consents themselves, and downloads of any version's document.

A survey's versions are the `ConsentNotice` rows linked to it (see
`ConsentNotice.survey` / `survey_version`); the *latest* is the highest
`survey_version`. Notices that predate that link and could not be matched
to a survey are not shown here.
"""
import os
import uuid

from django.db.models import Count, Max, Min, Q
from django.http import FileResponse, Http404, HttpResponse
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from apps.core.pagination import PageSizePagination
from apps.core.viewset_mixins import TenantScopedMixin
from apps.rbac.permissions import HasPermission
from apps.respondents.models import ConsentNotice, ConsentRecord
from apps.surveys.models import Survey


def _parse_uuid(value, what="id"):
    try:
        return uuid.UUID(str(value))
    except ValueError:
        raise NotFound(f"{what} not found.")


def _file_url(request, notice: ConsentNotice):
    if not notice.source_file:
        return None
    return request.build_absolute_uri(notice.source_file.url)


def _version_rows(request, survey: Survey):
    notices = list(ConsentNotice.objects.filter(survey=survey).order_by("-survey_version"))
    stats = {
        row["notice_id"]: row
        for row in ConsentRecord.objects.filter(notice__survey=survey)
        .values("notice_id")
        .annotate(
            total=Count("id"),
            withdrawn=Count("id", filter=Q(is_withdrawn=True)),
            first=Min("granted_at"),
            last=Max("granted_at"),
        )
    }
    current_id = str(survey.settings.get("consent_notice_id") or "")
    latest = notices[0].survey_version if notices else None
    rows = []
    for n in notices:
        s = stats.get(n.id, {})
        rows.append(
            {
                "id": n.id,
                "version_number": n.survey_version,
                "language": n.language,
                "uploaded_at": n.created_at,
                "is_latest": n.survey_version == latest,
                "is_current": str(n.id) == current_id,
                "has_file": bool(n.source_file),
                "filename": os.path.basename(n.source_file.name) if n.source_file else None,
                "text": n.text,
                "consents": s.get("total", 0),
                "withdrawn": s.get("withdrawn", 0),
                "first_consent_at": s.get("first"),
                "last_consent_at": s.get("last"),
            }
        )
    return rows


class ConsentVersionViewSet(TenantScopedMixin, ViewSet):
    module_code = "settings"
    REQUIRED_ACTIONS = {"GET": "view"}
    permission_classes = [HasPermission]

    def list(self, request):
        """Every survey, with a one-line summary of its consent history."""
        surveys = list(Survey.objects.filter(is_deleted=False).select_related("category"))

        notice_stats = {
            row["survey_id"]: row
            for row in ConsentNotice.objects.filter(survey__isnull=False)
            .values("survey_id")
            .annotate(versions=Count("id"), latest=Max("survey_version"))
        }
        record_stats = {
            row["notice__survey_id"]: row
            for row in ConsentRecord.objects.filter(notice__survey__isnull=False)
            .values("notice__survey_id")
            .annotate(total=Count("id"), withdrawn=Count("id", filter=Q(is_withdrawn=True)), last=Max("granted_at"))
        }
        latest_notices = {
            (n.survey_id, n.survey_version): n
            for n in ConsentNotice.objects.filter(survey__isnull=False).only(
                "id", "survey_id", "survey_version", "created_at", "source_file"
            )
        }

        rows = []
        for s in surveys:
            ns = notice_stats.get(s.id, {})
            rs = record_stats.get(s.id, {})
            latest = latest_notices.get((s.id, ns.get("latest")))
            rows.append(
                {
                    "survey_id": s.id,
                    "title": s.title,
                    "category_label": s.category.label,
                    "survey_status": s.status,
                    "consent_required": bool(s.settings.get("consent_required")),
                    "versions": ns.get("versions", 0),
                    "latest_version": ns.get("latest"),
                    "latest_uploaded_at": latest.created_at if latest else None,
                    "latest_has_file": bool(latest and latest.source_file),
                    "consents": rs.get("total", 0),
                    "withdrawn": rs.get("withdrawn", 0),
                    "last_consent_at": rs.get("last"),
                }
            )
        # Surveys that actually use consent first, busiest first.
        rows.sort(key=lambda r: (not r["consent_required"], r["versions"] == 0, -r["consents"], r["title"].lower()))
        return Response(
            {
                "totals": {
                    "surveys": len(rows),
                    "with_consent": sum(1 for r in rows if r["consent_required"]),
                    "versions": sum(r["versions"] for r in rows),
                    "consents": sum(r["consents"] for r in rows),
                },
                "surveys": rows,
            }
        )

    def retrieve(self, request, pk=None):
        survey_id = _parse_uuid(pk, "Survey")
        survey = Survey.objects.filter(id=survey_id, is_deleted=False).select_related("category").first()
        if survey is None:
            raise NotFound("Survey not found.")
        versions = _version_rows(request, survey)
        records = ConsentRecord.objects.filter(notice__survey=survey)
        return Response(
            {
                "survey": {
                    "id": survey.id,
                    "title": survey.title,
                    "category_label": survey.category.label,
                    "status": survey.status,
                    "consent_required": bool(survey.settings.get("consent_required")),
                },
                "totals": {
                    "versions": len(versions),
                    "latest_version": versions[0]["version_number"] if versions else None,
                    "consents": sum(v["consents"] for v in versions),
                    "withdrawn": sum(v["withdrawn"] for v in versions),
                    "respondents": records.values("respondent_id").distinct().count(),
                },
                "versions": versions,
            }
        )

    @action(detail=True, methods=["get"])
    def records(self, request, pk=None):
        """The consents captured for this survey, newest first. `?version=N`
        narrows to one version; paginated like every other list."""
        survey_id = _parse_uuid(pk, "Survey")
        if not Survey.objects.filter(id=survey_id, is_deleted=False).exists():
            raise NotFound("Survey not found.")
        qs = ConsentRecord.objects.filter(notice__survey_id=survey_id).select_related("notice", "respondent")
        version = request.query_params.get("version")
        if version:
            if not version.isdigit():
                raise ValidationError({"version": "Must be a version number."})
            qs = qs.filter(notice__survey_version=int(version))
        qs = qs.annotate(response_count=Count("responses")).order_by("-granted_at")

        paginator = PageSizePagination()
        page = paginator.paginate_queryset(qs, request)

        from apps.users.models import User

        captured_by = {
            str(u.id): u.full_name or u.email
            for u in User.objects.filter(id__in={r.captured_by_id for r in page if r.captured_by_id})
        }
        data = [
            {
                "id": r.id,
                "respondent": r.respondent_id,
                "respondent_name": r.respondent.full_name if r.respondent else None,
                "version_number": r.notice.survey_version,
                "method": r.method,
                "granted_at": r.granted_at,
                "captured_by_name": captured_by.get(str(r.captured_by_id)),
                "captured_offline": r.captured_offline,
                "is_withdrawn": r.is_withdrawn,
                "signature_url": request.build_absolute_uri(r.signature_image.url) if r.signature_image else None,
                "response_count": r.response_count,
            }
            for r in page
        ]
        return paginator.get_paginated_response(data)

    @action(detail=False, methods=["get"], url_path=r"notices/(?P<notice_id>[^/.]+)/download")
    def download(self, request, notice_id=None):
        """The version's uploaded document as-is, or -- when it was typed in
        rather than uploaded -- its text as a .txt, so every version has
        something to download."""
        notice = ConsentNotice.objects.filter(id=_parse_uuid(notice_id, "Consent version")).select_related("survey").first()
        if notice is None:
            raise NotFound("Consent version not found.")
        if notice.source_file:
            try:
                handle = notice.source_file.open("rb")
            except FileNotFoundError:
                raise Http404("The stored document is missing.")
            return FileResponse(handle, as_attachment=True, filename=os.path.basename(notice.source_file.name))

        title = notice.survey.title if notice.survey else "consent"
        safe = "".join(c if c.isalnum() or c in " -_" else "" for c in title).strip().replace(" ", "-") or "consent"
        response = HttpResponse(notice.text, content_type="text/plain; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{safe}-consent-v{notice.survey_version or notice.version}.txt"'
        return response
