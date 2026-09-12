from rest_framework import serializers

from apps.rbac.constants import ACTION_CODES
from apps.rbac.models import Module, Role


class ModuleSerializer(serializers.ModelSerializer):
    is_enabled = serializers.SerializerMethodField()

    class Meta:
        model = Module
        fields = ["id", "code", "label", "is_enabled"]

    def get_is_enabled(self, obj: Module) -> bool:
        tm = getattr(obj, "tenant_module", None)
        return tm.is_enabled if tm else True


class RoleSerializer(serializers.ModelSerializer):
    user_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Role
        fields = ["id", "code", "name", "is_system", "is_active", "user_count"]
        read_only_fields = ["is_system"]


class RoleCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["code", "name"]

    def validate_code(self, value):
        if Role.objects.filter(code=value).exists():
            raise serializers.ValidationError("A role with this code already exists.")
        return value


class PermissionMatrixSerializer(serializers.Serializer):
    """
    The whole role x module x action grid in one payload -- the natural
    shape for the settings screen, which edits several cells in one visit
    rather than one RolePermission row at a time.
    """

    modules = ModuleSerializer(many=True)
    roles = RoleSerializer(many=True)
    matrix = serializers.DictField(
        child=serializers.DictField(child=serializers.ListField(child=serializers.ChoiceField(choices=ACTION_CODES)))
    )


class SetPermissionSerializer(serializers.Serializer):
    role = serializers.UUIDField()
    module = serializers.UUIDField()
    action = serializers.ChoiceField(choices=ACTION_CODES)
    is_granted = serializers.BooleanField()
