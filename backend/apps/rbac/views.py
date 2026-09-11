from django.db.models import Count
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from apps.core.viewset_mixins import TenantScopedMixin
from apps.rbac.models import Module, Role, RolePermission
from apps.rbac.permissions import HasPermission
from apps.rbac.serializers import (
    ModuleSerializer,
    PermissionMatrixSerializer,
    RoleCreateSerializer,
    RoleSerializer,
    SetPermissionSerializer,
)


class ModuleViewSet(TenantScopedMixin, ReadOnlyModelViewSet):
    """
    Read-only for tenant admins: which modules exist and whether the
    platform has switched them on. Toggling a module is a superadmin
    control (see docs/architecture/AUTH_AND_RBAC.md) and lives under
    `/api/superadmin/`, not here.
    """

    module_code = "settings"
    required_action = "view"
    permission_classes = [HasPermission]
    serializer_class = ModuleSerializer

    def get_queryset(self):
        return Module.objects.select_related("tenant_module").order_by("code")


class RoleViewSet(TenantScopedMixin, ModelViewSet):
    module_code = "settings"
    REQUIRED_ACTIONS = {"GET": "view", "POST": "create", "PATCH": "edit", "PUT": "edit", "DELETE": "delete"}
    permission_classes = [HasPermission]

    def get_queryset(self):
        return Role.objects.annotate(user_count=Count("user_roles", distinct=True)).order_by("name")

    def get_serializer_class(self):
        return RoleCreateSerializer if self.action == "create" else RoleSerializer

    def perform_destroy(self, instance):
        if instance.is_system:
            raise ValidationError({"detail": "System roles cannot be deleted."})
        instance.delete()

    def perform_update(self, serializer):
        # The admin role's permissions are managed exclusively through the
        # all-actions-on-every-module seed; a tenant that weakens it has no
        # recovery path short of platform support. Renaming is fine.
        if serializer.instance.code == "admin" and "is_active" in serializer.validated_data:
            if not serializer.validated_data["is_active"]:
                raise ValidationError({"detail": "The admin role cannot be deactivated."})
        serializer.save()


class PermissionMatrixView(APIView):
    """
    The whole role x module x action grid, read and written as one payload
    -- a settings screen naturally edits several cells in one visit rather
    than one RolePermission row at a time.
    """

    module_code = "settings"
    required_action = "view"
    permission_classes = [HasPermission]

    def get(self, request):
        modules = Module.objects.select_related("tenant_module").order_by("code")
        roles = Role.objects.filter(is_active=True).order_by("name")
        matrix: dict[str, dict[str, list[str]]] = {}
        for row in RolePermission.objects.filter(is_granted=True).values("role__code", "module__code", "action"):
            matrix.setdefault(row["role__code"], {}).setdefault(row["module__code"], []).append(row["action"])

        return Response(
            PermissionMatrixSerializer(
                {"modules": modules, "roles": roles, "matrix": matrix}
            ).data
        )

    def post(self, request):
        """A single cell toggle: {role, module, action, is_granted}."""
        from apps.rbac.services import user_has_permission

        if not user_has_permission(request.user, "settings", "edit"):
            raise ValidationError({"detail": "You do not have permission to change permissions."})

        serializer = SetPermissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        role = Role.objects.get(pk=data["role"])
        if role.code == "admin":
            raise ValidationError({"detail": "The admin role's permissions cannot be changed -- it always has full access."})

        RolePermission.objects.update_or_create(
            role_id=data["role"], module_id=data["module"], action=data["action"],
            defaults={"is_granted": data["is_granted"]},
        )
        return Response({"detail": "Updated."})
