from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.core.tenant_context import current_tenant
from apps.users.models import UserTenantMembership


class SurveyQsTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Stamps `tenant_schema` and `is_superadmin` onto both the access and
    refresh token. This is what lets a single-host client (the mobile app)
    resolve its tenant purely from the token -- see
    apps/core/tenant_middleware.py.

    On a tenant subdomain, a non-superadmin with no active membership for
    *that* tenant is rejected with `tenant_mismatch` rather than a generic
    credentials error: the password was right, the workspace was wrong, and
    saying so avoids a support call.
    """

    default_error_messages = {
        "tenant_mismatch": "You do not have an active membership for this workspace.",
    }

    @classmethod
    def get_token(cls, user, effective_tenant=None):
        token = super().get_token(user)
        token["is_superadmin"] = user.is_superadmin
        if effective_tenant is not None:
            token["tenant_schema"] = effective_tenant.schema_name
        return token

    def validate(self, attrs):
        request = self.context["request"]
        user = authenticate(
            request=request, username=attrs["email"], password=attrs["password"]
        )
        if user is None or not user.is_active:
            self.fail("no_active_account")

        request_tenant = current_tenant(request)
        effective_tenant = None
        memberships_qs = UserTenantMembership.objects.filter(
            user=user, is_active=True
        ).select_related("tenant")

        if request_tenant is not None:
            if not user.is_superadmin:
                membership = memberships_qs.filter(tenant=request_tenant).first()
                if membership is None:
                    self.fail("tenant_mismatch")
            effective_tenant = request_tenant
        elif not user.is_superadmin:
            latest = memberships_qs.order_by("-joined_at").first()
            effective_tenant = latest.tenant if latest else None

        refresh = self.get_token(user, effective_tenant=effective_tenant)

        data = {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "is_superadmin": user.is_superadmin,
            },
        }
        if request_tenant is None and not user.is_superadmin:
            data["memberships"] = [
                {
                    "tenant_id": str(m.tenant_id),
                    "name": m.tenant.name,
                    "subdomain": m.tenant.subdomain,
                    "role_code": m.role_code,
                }
                for m in memberships_qs
            ]
        return data


class EmailAuthTokenSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
