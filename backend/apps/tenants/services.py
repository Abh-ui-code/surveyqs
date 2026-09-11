"""
Tenant provisioning. Deliberately NOT one atomic transaction: schema
creation and the migrations that follow commit as they go and cannot be
rolled back by wrapping them in `transaction.atomic()`. Every step records
its own failure onto the tenant row rather than raising into a half-applied
state with no diagnostic trail.

See docs/architecture/MULTI_TENANCY.md for the full reasoning.
"""
from dataclasses import dataclass

from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db import transaction
from django_tenants.utils import schema_context

from apps.tenants.models import Domain, Tenant


class ProvisioningError(Exception):
    pass


@dataclass
class ProvisionResult:
    tenant: Tenant
    admin_activation_url: str


def provision_tenant(
    *,
    name: str,
    subdomain: str,
    admin_email: str,
    admin_full_name: str,
    plan: str = "trial",
    base_domain: str,
) -> ProvisionResult:
    """
    1. Validate + create the Tenant and its primary Domain (public schema).
    2. Create and migrate the tenant's own schema.
    3. Seed its module catalogue, system roles and default permission matrix.
    4. Create the first administrator: a public User, a membership, and a
       tenant-schema UserRole granting them the admin role.
    5. Mark the tenant ready.

    Any failure records `provisioning_error` on the tenant and leaves the
    partially-built schema in place -- it is the only evidence of what went
    wrong, and dropping it destroys that evidence.
    """
    tenant = _create_tenant_and_domain(name, subdomain, plan, base_domain)

    try:
        tenant.create_schema(check_if_exists=True)
        call_command("migrate_schemas", tenant=True, schema_name=tenant.schema_name, interactive=False, verbosity=0)

        with schema_context(tenant.schema_name):
            from apps.rbac.services import provision_tenant_defaults

            provision_tenant_defaults(tenant)

        activation_url = _create_admin_user(tenant, admin_email, admin_full_name)

        tenant.is_ready = True
        tenant.provisioning_error = ""
        tenant.save(update_fields=["is_ready", "provisioning_error"])
        return ProvisionResult(tenant=tenant, admin_activation_url=activation_url)

    except Exception as exc:  # noqa: BLE001 -- deliberately broad: record and re-raise
        tenant.provisioning_error = str(exc)
        tenant.save(update_fields=["provisioning_error"])
        raise ProvisioningError(str(exc)) from exc


@transaction.atomic
def _create_tenant_and_domain(name: str, subdomain: str, plan: str, base_domain: str) -> Tenant:
    if Tenant.objects.filter(subdomain=subdomain).exists():
        raise ValidationError(f"Subdomain '{subdomain}' is already taken.")

    tenant = Tenant(name=name, subdomain=subdomain, plan=plan, is_ready=False)
    tenant.full_clean(exclude=["schema_name"])
    tenant.save()

    Domain.objects.create(
        tenant=tenant,
        domain=f"{subdomain}.{base_domain}",
        is_primary=True,
    )
    return tenant


@transaction.atomic
def _create_admin_user(tenant: Tenant, email: str, full_name: str) -> str:
    from apps.authentication.services import send_activation_email
    from apps.users.models import User, UserTenantMembership

    user, created = User.objects.get_or_create(
        email=email.lower(),
        defaults={"full_name": full_name, "is_active": True},
    )
    if created:
        user.set_unusable_password()
        user.save(update_fields=["password"])

    UserTenantMembership.objects.get_or_create(
        user=user,
        tenant=tenant,
        defaults={"role_code": "admin", "is_active": True},
    )

    with schema_context(tenant.schema_name):
        from apps.rbac.models import Role, UserRole

        admin_role = Role.objects.get(code="admin")
        UserRole.objects.get_or_create(user_id=user.id, role=admin_role)

    return send_activation_email(user)


@transaction.atomic
def deactivate_tenant(tenant: Tenant):
    tenant.is_active = False
    tenant.save(update_fields=["is_active"])


@transaction.atomic
def reactivate_tenant(tenant: Tenant):
    tenant.is_active = True
    tenant.save(update_fields=["is_active"])


def deprovision_tenant(tenant: Tenant):
    """
    Irreversible. The public-schema deletes are issued explicitly and in
    dependency order because the ORM's cascade would try to follow relations
    into the schema this function is about to drop.
    """
    from rest_framework_simplejwt.token_blacklist.models import (
        BlacklistedToken,
        OutstandingToken,
    )

    from apps.users.models import UserTenantMembership

    schema_name = tenant.schema_name
    with transaction.atomic():
        member_ids = list(
            UserTenantMembership.objects.filter(tenant=tenant).values_list("user_id", flat=True)
        )
        BlacklistedToken.objects.filter(token__user_id__in=member_ids).delete()
        OutstandingToken.objects.filter(user_id__in=member_ids).delete()
        UserTenantMembership.objects.filter(tenant=tenant).delete()
        Domain.objects.filter(tenant=tenant).delete()
        tenant.delete()  # drops the schema (auto_drop_schema is False, so do it explicitly below)

    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE')
