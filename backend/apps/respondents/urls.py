from rest_framework.routers import DefaultRouter

from apps.respondents.views import ConsentNoticeViewSet, ConsentRecordViewSet, RespondentViewSet

router = DefaultRouter()
router.register("respondents", RespondentViewSet, basename="respondent")
router.register("consent-notices", ConsentNoticeViewSet, basename="consent-notice")
router.register("consents", ConsentRecordViewSet, basename="consent-record")

urlpatterns = router.urls
