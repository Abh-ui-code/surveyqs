from rest_framework.permissions import BasePermission

from apps.core.tenant_context import current_tenant, user_can_access


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superadmin)


class HasTenant(BasePermission):
    """The request resolved to a real tenant schema, not the public one."""

    def has_permission(self, request, view):
        return current_tenant(request) is not None


class BelongsToTenant(BasePermission):
    """The authenticated user has an active membership in the resolved tenant."""

    def has_permission(self, request, view):
        tenant = current_tenant(request)
        return bool(request.user and request.user.is_authenticated) and user_can_access(
            request.user, tenant
        )
