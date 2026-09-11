from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.permissions import IsSuperAdmin
from apps.superadmin.serializers import TenantCreateSerializer, TenantListSerializer
from apps.tenants.models import Tenant
from apps.tenants.services import (
    ProvisioningError,
    deactivate_tenant,
    provision_tenant,
    reactivate_tenant,
)


class TenantViewSet(viewsets.ViewSet):
    """
    Platform-only. Never exposes a tenant's surveys, respondents or
    responses -- there is no code path here that opens a tenant schema for
    reading domain data, by design.
    """

    permission_classes = [IsSuperAdmin]

    def list(self, request):
        qs = Tenant.objects.annotate(
            user_count=Count("memberships", filter=Q(memberships__is_active=True))
        ).order_by("-created_at")
        search = request.query_params.get("search")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(subdomain__icontains=search))
        return Response(TenantListSerializer(qs, many=True).data)

    def retrieve(self, request, pk=None):
        tenant = Tenant.objects.annotate(
            user_count=Count("memberships", filter=Q(memberships__is_active=True))
        ).get(pk=pk)
        return Response(TenantListSerializer(tenant).data)

    def create(self, request):
        serializer = TenantCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            result = provision_tenant(
                name=data["name"],
                subdomain=data["subdomain"],
                admin_email=data["admin_email"],
                admin_full_name=data["admin_full_name"],
                plan=data["plan"],
                base_domain=settings.TENANT_BASE_DOMAIN,
            )
        except DjangoValidationError as exc:
            raise ValidationError({"subdomain": exc.messages}) from exc
        except ProvisioningError as exc:
            return Response(
                {
                    "detail": "Provisioning failed.",
                    "tenant_id": None,
                    "provisioning_error": str(exc),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response(
            {
                **TenantListSerializer(result.tenant).data,
                "admin_activation_url": result.admin_activation_url,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        tenant = Tenant.objects.get(pk=pk)
        deactivate_tenant(tenant)
        return Response(TenantListSerializer(tenant).data)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        tenant = Tenant.objects.get(pk=pk)
        reactivate_tenant(tenant)
        return Response(TenantListSerializer(tenant).data)
