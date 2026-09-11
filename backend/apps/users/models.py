import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import connection, models

from apps.users.managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    """
    Public schema. UUID pk, email as the username, no separate username
    field. A user may hold a membership in several tenants at once -- see
    UserTenantMembership -- so nothing here decides tenant-scoped
    permissions; that is `apps.rbac`'s job, evaluated inside the relevant
    tenant schema.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=32, blank=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superadmin = models.BooleanField(default=False)

    reporting_manager = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="direct_reports"
    )

    is_2fa_enabled = models.BooleanField(default=False)
    otp_secret = models.CharField(max_length=255, blank=True)  # encrypted at rest by the auth layer

    last_login_at = models.DateTimeField(null=True, blank=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        app_label = "users"

    def __str__(self):
        return self.email

    @property
    def tier(self) -> str:
        """`superadmin` | `tenant_admin` | `tenant_user` -- a display-only
        classification. Never used for an authorisation decision; that is
        always the RBAC module × action matrix, evaluated in the tenant
        schema."""
        if self.is_superadmin:
            return "superadmin"
        from django_tenants.utils import get_public_schema_name

        if connection.schema_name == get_public_schema_name():
            return "tenant_user"
        from apps.rbac.models import UserRole

        if UserRole.objects.filter(user_id=self.id, role__code="admin", role__is_active=True).exists():
            return "tenant_admin"
        return "tenant_user"


class UserTenantMembership(models.Model):
    """
    The M2M link between a User and a Tenant. Answers *is this user a
    member of this workspace?* -- actual permissions always come from the
    tenant-schema `UserRole`. `role_code` here is a denormalised mirror,
    useful for rendering the workspace picker without opening every
    tenant's schema.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.CASCADE, related_name="memberships")
    role_code = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)
    invited_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "users"
        db_table = "user_tenant_memberships"
        constraints = [
            models.UniqueConstraint(fields=["user", "tenant"], name="uniq_user_tenant_membership")
        ]

    def __str__(self):
        return f"{self.user.email} @ {self.tenant.subdomain} ({self.role_code})"
