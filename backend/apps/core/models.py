"""
Abstract base models shared by every tenant-schema app. Nothing here is a
concrete table -- `core` owns no migrations of its own.
"""
import uuid

from django.conf import settings
from django.db import models


class BaseModel(models.Model):
    """UUID primary key + timestamps. The baseline for every domain model."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SoftDeleteManager(models.Manager):
    """Hides soft-deleted rows from the default manager. `all_objects` sees everything."""

    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class SoftDeleteModel(BaseModel):
    """
    Adds a soft-delete flag so an accidental deletion of collected fieldwork
    is recoverable within the retention window. `objects` hides deleted rows;
    `all_objects` is the escape hatch for admin tooling and audits.
    """

    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        db_constraint=False,  # cross-schema FK -- see docs/architecture/MULTI_TENANCY.md
    )

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def soft_delete(self, actor=None):
        from django.utils import timezone

        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.deleted_by = actor
        self.save(update_fields=["is_deleted", "deleted_at", "deleted_by"])


class AuthoredModel(models.Model):
    """`created_by` / `updated_by` for user-authored tenant records."""

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        db_constraint=False,
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        db_constraint=False,
    )

    class Meta:
        abstract = True
