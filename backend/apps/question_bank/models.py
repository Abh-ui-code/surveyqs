"""
An admin-curated library of reusable question templates, grouped by their
own `QuestionBankCategory` -- deliberately independent of a survey's own
`apps.surveys.models.SurveyCategory`, since a survey's category has no
bearing on which bank questions it should be able to pull from (e.g. a
"Wheat Farming" survey should still see questions filed under a "Farming"
bank category, whatever the survey itself is categorized as).

Inserting a bank question into a survey copies its fields onto a
brand-new `Question` row -- see apps.surveys.services.create_question_from_bank
-- so a `BankQuestion` is never referenced live by a `Question`. Editing or
removing one here only changes what future inserts look like; surveys that
already copied it are untouched.
"""
from django.db import models

from apps.core.models import AuthoredModel, SoftDeleteModel
from apps.surveys.models import validate_question_code


class QuestionBankCategory(SoftDeleteModel, AuthoredModel):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        app_label = "question_bank"
        ordering = ["name"]

    def __str__(self):
        return self.name


class BankQuestion(SoftDeleteModel, AuthoredModel):
    category = models.ForeignKey(
        QuestionBankCategory, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="bank_questions",
    )
    code = models.CharField(max_length=63, unique=True, validators=[validate_question_code])
    type = models.CharField(max_length=30)

    label = models.JSONField(default=dict)
    hint = models.JSONField(default=dict, blank=True)

    is_required = models.CharField(max_length=1000, blank=True, default="false")
    is_pii = models.BooleanField(default=False)
    constraint = models.CharField(max_length=1000, blank=True)
    constraint_message = models.JSONField(default=dict, blank=True)

    config = models.JSONField(default=dict, blank=True)
    choices = models.JSONField(default=list, blank=True)  # [{"value","label","order"}, ...] for choice types

    class Meta:
        app_label = "question_bank"
        ordering = ["category__name", "code"]

    def __str__(self):
        return f"{self.code} ({self.type})"
