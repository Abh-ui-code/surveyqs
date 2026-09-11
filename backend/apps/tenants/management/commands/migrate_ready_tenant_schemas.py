"""
The deploy-safety variant of `migrate_schemas --tenant`. One tenant left
half-provisioned by a failed creation must not fail the release for every
other tenant -- so this iterates tenants, checks the schema actually
exists, and skips with a warning rather than raising.
"""
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection

from apps.tenants.models import Tenant


class Command(BaseCommand):
    help = "Migrate every tenant schema that actually exists, skipping and warning on any that don't."

    def handle(self, *args, **options):
        migrated, skipped = 0, 0
        for tenant in Tenant.objects.filter(is_ready=True).order_by("schema_name"):
            if not self._schema_exists(tenant.schema_name):
                self.stderr.write(
                    self.style.WARNING(
                        f"Skipping {tenant.schema_name}: marked ready but schema does not exist."
                    )
                )
                skipped += 1
                continue
            self.stdout.write(f"Migrating {tenant.schema_name}...")
            call_command(
                "migrate_schemas",
                tenant=True,
                schema_name=tenant.schema_name,
                interactive=False,
                verbosity=0,
            )
            migrated += 1

        self.stdout.write(
            self.style.SUCCESS(f"Migrated {migrated} tenant schema(s), skipped {skipped}.")
        )

    @staticmethod
    def _schema_exists(schema_name: str) -> bool:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM information_schema.schemata WHERE schema_name = %s", [schema_name]
            )
            return cursor.fetchone() is not None
