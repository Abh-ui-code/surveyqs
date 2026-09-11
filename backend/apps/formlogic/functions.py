"""
The fixed function table. Nothing else is callable from an expression --
see docs/product/FORM_LOGIC.md for why the surface is kept this small: every
function here must also exist, with identical behaviour, in the TypeScript
evaluator, and every additional function is another divergence risk between
the three runtimes.
"""
import re
from datetime import date, datetime, timezone as dt_timezone

from apps.formlogic.exceptions import ExpressionEvaluationError


def _as_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _as_number(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _selected(choice_value, target):
    return target in _as_list(choice_value)


def _count_selected(choice_value):
    return len(_as_list(choice_value))


def _count(repeat_value):
    return len(_as_list(repeat_value))


def _sum(repeat_values: list):
    numbers = [_as_number(v) for v in repeat_values]
    if any(n is None for n in numbers):
        return None
    return sum(numbers)


def _if(condition, when_true, when_false):
    return when_true if bool(condition) else when_false


def _coalesce(*args):
    for arg in args:
        if arg is not None:
            return arg
    return None


def _is_empty(value) -> bool:
    return value is None or value == "" or value == []


def _not_empty(value) -> bool:
    return not _is_empty(value)


def _today() -> date:
    return datetime.now(dt_timezone.utc).date()


def _now() -> datetime:
    return datetime.now(dt_timezone.utc)


def _to_date(value) -> date | None:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None
    return None


def _date_diff(a, b, unit: str):
    da, db = _to_date(a), _to_date(b)
    if da is None or db is None:
        return None
    delta_days = (da - db).days
    if unit == "days":
        return delta_days
    if unit == "months":
        return (da.year - db.year) * 12 + (da.month - db.month)
    if unit == "years":
        return da.year - db.year - ((da.month, da.day) < (db.month, db.day))
    raise ExpressionEvaluationError(f"Unknown date_diff unit: {unit!r}")


def _age(dob) -> int | None:
    d = _to_date(dob)
    if d is None:
        return None
    return _date_diff(_today(), d, "years")


def _length(value) -> int:
    if value is None:
        return 0
    if isinstance(value, (list, str)):
        return len(value)
    return len(str(value))


_MATCHES_ALLOWED = re.compile(r"^[\w\s.^$*+?{}\[\]()|\\-]*$")


def _matches(value, pattern: str) -> bool:
    """
    A deliberately restricted pattern syntax: anchored, no backreferences,
    no lookaround. Guards against a pathological pattern hanging on a
    low-end phone and keeps behaviour identical across three regex engines.
    """
    if not _MATCHES_ALLOWED.match(pattern):
        raise ExpressionEvaluationError("Pattern contains a disallowed construct.")
    if value is None:
        return False
    return re.fullmatch(pattern, str(value)) is not None


def _to_number(value):
    return _as_number(value)


def _to_int(value):
    n = _as_number(value)
    return int(n) if n is not None else None


def _to_text(value) -> str:
    return "" if value is None else str(value)


def _round(value, places=0):
    n = _as_number(value)
    return None if n is None else round(n, int(places))


def _min(*args):
    numbers = [n for n in (_as_number(a) for a in args) if n is not None]
    return min(numbers) if numbers else None


def _max(*args):
    numbers = [n for n in (_as_number(a) for a in args) if n is not None]
    return max(numbers) if numbers else None


def _abs(value):
    n = _as_number(value)
    return None if n is None else abs(n)


def _contains(haystack, needle) -> bool:
    return _to_text(needle) in _to_text(haystack)


def _starts_with(value, prefix) -> bool:
    return _to_text(value).startswith(_to_text(prefix))


def _ends_with(value, suffix) -> bool:
    return _to_text(value).endswith(_to_text(suffix))


def _upper(value) -> str:
    return _to_text(value).upper()


def _lower(value) -> str:
    return _to_text(value).lower()


def _trim(value) -> str:
    return _to_text(value).strip()


FUNCTIONS = {
    "selected": _selected,
    "count_selected": _count_selected,
    "count": _count,
    "sum": _sum,
    "if": _if,
    "coalesce": _coalesce,
    "is_empty": _is_empty,
    "not_empty": _not_empty,
    "today": _today,
    "now": _now,
    "date_diff": _date_diff,
    "age": _age,
    "length": _length,
    "matches": _matches,
    "number": _to_number,
    "int": _to_int,
    "text": _to_text,
    "round": _round,
    "min": _min,
    "max": _max,
    "abs": _abs,
    "contains": _contains,
    "starts_with": _starts_with,
    "ends_with": _ends_with,
    "upper": _upper,
    "lower": _lower,
    "trim": _trim,
}
