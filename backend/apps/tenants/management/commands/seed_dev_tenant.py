"""
Local development only. Seeds one tenant with a full set of role-covering
users, all with the same known password. Refuses outright when DEBUG is
false, so this can never run against production by accident.
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django_tenants.utils import schema_context

DEV_PASSWORD = "devpassword"


class Command(BaseCommand):
    help = "Seed a development tenant with one user per role. DEBUG-only."

    def add_arguments(self, parser):
        parser.add_argument("--subdomain", default="abc")
        parser.add_argument("--name", default="ABC Company")

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_dev_tenant refuses to run outside DEBUG.")

        from apps.tenants.models import Tenant
        from apps.tenants.services import provision_tenant

        subdomain = options["subdomain"]
        existing = Tenant.objects.filter(subdomain=subdomain).first()
        if existing:
            tenant = existing
            self.stdout.write(f"Tenant '{subdomain}' already exists; reusing it.")
        else:
            result = provision_tenant(
                name=options["name"], subdomain=subdomain,
                admin_email=self._email(subdomain, "admin"), admin_full_name="Admin User",
                base_domain=settings.TENANT_BASE_DOMAIN,
            )
            tenant = result.tenant
            self.stdout.write(self.style.SUCCESS(f"Provisioned tenant '{subdomain}'."))

        self._create_user(tenant, "admin", "admin", "Admin User")
        self._create_user(tenant, "supervisor", "supervisor", "Supervisor User")
        self._create_user(tenant, "agent1", "agent", "Agent One")
        self._create_user(tenant, "agent2", "agent", "Agent Two")
        self._create_user(tenant, "analyst", "analyst", "Analyst User")

        emails = "\n".join(f"  {self._email(subdomain, role)}" for role in ["admin", "supervisor", "agent1", "agent2", "analyst"])
        self.stdout.write(self.style.SUCCESS(
            f"\nSeeded {subdomain}.{settings.TENANT_BASE_DOMAIN} -- every user's password is '{DEV_PASSWORD}'.\n{emails}\n"
        ))

    @staticmethod
    def _email(subdomain: str, local_part: str) -> str:
        return f"{local_part}@{subdomain}.{settings.TENANT_BASE_DOMAIN}"

    def _create_user(self, tenant, local_part, role_code, full_name):
        from apps.users.models import User, UserTenantMembership

        email = self._email(tenant.subdomain, local_part)
        user, _ = User.objects.get_or_create(email=email, defaults={"full_name": full_name})
        user.set_password(DEV_PASSWORD)
        user.is_active = True
        user.full_name = full_name
        user.save()

        UserTenantMembership.objects.update_or_create(
            user=user, tenant=tenant, defaults={"role_code": role_code, "is_active": True}
        )

        with schema_context(tenant.schema_name):
            from apps.rbac.models import Role, UserRole

            role = Role.objects.get(code=role_code)
            UserRole.objects.get_or_create(user_id=user.id, role=role)
