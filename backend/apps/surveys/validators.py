"""
Pre-publish validation. Errors block publishing; warnings are advisory.
Every error names the section and question so the builder can offer a jump
link -- see docs/product/FUNCTIONAL_SPEC.md FR-SURV-13.
"""
from dataclasses import dataclass, field

from apps.formlogic.exceptions import ExpressionError
from apps.formlogic.parser import parse

_MAX_MATRIX_ROWS = 8
_MAX_RANKING_ITEMS = 7
_MAX_QUESTIONS_WARNING = 60
_MAX_CHOICE_LIST_SIZE = 2000


@dataclass
class Issue:
    code: str
    message: str
    location: str = ""


@dataclass
class ValidationReport:
    errors: list[Issue] = field(default_factory=list)
    warnings: list[Issue] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return not self.errors


def _all_questions(sections):
    """Yields (index_in_document_order, section, question) including repeat children."""
    order = 0
    for section in sections:
        for question in section.questions.all():
            yield order, section, question
            order += 1
            if question.type == "repeat":
                for child in question.repeat_children.all():
                    yield order, section, child
                    order += 1


def _referenced_codes(expr: str) -> set[str]:
    import re

    return set(re.findall(r"\$\{(?:\.\./)?([a-zA-Z_][a-zA-Z0-9_]*)\}", expr))


def validate_survey_structure(version) -> ValidationReport:
    report = ValidationReport()
    sections = list(version.sections.prefetch_related("questions__repeat_children").order_by("order"))

    if not sections:
        report.errors.append(Issue("empty_survey", "The survey has no sections."))
        return report

    seen_codes: dict[str, str] = {}  # code -> location, for the duplicate check
    position_by_code: dict[str, int] = {}
    total_questions = 0

    for section in sections:
        questions = list(section.questions.all())
        if not questions:
            report.errors.append(
                Issue("empty_section", f"Section '{section.code}' has no questions.", section.code)
            )

    for order, section, question in _all_questions(sections):
        total_questions += 1
        location = f"{section.code}/{question.code}"

        if question.code in seen_codes:
            report.errors.append(
                Issue(
                    "duplicate_question_code",
                    f"Question code '{question.code}' is used twice.",
                    f"{seen_codes[question.code]}, {location}",
                )
            )
        else:
            seen_codes[question.code] = location
            position_by_code[question.code] = order

        for field_name in ("relevant", "constraint", "default_value", "calculation"):
            expr = getattr(question, field_name)
            if not expr:
                continue
            try:
                parse(expr)
            except ExpressionError as exc:
                report.errors.append(
                    Issue(f"invalid_{field_name}_expression", f"{field_name}: {exc}", location)
                )
                continue
            for ref_code in _referenced_codes(expr):
                if ref_code == question.code and field_name != "constraint":
                    report.errors.append(
                        Issue("self_reference", f"'{field_name}' refers to its own question.", location)
                    )
                elif ref_code not in position_by_code and ref_code != question.code:
                    report.errors.append(
                        Issue(
                            "unknown_or_forward_reference",
                            f"'{field_name}' refers to '{ref_code}', which is unknown or appears later.",
                            location,
                        )
                    )

        if question.constraint and not question.constraint_message.get("en"):
            report.errors.append(
                Issue("missing_constraint_message", "A constraint must have a message.", location)
            )

        if question.type == "matrix_single" and len(question.config.get("rows", [])) > _MAX_MATRIX_ROWS:
            report.warnings.append(
                Issue("long_matrix", f"This matrix has more than {_MAX_MATRIX_ROWS} rows.", location)
            )

        if question.type == "ranking" and len(question.config.get("choice_list_items", [])) > _MAX_RANKING_ITEMS:
            report.warnings.append(
                Issue("long_ranking", f"This ranking has more than {_MAX_RANKING_ITEMS} items.", location)
            )

    for choice_list in version.choice_lists.all():
        count = choice_list.choices.count()
        if count == 0:
            report.errors.append(
                Issue("empty_choice_list", f"Choice list '{choice_list.name}' has no choices.", choice_list.name)
            )
        elif count > _MAX_CHOICE_LIST_SIZE:
            report.warnings.append(
                Issue(
                    "large_choice_list",
                    f"Choice list '{choice_list.name}' has {count} choices -- consider a searchable appearance.",
                    choice_list.name,
                )
            )

    if total_questions > _MAX_QUESTIONS_WARNING:
        estimated_minutes = round(total_questions * 0.6)
        report.warnings.append(
            Issue(
                "long_survey",
                f"{total_questions} questions, about {estimated_minutes} minutes. Consider splitting.",
            )
        )

    return report
