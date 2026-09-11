from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.assignments.models import SurveyAssignment, Team
from apps.assignments.serializers import (
    CreateAssignmentSerializer,
    SurveyAssignmentSerializer,
    TeamSerializer,
)
from apps.assignments.services import create_assignments, revoke_assignment
from apps.core.viewset_mixins import TenantScopedMixin
from apps.rbac.permissions import HasPermission
from apps.surveys.models import Survey


class TeamViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    module_code = "users"
    REQUIRED_ACTIONS = {"GET": "view", "POST": "create", "PATCH": "edit", "PUT": "edit", "DELETE": "delete"}
    permission_classes = [HasPermission]
    serializer_class = TeamSerializer

    def get_queryset(self):
        return Team.objects.annotate(member_count=Count("members")).order_by("name")


class SurveyAssignmentViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    module_code = "assignments"
    REQUIRED_ACTIONS = {"GET": "view", "POST": "create", "PATCH": "edit", "PUT": "edit", "DELETE": "edit"}
    permission_classes = [HasPermission]
    serializer_class = SurveyAssignmentSerializer
    filterset_fields = ["survey", "status", "assignee_type"]

    def get_queryset(self):
        from apps.assignments.scoping import scope_assignments

        qs = SurveyAssignment.objects.select_related("survey", "assignee_team").order_by("-assigned_at")
        return scope_assignments(qs, self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = CreateAssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        survey = Survey.objects.get(pk=data["survey"])
        created = create_assignments(
            survey=survey, assignees=data["assignees"], target_count=data.get("target_count"),
            due_date=data.get("due_date"), priority=data["priority"], instructions=data["instructions"],
            assigned_by=request.user,
        )
        return Response(
            {"created": len(created), "assignments": SurveyAssignmentSerializer(created, many=True).data},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        assignment = self.get_object()
        revoke_assignment(assignment, request.user)
        return Response(SurveyAssignmentSerializer(assignment).data)

    @action(detail=True, methods=["get"])
    def progress(self, request, pk=None):
        from apps.assignments.services import assignment_progress

        return Response(assignment_progress(self.get_object()))

    @action(detail=False, methods=["get"])
    def mine(self, request):
        """
        Assignments actually held by the caller -- direct or via a team --
        the same definition `user_has_active_assignment` enforces at
        submission time. `get_queryset`'s `scope_assignments` is a
        *management* view (an admin/supervisor/analyst sees every
        assignment in the tenant so they can oversee the team); it must
        never be used to decide whether *this* user may collect a
        response, or an admin with no assignment of their own would sail
        past this check in the UI and then get rejected by the server.
        """
        from apps.assignments.services import assignments_for_agent

        qs = assignments_for_agent(request.user.id).select_related("survey", "assignee_team")
        survey_id = request.query_params.get("survey")
        if survey_id:
            qs = qs.filter(survey_id=survey_id)
        return Response(SurveyAssignmentSerializer(qs, many=True).data)
