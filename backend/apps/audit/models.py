from django.conf import settings
from django.db import models

from apps.core.models import BaseModel

ACTION_CHOICES = [
    ("create", "Create"),
    ("update", "Update"),
    ("delete", "Delete"),
    ("login", "Login"),
    ("logout", "Logout"),
    ("export", "Export"),
    ("approve", "Approve"),
    ("reject", "Reject"),
]


class AuditLog(BaseModel):
    """
    Append-only. Nothing in the application updates or deletes a row here.
    The actor is soft-linked (id + email as plain values, no FK) so deleting
    a user account can never break the trail.
    """

    # Denormalised, and nullable: resolvable from `connection.tenant` in the
    # request path, or by schema-name lookup under `schema_context()` (see
    # apps/audit/signal_handlers.py::_current_tenant_id). Null only in the
    # edge case where neither resolves.
    tenant_id = models.UUIDField(null=True, blank=True, db_index=True)
    user_id = models.UUIDField(null=True, blank=True)
    user_email = models.EmailField(blank=True)

    action = models.CharField(max_length=20, choices=ACTION_CHOICES, db_index=True)
    entity_type = models.CharField(max_length=100, db_index=True)
    entity_id = models.CharField(max_length=64, db_index=True)
    entity_label = models.CharField(max_length=255, blank=True)

    before_values = models.JSONField(null=True, blank=True)
    after_values = models.JSONField(null=True, blank=True)
    changed_fields = models.JSONField(default=list, blank=True)

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    request_id = models.CharField(max_length=64, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["entity_type", "entity_id"]),
            models.Index(fields=["user_id", "created_at"]),
            models.Index(fields=["action", "created_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} {self.entity_type}:{self.entity_id} by {self.user_email or 'system'}"


# Models audited via the post_save / post_delete signal handlers in
# signal_handlers.py. Adding a model to auditing is one entry here.
AUDITED_MODELS: frozenset[str] = frozenset(
    {
        "surveys.Survey",
        "surveys.SurveyVersion",
        "assignments.SurveyAssignment",
        "respondents.Respondent",
        "respondents.ConsentRecord",
        "responses.SurveyResponse",
    }
)
