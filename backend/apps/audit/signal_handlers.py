"""
Drives AuditLog off `pre_save` (to capture the previous state) and
`post_save` / `post_delete`, scoped to the AUDITED_MODELS set declared in
models.py. Never fires on the public schema, where the AuditLog table does
not exist.
"""
from django.db import connection
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver
from django_tenants.utils import get_public_schema_name

from apps.audit.actor import get_actor
from apps.audit.models import AUDITED_MODELS, AuditLog

_PRE_SAVE_STATE: dict[str, dict] = {}


def _label(instance) -> str:
    return f"{instance._meta.app_label}.{instance._meta.object_name}"


def _in_tenant_schema() -> bool:
    return connection.schema_name != get_public_schema_name()


def _serialize(instance) -> dict:
    from django.core.serializers.json import DjangoJSONEncoder
    import json

    return json.loads(json.dumps(
        {f.name: getattr(instance, f.attname, None) for f in instance._meta.fields},
        cls=DjangoJSONEncoder,
        default=str,
    ))


def _current_tenant_id():
    """
    `connection.tenant` is a full `Tenant` instance when the schema was
    selected by the request middleware, but only a lightweight `FakeTenant`
    carrying `schema_name` when selected via `schema_context()` -- the path
    every management command and Celery task uses. Fall back to a lookup by
    schema name in that case rather than assuming `.id` exists.
    """
    tenant_id = getattr(connection.tenant, "id", None)
    if tenant_id is not None:
        return tenant_id
    from apps.tenants.models import Tenant

    real = Tenant.objects.filter(schema_name=connection.schema_name).only("id").first()
    return real.id if real else None


def _write(action: str, instance, before: dict | None, after: dict | None, changed: list[str]):
    if not _in_tenant_schema():
        return
    actor = get_actor()
    user = actor["user"]
    AuditLog.objects.create(
        tenant_id=_current_tenant_id(),
        user_id=getattr(user, "id", None),
        user_email=getattr(user, "email", ""),
        action=action,
        entity_type=_label(instance),
        entity_id=str(instance.pk),
        entity_label=str(instance)[:255],
        before_values=before,
        after_values=after,
        changed_fields=changed,
        ip_address=actor["ip_address"],
        user_agent=actor["user_agent"],
        request_id=actor["request_id"],
    )


@receiver(pre_save)
def _capture_before(sender, instance, **kwargs):
    if _label(instance) not in AUDITED_MODELS or not _in_tenant_schema():
        return
    if instance.pk:
        try:
            previous = sender.objects.get(pk=instance.pk)
            _PRE_SAVE_STATE[f"{_label(instance)}:{instance.pk}"] = _serialize(previous)
        except sender.DoesNotExist:
            pass


@receiver(post_save)
def _record_save(sender, instance, created, **kwargs):
    if _label(instance) not in AUDITED_MODELS:
        return
    after = _serialize(instance)
    key = f"{_label(instance)}:{instance.pk}"
    before = _PRE_SAVE_STATE.pop(key, None)
    changed = (
        []
        if created
        else [k for k, v in after.items() if before is None or before.get(k) != v]
    )
    _write("create" if created else "update", instance, before, after, changed)


@receiver(post_delete)
def _record_delete(sender, instance, **kwargs):
    if _label(instance) not in AUDITED_MODELS:
        return
    _write("delete", instance, _serialize(instance), None, [])
