from django.db import models

from apps.core.models import BaseModel, SoftDeleteModel


class SurveyResponse(SoftDeleteModel):
    """
    `survey_version` is the pin: set once at creation, never updated. Every
    render, export and report interprets this response against exactly this
    version's structure, regardless of later edits to the survey -- see
    docs/architecture/DATA_MODEL.md.
    """

    STATUS_CHOICES = [
        ("submitted", "Submitted"),
        ("under_review", "Under review"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]

    response_code = models.CharField(max_length=32, unique=True, db_index=True)
    survey = models.ForeignKey("surveys.Survey", on_delete=models.PROTECT, related_name="responses")
    survey_version = models.ForeignKey("surveys.SurveyVersion", on_delete=models.PROTECT, related_name="responses")
    assignment = models.ForeignKey(
        "assignments.SurveyAssignment", null=True, blank=True, on_delete=models.SET_NULL, related_name="responses"
    )
    respondent = models.ForeignKey(
        "respondents.Respondent", null=True, blank=True, on_delete=models.SET_NULL, related_name="responses"
    )
    collected_by_id = models.UUIDField(db_index=True)  # cross-schema, no FK

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="submitted", db_index=True)

    answers = models.JSONField(default=dict, blank=True)  # denormalised read cache -- see ANSWER_STORAGE.md

    started_at = models.DateTimeField()
    submitted_at = models.DateTimeField()
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)

    gps_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    gps_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    gps_accuracy_m = models.FloatField(null=True, blank=True)
    gps_captured_at = models.DateTimeField(null=True, blank=True)

    device_id = models.CharField(max_length=100, blank=True)
    app_version = models.CharField(max_length=20, blank=True)
    os_version = models.CharField(max_length=50, blank=True)
    was_offline = models.BooleanField(default=False)

    client_ref_id = models.UUIDField(null=True, blank=True)  # the offline idempotency key

    is_edited = models.BooleanField(default=False)
    edited_at = models.DateTimeField(null=True, blank=True)
    edited_by_id = models.UUIDField(null=True, blank=True)

    class Meta:
        app_label = "responses"
        constraints = [
            models.UniqueConstraint(
                fields=["client_ref_id"], condition=models.Q(client_ref_id__isnull=False),
                name="uniq_response_client_ref_id",
            )
        ]
        indexes = [
            models.Index(fields=["survey", "status", "submitted_at"]),
            models.Index(fields=["collected_by_id", "submitted_at"]),
        ]
        ordering = ["-submitted_at"]

    def __str__(self):
        return self.response_code


class Answer(BaseModel):
    """
    The canonical, typed store -- see docs/architecture/ANSWER_STORAGE.md.
    Exactly one `value_*` column is populated per row, enforced by the
    check constraint below. `question_code` is a denormalised snapshot so
    exports and cross-version queries never need to join the (possibly
    long-archived) version structure.
    """

    response = models.ForeignKey(SurveyResponse, on_delete=models.CASCADE, related_name="typed_answers")
    question_code = models.CharField(max_length=63, db_index=True)
    value_type = models.CharField(max_length=10)  # text|number|bool|date|datetime|json

    value_text = models.TextField(null=True, blank=True)
    value_number = models.FloatField(null=True, blank=True)
    value_bool = models.BooleanField(null=True, blank=True)
    value_date = models.DateField(null=True, blank=True)
    value_datetime = models.DateTimeField(null=True, blank=True)
    value_json = models.JSONField(null=True, blank=True)

    repeat_path = models.CharField(max_length=63, blank=True)
    repeat_index = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        app_label = "responses"
        constraints = [
            models.UniqueConstraint(
                fields=["response", "question_code", "repeat_path", "repeat_index"],
                name="uniq_answer_per_question_and_repeat_instance",
            )
        ]
        indexes = [
            models.Index(fields=["question_code", "value_text"]),
            models.Index(fields=["question_code", "value_number"]),
            models.Index(fields=["question_code", "value_date"]),
        ]

    def __str__(self):
        return f"{self.response_id}:{self.question_code}"


class ResponseAttachment(BaseModel):
    response = models.ForeignKey(SurveyResponse, on_delete=models.CASCADE, related_name="attachments")
    question_code = models.CharField(max_length=63)
    kind = models.CharField(max_length=20)  # image|audio|video|file|signature
    file = models.FileField(upload_to="attachments/%Y/%m/")
    filename = models.CharField(max_length=255, blank=True)
    size_bytes = models.PositiveIntegerField(default=0)
    checksum = models.CharField(max_length=80, blank=True)
    captured_at = models.DateTimeField(null=True, blank=True)
    client_ref_id = models.UUIDField(null=True, blank=True)

    class Meta:
        app_label = "responses"
        constraints = [
            models.UniqueConstraint(
                fields=["client_ref_id"], condition=models.Q(client_ref_id__isnull=False),
                name="uniq_attachment_client_ref_id",
            )
        ]

    def __str__(self):
        return f"{self.response_id}:{self.question_code}:{self.filename}"


class ResponseFlag(BaseModel):
    response = models.ForeignKey(SurveyResponse, on_delete=models.CASCADE, related_name="flags")
    code = models.CharField(max_length=50)
    severity = models.CharField(max_length=10, default="info")  # info|warning
    message = models.CharField(max_length=500)
    triggering_values = models.JSONField(default=dict, blank=True)

    class Meta:
        app_label = "responses"

    def __str__(self):
        return f"{self.code} on {self.response_id}"


class NumberSequence(BaseModel):
    """Row-locked counter backing `numbering.next_response_code()`."""

    key = models.CharField(max_length=50, unique=True)
    year = models.PositiveIntegerField()
    last_value = models.PositiveIntegerField(default=0)

    class Meta:
        app_label = "responses"

    def __str__(self):
        return f"{self.key}:{self.year}:{self.last_value}"


class ResponseReview(BaseModel):
    ACTION_CHOICES = [("approve", "Approve"), ("reject", "Reject"), ("reopen", "Reopen")]

    response = models.ForeignKey(SurveyResponse, on_delete=models.CASCADE, related_name="reviews")
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    reviewer_id = models.UUIDField()
    reason_code = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        app_label = "responses"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} on {self.response_id}"
