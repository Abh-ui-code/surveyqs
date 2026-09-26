"""
Excel export of survey responses.

Deliberately reads `SurveyResponse.answers` (the JSONB read-cache) against
each response's own pinned `survey_version.schema_json`, NOT the typed
`Answer` rows this app's other views (DashboardView, SurveySummaryView)
aggregate over. That is not an inconsistency -- see
docs/architecture/ANSWER_STORAGE.md: "the exporter deliberately uses the
document, so an export and an on-screen response can never disagree." The
`Answer` table is for aggregation across many responses; this reads one
response's own answers document at a time, exactly like rendering it.

Different responses in one export can belong to different surveys, each
with its own question set -- there is no single fixed column layout that
fits every response the naive way a single-survey report would. Columns
are therefore the union of every (survey, question) and demographic
question actually encountered, in first-seen order: a later response can
only add new columns, never move ones already placed. Demographic columns
are shared across surveys (the bank is global); survey-question columns
are namespaced per survey, so identical question codes from unrelated
surveys never collide into one column.

v1 scope: `note`, `repeat` and `matrix_single` questions are excluded --
none have a sane single-cell shape (a repeat answer is a list of
per-instance objects; a matrix answer is one value per row) and neither
type has an actual renderer anywhere in this app yet (mobile's widget
registry falls through to "unsupported" for both), so there is nothing
real to lose by leaving them out of the first version.
"""
from datetime import datetime
from io import BytesIO

from openpyxl import Workbook

from apps.formlogic.relevance import iter_questions
from apps.responses.models import SurveyResponse
from apps.responses.scoping import scope_responses

FIXED_HEADERS = [
    "Response Code", "Survey", "Full Name", "Phone", "Email",
    "Agent Name", "Agent Email", "Submitted At", "Duration (seconds)", "Collected Offline",
]

_EXCLUDED_TYPES = {"note", "repeat", "matrix_single"}
_UNSAFE_LEADING_CHARS = ("=", "+", "-", "@", "\t", "\r")


def _defang(value):
    """A respondent's free-text answer must never execute as a formula
    when the file is opened in Excel."""
    if isinstance(value, str) and value.startswith(_UNSAFE_LEADING_CHARS):
        return "'" + value
    return value


def _label(label_dict, fallback_code):
    return (label_dict or {}).get("en") or fallback_code


def _choice_label(choice_lists: dict, list_name, value):
    choices = (choice_lists.get(list_name) or {}).get("choices", [])
    for c in choices:
        if c.get("value") == value:
            return _label(c.get("label"), value)
    return value  # unmatched -- e.g. a "other, please specify" free-text answer


def _format_answer(question: dict, value, choice_lists: dict):
    if value is None or value == "":
        return None
    qtype = question.get("type")
    choice_list_name = (question.get("config") or {}).get("choice_list")

    if qtype == "yes_no":
        return "Yes" if value else "No"
    if qtype == "select_one":
        return _choice_label(choice_lists, choice_list_name, value)
    if qtype == "select_multiple" and isinstance(value, list):
        return ", ".join(str(_choice_label(choice_lists, choice_list_name, v)) for v in value)
    if qtype == "ranking" and isinstance(value, list):
        return ", ".join(f"{i + 1}. {_choice_label(choice_lists, choice_list_name, v)}" for i, v in enumerate(value))
    if qtype == "geopoint" and isinstance(value, dict):
        return f"{value.get('lat')},{value.get('lng')}"
    if qtype in {"image", "audio", "video", "file", "signature"}:
        items = value if isinstance(value, list) else [value]
        return ", ".join(i.get("filename", "") for i in items if isinstance(i, dict))
    if qtype in {"date", "datetime"} and isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return value
    if isinstance(value, (int, float, bool)):
        return value
    if isinstance(value, list):
        return ", ".join(str(v) for v in value)
    return value


def _resolve_agents(collected_by_ids):
    from apps.users.models import User

    return {str(u.id): u for u in User.objects.filter(id__in=collected_by_ids)}


