/**
 * Turns a finished InterviewDraft into the exact item chain
 * POST /api/sync/batch/ expects (docs/api/SYNC_API.md): an optional
 * `respondent.create`, an optional `consent.create` chained to it, and a
 * `response.submit` chained to whichever of those ran (or carrying the
 * respondent id directly when the agent picked an existing match).
 */
import type { SyncBatchItem } from "@surveyqs/shared";

import type { InterviewDraft } from "./drafts-store";
import { newUuid } from "./uuid";

export function buildSyncItems(draft: InterviewDraft): SyncBatchItem[] {
  const items: SyncBatchItem[] = [];
  let parentRef: string | undefined;
  let respondentId: string | undefined = draft.respondent?.existingId;

  if (draft.respondent && !draft.respondent.existingId) {
    items.push({
      ref: "r1",
      kind: "respondent.create",
      // `client_ref_id` is a real UUIDField server-side (apps/respondents/
      // models.py) — it must be an actual UUID, never the short "r1"-style
      // chain token used for `ref`/`parent_ref`.
      payload: {
        client_ref_id: newUuid(),
        full_name: draft.respondent.full_name,
        phone: draft.respondent.phone,
        email: draft.respondent.email || undefined,
        gender: draft.respondent.gender || undefined,
        address: draft.respondent.address || undefined,
        geography_node: draft.respondent.geography_node,
      },
    });
    parentRef = "r1";
  }

  if (draft.consent) {
    items.push({
      ref: "c1",
      kind: "consent.create",
      parent_ref: parentRef,
      payload: {
        client_ref_id: newUuid(),
        notice_id: draft.consent.notice_id,
        language: draft.consent.language,
        method: draft.consent.method,
        granted_at: draft.consent.granted_at,
        captured_offline: true,
        ...(parentRef ? {} : { respondent_id: respondentId }),
      },
    });
    parentRef = "c1";
  }

  const now = new Date().toISOString();
  items.push({
    ref: "s1",
    kind: "response.submit",
    parent_ref: parentRef,
    payload: {
      client_ref_id: newUuid(),
      survey_id: draft.surveyId,
      survey_version_id: draft.versionId,
      assignment_id: draft.assignmentId,
      started_at: draft.startedAt,
      submitted_at: now,
      duration_seconds: Math.max(0, Math.round((Date.parse(now) - Date.parse(draft.startedAt)) / 1000)),
      gps: draft.gps,
      device: { id: "mobile", app_version: "0.1.0", os: "unknown" },
      was_offline: true,
      answers: draft.answers,
      attachments: draft.attachments.map(({ local_uri: _local_uri, ...rest }) => rest),
      ...(parentRef ? {} : respondentId ? { respondent: { id: respondentId } } : {}),
      // Best-effort hint for editing a rejected response — the exact
      // server-side linkage for "resubmit the same interview, corrected"
      // needs confirming against apps/responses/services.py before this
      // ships; an unknown top-level key is safely ignored either way.
      ...(draft.resubmitOfResponseId ? { response_id: draft.resubmitOfResponseId } : {}),
    },
  });

  return items;
}
