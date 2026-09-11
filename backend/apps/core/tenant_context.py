"""
The single seam for "which tenant" and "may this user access it". No other
module reads `request.tenant` or `user.preferred_tenant` directly -- both
questions are answered here so the rule can change in one place.
"""
from django.db import connection
from django_tenants.utils import get_public_schema_name


def current_tenant(request):
    """
    Normalises django-tenants' public-schema stub to `None`, so callers can
    write `if current_tenant(request):` rather than checking schema names.
    """
    tenant = getattr(request, "tenant", None)
    if tenant is None or getattr(tenant, "schema_name", None) == get_public_schema_name():
        return None
    return tenant


def current_schema_name() -> str:
    return connection.schema_name


def user_can_access(user, tenant) -> bool:
    """A superadmin may access any tenant. Everyone else needs an active membership."""
    if user.is_superadmin:
        return True
    if tenant is None:
        return False
    from apps.users.models import UserTenantMembership

    return UserTenantMembership.objects.filter(
        user=user, tenant=tenant, is_active=True
    ).exists()
