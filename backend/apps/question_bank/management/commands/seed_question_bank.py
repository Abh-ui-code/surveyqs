"""
Seeds a starter "Farming" question bank so the feature isn't empty on day
one. Idempotent -- get_or_create keyed by code, safe to re-run.
"""
from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context


def _choices(*values_labels):
    return [{"value": value, "label": {"en": label}, "order": i} for i, (value, label) in enumerate(values_labels)]


BANK_QUESTIONS = [
    {
        "code": "farm_size", "type": "decimal",
        "label": {"en": "What is the total size of your farm?"}, "hint": {"en": "In hectares"},
        "is_required": "true", "config": {"min": 0, "max": 9999, "decimal_places": 2},
    },
    {
        "code": "primary_crop", "type": "select_one",
        "label": {"en": "What is your primary crop?"}, "is_required": "true",
        "choices": _choices(
            ("maize", "Maize"), ("rice", "Rice"), ("wheat", "Wheat"),
            ("vegetables", "Vegetables"), ("cash_crop", "Cash crop"), ("other", "Other"),
        ),
    },
    {
        "code": "farming_experience_years", "type": "integer",
        "label": {"en": "How many years have you been farming?"}, "config": {"min": 0, "max": 100},
    },
    {
        "code": "land_ownership", "type": "select_one",
        "label": {"en": "What is your land ownership status?"},
        "choices": _choices(("owned", "Owned"), ("leased", "Leased"), ("shared", "Shared"), ("other", "Other")),
    },
    {
        "code": "irrigation_source", "type": "select_one",
        "label": {"en": "What is your main source of irrigation?"},
        "choices": _choices(
            ("rainfed", "Rain-fed"), ("canal", "Canal"), ("borewell", "Borewell"),
            ("drip", "Drip irrigation"), ("other", "Other"),
        ),
    },
    {
        "code": "uses_fertilizer", "type": "yes_no",
        "label": {"en": "Do you use fertilizer on your farm?"},
    },
    {
        "code": "fertilizer_type", "type": "select_one",
        "label": {"en": "What type of fertilizer do you mainly use?"},
        "choices": _choices(("organic", "Organic"), ("chemical", "Chemical"), ("mixed", "Mixed")),
    },
    {
        "code": "livestock_owned", "type": "yes_no",
        "label": {"en": "Do you own any livestock?"},
    },
    {
        "code": "livestock_count", "type": "integer",
        "label": {"en": "How many livestock animals do you own?"}, "config": {"min": 0},
    },
    {
        "code": "annual_yield", "type": "decimal",
        "label": {"en": "What was your annual yield?"}, "hint": {"en": "In quintals per hectare"},
        "config": {"min": 0, "decimal_places": 2},
    },
    {
        "code": "farming_method", "type": "select_one",
        "label": {"en": "Which farming method do you primarily use?"},
        "choices": _choices(("organic", "Organic"), ("conventional", "Conventional"), ("mixed", "Mixed")),
    },
    {
        "code": "main_challenges", "type": "select_multiple",
        "label": {"en": "What are the main challenges you face in farming?"},
        "choices": _choices(
            ("water_scarcity", "Water scarcity"), ("pests", "Pests and disease"),
            ("market_access", "Market access"), ("credit_access", "Access to credit"),
            ("labor_shortage", "Labor shortage"), ("other", "Other"),
        ),
    },
]


class Command(BaseCommand):
    help = "Seed a starter Farming question bank. Safe to re-run."

    def add_arguments(self, parser):
        parser.add_argument("--subdomain", default="abc")

    def handle(self, *args, **options):
        from apps.tenants.models import Tenant

        tenant = Tenant.objects.get(subdomain=options["subdomain"])
        with schema_context(tenant.schema_name):
            self._seed()

    def _seed(self):
        from apps.question_bank.models import BankQuestion, QuestionBankCategory

        category, _ = QuestionBankCategory.objects.get_or_create(name="Farming")

        created_count = 0
        for spec in BANK_QUESTIONS:
            _, created = BankQuestion.objects.get_or_create(
                code=spec["code"],
                defaults={
                    "category": category,
                    "type": spec["type"],
                    "label": spec["label"],
                    "hint": spec.get("hint", {}),
                    "is_required": spec.get("is_required", "false"),
                    "config": spec.get("config", {}),
                    "choices": spec.get("choices", []),
                },
            )
            created_count += int(created)

        self.stdout.write(self.style.SUCCESS(
            f"Farming question bank: {created_count} created, "
            f"{len(BANK_QUESTIONS) - created_count} already present."
        ))
