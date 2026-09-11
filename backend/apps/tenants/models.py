import re
import uuid

from django.core.exceptions import ValidationError
from django.db import models
from django_tenants.models import DomainMixin, TenantMixin

RESERVED_SUBDOMAINS = {"admin", "api", "www", "app", "public", "static", "media"}

_SUBDOMAIN_RE = re.compile(r"^[a-z][a-z0-9-]{1,38}[a-z0-9]$")


def validate_subdomain(value: str):
    if value in RESERVED_SUBDOMAINS:
        raise ValidationError(f"'{value}' is a reserved subdomain.")
    if not _SUBDOMAIN_RE.match(value):
        raise ValidationError(
            "Subdomains must be lowercase letters, digits and hyphens, "
            "3-40 characters, starting with a letter."
        )


class Tenant(TenantMixin):
    """
    One customer workspace. Schema creation is explicit and staged --
    see apps/tenants/services.py::provision_tenant -- never automatic on
    save, because DDL and the seeding that follows must be able to fail
    partway through without corrupting an in-progress signup.
    """

    auto_create_schema = False
    auto_drop_schema = False

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    subdomain = models.CharField(max_length=40, unique=True, validators=[validate_subdomain])

    PLAN_CHOICES = [("trial", "Trial"), ("basic", "Basic"), ("enterprise", "Enterprise")]
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default="trial")

    is_active = models.BooleanField(default=True)
    is_ready = models.BooleanField(default=False)
    provisioning_error = models.TextField(blank=True)

    settings = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "tenants"

    def __str__(self):
        return self.name

    @staticmethod
    def build_schema_name(subdomain: str) -> str:
        return f"tenant_{subdomain}".replace("-", "_")

    def save(self, *args, **kwargs):
        if not self.schema_name:
            self.schema_name = self.build_schema_name(self.subdomain)
        super().save(*args, **kwargs)


class Domain(DomainMixin):
    class Meta:
        app_label = "tenants"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant"],
                condition=models.Q(is_primary=True),
                name="one_primary_domain_per_tenant",
            )
        ]
