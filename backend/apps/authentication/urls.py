from django.urls import path

from apps.authentication import views

urlpatterns = [
    path("login/", views.LoginView.as_view(), name="auth-login"),
    path("refresh/", views.RefreshView.as_view(), name="auth-refresh"),
    path("me/", views.MeView.as_view(), name="auth-me"),
    path("my-permissions/", views.MyPermissionsView.as_view(), name="auth-my-permissions"),
    path("forgot-password/", views.ForgotPasswordView.as_view(), name="auth-forgot-password"),
    path("reset-password/", views.ResetPasswordView.as_view(), name="auth-reset-password"),
    path("change-password/", views.ChangePasswordView.as_view(), name="auth-change-password"),
]
