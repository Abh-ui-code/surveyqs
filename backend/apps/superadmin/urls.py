from rest_framework.routers import DefaultRouter

from apps.superadmin.views import TenantViewSet

router = DefaultRouter()
router.register("tenants", TenantViewSet, basename="superadmin-tenant")

urlpatterns = router.urls
