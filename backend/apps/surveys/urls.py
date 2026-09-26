from rest_framework.routers import DefaultRouter
from rest_framework_nested.routers import NestedDefaultRouter

from apps.surveys.views import (
    ChoiceListViewSet,
    QuestionViewSet,
    SectionViewSet,
    SurveyCategoryViewSet,
    SurveyDemographicFieldViewSet,
    SurveyViewSet,
)

router = DefaultRouter()
router.register("categories", SurveyCategoryViewSet, basename="survey-category")
router.register("surveys", SurveyViewSet, basename="survey")

# /surveys/{survey_pk}/draft/sections/, /surveys/{survey_pk}/draft/questions/,
# /surveys/{survey_pk}/draft/choice-lists/, /surveys/{survey_pk}/draft/demographic-fields/
# -- all operate on the survey's current draft version, per docs/api/API_REFERENCE.md.
draft_router = NestedDefaultRouter(router, "surveys", lookup="survey")
draft_router.register(r"draft/sections", SectionViewSet, basename="survey-draft-section")
draft_router.register(r"draft/questions", QuestionViewSet, basename="survey-draft-question")
draft_router.register(r"draft/choice-lists", ChoiceListViewSet, basename="survey-draft-choice-list")
draft_router.register(
    r"draft/demographic-fields", SurveyDemographicFieldViewSet, basename="survey-draft-demographic-field"
)

urlpatterns = router.urls + draft_router.urls
