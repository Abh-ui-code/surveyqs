from rest_framework import serializers

from apps.respondents.models import ConsentNotice, ConsentRecord, Respondent


class RespondentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Respondent
        fields = [
            "id", "full_name", "phone", "alt_phone", "email", "gender", "date_of_birth",
            "identity_number", "address", "geography_node_id", "custom_fields",
            "consent_status", "is_anonymised", "client_ref_id", "created_at",
        ]
        read_only_fields = ["consent_status", "is_anonymised", "created_at"]


class RespondentLookupResultSerializer(serializers.Serializer):
    matched_on = serializers.CharField()
    respondent = RespondentSerializer()


class ConsentNoticeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConsentNotice
        fields = ["id", "version", "language", "text", "is_active"]


class ConsentRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConsentRecord
        fields = [
            "id", "respondent", "notice", "method", "granted_at", "captured_offline",
            "purposes", "signature_attachment_id", "is_withdrawn", "client_ref_id",
        ]
        read_only_fields = ["is_withdrawn"]
