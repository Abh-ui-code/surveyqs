from rest_framework.viewsets import ReadOnlyModelViewSet

from apps.core.viewset_mixins import TenantScopedMixin
from apps.rbac.permissions import HasPermission
from apps.responses.models import SurveyResponse
from apps.responses.serializers import ResponseDetailSerializer, ResponseListSerializer


class ResponseViewSet(TenantScopedMixin, ReadOnlyModelViewSet):
    """
    Creation happens through the sync API (apps.responses.sync_views), not
    here -- the sync endpoints implement the idempotency and chained-item
    contract an offline client depends on. This viewset is the admin/
    supervisor-facing read and export surface. A submission is final the
    moment it lands -- there is no review/approve step here to gate.
    """

    module_code = "responses"
    REQUIRED_ACTIONS = {"GET": "view", "PATCH": "edit", "DELETE": "delete"}
    permission_classes = [HasPermission]
    filterset_fields = ["survey", "survey_version", "status", "assignment", "respondent"]
    search_fields = ["response_code", "respondent__full_name", "respondent__phone"]
    ordering_fields = ["submitted_at", "duration_seconds", "status"]
    ordering = ["-submitted_at"]

    def get_queryset(self):
        from apps.responses.scoping import scope_responses

        qs = SurveyResponse.objects.select_related(
            "survey", "survey__category", "survey_version", "respondent"
        ).prefetch_related("flags", "attachments").filter(is_deleted=False)
        return scope_responses(qs, self.request.user)

    def get_serializer_class(self):
        return ResponseListSerializer if self.action == "list" else ResponseDetailSerializer
