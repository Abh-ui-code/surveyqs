"""
Respondent deduplication and consent capture. See
docs/product/RESPONDENT_AND_CONSENT.md -- the phone-first lookup is the
cheapest deduplication key and the one the mobile app checks before
creating a new record, online or off.
"""
import hashlib
from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone

from apps.respondents.models import ConsentRecord, Respondent


@dataclass
class LookupMatch:
    respondent: Respondent
    matched_on: str  # "phone" | "identity_number"


def lookup_duplicate(*, phone: str = "", identity_number: str = "") -> LookupMatch | None:
    if phone:
        existing = Respondent.objects.filter(phone=phone, is_deleted=False).first()
        if existing:
            return LookupMatch(respondent=existing, matched_on="phone")
    if identity_number:
        existing = Respondent.objects.filter(identity_number=identity_number, is_deleted=False).first()
        if existing:
            return LookupMatch(respondent=existing, matched_on="identity_number")
    return None


@transaction.atomic
def create_or_reuse_respondent(*, data: dict, client_ref_id=None, actor=None) -> tuple[Respondent, bool]:
    """
    Idempotent create: a resend of the same `client_ref_id` returns the
    existing record rather than raising a uniqueness error. Returns
    (respondent, created).
    """
    if client_ref_id:
        existing = Respondent.objects.filter(client_ref_id=client_ref_id).first()
        if existing:
            return existing, False

    match = lookup_duplicate(phone=data.get("phone", ""), identity_number=data.get("identity_number", ""))
    if match:
        return match.respondent, False

    respondent = Respondent.objects.create(client_ref_id=client_ref_id, created_by=actor, **data)
    return respondent, True


def _integrity_hash(*, respondent_id, notice_id, method, granted_at, purposes) -> str:
    payload = f"{respondent_id}|{notice_id}|{method}|{granted_at.isoformat()}|{sorted(purposes)}"
    return hashlib.sha256(payload.encode()).hexdigest()


@transaction.atomic
def capture_consent(
    *, respondent, notice, method: str, granted_at=None, captured_by=None,
    captured_offline: bool = False, purposes: list[str] | None = None,
    signature_attachment_id=None, client_ref_id=None,
) -> tuple[ConsentRecord, bool]:
    if client_ref_id:
        existing = ConsentRecord.objects.filter(client_ref_id=client_ref_id).first()
        if existing:
            return existing, False

    granted_at = granted_at or timezone.now()
    purposes = purposes or []
    record = ConsentRecord.objects.create(
        respondent=respondent, notice=notice, method=method, granted_at=granted_at,
        captured_by_id=getattr(captured_by, "id", None), captured_offline=captured_offline,
        purposes=purposes, signature_attachment_id=signature_attachment_id, client_ref_id=client_ref_id,
        integrity_hash=_integrity_hash(
            respondent_id=respondent.id if respondent else None, notice_id=notice.id,
            method=method, granted_at=granted_at, purposes=purposes,
        ),
    )
    if respondent:
        respondent.consent_status = "granted"
        respondent.save(update_fields=["consent_status"])
    return record, True


@transaction.atomic
def withdraw_consent(respondent: Respondent, actor=None):
    respondent.consent_status = "withdrawn"
    respondent.save(update_fields=["consent_status"])
    ConsentRecord.objects.filter(respondent=respondent, is_withdrawn=False).update(
        is_withdrawn=True, withdrawn_at=timezone.now()
    )
    return respondent
