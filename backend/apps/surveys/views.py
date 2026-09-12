from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.viewset_mixins import TenantScopedMixin
from apps.rbac.permissions import HasPermission
from apps.surveys.models import Choice, ChoiceList, Question, Section, Survey, SurveyCategory
from apps.surveys.serializers import (
    ChoiceListSerializer,
    PublishSerializer,
    QuestionSerializer,
    SectionSerializer,
    SurveyCategorySerializer,
    SurveyCreateSerializer,
    SurveyDetailSerializer,
    SurveyListSerializer,
    SurveyVersionSerializer,
    SurveyVersionSummarySerializer,
)
from apps.surveys.services import SurveyValidationError, open_draft, publish_survey, transition_survey
from apps.surveys.validators import validate_survey_structure


class SurveyCategoryViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    module_code = "settings"
    REQUIRED_ACTIONS = {"GET": "view", "POST": "create", "PATCH": "edit", "PUT": "edit", "DELETE": "delete"}
    permission_classes = [HasPermission]
    serializer_class = SurveyCategorySerializer

    def get_queryset(self):
        return SurveyCategory.objects.annotate(survey_count=Count("surveys")).order_by("display_order", "label")


class SurveyViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    module_code = "surveys"
    REQUIRED_ACTIONS = {"GET": "view", "POST": "create", "PATCH": "edit", "PUT": "edit", "DELETE": "delete"}
    permission_classes = [HasPermission]
    filterset_fields = ["category", "status"]
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "title", "status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        from apps.surveys.scoping import scope_surveys

        qs = Survey.objects.select_related("category", "current_version", "draft_version").filter(is_deleted=False)
        return scope_surveys(qs, self.request.user)

    def get_serializer_class(self):
        if self.action == "create":
            return SurveyCreateSerializer
        if self.action in {"list"}:
            return SurveyListSerializer
        return SurveyDetailSerializer

    def perform_destroy(self, instance):
        if instance.current_version and instance.current_version.response_count > 0:
            raise ValidationError(
                {"detail": f"Cannot delete this survey because it has {instance.current_version.response_count} responses. Archive it instead."}
            )
        instance.soft_delete(actor=self.request.user)

    @action(detail=True, methods=["get"])
    def draft(self, request, pk=None):
        survey = self.get_object()
        version = open_draft(survey)
        return Response(SurveyVersionSerializer(version).data)

    @action(detail=True, methods=["get"])
    def versions(self, request, pk=None):
        survey = self.get_object()
        qs = survey.versions.filter(status="published").order_by("-version_number")
        return Response(SurveyVersionSummarySerializer(qs, many=True).data)

    @action(detail=True, methods=["get"], url_path="versions/(?P<version_number>[0-9]+)")
    def version_detail(self, request, pk=None, version_number=None):
        survey = self.get_object()
        version = survey.versions.get(version_number=version_number, status="published")
        return Response(version.schema_json)

    @action(detail=True, methods=["get"])
    def preview(self, request, pk=None):
        survey = self.get_object()
        version = survey.draft_version or survey.current_version
        if version is None:
            return Response({"detail": "Nothing to preview yet."}, status=404)
        from apps.surveys.services import build_form_package

        version_number = survey.current_version.version_number + 1 if survey.current_version else 1
        return Response(build_form_package(survey, version, version_number))

    @action(detail=True, methods=["post"])
    def validate(self, request, pk=None):
        survey = self.get_object()
        version = open_draft(survey)
        report = validate_survey_structure(version)
        return Response(
            {
                "valid": report.is_valid,
                "errors": [vars(e) for e in report.errors],
                "warnings": [vars(w) for w in report.warnings],
            }
        )

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        survey = self.get_object()
        serializer = PublishSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            version = publish_survey(request.user, survey, serializer.validated_data["change_note"])
        except SurveyValidationError as exc:
            return Response(
                {"detail": "Survey has validation errors.", "errors": [vars(e) for e in exc.report.errors]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {
                "version_id": str(version.id), "version_number": version.version_number,
                "published_at": version.published_at, "schema_hash": version.schema_hash,
            },
            status=status.HTTP_201_CREATED,
        )

    def _transition(self, request, pk, new_status):
        survey = self.get_object()
        try:
            transition_survey(survey, new_status)
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        return Response(SurveyDetailSerializer(survey).data)

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        return self._transition(request, pk, "paused")

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        return self._transition(request, pk, "published")

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        return self._transition(request, pk, "closed")

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        return self._transition(request, pk, "published")

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        return self._transition(request, pk, "archived")

    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        from apps.surveys.services import _clone_structure

        source_survey = self.get_object()
        new_survey = Survey.objects.create(
            category=source_survey.category,
            title=f"{source_survey.title} (copy)",
            description=source_survey.description,
            instructions=source_survey.instructions,
            settings=source_survey.settings,
            status="draft",
            created_by=request.user,
        )
        source_version = source_survey.current_version or source_survey.draft_version
        if source_version is not None:
            draft = open_draft(new_survey)
            _clone_structure(source_version, draft)
        return Response(SurveyDetailSerializer(new_survey).data, status=status.HTTP_201_CREATED)


class _DraftScopedMixin:
    """Shared plumbing for section/question/choice-list editing, all of
    which operate on a survey's *draft* version -- never a published one."""

    def _draft_version(self):
        from apps.surveys.models import Survey

        survey = Survey.objects.get(pk=self.kwargs["survey_pk"])
        return open_draft(survey)


class SectionViewSet(_DraftScopedMixin, TenantScopedMixin, viewsets.ModelViewSet):
    module_code = "surveys"
    REQUIRED_ACTIONS = {"GET": "view", "POST": "edit", "PATCH": "edit", "PUT": "edit", "DELETE": "edit"}
    permission_classes = [HasPermission]
    serializer_class = SectionSerializer

    def get_queryset(self):
        return Section.objects.filter(version=self._draft_version()).order_by("order")

    def perform_create(self, serializer):
        version = self._draft_version()
        next_order = (Section.objects.filter(version=version).count())
        serializer.save(version=version, order=serializer.validated_data.get("order", next_order))

    @action(detail=False, methods=["post"])
    def reorder(self, request, survey_pk=None):
        version = self._draft_version()
        section_ids = request.data.get("section_ids", [])
        sections = {str(s.id): s for s in Section.objects.filter(version=version, id__in=section_ids)}
        for index, section_id in enumerate(section_ids):
            section = sections.get(str(section_id))
            if section:
                section.order = index
        Section.objects.bulk_update(sections.values(), ["order"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class QuestionViewSet(_DraftScopedMixin, TenantScopedMixin, viewsets.ModelViewSet):
    module_code = "surveys"
    REQUIRED_ACTIONS = {"GET": "view", "POST": "edit", "PATCH": "edit", "PUT": "edit", "DELETE": "edit"}
    permission_classes = [HasPermission]
    serializer_class = QuestionSerializer

    def get_queryset(self):
        return Question.objects.filter(section__version=self._draft_version()).order_by("order")

    def perform_create(self, serializer):
        section = serializer.validated_data["section"]
        next_order = Question.objects.filter(section=section).count()
        serializer.save(order=serializer.validated_data.get("order", next_order))

    @action(detail=False, methods=["post"], url_path="reorder")
    def reorder(self, request, survey_pk=None):
        version = self._draft_version()
        question_ids = request.data.get("question_ids", [])
        questions = {
            str(q.id): q for q in Question.objects.filter(section__version=version, id__in=question_ids)
        }
        for index, question_id in enumerate(question_ids):
            question = questions.get(str(question_id))
            if question:
                question.order = index
        Question.objects.bulk_update(questions.values(), ["order"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChoiceListViewSet(_DraftScopedMixin, TenantScopedMixin, viewsets.ModelViewSet):
    module_code = "surveys"
    REQUIRED_ACTIONS = {"GET": "view", "POST": "edit", "PATCH": "edit", "PUT": "edit", "DELETE": "edit"}
    permission_classes = [HasPermission]
    serializer_class = ChoiceListSerializer

    def get_queryset(self):
        return ChoiceList.objects.filter(version=self._draft_version())

    def perform_create(self, serializer):
        serializer.save(version=self._draft_version())

    @action(detail=True, methods=["post"], url_path="choices/reorder")
    def reorder_choices(self, request, survey_pk=None, pk=None):
        choice_list = self.get_object()
        choice_ids = request.data.get("choice_ids", [])
        choices = {str(c.id): c for c in Choice.objects.filter(choice_list=choice_list, id__in=choice_ids)}
        for index, choice_id in enumerate(choice_ids):
            choice = choices.get(str(choice_id))
            if choice:
                choice.order = index
        Choice.objects.bulk_update(choices.values(), ["order"])
        return Response(status=status.HTTP_204_NO_CONTENT)
