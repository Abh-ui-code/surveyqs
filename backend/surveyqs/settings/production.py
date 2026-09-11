import environ

from .base import *  # noqa: F401,F403

_env = environ.Env()

DEBUG = False

SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True

# A bucket configured -> S3-compatible storage. Otherwise local disk, which
# only ever makes sense behind a single instance with a mounted volume.
if _env("AWS_STORAGE_BUCKET_NAME", default=""):
    STORAGES = {
        "default": {"BACKEND": "storages.backends.s3.S3Storage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }
    AWS_STORAGE_BUCKET_NAME = _env("AWS_STORAGE_BUCKET_NAME")
    AWS_S3_ENDPOINT_URL = _env("AWS_S3_ENDPOINT_URL", default=None)
    AWS_S3_REGION_NAME = _env("AWS_S3_REGION_NAME", default=None)
    AWS_QUERYSTRING_AUTH = True
    AWS_QUERYSTRING_EXPIRE = 3600
else:
    import logging

    logging.getLogger(__name__).warning(
        "MEDIA_STORAGE: no AWS_STORAGE_BUCKET_NAME set -- falling back to local "
        "disk in production. This does not survive multiple instances."
    )

SENTRY_DSN = _env("SENTRY_DSN", default="")
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=_env.float("SENTRY_TRACES_SAMPLE_RATE", default=0.1),
        send_default_pii=False,
    )
