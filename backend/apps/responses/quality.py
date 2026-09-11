"""
Automatic quality flags -- advisory only, never a rejection. See
docs/product/DATA_QUALITY.md. This is the MVP subset (duration and GPS
accuracy); the full rule set (straightlining, out-of-area, out-of-hours) is
Phase 3 and slots into `_RULES` without touching the call site.
"""
from statistics import median

from apps.responses.models import ResponseFlag, SurveyResponse

_FAST_THRESHOLD_PERCENT = 0.40
_GPS_ACCURACY_THRESHOLD_M = 100


def _flag_too_fast(response: SurveyResponse) -> ResponseFlag | None:
    if response.duration_seconds is None:
        return None
    peer_durations = list(
        SurveyResponse.objects.filter(survey_version=response.survey_version, is_deleted=False)
        .exclude(duration_seconds__isnull=True)
        .values_list("duration_seconds", flat=True)
    )
    if len(peer_durations) < 5:
        return None  # not enough peers for a peer-comparison signal to mean anything
    typical = median(peer_durations)
    if typical and response.duration_seconds < typical * _FAST_THRESHOLD_PERCENT:
        return ResponseFlag(
            response=response, code="too_fast", severity="warning",
            message=f"Completed in {response.duration_seconds}s, well under the typical {int(typical)}s for this survey.",
            triggering_values={"duration_seconds": response.duration_seconds, "typical_seconds": typical},
        )
    return None


def _flag_poor_gps(response: SurveyResponse) -> ResponseFlag | None:
    if response.gps_accuracy_m is None:
        return None
    if response.gps_accuracy_m > _GPS_ACCURACY_THRESHOLD_M:
        return ResponseFlag(
            response=response, code="poor_gps", severity="info",
            message=f"Location accuracy was {response.gps_accuracy_m:.0f}m, worse than the {_GPS_ACCURACY_THRESHOLD_M}m threshold.",
            triggering_values={"accuracy_m": response.gps_accuracy_m},
        )
    return None


_RULES = [_flag_too_fast, _flag_poor_gps]


def evaluate_quality_flags(response_id):
    try:
        response = SurveyResponse.objects.get(id=response_id)
    except SurveyResponse.DoesNotExist:
        return
    flags = [rule(response) for rule in _RULES]
    ResponseFlag.objects.bulk_create([f for f in flags if f is not None])
