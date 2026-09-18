from rest_framework.routers import DefaultRouter

from apps.question_bank.views import BankQuestionViewSet, QuestionBankCategoryViewSet

router = DefaultRouter()
router.register("question-bank/categories", QuestionBankCategoryViewSet, basename="bank-category")
router.register("question-bank/questions", BankQuestionViewSet, basename="bank-question")

urlpatterns = router.urls
