from rest_framework import serializers

from apps.assignments.models import SurveyAssignment, Team


class TeamSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Team
        fields = ["id", "name", "supervisor_user_id", "is_active", "member_count"]


class AssigneeSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=["user", "team"])
    id = serializers.UUIDField()


class SurveyAssignmentSerializer(serializers.ModelSerializer):
    progress = serializers.SerializerMethodField()

    class Meta:
        model = SurveyAssignment
        fields = [
            "id", "survey", "assignee_type", "assignee_user_id", "assignee_team",
            "target_count", "due_date", "priority", "instructions", "status",
            "assigned_at", "revoked_at", "progress",
        ]
        read_only_fields = ["status", "assigned_at", "revoked_at"]

    def get_progress(self, obj):
        from apps.assignments.services import assignment_progress

        return assignment_progress(obj)


class CreateAssignmentSerializer(serializers.Serializer):
    survey = serializers.UUIDField()
    assignees = AssigneeSerializer(many=True)
    target_count = serializers.IntegerField(required=False, allow_null=True)
    due_date = serializers.DateField(required=False, allow_null=True)
    priority = serializers.ChoiceField(choices=["low", "normal", "high"], default="normal")
    instructions = serializers.CharField(required=False, allow_blank=True, default="")
