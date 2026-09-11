# Runbook

> **Audience & scope.** Whoever is on call, or handling a support request. Procedures, in the order you would reach for them. Assumes access to the production console and the database. Configuration is in [`ENVIRONMENT.md`](./ENVIRONMENT.md).

## Before anything else

1. **Is it one tenant or all of them?** The single most useful first question. One tenant points at provisioning, configuration or data; all tenants point at infrastructure or a release.
2. **Did anything deploy recently?** Check the release log before theorising.
3. **Write down what you do.** Commands run in an incident are the record of the incident.

---

## Tenant provisioning

### A tenant is stuck "not ready"

```bash
python manage.py shell -c "
from apps.tenants.models import Tenant
t = Tenant.objects.get(subdomain='abc')
print(t.is_ready, t.provisioning_error)
"
```

Common causes and fixes:

| Error mentions | Cause | Fix |
|---|---|---|
| schema already exists | A previous attempt got part-way | Complete it (below) rather than recreating |
| migration failure | A broken migration | Fix the migration, deploy, re-run for this tenant |
| duplicate email | The admin address is already a user | Add a membership for the existing user instead of creating one |

**Complete a partial provision:**

```bash
python manage.py migrate_schemas --schema=tenant_abc --noinput
python manage.py shell -c "
from django_tenants.utils import schema_context
from apps.tenants.models import Tenant
from apps.rbac.services import provision_tenant_defaults
t = Tenant.objects.get(subdomain='abc')
with schema_context(t.schema_name):
    provision_tenant_defaults(t)
t.is_ready = True; t.provisioning_error = ''; t.save()
"
```

Then confirm the administrator exists and has the admin role, and resend their activation email.

**Do not delete and recreate as a first move.** The error text is the only evidence of what went wrong.

### Resend an activation email

```bash
python manage.py shell -c "
from apps.users.services import send_activation_email
send_activation_email(email='admin@abc.example')
"
```

### Verify isolation after any manual intervention

```bash
python manage.py shell -c "
from django_tenants.utils import schema_context
from apps.responses.models import SurveyResponse
for s in ['tenant_abc','tenant_xyz']:
    with schema_context(s):
        print(s, SurveyResponse.objects.count())
"
```

Two different numbers, both plausible. If one shows the other's count, stop and escalate.

---

## Users and access

### A user cannot sign in

Work down this list in order:

| Check | Command or place |
|---|---|
| Is the user active? | `User.objects.get(email=...).is_active` |
| Is the tenant active and ready? | `Tenant.objects.get(subdomain=...)` |
| Do they have an active membership? | `UserTenantMembership.objects.filter(user=..., tenant=...)` |
| Are they on the right address? | A tenant user on the platform host will be refused |
| Rate limited? | Look for repeated failures for this email fingerprint in the log |

### Reset a password

Always by sending a reset link. **Never set a password on a user's behalf** — it makes the account's activity non-attributable from that moment on.

```bash
python manage.py shell -c "
from apps.authentication.services import send_password_reset
send_password_reset(email='user@abc.example')
"
```

### Reset two-factor for a locked-out user

Requires verification of identity by a route other than the account itself.

```bash
python manage.py shell -c "
from apps.users.models import User
u = User.objects.get(email='user@abc.example')
u.is_2fa_enabled = False; u.otp_secret = ''; u.save()
u.two_factor_devices.all().delete(); u.recovery_codes.all().delete()
"
```

Tell the user to re-enrol immediately, and record who authorised it.

### Revoke every session for a user

For a lost device.

```bash
python manage.py shell -c "
from apps.authentication.services import revoke_all_sessions
revoke_all_sessions(email='agent@abc.example')
"
```

Their access token stops working within its remaining lifetime — at most fifteen minutes — and the refresh fails immediately. **Any work still queued on that device cannot be recovered.** Say so plainly rather than implying it will turn up.

---

## Sync problems

### "An agent's work is not arriving"

The most common support request. Diagnose from the device outward.

**1. Is the device reaching us at all?**

```bash
python manage.py shell -c "
from apps.responses.models import DeviceSession
for d in DeviceSession.objects.filter(user__email='agent@abc.example'):
    print(d.device_id, d.last_sync_at, d.pending_count, d.app_version)
"
```

- No record, or a very old `last_sync_at` → the device has not connected. It is a connectivity or sign-in problem, not a server problem.
- Recent sync with a high `pending_count` → submissions are being refused. Continue.

**2. What is being refused?**

Search the logs for that user's rejections over the period. The error code tells you which branch to take:

| Code | Meaning | Action |
|---|---|---|
| `no_active_assignment` | The assignment was revoked before the response started | Reinstate the assignment, or accept the loss deliberately |
| `validation_failed` | The survey was published with a rule the answers cannot satisfy | Look at the survey, not the agent |
| `consent_missing` | The survey requires consent and none was captured | Not recoverable; the interview must be redone |
| `survey_closed` | Past the grace window | Extend or accept manually (below) |
| `duplicate_respondent` | Waiting for the agent's decision in Sync Review | Tell the agent to resolve it |

**3. Accept a submission past the close grace window**

Deliberate, audited, and only when the delay was genuinely the network's fault.

