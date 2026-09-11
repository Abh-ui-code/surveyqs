from rest_framework.permissions import BasePermission

from apps.rbac.services import user_has_permission


class HasPermission(BasePermission):
    """
    Reads `view.module_code` and either `view.REQUIRED_ACTIONS[method]` or
    `view.required_action`. Fails closed: a view that declares neither is
    denied, not allowed -- a forgotten declaration becomes a loud 403 in
    development rather than a silent hole in production.
    """

    def has_permission(self, request, view):
        module_code = getattr(view, "module_code", None)
        if module_code is None:
            return False

        action = getattr(view, "required_action", None)
        if action is None:
            required_actions = getattr(view, "REQUIRED_ACTIONS", None)
            if not required_actions:
                return False
            action = required_actions.get(request.method)
            if action is None:
                return False

        return user_has_permission(request.user, module_code, action)
