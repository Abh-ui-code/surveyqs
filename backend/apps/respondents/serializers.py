from rest_framework import serializers

from apps.respondents.models import ConsentNotice, ConsentRecord, DemographicQuestion, Respondent


class DemographicQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DemographicQuestion
        fields = [
            "id", "code", "type", "label", "hint", "is_required",
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


class RespondentSerializer(serializers.ModelSerializer):
    # The respondent's most recent, still-valid consent signature -- consent
    # is captured once per respondent and reused across all of their
    # responses (see docs/product/RESPONDENT_AND_CONSENT.md), so this is the
    # same signature shown on every response report for this respondent.
    consent_signature_url = serializers.SerializerMethodField()

    class Meta:
        model = Respondent
        fields = [
            "id", "full_name", "phone", "alt_phone", "email", "gender", "date_of_birth",
            "identity_number", "address", "geography_node_id", "custom_fields",
            "consent_status", "is_anonymised", "client_ref_id", "created_at",
            "consent_signature_url",
        ]
        read_only_fields = ["consent_status", "is_anonymised", "created_at"]

    def get_consent_signature_url(self, obj):
        request = self.context.get("request")
        if not request:
            return None
        record = next(
            (r for r in obj.consent_records.all() if r.signature_image and not r.is_withdrawn),
            None,
        )
        if not record:
            return None
        return request.build_absolute_uri(record.signature_image.url)


class RespondentLookupResultSerializer(serializers.Serializer):
    matched_on = serializers.CharField()
    respondent = RespondentSerializer()


class ConsentNoticeSerializer(serializers.ModelSerializer):
    source_file_url = serializers.SerializerMethodField()

    class Meta:
        model = ConsentNotice
        fields = ["id", "version", "language", "text", "source_file_url", "is_active"]

    def get_source_file_url(self, obj):
        request = self.context.get("request")
        if not obj.source_file or not request:
            return None
        return request.build_absolute_uri(obj.source_file.url)


class ConsentRecordSerializer(serializers.ModelSerializer):
    # A PNG as base64 in, a servable URL out -- see
    # apps.respondents.services.capture_consent / _decode_signature.
    signature_base64 = serializers.CharField(write_only=True, required=False, allow_blank=True)
    signature_url = serializers.SerializerMethodField()
    respondent_name = serializers.CharField(source="respondent.full_name", read_only=True, default=None)

    class Meta:
        model = ConsentRecord
        fields = [
            "id", "respondent", "respondent_name", "notice", "method", "granted_at", "captured_offline",
            "purposes", "signature_base64", "signature_url", "is_withdrawn", "client_ref_id",
        ]
        read_only_fields = ["is_withdrawn"]

    def get_signature_url(self, obj):
        request = self.context.get("request")
        if not obj.signature_image or not request:
            return None
        return request.build_absolute_uri(obj.signature_image.url)
