from django.db import models

from apps.core.models import BaseModel
from apps.rbac.constants import ACTION_CHOICES, MODULE_CHOICES


class Module(BaseModel):
    """The feature catalogue. Seeded once per tenant; never edited by a tenant admin."""

    code = models.CharField(max_length=50, unique=True, choices=MODULE_CHOICES)
    label = models.CharField(max_length=100)

    class Meta:
        app_label = "rbac"

    def __str__(self):
        return self.label


class TenantModule(BaseModel):
    """Whether this tenant has a given module switched on. A superadmin control,
    checked *before* any role lookup -- see rbac/services.py::user_has_permission."""

    module = models.OneToOneField(Module, on_delete=models.CASCADE, related_name="tenant_module")
    is_enabled = models.BooleanField(default=True)

    class Meta:
        app_label = "rbac"

    def __str__(self):
        return f"{self.module.code}: {'on' if self.is_enabled else 'off'}"


class Role(BaseModel):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    is_system = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        app_label = "rbac"

    def __str__(self):
        return self.name


class RolePermission(BaseModel):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="permissions")
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name="role_permissions")
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    is_granted = models.BooleanField(default=True)

    class Meta:
        app_label = "rbac"
        constraints = [
            models.UniqueConstraint(
                fields=["role", "module", "action"], name="uniq_role_module_action"
            )
        ]

    def __str__(self):
        return f"{self.role.code}.{self.module.code}.{self.action}"


class UserRole(BaseModel):
    """
    Links a user (cross-schema, hence a plain UUID rather than a real FK --
    Postgres cannot enforce a foreign key across schemas) to a role in this
    tenant.
    """

    user_id = models.UUIDField(db_index=True)
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="user_roles")

    class Meta:
        app_label = "rbac"
        constraints = [
            models.UniqueConstraint(fields=["user_id", "role"], name="uniq_user_role")
        ]

    def __str__(self):
        return f"{self.user_id} -> {self.role.code}"
