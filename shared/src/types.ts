/**
 * Domain types shared between web/tenant-app and mobile. Mirrors the wire
 * shapes documented in docs/api/SYNC_API.md and docs/architecture/FORM_SCHEMA.md
 * — this file has no logic, only shape, so both clients stay honest about
 * what the server actually sends.
 */

export interface Tenant {
  name: string;
  subdomain: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  is_superadmin: boolean;
  tenant: Tenant | null;
}

export interface MyPermissions {
  is_superadmin: boolean;
  is_admin: boolean;
  role_code: string | null;
  modules: string[];
  permissions: Record<string, string[]>;
}

export function canAccess(perms: MyPermissions | undefined, module: string, action = "view"): boolean {
  if (!perms) return false;
  if (perms.is_superadmin || perms.is_admin) return true;
  return perms.permissions[module]?.includes(action) ?? false;
}

// ---------------------------------------------------------------------
// Sync bootstrap / assignments — GET /api/sync/bootstrap/, /assignments/
// ---------------------------------------------------------------------

export interface ConsentNotice {
  id: string;
  version: number;
  language: string;
  text: string;
}

export interface SyncBootstrap {
  user: { id: string; full_name: string; email: string };
  permissions: MyPermissions;
  tenant: Tenant | null;
  settings: {
    attachment_limits: { image: number; audio: number; file: number };
    survey_close_grace_days: number;
  };
  consent_notices: ConsentNotice[];
  server_time: string;
}

export type AssignmentStatus = "active" | "paused" | "completed" | "revoked";

export interface SyncAssignment {
  id: string;
  survey: {
    id: string;
    title: string;
    category: { code: string; label: string };
  };
  version: { id: string; version_number: number; schema_hash: string } | null;
  target_count: number | null;
  submitted_count: number;
  due_date: string | null;
  priority: "low" | "normal" | "high";
  instructions: string;
  status: AssignmentStatus;
  survey_status: string;
}

// ---------------------------------------------------------------------
// Respondents — GET /api/sync/respondents/  (dedup lookup slice)
// ---------------------------------------------------------------------

export interface RespondentLookupResult {
  id: string;
  full_name: string;
  phone: string | null;
  identity_number: string | null;
  geography_node_id: string | null;
  consent_status: "granted" | "declined" | "pending";
  updated_at: string;
}

// ---------------------------------------------------------------------
// Form package — the frozen per-version schema. docs/architecture/FORM_SCHEMA.md
// ---------------------------------------------------------------------

export type LocalizedText = Record<string, string>;

export interface Choice {
  value: string;
  label: LocalizedText;
  order: number;
  attrs?: Record<string, string>;
  active?: boolean;
}

export interface ChoiceList {
  name: string;
  attributes?: string[];
  choices: Choice[];
}

export type QuestionType =
  | "text"
  | "long_text"
  | "email"
  | "phone"
  | "url"
  | "integer"
  | "decimal"
  | "range"
  | "percentage"
  | "rating"
  | "nps"
  | "duration"
  | "yes_no"
  | "acknowledge"
  | "select_one"
  | "select_multiple"
  | "likert"
  | "semantic_differential"
  | "ranking"
  | "constant_sum"
  | "matrix_single"
  | "matrix_multiple"
  | "date"
  | "time"
  | "datetime"
  | "geopoint"
  | "geotrace"
  | "geoshape"
  | "image"
  | "audio"
  | "video"
  | "file"
  | "signature"
  | "barcode"
  | "currency"
  | "repeat"
  | "calculate"
  | "note"
  | "hidden"
  | "section_break";

export interface Question {
  id: string;
  code: string;
  order: number;
  type: QuestionType;
  label: LocalizedText;
  hint?: LocalizedText;
  required?: boolean | string;
  required_message?: LocalizedText;
  relevant?: string | null;
  constraint?: string | null;
  constraint_message?: LocalizedText | null;
  default?: unknown;
  calculation?: string | null;
  read_only?: boolean;
  is_pii?: boolean;
  config?: Record<string, unknown>;
  /** Only present when type === "repeat". */
  questions?: Question[];
}

