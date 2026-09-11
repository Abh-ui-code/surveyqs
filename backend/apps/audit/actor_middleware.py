from apps.audit.actor import clear_actor, set_actor


class AuditActorMiddleware:
    """
    Clears any stale actor at the start of every request and sets a
    best-effort actor from Django's session-authenticated `request.user`
    (relevant to the admin site only). For JWT-authenticated API requests,
    `TenantScopedMixin.initial()` overwrites this once DRF auth has resolved
    the real user -- middleware runs before authentication, so it cannot
    know the API caller's identity yet.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        clear_actor()
        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            set_actor(user=user, ip_address=request.META.get("REMOTE_ADDR"))
        try:
            return self.get_response(request)
        finally:
            clear_actor()
