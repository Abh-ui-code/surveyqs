from rest_framework import serializers


class TenantUserSerializer(serializers.Serializer):
    """
    Assembled, not a ModelSerializer -- a tenant user is a join across a
    public-schema `User` + `UserTenantMembership` and a tenant-schema
    `UserRole`, which no single model represents.
    """

    id = serializers.UUIDField()
    email = serializers.EmailField()
    full_name = serializers.CharField()
    role_code = serializers.CharField()
    is_active = serializers.BooleanField()  # the membership's, not the account's
    last_login_at = serializers.DateTimeField(allow_null=True)
    joined_at = serializers.DateTimeField()


class InviteUserSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=255)
    role_code = serializers.CharField()

    def validate_role_code(self, value):
        from apps.rbac.models import Role

        if not Role.objects.filter(code=value, is_active=True).exists():
            raise serializers.ValidationError("Unknown role.")
        return value


class UpdateUserRoleSerializer(serializers.Serializer):
    role_code = serializers.CharField()

    def validate_role_code(self, value):
        from apps.rbac.models import Role

        if not Role.objects.filter(code=value, is_active=True).exists():
            raise serializers.ValidationError("Unknown role.")
        return value
