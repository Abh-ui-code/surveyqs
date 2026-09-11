"""
Routes available on the public schema -- reachable before a tenant is
known. Login, the superadmin API, and nothing that touches tenant survey
data. See docs/architecture/MULTI_TENANCY.md.
"""
from django.http import JsonResponse
from django.urls import include, path


def health(request):
    return JsonResponse({"status": "ok", "schema": "public"})


urlpatterns = [
    path("api/", health),
    path("api/auth/", include("apps.authentication.urls")),
    path("api/superadmin/", include("apps.superadmin.urls")),
]
