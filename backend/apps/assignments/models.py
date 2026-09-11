from django.db import models

from apps.core.models import BaseModel


class Team(BaseModel):
    """A supervisor and their agents. Used by team-level assignment and by
    supervisor row-level scoping (see apps.responses.scoping)."""

    name = models.CharField(max_length=255)
    supervisor_user_id = models.UUIDField(db_index=True)  # cross-schema, no FK
    is_active = models.BooleanField(default=True)

    class Meta:
        app_label = "assignments"

    def __str__(self):
        return self.name


class TeamMembership(BaseModel):
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="members")
    user_id = models.UUIDField(db_index=True)

    class Meta:
        app_label = "assignments"
        constraints = [models.UniqueConstraint(fields=["team", "user_id"], name="uniq_team_member")]


class SurveyAssignment(BaseModel):
    ASSIGNEE_TYPE_CHOICES = [("user", "User"), ("team", "Team")]
    STATUS_CHOICES = [("active", "Active"), ("revoked", "Revoked")]

    survey = models.ForeignKey("surveys.Survey", on_delete=models.CASCADE, related_name="assignments")
    assignee_type = models.CharField(max_length=10, choices=ASSIGNEE_TYPE_CHOICES)
    assignee_user_id = models.UUIDField(null=True, blank=True, db_index=True)
    assignee_team = models.ForeignKey(
        Team, null=True, blank=True, on_delete=models.CASCADE, related_name="assignments"
    )

    target_count = models.PositiveIntegerField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    priority = models.CharField(max_length=10, default="normal")
    instructions = models.TextField(blank=True)

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="active")
    assigned_by_id = models.UUIDField(null=True, blank=True)
    assigned_at = models.DateTimeField(auto_now_add=True)
    revoked_by_id = models.UUIDField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = "assignments"
        constraints = [
            models.UniqueConstraint(
                fields=["survey", "assignee_user_id"],
                condition=models.Q(status="active", assignee_type="user"),
                name="uniq_active_user_assignment_per_survey",
            )
        ]
        indexes = [models.Index(fields=["survey", "status"])]

    def __str__(self):
        target = self.assignee_user_id or (self.assignee_team_id and f"team:{self.assignee_team_id}")
        return f"{self.survey_id} -> {target}"

    def covers_agent(self, user_id) -> bool:
        if self.status != "active":
            return False
        if self.assignee_type == "user":
            return str(self.assignee_user_id) == str(user_id)
        return TeamMembership.objects.filter(team=self.assignee_team, user_id=user_id).exists()
