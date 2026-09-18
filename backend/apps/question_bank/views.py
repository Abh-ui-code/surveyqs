from rest_framework import viewsets

from apps.core.viewset_mixins import TenantScopedMixin
from apps.question_bank.models import BankQuestion, QuestionBankCategory
from apps.question_bank.serializers import BankQuestionSerializer, QuestionBankCategorySerializer
from apps.rbac.permissions import HasPermission


class QuestionBankCategoryViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    module_code = "settings"
    REQUIRED_ACTIONS = {"GET": "view", "POST": "create", "PATCH": "edit", "PUT": "edit", "DELETE": "delete"}
    permission_classes = [HasPermission]
    serializer_class = QuestionBankCategorySerializer
    queryset = QuestionBankCategory.objects.all()

    def perform_destroy(self, instance):
        instance.soft_delete(actor=self.request.user)


class BankQuestionViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    module_code = "settings"
    REQUIRED_ACTIONS = {"GET": "view", "POST": "create", "PATCH": "edit", "PUT": "edit", "DELETE": "delete"}
    permission_classes = [HasPermission]
    serializer_class = BankQuestionSerializer

    def get_queryset(self):
        qs = BankQuestion.objects.select_related("category")
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category_id=category)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(label__en__icontains=search)
        return qs

    def perform_destroy(self, instance):
        instance.soft_delete(actor=self.request.user)
