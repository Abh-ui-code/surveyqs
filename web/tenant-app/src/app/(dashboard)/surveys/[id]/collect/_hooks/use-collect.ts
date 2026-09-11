"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { assignmentKeys, consentKeys, respondentKeys, surveyKeys } from "@/lib/query-keys";

export interface ChoiceDef {
  value: string;
  label: Record<string, string>;
  order: number;
  attrs: Record<string, unknown>;
  active: boolean;
}

export interface ChoiceListDef {
  name: string;
  attributes: Record<string, unknown>;
  choices: ChoiceDef[];
}

export interface SchemaQuestion {
  id: string;
  code: string;
  order: number;
  type: string;
  label: Record<string, string>;
  hint: Record<string, string>;
  required: boolean | string;
  relevant: string | null;
  constraint: string | null;
  constraint_message: Record<string, string> | null;
  config: Record<string, unknown> & { choice_list?: string; min?: number; max?: number; decimal_places?: number };
  questions?: SchemaQuestion[];
}

export interface SchemaSection {
  id: string;
  code: string;
  order: number;
  title: Record<string, string>;
  description: Record<string, string>;
  questions: SchemaQuestion[];
}

export interface FormPackage {
  schema_version: string;
  survey_id: string;
  version_number: number;
  title: string;
  description: string;
  instructions: string;
  settings: Record<string, unknown>;
  choice_lists: ChoiceListDef[];
  sections: SchemaSection[];
}

export interface AssignmentSummary {
  id: string;
  target_count: number | null;
  status: string;
  progress: { submitted: number; target: number | null };
}

/**
 * An agent needs an active assignment to submit -- the server enforces
 * this too (see backend apps/responses/services.py::_assert_active_assignment).
 * This calls `/assignments/mine/`, not the plain `/assignments/` list:
 * that list is scoped for *management* visibility (an admin or supervisor
 * sees every assignment in the tenant), so it would report "yes" for any
 * survey regardless of whether this specific user is the one assigned to
 * it, and this check exists precisely to catch that before submission does.
 * Returns a plain array, like the `versions` action -- not every custom
 * `@action` on a ModelViewSet uses the paginated list shape.
 */
export function useMyActiveAssignment(surveyId: string) {
  return useQuery({
    queryKey: assignmentKeys.list({ survey: surveyId, mine: true }),
    queryFn: () => api.get<AssignmentSummary[]>("/assignments/mine/", { survey: surveyId }),
    enabled: !!surveyId,
  });
}

/** The `versions` action returns a plain array, not the paginated
 * `{results: [...]}` shape most list endpoints use -- see
 * backend/apps/surveys/views.py::SurveyViewSet.versions. */
export function usePublishedVersions(surveyId: string) {
  return useQuery({
    queryKey: surveyKeys.versions(surveyId),
    queryFn: () => api.get<{ id: string; version_number: number }[]>(`/surveys/${surveyId}/versions/`),
    enabled: !!surveyId,
  });
}

export function useVersionSchema(surveyId: string, versionNumber: number | undefined) {
  return useQuery({
    queryKey: surveyKeys.versionSchema(surveyId, versionNumber ?? -1),
    queryFn: () => api.get<FormPackage>(`/surveys/${surveyId}/versions/${versionNumber}/`),
    enabled: !!surveyId && versionNumber !== undefined,
  });
}

export interface Respondent {
  id: string;
  full_name: string;
  phone: string;
  alt_phone: string;
  email: string;
  gender: string;
  date_of_birth: string | null;
  identity_number: string;
  address: string;
  custom_fields: Record<string, unknown>;
  consent_status: string;
  created_at: string;
}

export function useSearchRespondents(query: string) {
  return useQuery({
    queryKey: respondentKeys.list({ search: query }),
    queryFn: () => api.list<Respondent>("/respondents/", { search: query }),
    enabled: query.trim().length >= 2,
    placeholderData: (prev) => prev,
  });
}

export function useCreateRespondent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      full_name: string;
      phone?: string;
      email?: string;
      gender?: string;
      address?: string;
    }) => api.post<Respondent>("/respondents/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["respondents"] }),
  });
}

export interface ConsentNotice {
  id: string;
  version: number;
  language: string;
  text: string;
  is_active: boolean;
}

export function useConsentNotices() {
  return useQuery({
    queryKey: consentKeys.notices(),
    queryFn: () => api.list<ConsentNotice>("/consent-notices/"),
  });
}

export function useCaptureConsent() {
  return useMutation({
    mutationFn: (data: { respondent: string; notice: string; method: string; granted_at?: string }) =>
      api.post("/consents/", data),
  });
}

export interface SubmitResponsePayload {
  survey_id: string;
  survey_version_id: string;
  assignment_id?: string;
  respondent?: { id: string };
  started_at: string;
  submitted_at: string;
  answers: Record<string, unknown>;
  was_offline: boolean;
}

interface SyncBatchItemResult {
  ref: string;
  status: "created" | "updated" | "conflict" | "rejected" | "skipped";
  id?: string;
  response_code?: string;
  warnings?: unknown[];
  code?: string;
  detail?: string;
  errors?: { question_code: string; code: string; message: string }[];
}

export class SubmissionRejectedError extends Error {
  code: string;
  fieldErrors: { question_code: string; message: string }[];

  constructor(code: string, message: string, fieldErrors: { question_code: string; message: string }[]) {
    super(message);
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

/** Goes through the same `response.submit` sync pipeline the mobile app
 * uses (apps/responses/services.py::submit_response) -- there is no
 * separate "web" submission path, so validation/consent/assignment rules
 * are enforced identically for both clients. */
export function useSubmitResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SubmitResponsePayload) => {
      const res = await api.post<{ results: SyncBatchItemResult[] }>("/sync/batch/", {
        items: [{ ref: "r1", kind: "response.submit", payload }],
      });
      const result = res.results[0];
      if (result.status === "rejected") {
        throw new SubmissionRejectedError(
          result.code ?? "rejected",
          result.detail ?? "Submission was rejected.",
          (result.errors ?? []).map((e) => ({ question_code: e.question_code, message: e.message })),
        );
      }
      if (result.status === "conflict") {
        throw new SubmissionRejectedError(result.code ?? "conflict", result.detail ?? "Submission conflict.", []);
      }
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["responses"] });
      qc.invalidateQueries({ queryKey: ["surveys"] });
    },
  });
}

export function useUploadAttachment() {
  return useMutation({
    mutationFn: ({ responseId, questionCode, file }: { responseId: string; questionCode: string; file: File }) => {
      const form = new FormData();
      form.append("response_id", responseId);
      form.append("question_code", questionCode);
      form.append("kind", "image");
      form.append("file", file);
      return api.postMultipart<{ id: string; status: string }>("/sync/attachments/", form);
    },
  });
}
