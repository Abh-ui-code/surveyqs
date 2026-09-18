from rest_framework import serializers

from apps.question_bank.models import BankQuestion, QuestionBankCategory


class QuestionBankCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionBankCategory
        fields = ["id", "name"]


class BankQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankQuestion
        fields = [
            "id", "category", "code", "type", "label", "hint", "is_required",
            "is_pii", "constraint", "constraint_message", "config", "choices",
            "created_at", "updated_at",
        ]

    def validate_choices(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("choices must be a list.")
        for i, item in enumerate(value):
            if not isinstance(item, dict) or "value" not in item or "label" not in item:
                raise serializers.ValidationError(f"choices[{i}] must be an object with 'value' and 'label'.")
            item.setdefault("order", i)
        return value
