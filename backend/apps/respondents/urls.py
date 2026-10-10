from rest_framework.routers import DefaultRouter

from apps.respondents.consent_versions import ConsentVersionViewSet
from apps.respondents.views import (
    ConsentNoticeViewSet,
    ConsentRecordViewSet,
    DemographicQuestionViewSet,
    RespondentViewSet,
)

router = DefaultRouter()
router.register("respondents", RespondentViewSet, basename="respondent")
router.register("consent-notices", ConsentNoticeViewSet, basename="consent-notice")
router.register("consents", ConsentRecordViewSet, basename="consent-record")
router.register("consent-versions", ConsentVersionViewSet, basename="consent-version")
router.register("demographic-questions", DemographicQuestionViewSet, basename="demographic-question")

urlpatterns = router.urls
