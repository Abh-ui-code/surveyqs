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
        geography_node: draft.respondent.geography_node,
        custom_fields: draft.respondent.custom_fields ?? {},
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
        ...(draft.consent.signature_base64 ? { signature_base64: draft.consent.signature_base64 } : {}),
        ...(parentRef ? {} : { respondent_id: respondentId }),
      },
    });
    // `parentRef` must keep pointing at the respondent item ("r1", or stay
    // undefined for an existing respondent) -- it feeds `response.submit`'s
    // own `parent_ref` below, and the backend (sync_views.py) resolves
    // `_parent_server_id` generically as "the respondent id" regardless of
    // which item kind it came from. Re-pointing it at "c1" here used to
    // make the response's respondent_id resolve to the ConsentRecord's id
    // instead, breaking every submission that captured consent.
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
    },
  });

  return items;
}
