"""
Survey authoring services. Views orchestrate; invariants live here -- a view
that wrote through the serializer's default `create()` would bypass the
publish-time validation and the version-freeze guarantee entirely.
"""
import hashlib
import json

from django.db import transaction
from django.utils import timezone

from apps.surveys.models import Question, Section, Survey, SurveyDemographicField, SurveyVersion
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


def _serialize_demographic_field(field) -> dict:
    data = {
        "id": str(field.id),
        "code": field.code,
        "order": field.order,
        "type": field.type,
        "label": field.label,
        "hint": field.hint,
        "required": (
            True if field.is_required == "true"
            else False if field.is_required == "false"
            else field.is_required
        ),
        "constraint": field.constraint or None,
        "constraint_message": field.constraint_message or None,
        "is_pii": field.is_pii,
        "config": dict(field.config or {}),
    }
    if field.choice_list_id:
        data["config"]["choice_list"] = field.choice_list.name
    return data


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


def _serialize_consent_notice(survey: Survey) -> dict | None:
    notice_id = survey.settings.get("consent_notice_id")
    if not notice_id:
        return None
    from apps.respondents.models import ConsentNotice

    notice = ConsentNotice.objects.filter(id=notice_id).first()
    if not notice:
        return None
    return {"id": str(notice.id), "version": notice.version, "language": notice.language, "text": notice.text}


