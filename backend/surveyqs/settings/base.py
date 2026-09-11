"""
Base settings for SurveyQs.

Every environment variable used anywhere in the project is declared once,
here, with its default. An optional integration (email, push, error tracking)
is inert when its key is blank -- see docs/operations/ENVIRONMENT.md.
"""
from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    TENANT_BASE_DOMAIN=(str, "surveyqs.local"),
    TENANT_PLATFORM_SUBDOMAINS=(list, ["admin", "api", "www", "app"]),
    JWT_ACCESS_TOKEN_LIFETIME_MIN=(int, 15),
    JWT_REFRESH_TOKEN_LIFETIME_DAYS=(int, 7),
    MAX_UPLOAD_IMAGE_BYTES=(int, 5 * 1024 * 1024),
    MAX_UPLOAD_AUDIO_BYTES=(int, 10 * 1024 * 1024),
    MAX_UPLOAD_FILE_BYTES=(int, 25 * 1024 * 1024),
    EXPORT_SYNC_THRESHOLD_ROWS=(int, 5000),
    SURVEY_CLOSE_GRACE_DAYS=(int, 14),
    DEMO_ADMIN_EMAIL=(str, ""),
    DEMO_ADMIN_PASSWORD=(str, ""),
)
environ.Env.read_env(str(BASE_DIR / ".env"))

SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-insecure-secret-key-change-me")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")

TENANT_BASE_DOMAIN = env("TENANT_BASE_DOMAIN")
TENANT_PLATFORM_SUBDOMAINS = env("TENANT_PLATFORM_SUBDOMAINS")
FRONTEND_BASE_URL = env("FRONTEND_BASE_URL", default=f"http://app.{TENANT_BASE_DOMAIN}:3000")

# ---------------------------------------------------------------------------
# Apps
# ---------------------------------------------------------------------------
SHARED_APPS = [
    "django_tenants",
    "apps.tenants",
    "apps.core",
    "apps.users",
    "apps.authentication",
    "apps.superadmin",
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "rest_framework_nested",
]

TENANT_APPS = [
    "django.contrib.contenttypes",
    "apps.rbac",
    "apps.surveys",
    "apps.formlogic",
    "apps.assignments",
    "apps.respondents",
    "apps.responses",
    "apps.reports",
    "apps.audit",
]

INSTALLED_APPS = list(SHARED_APPS) + [a for a in TENANT_APPS if a not in SHARED_APPS]

TENANT_MODEL = "tenants.Tenant"
TENANT_DOMAIN_MODEL = "tenants.Domain"
PUBLIC_SCHEMA_NAME = "public"

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.gzip.GZipMiddleware",
    "apps.core.tenant_middleware.PublicFallbackTenantMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.core.tenant_middleware.TenantContextNormalizationMiddleware",
    "apps.audit.actor_middleware.AuditActorMiddleware",
]

ROOT_URLCONF = "surveyqs.urls_tenant"
PUBLIC_SCHEMA_URLCONF = "surveyqs.urls_public"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "surveyqs.wsgi.application"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
DATABASES = {
    "default": {
        **env.db_url(
            "DATABASE_URL",
            default="postgres://surveyqs:surveyqs@localhost:5432/surveyqs_dev",
        ),
        "ENGINE": "django_tenants.postgresql_backend",
        "CONN_MAX_AGE": 300,
    }
}
DATABASE_ROUTERS = ("django_tenants.routers.TenantSyncRouter",)

# ---------------------------------------------------------------------------
# Cache / Redis
# ---------------------------------------------------------------------------
REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0")
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    }
}

CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=False)

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "users.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.PageSizePagination",
    "PAGE_SIZE": 25,
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "EXCEPTION_HANDLER": "apps.core.exceptions.exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
    "DEFAULT_THROTTLE_RATES": {
        "login": "5/min",
        "refresh": "20/min",
        "forgot_password": "10/min",
        "reset_password": "10/min",
        "signup": "3/min",
        "sync": "120/min",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env("JWT_ACCESS_TOKEN_LIFETIME_MIN")),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env("JWT_REFRESH_TOKEN_LIFETIME_DAYS")),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "TOKEN_OBTAIN_SERIALIZER": "apps.authentication.serializers.SurveyQsTokenObtainPairSerializer",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "SurveyQs API",
    "DESCRIPTION": "Multi-tenant survey platform API",
    "VERSION": "0.1.0",
}

# ---------------------------------------------------------------------------
# CORS -- parametric on the tenant base domain, never a static enumeration
# ---------------------------------------------------------------------------
import re  # noqa: E402

_domain_re = re.escape(TENANT_BASE_DOMAIN)
CORS_ALLOWED_ORIGIN_REGEXES = [rf"^https://([\w-]+\.)?{_domain_re}$"]
if DEBUG:
    CORS_ALLOWED_ORIGIN_REGEXES.append(rf"^http://([\w-]+\.)?{_domain_re}:(3000|3001|8000)$")
    CORS_ALLOWED_ORIGIN_REGEXES.append(r"^http://localhost:(3000|3001|8000)$")
CORS_ALLOW_CREDENTIALS = True

from corsheaders.defaults import default_headers  # noqa: E402

CORS_ALLOW_HEADERS = [*default_headers, "x-request-id"]

# ---------------------------------------------------------------------------
# I18N / static / media
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Product-level limits, all overridable per environment
# ---------------------------------------------------------------------------
MAX_UPLOAD_IMAGE_BYTES = env("MAX_UPLOAD_IMAGE_BYTES")
MAX_UPLOAD_AUDIO_BYTES = env("MAX_UPLOAD_AUDIO_BYTES")
MAX_UPLOAD_FILE_BYTES = env("MAX_UPLOAD_FILE_BYTES")
EXPORT_SYNC_THRESHOLD_ROWS = env("EXPORT_SYNC_THRESHOLD_ROWS")
SURVEY_CLOSE_GRACE_DAYS = env("SURVEY_CLOSE_GRACE_DAYS")

DEMO_ADMIN_EMAIL = env("DEMO_ADMIN_EMAIL")
DEMO_ADMIN_PASSWORD = env("DEMO_ADMIN_PASSWORD")

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="no-reply@surveyqs.local")
