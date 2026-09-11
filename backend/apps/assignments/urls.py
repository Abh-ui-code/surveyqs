from rest_framework.routers import DefaultRouter

from apps.assignments.views import SurveyAssignmentViewSet, TeamViewSet

router = DefaultRouter()
router.register("teams", TeamViewSet, basename="team")
router.register("assignments", SurveyAssignmentViewSet, basename="assignment")

urlpatterns = router.urls
