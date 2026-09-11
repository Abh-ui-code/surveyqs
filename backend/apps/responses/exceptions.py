class SubmissionRejected(Exception):
    """A permanent failure (4xx) -- the client must not retry unchanged.
    Carries a machine-readable `code` per docs/api/SYNC_API.md."""

    def __init__(self, code: str, detail: str, errors: list | None = None, extra: dict | None = None):
        self.code = code
        self.detail = detail
        self.errors = errors or []
        self.extra = extra or {}
        super().__init__(detail)


class SubmissionConflict(SubmissionRejected):
    """A conflict a human must resolve -- duplicate respondent, revoked
    assignment, closed survey. Never retried blindly."""
