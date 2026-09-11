from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from apps.core.viewset_mixins import TenantScopedMixin
from apps.rbac.permissions import HasPermission
from apps.responses.models import SurveyResponse
from apps.responses.serializers import (
    RejectResponseSerializer,
    ResponseDetailSerializer,
    ResponseListSerializer,
)
from apps.responses.services import approve_response, reject_response


class ResponseViewSet(TenantScopedMixin, ReadOnlyModelViewSet):
    """
    Creation happens through the sync API (apps.responses.sync_views), not
    here -- the sync endpoints implement the idempotency and chained-item
    contract an offline client depends on. This viewset is the admin/
    supervisor-facing read, review and export surface.
    """

    module_code = "responses"
    # POST covers both the `approve` and `reject` actions below -- both are
    # review actions gated on the same "approve" permission, checked again
    # (redundantly, but harmlessly) by `_require_action` in each method.
    # HasPermission fails closed for any method with no entry here, so a
    # missing "POST" mapping used to deny approve/reject to everyone,
    # including admins, with a generic 403 before either method ever ran.
    REQUIRED_ACTIONS = {"GET": "view", "POST": "approve", "PATCH": "edit", "DELETE": "delete"}
    permission_classes = [HasPermission]
    filterset_fields = ["survey", "survey_version", "status", "assignment"]
    search_fields = ["response_code", "respondent__full_name", "respondent__phone"]
    ordering_fields = ["submitted_at", "duration_seconds", "status"]
    ordering = ["-submitted_at"]

    def get_queryset(self):
        from apps.responses.scoping import scope_responses

        qs = SurveyResponse.objects.select_related(
            "survey", "survey__category", "survey_version", "respondent"
        ).prefetch_related("flags", "attachments", "reviews").filter(is_deleted=False)
        return scope_responses(qs, self.request.user)

    def get_serializer_class(self):
        return ResponseListSerializer if self.action == "list" else ResponseDetailSerializer

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        response = self.get_object()
        self._require_action("approve")
        approve_response(response, request.user)
        return Response(ResponseDetailSerializer(response, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        response = self.get_object()
        self._require_action("approve")  # reject shares the `approve` permission -- both are review actions
        serializer = RejectResponseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reject_response(response, request.user, **serializer.validated_data)
        return Response(ResponseDetailSerializer(response, context={"request": request}).data)

    def _require_action(self, action_code: str):
        from apps.rbac.services import user_has_permission

        if not user_has_permission(self.request.user, "responses", action_code):
            raise ValidationError({"detail": "You do not have permission to review responses."})
