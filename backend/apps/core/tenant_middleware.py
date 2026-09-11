"""
Tenant resolution: host -> Domain row -> tenant schema, with a JWT-claim
fallback for single-host clients (the mobile app), and a set of explicit
platform-host exceptions.

See docs/architecture/MULTI_TENANCY.md for the full reasoning. Three rules
this file exists to encode, none of them obvious from django-tenants alone:

1. A platform host (the root domain, a reserved subdomain, a bare IP, the
   test host) resolves to the public schema instead of 404ing.
2. A single-host client identifies its tenant via a `tenant_schema` claim
   inside its JWT. Resolving that claim after the URL conf has already been
   pinned to the public conf requires explicitly clearing the pin --
   otherwise the schema is correct but the routing still isn't.
3. A Bearer token that fails to decode must leave the tenant unresolved so
   DRF's own auth returns 401, not 404. A mobile replayer treats a 401 as
   "refresh and retry" and a 404 as "this doesn't exist, give up" -- the
   difference between transient and permanent failure for queued work.
"""
import logging

from django.conf import settings
from django.urls import set_urlconf
from django_tenants.middleware.main import TenantMainMiddleware
from django_tenants.utils import get_public_schema_name, get_tenant_domain_model

logger = logging.getLogger(__name__)


def _is_platform_host(hostname: str) -> bool:
    base = settings.TENANT_BASE_DOMAIN
    if hostname in {base, "localhost", "127.0.0.1", "testserver"}:
        return True
    for sub in settings.TENANT_PLATFORM_SUBDOMAINS:
        if hostname == f"{sub}.{base}":
            return True
    # A bare IP address (development / health checks) is a platform host too.
    parts = hostname.split(".")
    if len(parts) == 4 and all(p.isdigit() for p in parts):
        return True
    return False


def _tenant_schema_from_bearer(request) -> str | None:
    """
    Best-effort read of the `tenant_schema` claim from a Bearer token,
    without raising. An invalid or absent token must never be treated as an
    error here -- that is DRF authentication's job downstream, and it must
    surface as 401, not as a tenant-resolution 404.
    """
    auth = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth.startswith("Bearer "):
        return None
    raw_token = auth.split(" ", 1)[1]
    try:
        from rest_framework_simplejwt.tokens import UntypedToken

        token = UntypedToken(raw_token)
        return token.get("tenant_schema")
    except Exception:  # noqa: BLE001 -- deliberately swallow; see docstring
        return None


class PublicFallbackTenantMiddleware(TenantMainMiddleware):
    """
    Resolution order for every request:

    1. Host matches a `Domain` row exactly       -> that tenant's schema.
    2. Host is a recognised platform host        -> public schema.
    3. A JWT Bearer token carries `tenant_schema` -> that tenant's schema,
       with the URL conf pin explicitly cleared so tenant routes resolve.
    4. Anything else                             -> 404 (a genuine typo).
    """

    def process_request(self, request):
        from django.db import connection

        hostname = request.get_host().split(":")[0]
        Domain = get_tenant_domain_model()

        domain = Domain.objects.filter(domain=hostname).select_related("tenant").first()
        if domain is not None:
            request.tenant = domain.tenant
            request.tenant_domain = domain
            # The base class's process_request does this too, but we
            # replaced process_request wholesale, so it must be repeated
            # here explicitly -- setup_url_routing alone only picks the URL
            # conf, it never touches the connection's search_path.
            connection.set_tenant(domain.tenant)
            self.setup_url_routing(request)
            return

        if _is_platform_host(hostname):
            schema = _tenant_schema_from_bearer(request)
            if schema and schema != get_public_schema_name():
                from apps.tenants.models import Tenant

                tenant = Tenant.objects.filter(schema_name=schema, is_active=True).first()
                if tenant is not None:
                    request.tenant = tenant
                    from django.db import connection

                    connection.set_tenant(tenant)
                    # The public conf may already be pinned by an earlier
                    # branch of this same resolution chain -- clear it, or
                    # the schema is right but the routing still isn't.
                    if hasattr(request, "urlconf"):
                        del request.urlconf
                    set_urlconf(None)
                    return
            self._route_to_public(request)
            return

        # An unrecognised host is a genuine 404, not a fallback candidate.
        from django.http import Http404

        raise Http404(f"No tenant found for host {hostname!r}")

    def _route_to_public(self, request):
        from django.db import connection

        request.tenant = None  # normalised: `if request.tenant:` behaves
        connection.set_schema_to_public()
        request.urlconf = settings.PUBLIC_SCHEMA_URLCONF
        set_urlconf(settings.PUBLIC_SCHEMA_URLCONF)


class TenantContextNormalizationMiddleware:
    """
    Runs immediately after PublicFallbackTenantMiddleware, later in the
    MIDDLEWARE list. Its only job is to make `request.tenant` reliably
    `None` on the public schema even in code paths where django-tenants'
    own (truthy) stub object might otherwise have been left in place, so
    every downstream `if request.tenant:` check behaves correctly without
    re-deriving the rule itself. See tenant_context.current_tenant().
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        from apps.core.tenant_context import current_tenant

        request.tenant = current_tenant(request)
        return self.get_response(request)
