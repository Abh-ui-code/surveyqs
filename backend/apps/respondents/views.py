from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from apps.core.viewset_mixins import TenantScopedMixin
from apps.rbac.permissions import HasPermission
from apps.respondents.models import ConsentNotice, ConsentRecord, Respondent
from apps.respondents.serializers import (
    ConsentNoticeSerializer,
    ConsentRecordSerializer,
    RespondentLookupResultSerializer,
    RespondentSerializer,
)
from apps.respondents.services import (
    create_or_reuse_respondent,
    lookup_duplicate,
    withdraw_consent,
)


class RespondentViewSet(TenantScopedMixin, ModelViewSet):
    module_code = "respondents"
    REQUIRED_ACTIONS = {"GET": "view", "POST": "create", "PATCH": "edit", "PUT": "edit", "DELETE": "delete"}
    permission_classes = [HasPermission]
    serializer_class = RespondentSerializer
    search_fields = ["full_name", "phone", "identity_number"]

    def get_queryset(self):
        from apps.respondents.scoping import scope_respondents

        qs = Respondent.objects.filter(is_deleted=False).order_by("-created_at")
        return scope_respondents(qs, self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        respondent, created = create_or_reuse_respondent(
            data={k: v for k, v in serializer.validated_data.items() if k != "client_ref_id"},
            client_ref_id=serializer.validated_data.get("client_ref_id"),
            actor=request.user,
        )
        status_code = 201 if created else 200
        return Response(RespondentSerializer(respondent).data, status=status_code)

    @action(detail=False, methods=["get"])
    def lookup(self, request):
        match = lookup_duplicate(
            phone=request.query_params.get("phone", ""),
            identity_number=request.query_params.get("identity_number", ""),
        )
        if match is None:
            return Response(status=204)
        return Response(RespondentLookupResultSerializer(
            {"matched_on": match.matched_on, "respondent": match.respondent}
        ).data)

    @action(detail=True, methods=["post"], url_path="withdraw-consent")
    def withdraw_consent_action(self, request, pk=None):
        respondent = self.get_object()
        withdraw_consent(respondent, actor=request.user)
        return Response(RespondentSerializer(respondent).data)

    @action(detail=True, methods=["post"])
    def anonymise(self, request, pk=None):
        respondent = self.get_object()
        respondent.anonymise(actor=request.user)
        return Response(RespondentSerializer(respondent).data)


class ConsentNoticeViewSet(TenantScopedMixin, ReadOnlyModelViewSet):
    module_code = "respondents"
    REQUIRED_ACTIONS = {"GET": "view"}
    permission_classes = [HasPermission]
    serializer_class = ConsentNoticeSerializer

    def get_queryset(self):
        return ConsentNotice.objects.filter(is_active=True)


class ConsentRecordViewSet(TenantScopedMixin, ModelViewSet):
    module_code = "respondents"
    REQUIRED_ACTIONS = {"GET": "view", "POST": "create"}
    permission_classes = [HasPermission]
    serializer_class = ConsentRecordSerializer
    filterset_fields = ["respondent"]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return ConsentRecord.objects.select_related("notice").order_by("-granted_at")

    def create(self, request, *args, **kwargs):
        from apps.respondents.services import capture_consent

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        record, created = capture_consent(
            respondent=data.get("respondent"), notice=data["notice"], method=data["method"],
            granted_at=data.get("granted_at"), captured_by=request.user,
            captured_offline=data.get("captured_offline", False), purposes=data.get("purposes"),
            signature_attachment_id=data.get("signature_attachment_id"),
            client_ref_id=data.get("client_ref_id"),
        )
        return Response(ConsentRecordSerializer(record).data, status=201 if created else 200)
