from rest_framework import serializers

from apps.surveys.models import Choice, ChoiceList, Question, Section, Survey, SurveyCategory, SurveyVersion


class SurveyCategorySerializer(serializers.ModelSerializer):
    survey_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = SurveyCategory
        fields = ["id", "code", "label", "description", "icon", "color", "display_order", "is_active", "survey_count"]


class SurveyListSerializer(serializers.ModelSerializer):
    category = SurveyCategorySerializer(read_only=True)
    question_count = serializers.SerializerMethodField()
    response_count = serializers.SerializerMethodField()

    class Meta:
        model = Survey
        fields = [
            "id", "title", "category", "status", "description",
            "question_count", "response_count", "created_at", "updated_at",
        ]

    def get_question_count(self, obj):
        version = obj.current_version or obj.draft_version
        if version is None:
            return 0
        if version.schema_json:
            return sum(len(s.get("questions", [])) for s in version.schema_json.get("sections", []))
        return Question.objects.filter(section__version=version).count()

    def get_response_count(self, obj):
        if obj.current_version is None:
            return 0
        request = self.context.get("request")
        if request is None:
            return obj.current_version.response_count

        from apps.rbac.services import user_has_role

        user = request.user
        if user.is_superadmin or user_has_role(user, "admin") or user_has_role(user, "analyst"):
            return obj.current_version.response_count

        # Same "own data only" rule as the survey list itself (see
        # apps.surveys.scoping.scope_surveys) -- a role that only sees its
        # own surveys must not see everyone else's response count on them.
        from apps.responses.models import SurveyResponse
        from apps.responses.scoping import scope_responses

        qs = SurveyResponse.objects.filter(is_deleted=False, survey_id=obj.id)
        return scope_responses(qs, user).count()


class SurveyDetailSerializer(SurveyListSerializer):
    class Meta(SurveyListSerializer.Meta):
        fields = SurveyListSerializer.Meta.fields + ["instructions", "settings"]


class SurveyCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Survey
        fields = ["id", "title", "category", "description", "instructions", "settings"]

    def create(self, validated_data):
        validated_data["status"] = "draft"
        return super().create(validated_data)


class ChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Choice
        fields = ["id", "value", "label", "order", "attrs", "is_active"]


class ChoiceListSerializer(serializers.ModelSerializer):
    choices = ChoiceSerializer(many=True, required=False)

    class Meta:
        model = ChoiceList
        fields = ["id", "name", "attributes", "choices"]

    def create(self, validated_data):
        choices_data = validated_data.pop("choices", [])
        choice_list = ChoiceList.objects.create(**validated_data)
        for i, choice_data in enumerate(choices_data):
            Choice.objects.create(choice_list=choice_list, order=choice_data.get("order", i), **{
                k: v for k, v in choice_data.items() if k != "order"
            })
        return choice_list

    def update(self, instance, validated_data):
        # ModelSerializer.update() doesn't support writable nested fields,
        # so `choices` needs its own full-replace-by-value sync (matching
        # `create()`'s upsert semantics) rather than falling through to the
        # default implementation.
        choices_data = validated_data.pop("choices", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if choices_data is not None:
            existing = {c.value: c for c in instance.choices.all()}
            seen_values = set()
            for i, choice_data in enumerate(choices_data):
                fields = {k: v for k, v in choice_data.items() if k != "order"}
                value = fields.get("value")
                seen_values.add(value)
                order = choice_data.get("order", i)
                choice = existing.get(value)
                if choice is not None:
                    for k, v in fields.items():
                        setattr(choice, k, v)
                    choice.order = order
                    choice.save()
                else:
                    Choice.objects.create(choice_list=instance, order=order, **fields)
            instance.choices.exclude(value__in=seen_values).delete()

        return instance


class QuestionSerializer(serializers.ModelSerializer):
    order = serializers.IntegerField(required=False)  # server-assigned by default; see views.perform_create

    class Meta:
        model = Question
        fields = [
            "id", "section", "parent_question", "code", "type", "order",
            "label", "hint", "is_required", "relevant", "constraint", "constraint_message",
            "default_value", "calculation", "read_only", "is_pii", "choice_list", "config",
        ]


class SectionSerializer(serializers.ModelSerializer):
    order = serializers.IntegerField(required=False)  # server-assigned by default; see views.perform_create
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Section
        fields = ["id", "code", "order", "title", "description", "relevant", "questions"]


class SurveyVersionSerializer(serializers.ModelSerializer):
    sections = SectionSerializer(many=True, read_only=True)
    choice_lists = ChoiceListSerializer(many=True, read_only=True)

    class Meta:
        model = SurveyVersion
        fields = [
            "id", "version_number", "status", "change_note", "published_at",
            "response_count", "sections", "choice_lists",
        ]


class SurveyVersionSummarySerializer(serializers.ModelSerializer):
    published_by_email = serializers.CharField(source="published_by.email", read_only=True, default=None)

    class Meta:
        model = SurveyVersion
        fields = ["id", "version_number", "status", "change_note", "published_at", "published_by_email", "response_count"]


class PublishSerializer(serializers.Serializer):
    change_note = serializers.CharField(required=False, allow_blank=True, default="")
