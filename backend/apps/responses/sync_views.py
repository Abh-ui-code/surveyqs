"""
The mobile sync API -- a thin, purpose-built facade over the same services
the web endpoints use (never a second implementation of the business
rules). See docs/api/SYNC_API.md for the full wire contract this
implements.
"""
from django.conf import settings
from django.utils import timezone
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.assignments.services import assignments_for_agent
from apps.respondents.services import capture_consent, create_or_reuse_respondent
from apps.responses.exceptions import SubmissionConflict, SubmissionRejected
from apps.responses.models import ResponseAttachment, SurveyResponse
from apps.responses.services import submit_response


class SyncBootstrapView(APIView):
    """One call on sign-in: everything the app needs to start working."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "sync"

    def get(self, request):
        from apps.core.tenant_context import current_tenant
        from apps.rbac.services import user_permission_summary
        from apps.respondents.models import ConsentNotice

        tenant = current_tenant(request)
        return Response(
            {
                "user": {"id": str(request.user.id), "full_name": request.user.full_name, "email": request.user.email},
                "permissions": user_permission_summary(request.user),
                "tenant": {"name": tenant.name, "subdomain": tenant.subdomain} if tenant else None,
                "settings": {
                    "attachment_limits": {
                        "image": settings.MAX_UPLOAD_IMAGE_BYTES,
                        "audio": settings.MAX_UPLOAD_AUDIO_BYTES,
                        "file": settings.MAX_UPLOAD_FILE_BYTES,
                    },
                    "survey_close_grace_days": settings.SURVEY_CLOSE_GRACE_DAYS,
                },
                "consent_notices": [
                    {"id": str(n.id), "version": n.version, "language": n.language, "text": n.text}
                    for n in ConsentNotice.objects.filter(is_active=True)
                ],
                "server_time": timezone.now().isoformat(),
            }
        )


class SyncAssignmentsView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "sync"

    def get(self, request):
        assignments = assignments_for_agent(request.user.id).select_related("survey", "survey__category")
        data = []
        for a in assignments:
            version = a.survey.current_version
            data.append(
                {
                    "id": str(a.id),
                    "survey": {
                        "id": str(a.survey_id), "title": a.survey.title,
                        "category": {"code": a.survey.category.code, "label": a.survey.category.label},
                    },
                    "version": (
                        {"id": str(version.id), "version_number": version.version_number, "schema_hash": version.schema_hash}
                        if version else None
                    ),
                    "target_count": a.target_count,
                    "submitted_count": SurveyResponse.objects.filter(assignment=a, is_deleted=False).count(),
                    "due_date": a.due_date,
                    "priority": a.priority,
                    "instructions": a.instructions,
                    "status": a.status,
                    "survey_status": a.survey.status,
                }
            )
        return Response({"assignments": data, "server_time": timezone.now().isoformat()})


class SyncPackageView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "sync"

    def get(self, request, version_id):
        from apps.surveys.models import SurveyVersion

        version = SurveyVersion.objects.get(id=version_id, status="published")
        if_none_match = request.META.get("HTTP_IF_NONE_MATCH", "").strip('"')
        if if_none_match == version.schema_hash:
            return Response(status=304)
        response = Response(version.schema_json)
        response["ETag"] = f'"{version.schema_hash}"'
        response["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


class SyncBatchView(APIView):
    """
    Processes a chain of items in order, each in its own transaction, so one
    failure does not roll back the successes before it. See
    docs/api/SYNC_API.md for the item kinds and the per-item response shape.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "sync"

    def post(self, request):
        items = request.data.get("items", [])
        results = []
        server_ids: dict[str, str] = {}
        failed_refs: set[str] = set()

        for item in items:
            ref = item.get("ref")
            parent_ref = item.get("parent_ref")
            if parent_ref and parent_ref in failed_refs:
                results.append({"ref": ref, "status": "skipped", "reason": "parent_failed"})
                failed_refs.add(ref)
                continue

            payload = dict(item.get("payload", {}))
            if parent_ref and parent_ref in server_ids:
                payload["_parent_server_id"] = server_ids[parent_ref]

            try:
                outcome = self._dispatch(item["kind"], payload)
                results.append({"ref": ref, **outcome})
                if "id" in outcome:
                    server_ids[ref] = outcome["id"]
            except SubmissionConflict as exc:
                results.append({"ref": ref, "status": "conflict", "code": exc.code, "detail": exc.detail, **exc.extra})
                failed_refs.add(ref)
            except SubmissionRejected as exc:
                results.append({"ref": ref, "status": "rejected", "code": exc.code, "detail": exc.detail, "errors": exc.errors})
                failed_refs.add(ref)

        return Response({"results": results, "server_time": timezone.now().isoformat()})

    def _dispatch(self, kind, payload):
        if kind == "respondent.create":
            client_ref_id = payload.pop("client_ref_id", None)
            respondent, created = create_or_reuse_respondent(
                data=payload, client_ref_id=client_ref_id, actor=self.request.user
            )
            return {"status": "created" if created else "updated", "id": str(respondent.id)}

        if kind == "consent.create":
            from apps.respondents.models import ConsentNotice, Respondent

            client_ref_id = payload.pop("client_ref_id", None)
            respondent_id = payload.get("respondent_id") or payload.pop("_parent_server_id", None)
            respondent = Respondent.objects.get(id=respondent_id) if respondent_id else None
            notice = ConsentNotice.objects.get(id=payload["notice_id"])
            record, created = capture_consent(
                respondent=respondent, notice=notice, method=payload["method"],
                granted_at=payload.get("granted_at"), captured_by=self.request.user,
                captured_offline=payload.get("captured_offline", False),
                purposes=payload.get("purposes"), signature_attachment_id=payload.get("signature_attachment_id"),
                client_ref_id=client_ref_id,
            )
            return {"status": "created" if created else "updated", "id": str(record.id)}

        if kind == "response.submit":
            if "_parent_server_id" in payload and "respondent" not in payload:
                payload["respondent"] = {"id": payload.pop("_parent_server_id")}
            response, verb, warnings = submit_response(user=self.request.user, payload=payload)
            return {"status": verb, "id": str(response.id), "response_code": response.response_code, "warnings": warnings}

        raise SubmissionRejected("unknown_kind", f"Unknown item kind: {kind!r}")


class SyncAttachmentUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "sync"

    def post(self, request):
        client_ref_id = request.data.get("client_ref_id")
        if client_ref_id:
            existing = ResponseAttachment.objects.filter(client_ref_id=client_ref_id).first()
            if existing:
                return Response({"id": str(existing.id), "status": "already_stored"})

        uploaded = request.FILES.get("file")
        from apps.core.file_validation import validate_file_kind

        allowed_by_kind = {
            "image": {"jpeg", "png", "gif"},
            "audio": set(),  # audio/video magic-byte detection is out of MVP scope
            "signature": {"png"},
        }
        kind = request.data.get("kind", "file")
        if kind in allowed_by_kind and allowed_by_kind[kind]:
            validate_file_kind(uploaded, allowed_by_kind[kind])

        attachment = ResponseAttachment.objects.create(
            response_id=request.data["response_id"],
            question_code=request.data.get("question_code", ""),
            kind=kind,
            file=uploaded,
            filename=uploaded.name,
            size_bytes=uploaded.size,
            checksum=request.data.get("checksum", ""),
            captured_at=request.data.get("captured_at") or None,
            client_ref_id=client_ref_id,
        )
        return Response({"id": str(attachment.id), "status": "stored"}, status=201)


class SyncHeartbeatView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "sync"

    def post(self, request):
        return Response({"server_time": timezone.now().isoformat(), "has_updates": True})
