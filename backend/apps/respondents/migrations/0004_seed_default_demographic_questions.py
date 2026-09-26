"""
Seeds a small starter set of demographic questions into every tenant's bank
so the module isn't empty on day one -- admins can edit, reorder or delete
any of these afterward exactly like a hand-added one; nothing here is
special-cased or protected. Runs once per tenant schema: automatically for
every new tenant (provision_tenant migrates the full history into a fresh
schema), and via `migrate_ready_tenant_schemas` for tenants that already
existed when this migration was added.
"""
from django.db import migrations

DEFAULTS = [
    {
        "code": "gender",
        "type": "select_one",
        "label": {"en": "Gender"},
        "is_required": "false",
        "choices": [
            {"value": "female", "label": {"en": "Female"}, "order": 0},
            {"value": "male", "label": {"en": "Male"}, "order": 1},
            {"value": "other", "label": {"en": "Other"}, "order": 2},
            {"value": "prefer_not_to_say", "label": {"en": "Prefer not to say"}, "order": 3},
        ],
    },
    {
        "code": "age",
        "type": "integer",
        "label": {"en": "Age"},
        "is_required": "false",
        "config": {"min": 0, "max": 120},
    },
    {
        "code": "occupation",
        "type": "text",
        "label": {"en": "Occupation"},
        "is_required": "false",
    },
    {
        "code": "marital_status",
        "type": "select_one",
        "label": {"en": "Marital status"},
        "is_required": "false",
        "choices": [
            {"value": "single", "label": {"en": "Single"}, "order": 0},
            {"value": "married", "label": {"en": "Married"}, "order": 1},
            {"value": "divorced", "label": {"en": "Divorced"}, "order": 2},
            {"value": "widowed", "label": {"en": "Widowed"}, "order": 3},
        ],
    },
    {
        "code": "address",
        "type": "long_text",
        "label": {"en": "Address"},
        "is_required": "false",
    },
]


def seed_defaults(apps, schema_editor):
    DemographicQuestion = apps.get_model("respondents", "DemographicQuestion")
    for entry in DEFAULTS:
        DemographicQuestion.objects.get_or_create(
            code=entry["code"],
            defaults={
                "type": entry["type"],
                "label": entry["label"],
                "is_required": entry["is_required"],
                "config": entry.get("config", {}),
                "choices": entry.get("choices", []),
            },
        )


def remove_defaults(apps, schema_editor):
    DemographicQuestion = apps.get_model("respondents", "DemographicQuestion")
    DemographicQuestion.objects.filter(code__in=[e["code"] for e in DEFAULTS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("respondents", "0003_demographicquestion"),
    ]

    operations = [
        migrations.RunPython(seed_defaults, remove_defaults),
    ]
