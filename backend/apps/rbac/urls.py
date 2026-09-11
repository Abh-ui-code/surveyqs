from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.rbac.views import ModuleViewSet, PermissionMatrixView, RoleViewSet

router = DefaultRouter()
router.register("modules", ModuleViewSet, basename="rbac-module")
router.register("roles", RoleViewSet, basename="rbac-role")

urlpatterns = router.urls + [
    path("permission-matrix/", PermissionMatrixView.as_view(), name="rbac-permission-matrix"),
]
