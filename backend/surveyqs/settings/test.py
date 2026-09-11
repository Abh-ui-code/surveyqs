"""
Test settings. Runs against the same Postgres engine as production would --
django-tenants relies on real schemas, which SQLite cannot provide, so we do
not attempt the SQLite-router workaround here. Tests use a disposable
Postgres database instead (`surveyqs_test`), created and torn down by
Django's test runner in the usual way.
"""
from .base import *  # noqa: F401,F403

DEBUG = False
SECRET_KEY = "test-secret-key"
CELERY_TASK_ALWAYS_EAGER = True
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]  # fast tests only
