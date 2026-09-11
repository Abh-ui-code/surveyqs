from rest_framework import serializers

from apps.tenants.models import Tenant, validate_subdomain


class TenantListSerializer(serializers.ModelSerializer):
    user_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tenant
        fields = [
            "id", "name", "subdomain", "plan", "is_active", "is_ready",
            "provisioning_error", "user_count", "created_at",
        ]
        read_only_fields = fields


class TenantCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    subdomain = serializers.CharField(max_length=40, validators=[validate_subdomain])
    plan = serializers.ChoiceField(choices=Tenant.PLAN_CHOICES, default="trial")
    admin_email = serializers.EmailField()
    admin_full_name = serializers.CharField(max_length=255)

    def validate_subdomain(self, value):
        if Tenant.objects.filter(subdomain=value).exists():
            raise serializers.ValidationError("This subdomain is already taken.")
        return value
