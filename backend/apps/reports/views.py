"""
Read-only aggregates. No models of its own. Every query here reads the
typed `Answer` rows or `SurveyResponse` columns directly -- never the
`answers` JSONB document, which is the read-cache for rendering a single
response, not for aggregating across many. See
docs/architecture/ANSWER_STORAGE.md.
"""
from django.utils.dateparse import parse_date
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.rbac.permissions import HasPermission
from apps.responses.models import SurveyResponse
from apps.responses.scoping import scope_responses


class DashboardView(APIView):
    module_code = "reports"
    required_action = "view"
    permission_classes = [IsAuthenticated, HasPermission]

    def get(self, request):
        qs = scope_responses(SurveyResponse.objects.filter(is_deleted=False), request.user)

        since = parse_date(request.query_params.get("since", "")) if request.query_params.get("since") else None
        if since:
            qs = qs.filter(submitted_at__date__gte=since)

        by_category: dict[str, int] = {}
        by_status: dict[str, int] = {}
        for row in qs.values("survey__category__label", "status"):
            by_category[row["survey__category__label"]] = by_category.get(row["survey__category__label"], 0) + 1
            by_status[row["status"]] = by_status.get(row["status"], 0) + 1

        return Response(
            {
                "total_responses": qs.count(),
                "by_category": [{"label": k, "count": v} for k, v in by_category.items()],
                "by_status": [{"status": k, "count": v} for k, v in by_status.items()],
                "flagged_count": qs.filter(flags__isnull=False).distinct().count(),
            }
        )


class SurveySummaryView(APIView):
    """Per-question closed-ended summary for one survey -- the MVP subset
    (select_one distributions). Full cross-version aggregation rules are
    Phase 3, see docs/product/REPORTING_AND_EXPORTS.md."""

    module_code = "reports"
    required_action = "view"
    permission_classes = [IsAuthenticated, HasPermission]

    def get(self, request):
        from apps.responses.models import Answer

        survey_id = request.query_params.get("survey")
        qs = scope_responses(SurveyResponse.objects.filter(is_deleted=False, survey_id=survey_id), request.user)
        response_ids = list(qs.values_list("id", flat=True))

        answers = Answer.objects.filter(response_id__in=response_ids, value_type="text").exclude(value_text="")
        by_question: dict[str, dict[str, int]] = {}
        for row in answers.values("question_code", "value_text"):
            bucket = by_question.setdefault(row["question_code"], {})
            bucket[row["value_text"]] = bucket.get(row["value_text"], 0) + 1

        return Response(
            {
                "response_count": len(response_ids),
                "questions": [
                    {"question_code": code, "distribution": [{"value": v, "count": c} for v, c in dist.items()]}
                    for code, dist in by_question.items()
                ],
            }
        )
