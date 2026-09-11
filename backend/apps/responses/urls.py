from rest_framework.routers import DefaultRouter

from apps.responses.views import ResponseViewSet

router = DefaultRouter()
router.register("responses", ResponseViewSet, basename="response")

urlpatterns = router.urls
