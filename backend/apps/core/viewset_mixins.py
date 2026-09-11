from apps.audit.actor import set_actor
from apps.core.tenant_context import current_tenant


class TenantScopedMixin:
    """
    Mixin for every tenant-scoped viewset. Two jobs, both of which must run
    after DRF authentication so the authenticated user is available:

    1. A last-resort tenant resolution for token-only clients where the host
       alone was ambiguous (defensive; the middleware already handles this).
    2. Setting the audit actor for this request, so signal handlers writing
       AuditLog rows know who to attribute the change to.
    """

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.user and request.user.is_authenticated:
            set_actor(
                user=request.user,
                ip_address=request.META.get("REMOTE_ADDR"),
                user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
                request_id=request.META.get("HTTP_X_REQUEST_ID", ""),
            )

    def perform_create(self, serializer):
        extra = {}
        if hasattr(serializer.Meta.model, "created_by_id"):
            extra["created_by"] = self.request.user
        serializer.save(**extra)

    def perform_update(self, serializer):
        extra = {}
        if hasattr(serializer.Meta.model, "updated_by_id"):
            extra["updated_by"] = self.request.user
        serializer.save(**extra)

    @property
    def tenant(self):
        return current_tenant(self.request)