export interface Section {
  id: string;
  code: string;
  order: number;
  title: LocalizedText;
  description?: LocalizedText;
  relevant?: string | null;
  questions: Question[];
}

export interface FormPackageSettings {
  anonymous: boolean;
  consent_required: boolean;
  consent_notice_id?: string | null;
  consent_methods: string[];
  one_response_per_respondent: boolean;
  require_gps: boolean;
  gps_accuracy_threshold_m: number;
  allow_draft: boolean;
  auto_approve: boolean;
  show_progress: boolean;
  allow_back_navigation: boolean;
  randomize_sections: boolean;
  estimated_minutes: number;
  close_grace_days: number;
}

export interface FormPackage {
  schema_version: string;
  survey_id: string;
  version_id: string;
  version_number: number;
  published_at: string;
  title: string;
  description?: string;
  category: { id: string; code: string; label: string };
  instructions?: string;
  settings: FormPackageSettings;
  languages: { default: string; available: string[] };
  choice_lists: ChoiceList[];
  sections: Section[];
  metadata_questions: Array<{ code: string; type: string; source: string }>;
}

// ---------------------------------------------------------------------
// Answers / submission — the device -> server document
// ---------------------------------------------------------------------

export type AnswerValue =
  | string
  | number
  | boolean
  | string[]
  | Record<string, unknown>
  | Array<Record<string, unknown>>
  | null;

export type AnswerMap = Record<string, AnswerValue>;

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy_m: number;
  captured_at: string;
}

export interface PendingAttachment {
  ref: string;
  question_code: string;
  kind: "image" | "audio" | "video" | "file" | "signature";
  filename: string;
  size_bytes: number;
  checksum: string;
  captured_at: string;
  /** Local device URI — never sent to the server, stripped before the
   * sync batch item is built. Kept here so the outbox can find the file
   * to upload once the parent response has synced. */
  local_uri: string;
}

export interface SubmissionPayload {
  client_ref_id: string;
  survey_id: string;
  survey_version_id: string;
  assignment_id: string;
  respondent?: { id: string };
  started_at: string;
  submitted_at: string;
  duration_seconds: number;
  gps?: GeoPoint;
  device: { id: string; app_version: string; os: string };
  was_offline: boolean;
  answers: AnswerMap;
  attachments: Array<Omit<PendingAttachment, "local_uri">>;
}

// ---------------------------------------------------------------------
// Responses — GET /api/responses/ (read-only; scoped server-side to the
// signed-in agent's own responses). Field names match
// apps/responses/serializers.py exactly.
// ---------------------------------------------------------------------

export type ResponseStatus = "submitted" | "under_review" | "approved" | "rejected";

export interface ResponseListItem {
  id: string;
  response_code: string;
  survey: string; // survey id
  survey_title: string;
  category_label: string;
  survey_version: string; // version id
  respondent: string | null; // respondent id
  respondent_name: string | null;
  collected_by_id: string;
  status: ResponseStatus;
  submitted_at: string;
  duration_seconds: number;
  flag_count: number;
  was_offline: boolean;
}

export interface ResponseReview {
  id: string;
  action: "approve" | "reject" | "reopen";
  reviewer_id: string;
  reason_code: string;
  notes: string;
  created_at: string;
}

export interface ResponseAttachmentInfo {
  id: string;
  question_code: string;
  kind: string;
  filename: string;
  size_bytes: number;
  captured_at: string | null;
  url: string | null;
}

export interface ResponseFlag {
  id: string;
  code: string;
  severity: string;
  message: string;
  triggering_values: unknown;
  created_at: string;
}

export interface ResponseDetail extends ResponseListItem {
  answers: AnswerMap;
  started_at: string;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy_m: number | null;
  device_id: string;
  app_version: string;
  is_edited: boolean;
  attachments: ResponseAttachmentInfo[];
  reviews: ResponseReview[];
  flags: ResponseFlag[];
}

/** The most recent reject review, if any — My Work shows its reason. */
export function latestRejection(detail: Pick<ResponseDetail, "reviews">): ResponseReview | null {
  return detail.reviews.find((r) => r.action === "reject") ?? null;
}
