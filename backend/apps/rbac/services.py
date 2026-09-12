"""
Permission evaluation and tenant-schema seeding. Must run inside
`schema_context(tenant.schema_name)` -- these are all tenant-schema models.
"""
from apps.rbac.constants import DEFAULT_PERMISSIONS, MODULE_CHOICES, SYSTEM_ROLES
from apps.rbac.models import Module, Role, RolePermission, TenantModule


def provision_tenant_defaults(tenant):
    """
    Seeds the module catalogue, the four system roles, and the default
    permission matrix. Bulk-inserted with conflicts ignored: a per-row
    get_or_create loop here is ~150 round trips and is what blew the
    provisioning request timeout in earlier iterations of this pattern.
    Also idempotent, which matters -- provisioning can be safely re-run
    after a partial failure.
    """
    Module.objects.bulk_create(
        [Module(code=code, label=label) for code, label in MODULE_CHOICES],
        ignore_conflicts=True,
    )
    modules = {m.code: m for m in Module.objects.all()}

    TenantModule.objects.bulk_create(
        [TenantModule(module=m, is_enabled=True) for m in modules.values()],
        ignore_conflicts=True,
    )

    Role.objects.bulk_create(
        [Role(code=code, name=name, is_system=True) for code, name in SYSTEM_ROLES.items()],
        ignore_conflicts=True,
    )
    roles = {r.code: r for r in Role.objects.filter(code__in=SYSTEM_ROLES)}

    # Admin gets every action on every module, unconditionally.
    admin_role = roles["admin"]
    all_actions = [a for a, _ in RolePermission._meta.get_field("action").choices]
    permission_rows = [
        RolePermission(role=admin_role, module=m, action=a, is_granted=True)
        for m in modules.values()
        for a in all_actions
    ]

    for role_code, module_actions in DEFAULT_PERMISSIONS.items():
        role = roles[role_code]
        for module_code, actions in module_actions.items():
            module = modules[module_code]
            for action in actions:
                permission_rows.append(
                    RolePermission(role=role, module=module, action=action, is_granted=True)
                )

    RolePermission.objects.bulk_create(permission_rows, ignore_conflicts=True)


def user_roles_qs(user_id):
    return Role.objects.filter(user_roles__user_id=user_id, is_active=True)


def user_has_role(user, role_code: str) -> bool:
    return user_roles_qs(user.id).filter(code=role_code).exists()


def user_has_permission(user, module_code: str, action: str) -> bool:
    """
    Check order is the specification:
    1. A superadmin bypasses everything.
    2. A module the *superadmin* has disabled for this tenant is
       unreachable even for the tenant's own administrator -- checked
       before any role lookup, so it functions as a commercial control
       rather than a suggestion.
    3. The admin role has everything.
    4. Otherwise: does any of the user's roles grant this (module, action)?
    """
    if user.is_superadmin:
        return True

    if not TenantModule.objects.filter(module__code=module_code, is_enabled=True).exists():
        return False

    if user_has_role(user, "admin"):
        return True

    return RolePermission.objects.filter(
        role__user_roles__user_id=user.id,
        role__is_active=True,
        module__code=module_code,
        action=action,
        is_granted=True,
    ).exists()


def user_permission_summary(user) -> dict:
    """Powers `GET /api/auth/my-permissions/` -- the one call both clients
    make on startup to decide what to render."""
    enabled_modules = set(
        TenantModule.objects.filter(is_enabled=True).values_list("module__code", flat=True)
    )
    is_admin = user.is_superadmin or user_has_role(user, "admin")
    role = user_roles_qs(user.id).first()

    if is_admin:
        permissions = {code: ["view", "create", "edit", "delete", "approve", "export"] for code in enabled_modules}
    else:
        permissions = {}
        rows = RolePermission.objects.filter(
            role__user_roles__user_id=user.id,
            role__is_active=True,
            module__code__in=enabled_modules,
            is_granted=True,
        ).values_list("module__code", "action")
        for module_code, action in rows:
            permissions.setdefault(module_code, []).append(action)

    return {
        "is_superadmin": user.is_superadmin,
        "is_admin": is_admin,
        "role_code": "admin" if (is_admin and not user.is_superadmin) else (role.code if role else None),
        "modules": sorted(enabled_modules),
        "permissions": permissions,
    }
