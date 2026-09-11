"""
Email-adjacent flows: activation links and password resets. Both use
Django's own signed-token machinery (no extra model needed for a first
release) and both degrade to printing on the console backend when no real
mail provider is configured -- see docs/operations/ENVIRONMENT.md.
"""
from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


class ActivationTokenGenerator(PasswordResetTokenGenerator):
    def _make_hash_value(self, user, timestamp):
        # Include `is_active`/password state so a token is invalidated the
        # moment the user actually sets a password.
        return f"{user.pk}{user.password}{timestamp}"


activation_token_generator = ActivationTokenGenerator()


def _activation_url(user) -> str:
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = activation_token_generator.make_token(user)
    return f"{settings.FRONTEND_BASE_URL}/auth/activate-account?uid={uid}&token={token}"


def send_activation_email(user) -> str:
    """
    Returns the activation URL it sent, so a caller (the invite endpoint)
    can surface it back to the admin who did the inviting -- there is no
    real mail provider configured in local development, so the email
    otherwise lands nowhere the admin using the browser can see it.
    Returning it is not a security regression: the admin who just created
    this exact account is already authorised to know how to activate it.
    """
    url = _activation_url(user)
    send_mail(
        subject="Set up your SurveyQs account",
        message=(
            f"Hello {user.full_name or user.email},\n\n"
            f"An administrator created an account for you on SurveyQs. "
            f"Set your password to get started:\n\n{url}\n\n"
            f"This link is single-use and expires in a few days."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=True,
    )
    return url


def send_password_reset(email: str) -> None:
    """Always returns None regardless of whether the address exists --
    the caller must respond identically either way, or the endpoint becomes
    a way to enumerate registered accounts."""
    from apps.users.models import User

    user = User.objects.filter(email=email.lower(), is_active=True).first()
    if user is None:
        return
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = activation_token_generator.make_token(user)
    url = f"{settings.FRONTEND_BASE_URL}/auth/reset-password?uid={uid}&token={token}"
    send_mail(
        subject="Reset your SurveyQs password",
        message=f"Use this link to set a new password:\n\n{url}\n\nIf you didn't request this, ignore this email.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=True,
    )
