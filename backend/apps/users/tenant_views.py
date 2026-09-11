"""
Tenant-facing user management. The models involved straddle two schemas --
`User` and `UserTenantMembership` live in `public`; `Role` and `UserRole`
live in the tenant schema -- so this view assembles the join itself rather
than delegating to a single model's manager. Both schemas are reachable
from one connection because django-tenants sets `search_path` to
`<tenant>, public`.
"""
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from django.conf import settings
from django.core.mail import send_mail

from apps.core.tenant_context import current_tenant
from apps.core.viewset_mixins import TenantScopedMixin
from apps.rbac.permissions import HasPermission
from apps.users.models import User, UserTenantMembership
from apps.users.passwords import generate_temporary_password
from apps.users.tenant_serializers import (
    InviteUserSerializer,
    TenantUserSerializer,
    UpdateUserRoleSerializer,
)


class TenantUserViewSet(TenantScopedMixin, ViewSet):
    module_code = "users"
    REQUIRED_ACTIONS = {
        "list": "view", "create": "create", "partial_update": "edit",
        "destroy": "delete", "deactivate": "edit", "reactivate": "edit",
    }
    permission_classes = [HasPermission]

    @property
    def required_action(self):
        return self.REQUIRED_ACTIONS.get(self.action, "view")

    def list(self, request):
        tenant = current_tenant(request)
        memberships = UserTenantMembership.objects.filter(tenant=tenant).select_related("user").order_by("user__full_name")
        rows = [
            {
                "id": m.user.id,
                "email": m.user.email,
                "full_name": m.user.full_name,
                "role_code": m.role_code,
                "is_active": m.is_active,
                "last_login_at": m.user.last_login_at,
                "joined_at": m.joined_at,
            }
            for m in memberships
        ]
        return Response(TenantUserSerializer(rows, many=True).data)

    def create(self, request):
        """
        Invite a user: create the account if needed, grant a membership and
        a tenant role, and set a system-generated temporary password.

        The temporary password is returned in the response, once, to the
        admin who created the account -- it is never logged, never stored
        anywhere but the (hashed) password field, and cannot be retrieved
        again after this response. It remains a normal, permanent password
        until the user changes it themselves from their profile.
        """
        serializer = InviteUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        tenant = current_tenant(request)

        user, created = User.objects.get_or_create(
            email=data["email"].lower(), defaults={"full_name": data["full_name"]}
        )

        membership, membership_created = UserTenantMembership.objects.get_or_create(
            user=user, tenant=tenant,
            defaults={"role_code": data["role_code"], "invited_by": request.user, "is_active": True},
        )
        if not membership_created:
            raise ValidationError({"detail": "This person already has access to this workspace."})

        from apps.rbac.models import Role, UserRole

        role = Role.objects.get(code=data["role_code"])
        UserRole.objects.get_or_create(user_id=user.id, role=role)

        # A brand-new account always gets a fresh temporary password. An
        # existing account (already a member elsewhere with a real password
        # of their own) just needs the new membership -- reissuing them a
        # temporary password would lock them out of their existing one.
        temporary_password = None
        if created or not user.has_usable_password():
            temporary_password = generate_temporary_password()
            user.set_password(temporary_password)
            user.save(update_fields=["password"])
            self._notify_account_created(user)

        return Response(
            {
                **TenantUserSerializer(
                    {
                        "id": user.id, "email": user.email, "full_name": user.full_name,
                        "role_code": membership.role_code, "is_active": membership.is_active,
                        "last_login_at": user.last_login_at, "joined_at": membership.joined_at,
                    }
                ).data,
                "temporary_password": temporary_password,
            },
            status=201,
        )

    @staticmethod
    def _notify_account_created(user):
        """A courtesy notification only -- deliberately does not include
        the password. Sending a password by email is a bad habit even when
        console-backend-only in this environment; the admin hands the
        temporary password to the user through whatever channel they trust."""
        send_mail(
            subject="An account was created for you on SurveyQs",
            message=(
                f"Hello {user.full_name or user.email},\n\n"
                f"An administrator created an account for you. Ask them for your temporary "
                f"password to sign in -- you'll be asked to choose your own on first sign-in."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )

    def partial_update(self, request, pk=None):
        """Change a user's role within this tenant."""
        serializer = UpdateUserRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tenant = current_tenant(request)

        membership = UserTenantMembership.objects.get(tenant=tenant, user_id=pk)
        membership.role_code = serializer.validated_data["role_code"]
        membership.save(update_fields=["role_code"])

        from apps.rbac.models import Role, UserRole

        role = Role.objects.get(code=serializer.validated_data["role_code"])
        UserRole.objects.filter(user_id=pk).delete()
        UserRole.objects.get_or_create(user_id=pk, role=role)

        return Response({"detail": "Role updated."})

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        tenant = current_tenant(request)
        membership = UserTenantMembership.objects.get(tenant=tenant, user_id=pk)
        if membership.role_code == "admin" and self._is_only_active_admin(tenant, pk):
            raise ValidationError({"detail": "This is the only active admin -- deactivating them would lock the workspace out."})
        membership.is_active = False
        membership.save(update_fields=["is_active"])
        return Response({"detail": "User deactivated."})

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        tenant = current_tenant(request)
        membership = UserTenantMembership.objects.get(tenant=tenant, user_id=pk)
        membership.is_active = True
        membership.save(update_fields=["is_active"])
        return Response({"detail": "User reactivated."})

    @staticmethod
    def _is_only_active_admin(tenant, user_id) -> bool:
        admins = UserTenantMembership.objects.filter(tenant=tenant, role_code="admin", is_active=True)
        return admins.count() == 1 and str(admins.first().user_id) == str(user_id)
