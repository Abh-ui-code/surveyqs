MODULE_CHOICES = [
    ("surveys", "Surveys"),
    ("assignments", "Assignments"),
    ("responses", "Responses"),
    ("respondents", "Respondents"),
    ("reports", "Reports"),
    ("users", "Users"),
    ("settings", "Settings"),
    ("audit", "Audit"),
]
MODULE_CODES = [code for code, _ in MODULE_CHOICES]

ACTION_CHOICES = [
    ("view", "View"),
    ("create", "Create"),
    ("edit", "Edit"),
    ("delete", "Delete"),
    ("approve", "Approve"),
    ("export", "Export"),
]
ACTION_CODES = [code for code, _ in ACTION_CHOICES]

SYSTEM_ROLES = {
    "admin": "Admin",
    "supervisor": "Supervisor",
    "agent": "Agent",
    "analyst": "Analyst",
}

# Default (module -> [actions]) per system role. `admin` is granted every
# action on every module unconditionally in provision_tenant_defaults and is
# therefore intentionally absent here.
DEFAULT_PERMISSIONS: dict[str, dict[str, list[str]]] = {
    "supervisor": {
        "surveys": ["view"],
        "assignments": ["view", "create", "edit"],
        "responses": ["view", "edit", "approve", "export"],
        "respondents": ["view", "create", "edit"],
        "reports": ["view", "export"],
    },
    "agent": {
        "surveys": ["view"],
        "assignments": ["view"],
        "responses": ["view", "create", "edit"],
        "respondents": ["view", "create", "edit"],
        "reports": ["view"],
    },
    "analyst": {
        "surveys": ["view"],
        "responses": ["view", "export"],
        "respondents": ["view", "export"],
        "reports": ["view", "export"],
    },
}
