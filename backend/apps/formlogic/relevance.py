"""
Derives which questions in a form package are relevant given a set of
answers so far. Runs in dependency (document) order, which publish-time
validation guarantees is also reference order -- see
apps.surveys.validators for the forward-reference check that makes this
safe to assume here.
"""
from apps.formlogic.evaluator import EvalContext, safe_evaluate_bool
from apps.formlogic.parser import parse


def iter_questions(schema_json: dict):
    """Yields (section, question) pairs in document order, including repeat children."""
    for section in schema_json.get("sections", []):
        for question in section.get("questions", []):
            yield section, question
            if question.get("type") == "repeat":
                for child in question.get("questions", []):
                    yield section, child


def relevant_question_codes(schema_json: dict, answers: dict) -> set[str]:
    """
    Returns the set of question codes that are relevant given `answers`.
    A section whose own `relevant` is false makes every question inside it
    irrelevant regardless of the question's own condition.
    """
    relevant: set[str] = set()
    context = EvalContext(answers=answers)

    section_relevance: dict[str, bool] = {}
    for section in schema_json.get("sections", []):
        expr = section.get("relevant")
        section_relevance[section["code"]] = (
            True if not expr else safe_evaluate_bool(parse(expr), context)
        )

    for section, question in iter_questions(schema_json):
        if not section_relevance.get(section["code"], True):
            continue
        expr = question.get("relevant")
        is_relevant = True if not expr else safe_evaluate_bool(parse(expr), context)
        if is_relevant:
            relevant.add(question["code"])

    return relevant


def drop_irrelevant_answers(schema_json: dict, answers: dict) -> tuple[dict, list[str]]:
    """
    Returns (kept_answers, dropped_codes). Re-derives relevance from
    `answers` as submitted and strips any answer to a question the server
    now judges irrelevant -- the server is the only authority, never the
    client's own view of what it showed.
    """
    relevant = relevant_question_codes(schema_json, answers)
    kept, dropped = {}, []
    for code, value in answers.items():
        if code in relevant:
            kept[code] = value
        else:
            dropped.append(code)
    return kept, dropped
