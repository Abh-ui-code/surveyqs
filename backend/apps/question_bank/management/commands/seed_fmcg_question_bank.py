"""
Seeds a starter "FMCG" (fast-moving consumer goods) question bank -- retail
audit / in-store survey questions, mirroring seed_question_bank.py's
Farming set. Idempotent -- get_or_create keyed by code, safe to re-run.
"""
from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context


def _choices(*values_labels):
    return [{"value": value, "label": {"en": label}, "order": i} for i, (value, label) in enumerate(values_labels)]


BANK_QUESTIONS = [
    {
        "code": "outlet_type", "type": "select_one",
        "label": {"en": "What type of outlet is this?"}, "is_required": "true",
        "choices": _choices(
            ("kirana", "Kirana / general store"), ("supermarket", "Supermarket"),
            ("convenience", "Convenience store"), ("wholesale", "Wholesale"),
            ("online", "Online / e-commerce"), ("other", "Other"),
        ),
    },
    {
        "code": "daily_footfall", "type": "integer",
        "label": {"en": "Roughly how many customers visit this outlet per day?"}, "config": {"min": 0},
    },
    {
        "code": "top_selling_category", "type": "select_one",
        "label": {"en": "Which product category sells the most here?"},
        "choices": _choices(
            ("food_beverages", "Food & beverages"), ("personal_care", "Personal care"),
            ("household_care", "Household care"), ("snacks_confectionery", "Snacks & confectionery"),
            ("dairy", "Dairy"), ("other", "Other"),
        ),
    },
    {
        "code": "stocks_product", "type": "yes_no",
        "label": {"en": "Does this outlet currently stock the product?"}, "is_required": "true",
    },
    {
        "code": "stockout_frequency", "type": "select_one",
        "label": {"en": "How often does this product go out of stock?"},
        "choices": _choices(
            ("never", "Never"), ("rarely", "Rarely"), ("sometimes", "Sometimes"),
            ("often", "Often"), ("always", "Always"),
        ),
    },
    {
        "code": "purchase_frequency", "type": "select_one",
        "label": {"en": "How often do customers purchase this product?"},
        "choices": _choices(
            ("daily", "Daily"), ("weekly", "Weekly"), ("monthly", "Monthly"),
            ("occasionally", "Occasionally"), ("rarely", "Rarely"),
        ),
    },
    {
        "code": "price_perception", "type": "select_one",
        "label": {"en": "How would you rate the price point of this product?"},
        "choices": _choices(("too_expensive", "Too expensive"), ("fairly_priced", "Fairly priced"), ("very_affordable", "Very affordable")),
    },
    {
        "code": "preferred_pack_sizes", "type": "select_multiple",
        "label": {"en": "Which pack sizes do customers prefer?"},
        "choices": _choices(
            ("sachet", "Small / sachet"), ("medium", "Medium"),
            ("large", "Large / family pack"), ("bulk", "Bulk"),
        ),
    },
    {
        "code": "shelf_visibility", "type": "select_one",
        "label": {"en": "How would you rate this product's shelf visibility and placement?"},
        "choices": _choices(("excellent", "Excellent"), ("good", "Good"), ("average", "Average"), ("poor", "Poor")),
    },
    {
        "code": "purchase_influencers", "type": "select_multiple",
        "label": {"en": "What most influences the customer's purchase decision?"},
        "choices": _choices(
            ("price", "Price"), ("brand_loyalty", "Brand loyalty"), ("packaging", "Packaging"),
            ("advertisement", "Advertisement"), ("recommendation", "Recommendation"), ("availability", "Availability"),
        ),
    },
    {
        "code": "promotion_active", "type": "yes_no",
        "label": {"en": "Is there any ongoing promotion or discount on this product?"},
    },
    {
        "code": "average_purchase_value", "type": "decimal",
        "label": {"en": "What is the average amount spent per purchase?"}, "hint": {"en": "In local currency"},
        "config": {"min": 0, "decimal_places": 2},
    },
    {
        "code": "competitor_brand", "type": "text",
        "label": {"en": "Which competing brand is most commonly purchased instead?"},
    },
    {
        "code": "would_recommend", "type": "yes_no",
        "label": {"en": "Would the retailer recommend this product to other outlets?"},
    },
]


class Command(BaseCommand):
    help = "Seed a starter FMCG (retail audit) question bank. Safe to re-run."

    def add_arguments(self, parser):
        parser.add_argument("--subdomain", default="abc")

    def handle(self, *args, **options):
        from apps.tenants.models import Tenant

        tenant = Tenant.objects.get(subdomain=options["subdomain"])
        with schema_context(tenant.schema_name):
            self._seed()

    def _seed(self):
        from apps.question_bank.models import BankQuestion, QuestionBankCategory

        category, _ = QuestionBankCategory.objects.get_or_create(name="FMCG")

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
            f"FMCG question bank: {created_count} created, "
            f"{len(BANK_QUESTIONS) - created_count} already present."
        ))
