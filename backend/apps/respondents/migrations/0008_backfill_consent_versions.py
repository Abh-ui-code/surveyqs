"""
Backfill for consent versioning (see 0007): link each existing consent
notice to its survey, number a survey's notices v1, v2, ... in the order
they were created, and pin each existing response to the consent record it
was collected under.

A notice is linked to its survey one of two ways. The current notice is
named in `survey.settings["consent_notice_id"]`. A *superseded* notice has
no pointer left anywhere (settings only ever held the latest), so it is
matched by evidence instead: the surveys that the respondents who signed it
went on to answer. It is linked only when that points at exactly one survey
-- an ambiguous notice is left unlinked rather than guessed at.
"""
from django.db import migrations


def backfill(apps, schema_editor):
    Survey = apps.get_model("surveys", "Survey")
    ConsentNotice = apps.get_model("respondents", "ConsentNotice")
    ConsentRecord = apps.get_model("respondents", "ConsentRecord")
    SurveyResponse = apps.get_model("responses", "SurveyResponse")

    for survey in Survey.objects.all():
        notice_id = (survey.settings or {}).get("consent_notice_id")
        if notice_id:
            ConsentNotice.objects.filter(id=notice_id, survey__isnull=True).update(survey=survey)

    for notice in ConsentNotice.objects.filter(survey__isnull=True):
        respondent_ids = ConsentRecord.objects.filter(notice=notice).values_list("respondent_id", flat=True)
        survey_ids = set(
            SurveyResponse.objects.filter(respondent_id__in=list(respondent_ids)).values_list("survey_id", flat=True)
        )
        # Only a survey that already owns a (newer) notice can have had this
        # one as a predecessor -- otherwise the evidence is too weak.
        survey_ids = {sid for sid in survey_ids if ConsentNotice.objects.filter(survey_id=sid).exists()}
        if len(survey_ids) == 1:
            notice.survey_id = survey_ids.pop()
            notice.save(update_fields=["survey"])

    for survey_id in ConsentNotice.objects.filter(survey__isnull=False).values_list("survey_id", flat=True).distinct():
        for n, notice in enumerate(ConsentNotice.objects.filter(survey_id=survey_id).order_by("created_at", "version"), 1):
            notice.survey_version = n
            notice.save(update_fields=["survey_version"])

    for response in SurveyResponse.objects.filter(respondent__isnull=False, consent_record__isnull=True):
        records = ConsentRecord.objects.filter(
            respondent_id=response.respondent_id, notice__survey_id=response.survey_id
        ).order_by("-granted_at")
        record = records.filter(granted_at__lte=response.submitted_at).first() or records.first()
        if record:
            response.consent_record_id = record.id
            response.save(update_fields=["consent_record"])


class Migration(migrations.Migration):
    dependencies = [
        ("respondents", "0007_consent_versioning"),
        ("responses", "0004_consent_versioning"),
        ("surveys", "0003_surveydemographicfield"),
    ]

    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
