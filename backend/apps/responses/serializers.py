from rest_framework import serializers

from apps.responses.models import ResponseAttachment, ResponseFlag, ResponseReview, SurveyResponse


class ResponseListSerializer(serializers.ModelSerializer):
    """
    Deliberately lighter than the detail shape -- no `answers` document, so
    a 50-row page stays small. See docs/api/API_REFERENCE.md.
    """

    survey_title = serializers.CharField(source="survey.title", read_only=True)
    category_label = serializers.CharField(source="survey.category.label", read_only=True)
    respondent_name = serializers.CharField(source="respondent.full_name", read_only=True, default=None)
    flag_count = serializers.IntegerField(source="flags.count", read_only=True)

    class Meta:
        model = SurveyResponse
        fields = [
            "id", "response_code", "survey", "survey_title", "category_label", "survey_version",
            "respondent", "respondent_name", "collected_by_id", "status",
            "submitted_at", "duration_seconds", "flag_count", "was_offline",
        ]


class ResponseAttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ResponseAttachment
        fields = ["id", "question_code", "kind", "filename", "size_bytes", "captured_at", "url"]

    def get_url(self, obj):
        request = self.context.get("request")
        return request.build_absolute_uri(obj.file.url) if request and obj.file else None


class ResponseFlagSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResponseFlag
        fields = ["id", "code", "severity", "message", "triggering_values", "created_at"]


class ResponseReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResponseReview
        fields = ["id", "action", "reviewer_id", "reason_code", "notes", "created_at"]


class ResponseDetailSerializer(ResponseListSerializer):
    attachments = ResponseAttachmentSerializer(many=True, read_only=True)
    flags = ResponseFlagSerializer(many=True, read_only=True)
    reviews = ResponseReviewSerializer(many=True, read_only=True)

    class Meta(ResponseListSerializer.Meta):
        fields = ResponseListSerializer.Meta.fields + [
            "answers", "started_at", "gps_lat", "gps_lng", "gps_accuracy_m",
            "device_id", "app_version", "is_edited", "attachments", "flags", "reviews",
        ]


class RejectResponseSerializer(serializers.Serializer):
    reason_code = serializers.CharField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")