def build_form_package(survey: Survey, draft_version: SurveyVersion, version_number: int) -> dict:
    """
    The single place the relational, editable structure becomes the shipped
    JSON. Everything downstream -- both renderers, the validator, the
    exporter -- reads only this output, which is what keeps the frozen
    artefact and the editable rows from drifting apart.

    `consent_notice` is embedded (not just referenced by
    `settings.consent_notice_id`) so the offline mobile client has the
    actual notice text cached for the consent screen before it ever needs
    a network call -- the same reason sections/choice_lists/demographic
    questions are embedded rather than fetched separately.
    """
    sections = draft_version.sections.order_by("order")
    demographic_fields = draft_version.demographic_fields.order_by("order")
    return {
        "schema_version": "1.0",
        "survey_id": str(survey.id),
        "version_number": version_number,
        "title": survey.title,
        "description": survey.description,
        "category": {"id": str(survey.category_id), "code": survey.category.code, "label": survey.category.label},
        "instructions": survey.instructions,
        "settings": survey.settings,
        "consent_notice": _serialize_consent_notice(survey),
        "choice_lists": [_serialize_choice_list(cl) for cl in draft_version.choice_lists.all()],
        "sections": [_serialize_section(s) for s in sections],
        "demographic_questions": [_serialize_demographic_field(f) for f in demographic_fields],
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

    SurveyDemographicField.objects.bulk_create(
        [
            SurveyDemographicField(
                version=target, code=f.code, type=f.type, order=f.order,
                label=f.label, hint=f.hint, is_required=f.is_required, is_pii=f.is_pii,
                constraint=f.constraint, constraint_message=f.constraint_message,
                choice_list=choice_list_map.get(f.choice_list_id) if f.choice_list_id else None,
                config=f.config,
            )
            for f in source.demographic_fields.order_by("order")
        ]
    )


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


def _unique_code_for_version(base_code: str, version: SurveyVersion) -> str:
    """A bank question's code may already be used elsewhere in this draft
    (e.g. inserted before, or a hand-authored question with the same name)
    -- suffix it rather than fail the insert outright."""
    existing = set(Question.objects.filter(section__version=version).values_list("code", flat=True))
    if base_code not in existing:
        return base_code
    n = 2
    while f"{base_code}_{n}" in existing:
        n += 1
    return f"{base_code}_{n}"


def create_question_from_bank(section: Section, bank_question) -> Question:
    """Copies a `BankQuestion` into `section` as an ordinary `Question`.
    Skip-logic fields (`relevant`/`calculation`/`default_value`) are
    deliberately left blank -- a bank question has no fixed position in any
    survey, so any condition would reference the wrong questions here."""
    from apps.surveys.models import Choice, ChoiceList

    version = section.version
    code = _unique_code_for_version(bank_question.code, version)
    next_order = Question.objects.filter(section=section).count()

    choice_list = None
    if bank_question.choices:
        choice_list = ChoiceList.objects.create(version=version, name=f"{code}_choices")
        Choice.objects.bulk_create(
            [
                Choice(
                    choice_list=choice_list,
                    value=c["value"], label=c["label"], order=c.get("order", i),
                )
                for i, c in enumerate(bank_question.choices)
            ]
        )

    return Question.objects.create(
        section=section, code=code, type=bank_question.type, order=next_order,
        label=bank_question.label, hint=bank_question.hint,
        is_required=bank_question.is_required, is_pii=bank_question.is_pii,
        constraint=bank_question.constraint, constraint_message=bank_question.constraint_message,
        choice_list=choice_list, config=bank_question.config,
    )


def _unique_demographic_code_for_version(base_code: str, version: SurveyVersion) -> str:
    existing = set(SurveyDemographicField.objects.filter(version=version).values_list("code", flat=True))
    if base_code not in existing:
        return base_code
    n = 2
    while f"{base_code}_{n}" in existing:
        n += 1
    return f"{base_code}_{n}"


def create_demographic_field_from_bank(version: SurveyVersion, demographic_question) -> SurveyDemographicField:
    """Copies a `DemographicQuestion` into `version` as a
    `SurveyDemographicField`, exactly mirroring create_question_from_bank."""
    from apps.surveys.models import Choice, ChoiceList

    code = _unique_demographic_code_for_version(demographic_question.code, version)
    next_order = SurveyDemographicField.objects.filter(version=version).count()

    choice_list = None
    if demographic_question.choices:
        choice_list = ChoiceList.objects.create(version=version, name=f"{code}_choices")
        Choice.objects.bulk_create(
            [
                Choice(
                    choice_list=choice_list,
                    value=c["value"], label=c["label"], order=c.get("order", i),
                )
                for i, c in enumerate(demographic_question.choices)
            ]
        )

    return SurveyDemographicField.objects.create(
        version=version, code=code, type=demographic_question.type, order=next_order,
        label=demographic_question.label, hint=demographic_question.hint,
        is_required=demographic_question.is_required, is_pii=demographic_question.is_pii,
        constraint=demographic_question.constraint, constraint_message=demographic_question.constraint_message,
        choice_list=choice_list, config=demographic_question.config,
    )


def set_survey_consent(
    survey: Survey, *, required: bool, text: str = "", language: str = "en", source_file=None,
) -> Survey:
    """
    Configures this survey's consent requirement -- see
    docs/product/RESPONDENT_AND_CONSENT.md. Each survey owns its own
    `ConsentNotice` row rather than sharing one tenant-wide: editing the
    text of an already-published survey creates a new version instead of
    rewriting the text underneath consents already captured against it; a
    still-draft survey's notice is safe to edit in place.

    `source_file` (a PDF/DOCX/TXT upload) takes priority over `text` when
    both are given -- its extracted text becomes the notice text, and the
    original file is kept alongside it for reference. Passing `text` alone
    (no file) is the plain "just type it in" path.
    """
    from apps.respondents.document_extraction import extract_text
    from apps.respondents.models import ConsentNotice

    settings = dict(survey.settings)
    if not required:
        settings["consent_required"] = False
        survey.settings = settings
        survey.save(update_fields=["settings"])
        return survey

    if source_file is not None:
        text = extract_text(source_file)

    notice_id = settings.get("consent_notice_id")
    existing = ConsentNotice.objects.filter(id=notice_id).first() if notice_id else None
    if existing and survey.status == "draft":
        existing.text = text
        existing.language = language
        if source_file is not None:
            existing.source_file = source_file
        existing.save(update_fields=["text", "language", "source_file"])
        notice = existing
    else:
        next_version = (
            ConsentNotice.objects.filter(language=language)
            .order_by("-version").values_list("version", flat=True).first()
            or 0
        ) + 1
        notice = ConsentNotice.objects.create(
            version=next_version, language=language, text=text, source_file=source_file, is_active=True,
        )

    settings["consent_required"] = True
    settings["consent_notice_id"] = str(notice.id)
    settings.setdefault("consent_methods", ["signature"])
    survey.settings = settings
    survey.save(update_fields=["settings"])
    return survey


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
