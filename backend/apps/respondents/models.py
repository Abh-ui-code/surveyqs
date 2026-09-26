from django.db import models

from apps.core.models import AuthoredModel, BaseModel, SoftDeleteModel
from apps.surveys.models import validate_question_code


class Respondent(SoftDeleteModel, AuthoredModel):
    CONSENT_STATUS_CHOICES = [
        ("none", "None"), ("granted", "Granted"), ("withdrawn", "Withdrawn"),
    ]

    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=32, blank=True)  # E.164, so dedup is exact
    alt_phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)

    gender = models.CharField(max_length=30, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    identity_number = models.CharField(max_length=100, blank=True)

    address = models.TextField(blank=True)
    geography_node_id = models.UUIDField(null=True, blank=True)

    custom_fields = models.JSONField(default=dict, blank=True)

    consent_status = models.CharField(max_length=20, choices=CONSENT_STATUS_CHOICES, default="none")
    is_anonymised = models.BooleanField(default=False)
    anonymised_at = models.DateTimeField(null=True, blank=True)

    client_ref_id = models.UUIDField(null=True, blank=True)  # device-generated, for offline idempotency

    class Meta:
        app_label = "respondents"
        constraints = [
            models.UniqueConstraint(
                fields=["phone"], condition=models.Q(phone__gt="", is_deleted=False),
                name="uniq_respondent_phone",
            ),
            models.UniqueConstraint(
                fields=["identity_number"], condition=models.Q(identity_number__gt="", is_deleted=False),
                name="uniq_respondent_identity_number",
            ),
            models.UniqueConstraint(
                fields=["client_ref_id"], condition=models.Q(client_ref_id__isnull=False),
                name="uniq_respondent_client_ref_id",
            ),
        ]
        indexes = [models.Index(fields=["phone"]), models.Index(fields=["identity_number"])]

    def __str__(self):
        return self.full_name

    def anonymise(self, actor=None):
        from django.utils import timezone

        self.full_name = "Anonymised respondent"
        self.phone = ""
        self.alt_phone = ""
        self.email = ""
        self.identity_number = ""
        self.address = ""
        self.date_of_birth = None
        self.custom_fields = {}
        self.is_anonymised = True
        self.anonymised_at = timezone.now()
        self.updated_by = actor
        self.save()


class DemographicQuestion(SoftDeleteModel, AuthoredModel):
    """
    An admin-curated bank of reusable respondent demographic questions --
    Gender, Occupation, Household size, etc. -- independent of any survey,
    mirroring apps.question_bank.models.BankQuestion.

    Selecting one into a survey (see
    apps.surveys.services.create_demographic_field_from_bank) copies its
    fields onto a brand-new `apps.surveys.models.SurveyDemographicField` row
    -- a `DemographicQuestion` is never referenced live, so editing or
    removing one here only changes what future selections look like.
    """

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
        app_label = "respondents"
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} ({self.type})"


class ConsentNotice(BaseModel):
    version = models.PositiveIntegerField()
    language = models.CharField(max_length=10, default="en")
    text = models.TextField()
    # The uploaded PDF/DOCX/TXT `text` was extracted from, kept for
    # reference/audit -- see apps.respondents.document_extraction. Null
    # when the admin just typed the text directly instead of uploading one.
    source_file = models.FileField(upload_to="consent_notices/%Y/%m/", null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        app_label = "respondents"
        constraints = [
            models.UniqueConstraint(fields=["version", "language"], name="uniq_notice_version_language")
        ]

    def __str__(self):
        return f"Notice v{self.version} ({self.language})"


class ConsentRecord(BaseModel):
    METHOD_CHOICES = [
        ("verbal_confirmed", "Verbal, confirmed"),
        ("signature", "Signature"),
        ("checkbox", "Checkbox"),
        ("uploaded_form", "Uploaded form"),
    ]

    respondent = models.ForeignKey(
        Respondent, null=True, blank=True, on_delete=models.CASCADE, related_name="consent_records"
    )
    notice = models.ForeignKey(ConsentNotice, on_delete=models.PROTECT, related_name="consent_records")
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    granted_at = models.DateTimeField()
    captured_by_id = models.UUIDField(null=True, blank=True)
    captured_offline = models.BooleanField(default=False)
    is_withdrawn = models.BooleanField(default=False)
    withdrawn_at = models.DateTimeField(null=True, blank=True)
    purposes = models.JSONField(default=list, blank=True)
    signature_image = models.ImageField(upload_to="consent_signatures/%Y/%m/", null=True, blank=True)
    integrity_hash = models.CharField(max_length=64, blank=True)
    client_ref_id = models.UUIDField(null=True, blank=True)

    class Meta:
        app_label = "respondents"
        constraints = [
            models.UniqueConstraint(
                fields=["client_ref_id"], condition=models.Q(client_ref_id__isnull=False),
                name="uniq_consent_client_ref_id",
            )
        ]

    def __str__(self):
        return f"Consent for {self.respondent_id} ({self.method})"
