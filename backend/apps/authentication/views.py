from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.authentication.serializers import SurveyQsTokenObtainPairSerializer
from apps.authentication.services import (
    activation_token_generator,
    send_password_reset,
)
from apps.core.tenant_context import current_tenant

User = get_user_model()


class LoginView(TokenObtainPairView):
    serializer_class = SurveyQsTokenObtainPairSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            email = request.data.get("email", "")
            User.objects.filter(email=email.lower()).update(
                last_login_at=timezone.now(),
                last_login_ip=request.META.get("REMOTE_ADDR"),
            )
        return response


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "refresh"


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(self._serialize(request))

    def patch(self, request):
        full_name = request.data.get("full_name", "").strip()
        if not full_name:
            return Response({"full_name": ["This field may not be blank."]}, status=400)
        request.user.full_name = full_name
        request.user.save(update_fields=["full_name"])
        return Response(self._serialize(request))

    @staticmethod
    def _serialize(request):
        user = request.user
        tenant = current_tenant(request)
        return {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "is_superadmin": user.is_superadmin,
            "tenant": {"name": tenant.name, "subdomain": tenant.subdomain} if tenant else None,
        }


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "reset_password"

    def post(self, request):
        current = request.data.get("current_password", "")
        new = request.data.get("new_password", "")
        if not request.user.check_password(current):
            return Response({"current_password": ["That's not your current password."]}, status=400)
        if len(new) < 8:
            return Response({"new_password": ["Use at least 8 characters."]}, status=400)
        request.user.set_password(new)
        request.user.save(update_fields=["password"])
        return Response({"detail": "Password changed."})


class MyPermissionsView(APIView):
    """The one call both clients make on startup to decide what to render."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if current_tenant(request) is None:
            return Response(
                {"is_superadmin": request.user.is_superadmin, "is_admin": False, "role_code": None, "modules": [], "permissions": {}}
            )
        from apps.rbac.services import user_permission_summary

        return Response(user_permission_summary(request.user))


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "forgot_password"

    def post(self, request):
        email = request.data.get("email", "")
        if email:
            send_password_reset(email)
        # Identical response whether or not the address exists.
        return Response({"detail": "If that email exists, a reset link has been sent."})


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "reset_password"

    def post(self, request):
        uid = request.data.get("uid")
        token = request.data.get("token")
        password = request.data.get("password")
        if not (uid and token and password):
            return Response({"detail": "uid, token and password are required."}, status=400)

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response({"detail": "Invalid or expired link."}, status=400)

        if not activation_token_generator.check_token(user, token):
            return Response({"detail": "Invalid or expired link."}, status=400)

        user.set_password(password)
        user.is_active = True
        user.save(update_fields=["password", "is_active"])
        return Response({"detail": "Password set. You can sign in now."})
