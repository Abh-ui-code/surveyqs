import re

from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import AuthoredModel, BaseModel, SoftDeleteModel

QUESTION_CODE_RE = re.compile(r"^[a-z][a-z0-9_]{0,62}$")
_RESERVED_CODES = {"self", "parent", "response", "assignment", "respondent"}


def validate_question_code(value: str):
    if value in _RESERVED_CODES:
        raise ValidationError(f"'{value}' is a reserved word and cannot be used as a question code.")
    if not QUESTION_CODE_RE.match(value):
        raise ValidationError(
            "Question codes must start with a lowercase letter and contain only "
            "lowercase letters, digits and underscores (max 63 characters)."
        )


class SurveyCategory(BaseModel):
    """The topic a survey belongs to -- Farming, Electronics, Automotive."""

    code = models.SlugField(max_length=50, unique=True)
    label = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, blank=True)
    color = models.CharField(max_length=20, blank=True)
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        app_label = "surveys"
        ordering = ["display_order", "label"]
        verbose_name_plural = "survey categories"

    def __str__(self):
        return self.label


class Survey(SoftDeleteModel, AuthoredModel):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("published", "Published"),
        ("paused", "Paused"),
        ("closed", "Closed"),
        ("archived", "Archived"),
    ]

    category = models.ForeignKey(SurveyCategory, on_delete=models.PROTECT, related_name="surveys")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    instructions = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft", db_index=True)
    closed_at = models.DateTimeField(null=True, blank=True)  # drives the close-grace-window check on submit

    current_version = models.ForeignKey(
        "surveys.SurveyVersion", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    draft_version = models.ForeignKey(
        "surveys.SurveyVersion", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    # anonymous, consent_required, consent_notice_id, one_response_per_respondent,
    # require_gps, gps_accuracy_threshold_m, auto_approve, close_grace_days, etc.
    settings = models.JSONField(default=dict, blank=True)

    class Meta:
        app_label = "surveys"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class SurveyVersion(BaseModel):
    """
    Immutable once published. `schema_json` is the frozen form package --
    see docs/architecture/FORM_SCHEMA.md -- and is what every response is
    interpreted against forever, regardless of later edits to the survey.
    """

    STATUS_CHOICES = [("draft", "Draft"), ("published", "Published")]

    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name="versions")
    version_number = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")

    schema_json = models.JSONField(default=dict, blank=True)
    schema_hash = models.CharField(max_length=64, blank=True)

    change_note = models.TextField(blank=True)
    published_by = models.ForeignKey(
        "users.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+", db_constraint=False
    )
    published_at = models.DateTimeField(null=True, blank=True)
    response_count = models.PositiveIntegerField(default=0)

    class Meta:
        app_label = "surveys"
        constraints = [
            models.UniqueConstraint(fields=["survey", "version_number"], name="uniq_survey_version_number")
        ]
        ordering = ["-version_number"]

    def __str__(self):
        return f"{self.survey.title} v{self.version_number}"


class Section(BaseModel):
    version = models.ForeignKey(SurveyVersion, on_delete=models.CASCADE, related_name="sections")
    code = models.SlugField(max_length=63)
    order = models.PositiveIntegerField()
    title = models.JSONField(default=dict)  # {"en": "Screening", "mr": "..."}
    description = models.JSONField(default=dict, blank=True)
    relevant = models.CharField(max_length=1000, blank=True)  # an expression, or blank

    class Meta:
        app_label = "surveys"
        constraints = [
            models.UniqueConstraint(fields=["version", "code"], name="uniq_section_code_per_version")
        ]
        ordering = ["order"]

    def __str__(self):
        return self.title.get("en", self.code)


class ChoiceList(BaseModel):
    version = models.ForeignKey(SurveyVersion, on_delete=models.CASCADE, related_name="choice_lists")
    name = models.SlugField(max_length=100)
    attributes = models.JSONField(default=list, blank=True)  # column names a choice_filter can match on

    class Meta:
        app_label = "surveys"
        constraints = [
            models.UniqueConstraint(fields=["version", "name"], name="uniq_choice_list_name_per_version")
        ]

    def __str__(self):
        return self.name


class Choice(BaseModel):
    choice_list = models.ForeignKey(ChoiceList, on_delete=models.CASCADE, related_name="choices")
    value = models.CharField(max_length=100)
    label = models.JSONField(default=dict)
    order = models.PositiveIntegerField(default=0)
    attrs = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        app_label = "surveys"
        constraints = [
            models.UniqueConstraint(fields=["choice_list", "value"], name="uniq_choice_value_per_list")
        ]
        ordering = ["order"]

    def __str__(self):
        return self.label.get("en", self.value)


class Question(BaseModel):
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="questions")
    parent_question = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="repeat_children"
    )
    code = models.CharField(max_length=63, validators=[validate_question_code])
    type = models.CharField(max_length=30)
    order = models.PositiveIntegerField()

    label = models.JSONField(default=dict)
    hint = models.JSONField(default=dict, blank=True)

    is_required = models.CharField(max_length=1000, blank=True, default="false")  # "true" | "false" | an expression
    relevant = models.CharField(max_length=1000, blank=True)
    constraint = models.CharField(max_length=1000, blank=True)
    constraint_message = models.JSONField(default=dict, blank=True)

    default_value = models.CharField(max_length=1000, blank=True)
    calculation = models.CharField(max_length=1000, blank=True)

    read_only = models.BooleanField(default=False)
    is_pii = models.BooleanField(default=False)

    choice_list = models.ForeignKey(
        ChoiceList, null=True, blank=True, on_delete=models.SET_NULL, related_name="questions"
    )
    config = models.JSONField(default=dict, blank=True)

    class Meta:
        app_label = "surveys"
        ordering = ["order"]

    def __str__(self):
        return f"{self.code} ({self.type})"

    @property
    def required_bool_or_expression(self):
        return True if self.is_required == "true" else (False if self.is_required == "false" else self.is_required)
