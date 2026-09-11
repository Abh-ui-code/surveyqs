from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.tenant_context import current_tenant
from apps.rbac.permissions import HasPermission

_ALLOWED_KEYS = {"date_format", "timezone", "default_language", "accent_color"}


class WorkspaceSettingsView(APIView):
    """
    Reads and writes `Tenant.settings` (a JSONField, public schema) from a
    request already resolved to that tenant. Saving a public-schema model
    instance while the connection's `search_path` is `<tenant>, public`
    works without an explicit schema switch: the unqualified table name
    resolves through the fallback to `public.tenants_tenant`.
    """

    module_code = "settings"
    permission_classes = [IsAuthenticated, HasPermission]

    @property
    def required_action(self):
        return "view" if self.request.method == "GET" else "edit"

    def get(self, request):
        tenant = current_tenant(request)
        return Response({"name": tenant.name, "subdomain": tenant.subdomain, "settings": tenant.settings})

    def patch(self, request):
        tenant = current_tenant(request)
        updates = {k: v for k, v in request.data.items() if k in _ALLOWED_KEYS}
        if not updates:
            raise ValidationError({"detail": f"No recognised settings in the request. Allowed: {sorted(_ALLOWED_KEYS)}."})
        tenant.settings = {**tenant.settings, **updates}
        tenant.save(update_fields=["settings"])
        return Response({"name": tenant.name, "subdomain": tenant.subdomain, "settings": tenant.settings})
