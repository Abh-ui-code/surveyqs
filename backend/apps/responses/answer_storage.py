"""
Converts a validated `{question_code: value}` document into typed `Answer`
rows. This is the hybrid-storage write path described in
docs/architecture/ANSWER_STORAGE.md: the JSONB document on SurveyResponse
and these typed rows are written in the same transaction by the same
service function -- there is no other code path that writes one without
the other, which is the entire consistency discipline this design relies on.
"""
from datetime import date, datetime

from apps.responses.models import Answer

_SCALAR_TYPE_MAP = {
    "text": "text", "long_text": "text", "email": "text", "phone": "text", "url": "text", "barcode": "text",
    "select_one": "text", "likert": "text", "time": "text",
    "integer": "number", "decimal": "number", "rating": "number", "nps": "number",
    "yes_no": "bool", "acknowledge": "bool",
    "date": "date", "datetime": "datetime",
}


def _question_type_index(schema_json: dict) -> dict[str, str]:
    from apps.formlogic.relevance import iter_questions

    return {q["code"]: q["type"] for _section, q in iter_questions(schema_json)}


def build_answer_rows(response, schema_json: dict, answers: dict) -> list[Answer]:
    """
    Repeat-group answers are stored as a list of per-instance dicts in the
    JSONB document (matching the FORM_SCHEMA answer shape); each field of
    each instance becomes its own typed `Answer` row with `repeat_path` /
    `repeat_index` set, so a report can filter or aggregate across
    instances without parsing JSON.
    """
    type_by_code = _question_type_index(schema_json)
    rows: list[Answer] = []

    for code, value in answers.items():
        if value is None:
            continue
        qtype = type_by_code.get(code)

        if qtype == "repeat" and isinstance(value, list):
            for instance in value:
                index = instance.get("repeat_index")
                for field_code, field_value in instance.items():
                    if field_code == "repeat_index" or field_value is None:
                        continue
                    rows.append(
                        _make_row(response, field_code, field_value, type_by_code.get(field_code),
                                  repeat_path=code, repeat_index=index)
                    )
            continue

        rows.append(_make_row(response, code, value, qtype))

    return rows


def _make_row(response, code, value, qtype, repeat_path="", repeat_index=None) -> Answer:
    kind = _SCALAR_TYPE_MAP.get(qtype)

    if kind == "text":
        return Answer(response=response, question_code=code, value_type="text",
                       value_text=str(value), repeat_path=repeat_path, repeat_index=repeat_index)
    if kind == "number":
        return Answer(response=response, question_code=code, value_type="number",
                       value_number=float(value), repeat_path=repeat_path, repeat_index=repeat_index)
    if kind == "bool":
        return Answer(response=response, question_code=code, value_type="bool",
                       value_bool=bool(value), repeat_path=repeat_path, repeat_index=repeat_index)
    if kind == "date":
        return Answer(response=response, question_code=code, value_type="date",
                       value_date=_parse_date(value), repeat_path=repeat_path, repeat_index=repeat_index)
    if kind == "datetime":
        return Answer(response=response, question_code=code, value_type="datetime",
                       value_datetime=_parse_datetime(value), repeat_path=repeat_path, repeat_index=repeat_index)

    # select_multiple, ranking, matrix_*, constant_sum, currency, geopoint,
    # media references, and anything else structural: stored as JSON.
    return Answer(response=response, question_code=code, value_type="json",
                   value_json=value, repeat_path=repeat_path, repeat_index=repeat_index)


def _parse_date(value) -> date | None:
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _parse_datetime(value) -> datetime | None:
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None
