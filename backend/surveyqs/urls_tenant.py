"""
Routes available inside a tenant schema. See docs/api/API_REFERENCE.md for
the endpoint-by-endpoint reference.
"""
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.urls import include, path

from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.tenants.tenant_settings_views import WorkspaceSettingsView


def health(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("api/", health),
    path("api/auth/", include("apps.authentication.urls")),
    path("api/", include("apps.surveys.urls")),
    path("api/", include("apps.question_bank.urls")),
    path("api/", include("apps.assignments.urls")),
    path("api/", include("apps.respondents.urls")),
    path("api/", include("apps.responses.urls")),
    path("api/sync/", include("apps.responses.sync_urls")),
    path("api/reports/", include("apps.reports.urls")),
    path("api/rbac/", include("apps.rbac.urls")),
    path("api/", include("apps.users.tenant_urls")),
    path("api/settings/workspace/", WorkspaceSettingsView.as_view(), name="workspace-settings"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
