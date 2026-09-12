"""
Local development only. Seeds one category and one published, assigned
survey inside an existing tenant, so a fresh checkout has something real to
look at immediately. Refuses outright when DEBUG is false.
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django_tenants.utils import schema_context


class Command(BaseCommand):
    help = "Seed a sample published survey with an assignment. DEBUG-only."

    def add_arguments(self, parser):
        parser.add_argument("--subdomain", default="abc")

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_dev_surveys refuses to run outside DEBUG.")

        from apps.tenants.models import Tenant

        tenant = Tenant.objects.get(subdomain=options["subdomain"])
        with schema_context(tenant.schema_name):
            self._seed(tenant)

    def _seed(self, tenant):
        from apps.assignments.services import create_assignments
        from apps.surveys.models import Question, Section, Survey, SurveyCategory
        from apps.surveys.services import publish_survey
        from apps.users.models import User

        base = settings.TENANT_BASE_DOMAIN
        admin = User.objects.get(email=f"admin@{tenant.subdomain}.{base}")
        agent1 = User.objects.get(email=f"agent1@{tenant.subdomain}.{base}")
        agent2 = User.objects.get(email=f"agent2@{tenant.subdomain}.{base}")

        category, _ = SurveyCategory.objects.get_or_create(
            code="farming", defaults={"label": "Farming", "display_order": 1}
        )
        SurveyCategory.objects.get_or_create(
            code="electronics", defaults={"label": "Electronics", "display_order": 2}
        )
        SurveyCategory.objects.get_or_create(
            code="automotive", defaults={"label": "Automotive", "display_order": 3}
        )

        survey, created = Survey.objects.get_or_create(
            title="Farming Survey",
            defaults={
                "category": category, "description": "Annual practices and yield survey",
                "instructions": "Introduce yourself, then read the consent notice aloud.",
                "created_by": admin,
            },
        )
        if not created and survey.current_version_id:
            self.stdout.write("Farming Survey already published; leaving it as-is.")
        else:
            from apps.surveys.services import open_draft

            draft = open_draft(survey)
            section = Section.objects.create(version=draft, code="main", order=0, title={"en": "Farm Details"})
            Question.objects.create(
                section=section, code="crop", type="text", order=0,
                label={"en": "What is your primary crop?"}, is_required="true",
            )
            Question.objects.create(
                section=section, code="area_acres", type="decimal", order=1,
                label={"en": "How many acres do you farm?"}, is_required="true",
                config={"min": 0, "max": 9999, "decimal_places": 2},
            )
            Question.objects.create(
                section=section, code="owns_irrigation", type="yes_no", order=2,
                label={"en": "Do you have access to irrigation?"},
            )
            publish_survey(admin, survey, change_note="Initial version")
            self.stdout.write(self.style.SUCCESS(f"Published '{survey.title}' v1."))

        create_assignments(
            survey=survey, assignees=[{"type": "user", "id": agent1.id}, {"type": "user", "id": agent2.id}],
            target_count=200, due_date=None, priority="normal",
            instructions="Focus on households with more than 2 acres.", assigned_by=admin,
        )
        self.stdout.write(self.style.SUCCESS("Assigned to agent1 and agent2."))
