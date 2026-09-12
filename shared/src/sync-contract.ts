/**
 * The exact wire shape of POST /api/sync/batch/, per docs/api/SYNC_API.md.
 * Kept separate from the outbox's own on-device storage shape (that lives
 * in the mobile app, since it's a local implementation detail) — this file
 * is only the contract with the server.
 */

export type SyncBatchItemKind = "respondent.create" | "consent.create" | "response.submit";

export interface SyncBatchItem {
  ref: string;
  kind: SyncBatchItemKind;
  parent_ref?: string;
  /** Present only when resolving a conflict the server returned earlier. */
  resolution?: "merge" | "keep_both" | "discard";
  merge_into?: string;
  payload: Record<string, unknown>;
}

export type SyncBatchResultStatus = "created" | "updated" | "rejected" | "conflict" | "skipped";

export interface SyncBatchResult {
  ref: string;
  status: SyncBatchResultStatus;
  id?: string;
  response_code?: string;
  code?: string;
  detail?: string;
  reason?: string;
  errors?: Array<{ question_code?: string; code: string; message: string; value?: unknown }>;
  warnings?: Array<{ code: string; question_code?: string; detail: string }>;
  existing?: { id: string; full_name: string; phone: string; created_at: string };
  resolutions?: string[];
  attachment_uploads?: Array<{ ref: string; upload_url: string; attachment_id: string }>;
}

export interface SyncBatchResponse {
  results: SyncBatchResult[];
  server_time: string;
}

/** Error vocabulary from docs/api/SYNC_API.md — a code outside this list is
 * treated as a generic retryable failure rather than crashing the replayer. */
export const REJECTION_CODES = [
  "validation_failed",
  "unknown_question",
  "invalid_version",
  "survey_archived",
  "consent_missing",
  "checksum_mismatch",
  "file_too_large",
  "unsupported_type",
  "quota_full",
] as const;

export const CONFLICT_CODES = [
  "duplicate_respondent",
  "duplicate_response",
  "no_active_assignment",
  "survey_closed",
] as const;