```bash
python manage.py shell -c "
from apps.surveys.models import Survey
s = Survey.objects.get(id='...')
s.settings['close_grace_days'] = 30; s.save()
print('grace extended; revert after the agent syncs')
"
```

Revert it afterwards.

### Submissions are failing for everybody

Check, in order: the sync success-rate metric, recent deploys, the error tracker for a spike in one code, database connections and disk, and whether a survey was published in the last hour. A newly published survey with a broken validation rule produces a wave of `validation_failed` that looks exactly like an outage.

---

## Surveys and data

### A survey was published with a mistake

Published versions are immutable, by design, and that is not negotiable. Choose:

- **Pause the survey**, fix it, publish a new version. Correct, and costs the field team a few hours.
- **Let it run** and fix it in the next version if the mistake is cosmetic.

Do **not** edit `schema_json` directly in the database. It is the artefact every response's interpretation depends on, and editing it silently changes the meaning of data already collected.

### Restore a soft-deleted response

Within the retention window:

```bash
python manage.py shell -c "
from django_tenants.utils import schema_context
from apps.responses.models import SurveyResponse
with schema_context('tenant_abc'):
    r = SurveyResponse.objects.get(response_code='RESP-2026-004821')
    r.is_deleted = False; r.deleted_at = None; r.save()
"
```

### A subject-access or erasure request

1. Locate the respondent by phone or identity number.
2. **Access:** export their record and every response through the portal.
3. **Erasure:** use **Anonymise** in the portal, not a database delete. It clears the personal fields across the respondent and all their responses and writes an audit entry. A raw `DELETE` leaves orphaned answers and no record that the request was honoured.
4. Record who asked, when, and what was done.

### Find every export of a customer's data

```bash
python manage.py shell -c "
from django_tenants.utils import schema_context
from apps.audit.models import AuditLog
with schema_context('tenant_abc'):
    for a in AuditLog.objects.filter(action='export').order_by('-created_at')[:50]:
        print(a.created_at, a.user_email, a.after_values.get('row_count'), a.after_values.get('filters'))
"
```

---

## Background work

### The queue is backing up

```bash
celery -A surveyqs inspect active
celery -A surveyqs inspect reserved
```

Usually one long export starving the rest. If exports and notifications are sharing a queue, that is the bug — separate them.

### A stuck export

```bash
python manage.py shell -c "
from django_tenants.utils import schema_context
from apps.reports.models import ExportJob
with schema_context('tenant_abc'):
    j = ExportJob.objects.get(id='...')
    j.status='failed'; j.error='Cancelled by operator'; j.save()
"
```

Tell the user, and ask them to narrow the filters.

### Scheduled jobs running twice

**Two scheduler processes are running.** There must be exactly one. Stop the extra, then check whether anything user-visible was duplicated — notifications most likely.

---

## Database

### Slow queries

The usual suspects in this product, in order:

1. **A report aggregating from the JSONB document instead of the typed answer rows.** Reports read `Answer`; if one reads `answers`, that is the bug.
2. **A missing index after a new filter shipped.**
3. **One tenant with an outsized `Answer` table** — the first candidate for partitioning.

### Emergency read-only mode

To protect the database under load, disable writes at the load balancer rather than in the application. Reads keep working, the portal stays usable, and — importantly — **mobile agents are unaffected**, because they queue locally and retry. This is the one outage where the offline design genuinely saves the day: field work continues and nothing is lost.

---

## Secret rotation

| Secret | Effect of rotating | Procedure |
|---|---|---|
| `DJANGO_SECRET_KEY` | **Every session ends.** Everyone signs in again. | Announce, rotate off-hours, deploy |
| `OTP_ENCRYPTION_KEYS` | None, if done correctly | Prepend the new key, deploy, run the re-encrypt command, remove the old key on the next deploy |
| Database password | Brief connection errors | Rotate, update the variable, rolling restart |
| Object storage keys | New attachment uploads fail until updated | Create new keys, update, verify, revoke old |
| Email or push keys | That channel stops until updated | Rotate, update, send a test |

Nothing is ever rotated by editing a value in a running process. Change it in the configuration store and deploy, so the change is recorded and reproducible.

---

## After a security incident

1. **Contain.** Revoke sessions for affected accounts; deactivate the tenant if the scope is unclear.
2. **Preserve.** Snapshot the audit log and application logs before anything is changed.
3. **Scope.** What was accessed, by whom, over what period. The audit log and the export log are the two sources.
4. **Notify.** Personal data is involved, so notification obligations are likely. Involve counsel early, not after the technical work.
5. **Remediate.** Rotate what needs rotating, patch, deploy.
6. **Write it up.** Blamelessly, with the specific change that prevents a recurrence.

---

## Escalation

| Situation | Escalate immediately |
|---|---|
| Any suspicion of cross-tenant data exposure | Yes, without waiting to confirm |
| Personal data possibly exposed | Yes |
| Data loss that backups cannot cover | Yes |
| A whole tenant down for more than 30 minutes | Yes |
| Sync failing platform-wide | Yes — every hour costs a field team a day |
| One user's login trouble | No, handle it |

---

*Last reviewed: 2026-09-11. Every command here should be exercised in staging before it is needed in production.*
