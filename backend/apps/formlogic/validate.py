"""
Server-side re-validation of a submitted response against its pinned
version. This is the only authoritative validation in the system -- see
docs/api/SYNC_API.md "Server-side submission pipeline" for the full
ten-step sequence this module implements steps 5-9 of.

Returns a ValidationOutcome: `errors` block the submission (422); `warnings`
never do -- a client that submitted an answer to a question the server now
judges irrelevant is out of step, not malicious, and losing an entire
interview over one stray key is a far worse outcome than dropping it.
"""
from dataclasses import dataclass, field

from apps.formlogic.evaluator import EvalContext, evaluate
from apps.formlogic.parser import parse
from apps.formlogic.relevance import iter_questions, relevant_question_codes

_SCALAR_TYPES = {
    "text": str, "long_text": str, "email": str, "phone": str, "url": str, "barcode": str,
    "integer": int, "decimal": (int, float), "rating": (int, float), "nps": (int, float),
    "yes_no": bool, "acknowledge": bool,
    "select_one": str, "likert": str,
    "date": str, "time": str, "datetime": str,
}
_ARRAY_TYPES = {"select_multiple", "ranking"}
_OBJECT_TYPES = {"matrix_single", "matrix_multiple", "constant_sum", "currency", "geopoint"}
_NON_STORING_TYPES = {"note", "section_break"}


@dataclass
class FieldError:
    question_code: str
    code: str
    message: str


@dataclass
class ValidationOutcome:
    answers: dict = field(default_factory=dict)
    errors: list[FieldError] = field(default_factory=list)
    warnings: list[dict] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return not self.errors


def _question_index(schema_json: dict) -> dict[str, dict]:
    return {q["code"]: q for _section, q in iter_questions(schema_json)}


def _check_required(question: dict, value, context: EvalContext) -> bool:
    required = question.get("required", False)
    if isinstance(required, str):
        required = bool(evaluate(parse(required), context))
    if not required:
        return True
    if isinstance(value, str):
        return value.strip() != ""
    return value is not None and value != []


def _check_type(question: dict, value) -> bool:
    qtype = question["type"]
    if qtype in _NON_STORING_TYPES:
        return True
    if qtype in _SCALAR_TYPES:
        return isinstance(value, _SCALAR_TYPES[qtype])
    if qtype in _ARRAY_TYPES:
        return isinstance(value, list)
    if qtype in _OBJECT_TYPES:
        return isinstance(value, dict)
    if qtype == "repeat":
        return isinstance(value, list)
    return True  # media / calculate / hidden: no simple scalar shape to check here


def _check_constraint(question: dict, value, context: EvalContext) -> str | None:
    """Returns a failure message, or `None` if the constraint passes.
    Constraints never evaluate on a blank answer -- that is `required`'s job."""
    expr = question.get("constraint")
    if not expr or value is None or value == "":
        return None
    dot_context = EvalContext(answers=context.answers, dot_value=value, parent=context.parent)
    if bool(evaluate(parse(expr), dot_context)):
        return None
    message = question.get("constraint_message") or {}
    return message.get("en", "This value is not accepted.")


def validate_submission(schema_json: dict, raw_answers: dict) -> ValidationOutcome:
    outcome = ValidationOutcome()
    questions = _question_index(schema_json)

    known = {code: v for code, v in raw_answers.items() if code in questions}
    for code in raw_answers:
        if code not in questions:
            outcome.warnings.append(
                {"code": "unknown_question", "question_code": code,
                 "detail": "This question does not exist in the pinned version; the answer was not stored."}
            )

    relevant_codes = relevant_question_codes(schema_json, known)
    for code, value in known.items():
        if code in relevant_codes:
            outcome.answers[code] = value
        else:
            outcome.warnings.append(
                {"code": "irrelevant_answer_dropped", "question_code": code,
                 "detail": "This question was not relevant; the answer was not stored."}
            )

    context = EvalContext(answers=outcome.answers)
    for code in relevant_codes:
        question = questions[code]
        if question["type"] in _NON_STORING_TYPES | {"calculate", "hidden"}:
            continue
        value = outcome.answers.get(code)

        if not _check_required(question, value, context):
            outcome.errors.append(FieldError(code, "required_missing", "This question is required."))
            continue
        if value is None:
            continue  # optional and unanswered: nothing further to check

        if not _check_type(question, value):
            outcome.errors.append(
                FieldError(code, "invalid_type", f"Expected a value of type {question['type']}.")
            )
            continue

        failure = _check_constraint(question, value, context)
        if failure:
            outcome.errors.append(FieldError(code, "constraint_failed", failure))

    return outcome
