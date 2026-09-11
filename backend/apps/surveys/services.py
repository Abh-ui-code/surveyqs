"""
Survey authoring services. Views orchestrate; invariants live here -- a view
that wrote through the serializer's default `create()` would bypass the
publish-time validation and the version-freeze guarantee entirely.
"""
import hashlib
import json

from django.db import transaction
from django.utils import timezone

from apps.surveys.models import Question, Section, Survey, SurveyVersion
from apps.surveys.validators import ValidationReport, validate_survey_structure


class SurveyValidationError(Exception):
    def __init__(self, report: ValidationReport):
        self.report = report
        super().__init__("Survey has validation errors.")


def _serialize_question(question) -> dict:
    data = {
        "id": str(question.id),
        "code": question.code,
        "order": question.order,
        "type": question.type,
        "label": question.label,
        "hint": question.hint,
        "required": (
            True if question.is_required == "true"
            else False if question.is_required == "false"
            else question.is_required
        ),
        "relevant": question.relevant or None,
        "constraint": question.constraint or None,
        "constraint_message": question.constraint_message or None,
        "default": question.default_value or None,
        "calculation": question.calculation or None,
        "read_only": question.read_only,
        "is_pii": question.is_pii,
        "config": dict(question.config or {}),
    }
    if question.choice_list_id:
        data["config"]["choice_list"] = question.choice_list.name
    if question.type == "repeat":
        data["questions"] = [_serialize_question(child) for child in question.repeat_children.order_by("order")]
    return data


def _serialize_section(section) -> dict:
    top_level = section.questions.filter(parent_question__isnull=True).order_by("order")
    return {
        "id": str(section.id),
        "code": section.code,
        "order": section.order,
        "title": section.title,
        "description": section.description,
        "relevant": section.relevant or None,
        "questions": [_serialize_question(q) for q in top_level],
    }


def _serialize_choice_list(choice_list) -> dict:
    return {
        "name": choice_list.name,
        "attributes": choice_list.attributes,
        "choices": [
            {
                "value": c.value,
                "label": c.label,
                "order": c.order,
                "attrs": c.attrs,
                "active": c.is_active,
            }
            for c in choice_list.choices.order_by("order")
        ],
    }


def build_form_package(survey: Survey, draft_version: SurveyVersion, version_number: int) -> dict:
    """
    The single place the relational, editable structure becomes the shipped
    JSON. Everything downstream -- both renderers, the validator, the
    exporter -- reads only this output, which is what keeps the frozen
    artefact and the editable rows from drifting apart.
    """
    sections = draft_version.sections.order_by("order")
    return {
        "schema_version": "1.0",
        "survey_id": str(survey.id),
        "version_number": version_number,
        "title": survey.title,
        "description": survey.description,
        "category": {"id": str(survey.category_id), "code": survey.category.code, "label": survey.category.label},
        "instructions": survey.instructions,
        "settings": survey.settings,
        "choice_lists": [_serialize_choice_list(cl) for cl in draft_version.choice_lists.all()],
        "sections": [_serialize_section(s) for s in sections],
    }


def open_draft(survey: Survey) -> SurveyVersion:
    """
    Editing a published survey clones the current version's structure into a
    fresh working draft. The live version is untouched -- agents keep
    running it until the new one is published.
    """
    if survey.draft_version_id:
        return survey.draft_version

    with transaction.atomic():
        draft = SurveyVersion.objects.create(
            survey=survey,
            version_number=0,  # provisional; publish assigns the real number
            status="draft",
        )
        source = survey.current_version
        if source is not None:
            _clone_structure(source, draft)
        survey.draft_version = draft
        survey.save(update_fields=["draft_version"])
    return draft


def _clone_structure(source: SurveyVersion, target: SurveyVersion):
    from apps.surveys.models import Choice, ChoiceList

    choice_list_map = {}
    for cl in source.choice_lists.all():
        new_cl = ChoiceList.objects.create(version=target, name=cl.name, attributes=cl.attributes)
        choice_list_map[cl.id] = new_cl
        Choice.objects.bulk_create(
            [
                Choice(choice_list=new_cl, value=c.value, label=c.label, order=c.order, attrs=c.attrs, is_active=c.is_active)
                for c in cl.choices.all()
            ]
        )

    for section in source.sections.order_by("order"):
        new_section = Section.objects.create(
            version=target, code=section.code, order=section.order,
            title=section.title, description=section.description, relevant=section.relevant,
        )
        question_map = {}
        top_level = list(section.questions.filter(parent_question__isnull=True).order_by("order"))
        for q in top_level:
            question_map[q.id] = _clone_question(q, new_section, choice_list_map, parent=None)
        for q in section.questions.filter(parent_question__isnull=False).order_by("order"):
            _clone_question(q, new_section, choice_list_map, parent=question_map[q.parent_question_id])


def _clone_question(question, new_section, choice_list_map, parent):
    return Question.objects.create(
        section=new_section,
        parent_question=parent,
        code=question.code, type=question.type, order=question.order,
        label=question.label, hint=question.hint,
        is_required=question.is_required, relevant=question.relevant,
        constraint=question.constraint, constraint_message=question.constraint_message,
        default_value=question.default_value, calculation=question.calculation,
        read_only=question.read_only, is_pii=question.is_pii,
        choice_list=choice_list_map.get(question.choice_list_id) if question.choice_list_id else None,
        config=question.config,
    )


def next_version_number(survey: Survey) -> int:
    latest = survey.versions.filter(status="published").order_by("-version_number").first()
    return (latest.version_number + 1) if latest else 1


@transaction.atomic
def publish_survey(user, survey: Survey, change_note: str = "") -> SurveyVersion:
    draft = survey.draft_version or open_draft(survey)
    report = validate_survey_structure(draft)
    if not report.is_valid:
        raise SurveyValidationError(report)

    version_number = next_version_number(survey)
    package = build_form_package(survey, draft, version_number)
    package_bytes = json.dumps(package, sort_keys=True, default=str).encode()

    draft.version_number = version_number
    draft.status = "published"
    draft.schema_json = package
    draft.schema_hash = hashlib.sha256(package_bytes).hexdigest()
    draft.published_by = user
    draft.published_at = timezone.now()
    draft.change_note = change_note
    draft.save()

    survey.current_version = draft
    survey.draft_version = None
    survey.status = "published"
    survey.save(update_fields=["current_version", "draft_version", "status"])
    return draft


@transaction.atomic
def transition_survey(survey: Survey, new_status: str):
    allowed = {
        "draft": set(),
        "published": {"paused", "closed"},
        "paused": {"published", "closed"},
        "closed": {"published", "archived"},
        "archived": {"closed"},
    }
    if new_status not in allowed.get(survey.status, set()):
        raise ValueError(f"Cannot move a '{survey.status}' survey to '{new_status}'.")
    survey.status = new_status
    survey.closed_at = timezone.now() if new_status == "closed" else None
    survey.save(update_fields=["status", "closed_at"])
    return survey
