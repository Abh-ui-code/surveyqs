"""
Human-readable response codes, e.g. RESP-2026-004821. A tiny row-locked
sequence rather than a global counter cache, so two concurrent submissions
can never collide.
"""
from django.db import transaction
from django.utils import timezone

from apps.responses.models import NumberSequence


@transaction.atomic
def next_response_code() -> str:
    year = timezone.now().year
    seq, _ = NumberSequence.objects.select_for_update().get_or_create(
        key="response", defaults={"year": year, "last_value": 0}
    )
    if seq.year != year:
        seq.year = year
        seq.last_value = 0
    seq.last_value += 1
    seq.save(update_fields=["year", "last_value"])
    return f"RESP-{year}-{seq.last_value:06d}"