def _build_columns_and_rows(responses: list[SurveyResponse]):
    """
    Returns (dynamic_headers, rows) where each row is
    (fixed_values, {column_key: value}) -- the caller materializes the
    final flat row once `dynamic_headers` (and the key->index map) is
    complete, since a response processed early cannot know about columns
    a later response will introduce.
    """
    from apps.respondents.models import Respondent

    respondent_ids = {r.respondent_id for r in responses if r.respondent_id}
    respondents_by_id = {str(r.id): r for r in Respondent.objects.filter(id__in=respondent_ids)}
    agents_by_id = _resolve_agents({r.collected_by_id for r in responses})

    column_index: dict[tuple, int] = {}
    dynamic_headers: list[str] = []
    schema_cache: dict[str, tuple[dict, dict]] = {}  # version id -> (schema_json, choice_lists by name)
    prepared_rows = []

    for r in responses:
        version_id = str(r.survey_version_id)
        if version_id not in schema_cache:
            schema = r.survey_version.schema_json or {}
            choice_lists = {cl["name"]: cl for cl in schema.get("choice_lists", [])}
            schema_cache[version_id] = (schema, choice_lists)
        schema, choice_lists = schema_cache[version_id]

        respondent = respondents_by_id.get(str(r.respondent_id)) if r.respondent_id else None
        agent = agents_by_id.get(str(r.collected_by_id))
        row_values: dict[tuple, object] = {}

        if respondent:
            demographic_questions = {q["code"]: q for q in schema.get("demographic_questions", [])}
            for code, value in (respondent.custom_fields or {}).items():
                question = demographic_questions.get(code)
                key = ("__demo__", code)
                if key not in column_index:
                    column_index[key] = len(dynamic_headers)
                    dynamic_headers.append(_label(question.get("label") if question else None, code))
                formatted = _format_answer(question, value, choice_lists) if question else value
                row_values[key] = _defang(formatted)

        answers = r.answers or {}
        for _section, question in iter_questions(schema):
            if question.get("type") in _EXCLUDED_TYPES:
                continue
            code = question["code"]
            if code not in answers:
                continue
            key = (str(r.survey_id), code)
            if key not in column_index:
                column_index[key] = len(dynamic_headers)
                dynamic_headers.append(f"{r.survey.title} — {_label(question.get('label'), code)}")
            row_values[key] = _defang(_format_answer(question, answers[code], choice_lists))

        fixed = [
            r.response_code,
            r.survey.title,
            respondent.full_name if respondent else "",
            respondent.phone if respondent else "",
            respondent.email if respondent else "",
            agent.full_name if agent else "",
            agent.email if agent else "",
            r.submitted_at.replace(tzinfo=None) if r.submitted_at else None,
            r.duration_seconds,
            "Yes" if r.was_offline else "No",
        ]
        prepared_rows.append((fixed, row_values))

    rows = []
    for fixed, row_values in prepared_rows:
        dynamic = [None] * len(dynamic_headers)
        for key, value in row_values.items():
            dynamic[column_index[key]] = value
        rows.append(fixed + dynamic)

    return dynamic_headers, rows


def _write_workbook(dynamic_headers: list[str], rows: list[list]) -> BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.title = "Responses"
    headers = FIXED_HEADERS + dynamic_headers
    ws.append(headers)
    for row in rows:
        ws.append(row)
    ws.freeze_panes = "A2"

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def export_responses(user, *, survey_id=None, collected_by_id=None, date_from=None, date_to=None) -> BytesIO:
    """The single query that backs both the Master Report (no filters) and
    the Filtered Report (any combination of these) -- the RBAC visibility
    floor from `scope_responses` is always applied first, and the admin's
    chosen filters narrow on top of it, never replace it."""
    qs = scope_responses(SurveyResponse.objects.filter(is_deleted=False), user)
    if survey_id:
        qs = qs.filter(survey_id=survey_id)
    if collected_by_id:
        qs = qs.filter(collected_by_id=collected_by_id)
    if date_from:
        qs = qs.filter(submitted_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(submitted_at__date__lte=date_to)

    responses = list(
        qs.select_related("survey", "survey_version", "respondent").order_by("survey_id", "submitted_at")
    )
    dynamic_headers, rows = _build_columns_and_rows(responses)
    return _write_workbook(dynamic_headers, rows)
