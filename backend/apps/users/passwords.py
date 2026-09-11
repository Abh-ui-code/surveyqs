"""
Temporary password generation for admin-created accounts. Shown once, in
the response to the admin who created the account -- never emailed in
plaintext, never logged, never retrievable again afterwards. The account
is flagged `must_change_password` so the temporary value cannot become a
permanent one by inertia.
"""
import secrets
import string

# Excludes visually ambiguous characters (0/O, 1/l/I) so a password read
# aloud or copied by hand is not a guessing game.
_ALPHABET = "".join(c for c in string.ascii_letters + string.digits if c not in "0O1lI")


def generate_temporary_password(length: int = 12) -> str:
    while True:
        candidate = "".join(secrets.choice(_ALPHABET) for _ in range(length))
        # Guarantee at least one of each class so it always passes Django's
        # own password validators (which this project also enforces here).
        if any(c.islower() for c in candidate) and any(c.isupper() for c in candidate) and any(c.isdigit() for c in candidate):
            return candidate
