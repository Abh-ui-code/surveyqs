from django.db.models import ProtectedError, RestrictedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


def _protected_delete_message(exc) -> str:
    """
    Turn Django's opaque `ProtectedError` into a sentence naming what blocks
    the operation and what to do instead. "Cannot delete" with no
    explanation generates a support ticket every time.
    """
    protected = getattr(exc, "protected_objects", None) or getattr(exc, "restricted_objects", None) or []
    counts: dict[str, int] = {}
    for obj in protected:
        label = obj._meta.verbose_name_plural
        counts[label] = counts.get(label, 0) + 1
    parts = [f"{n} {label}" for label, n in counts.items()]
    referenced = ", ".join(parts) if parts else "other records"
    return f"Cannot delete this record because it is still referenced by {referenced}."


def exception_handler(exc, context):
    if isinstance(exc, (ProtectedError, RestrictedError)):
        return Response({"detail": _protected_delete_message(exc)}, status=status.HTTP_409_CONFLICT)
    return drf_exception_handler(exc, context)
