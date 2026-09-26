"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { assignmentKeys, categoryKeys, consentKeys, surveyKeys } from "@/lib/query-keys";

export interface SurveyCategory {
  id: string;
  code: string;
  label: string;
  survey_count: number;
}

export interface SurveyRow {
  id: string;
  title: string;
  description: string;
  status: "draft" | "published" | "paused" | "closed" | "archived";
  category: SurveyCategory;
  question_count: number;
  response_count: number;
  created_at: string;
  // Present on the detail response (GET /surveys/:id/), absent on list rows.
  instructions?: string;
  settings?: {
    consent_required?: boolean;
    consent_notice_id?: string;
    anonymous?: boolean;
  } & Record<string, unknown>;
}

export interface Question {
  id: string;
  section: string;
  code: string;
  type: string;
  order: number;
  label: Record<string, string>;
  is_required: string;
  relevant: string;
  constraint: string;
  constraint_message: Record<string, string>;
  choice_list: string | null;
  config: Record<string, unknown>;
}

export interface Section {
  id: string;
  code: string;
  order: number;
  title: Record<string, string>;
  questions: Question[];
}

export interface Choice {
  id: string;
  value: string;
  label: Record<string, string>;
  order: number;
  attrs: Record<string, unknown>;
  is_active: boolean;
}

export interface ChoiceListItem {
  id: string;
  name: string;
  attributes: unknown[];
  choices: Choice[];
}

export interface SurveyDemographicFieldRow {
  id: string;
  code: string;
  type: string;
  order: number;
  label: Record<string, string>;
  hint: Record<string, string>;
  is_required: string;
  is_pii: boolean;
  constraint: string;
  constraint_message: Record<string, string>;
  choice_list: string | null;
  config: Record<string, unknown>;
}

export interface SurveyDraft {
  id: string;
  version_number: number;
  status: string;
  sections: Section[];
  choice_lists: ChoiceListItem[];
  demographic_fields: SurveyDemographicFieldRow[];
}

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.list(),
    queryFn: () => api.list<SurveyCategory>("/categories/"),
    staleTime: 5 * 60_000,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { code: string; label: string }) => api.post("/categories/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoryKeys.list() }),
  });
}

export function useSurveys(params: { category?: string; status?: string; search?: string }) {
  return useQuery({
    queryKey: surveyKeys.list(params),
    queryFn: () => api.list<SurveyRow>("/surveys/", params),
    placeholderData: (prev) => prev,
  });
}

export function useSurvey(id: string) {
  return useQuery({
    queryKey: surveyKeys.detail(id),
    queryFn: () => api.get<SurveyRow>(`/surveys/${id}/`),
    enabled: !!id,
  });
}

/** Configures this survey's consent requirement -- see
 * apps/surveys/services.py::set_survey_consent. Passing `required: false`
 * turns the gate off without touching any already-authored notice text;
 * passing `required: true` (re-)writes it, versioning it server-side when
 * the survey is already published. A `file` (PDF/DOCX/TXT) takes priority
 * over `text` server-side -- its extracted text becomes the notice. */
export function useSetSurveyConsent(surveyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { required: boolean; text?: string; language?: string; file?: File }) => {
      if (!data.file) {
        return api.post<SurveyRow>(`/surveys/${surveyId}/consent-notice/`, {
          required: data.required,
          text: data.text ?? "",
          language: data.language ?? "en",
        });
      }
      const form = new FormData();
      form.append("required", String(data.required));
      form.append("text", data.text ?? "");
      form.append("language", data.language ?? "en");
      form.append("file", data.file);
      return api.postMultipart<SurveyRow>(`/surveys/${surveyId}/consent-notice/`, form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: surveyKeys.detail(surveyId) });
      qc.invalidateQueries({ queryKey: consentKeys.notices() });
    },
  });
}

export function useSurveyDraft(id: string) {
  return useQuery({
    queryKey: surveyKeys.draft(id),
    queryFn: () => api.get<SurveyDraft>(`/surveys/${id}/draft/`),
    enabled: !!id,
  });
}

export function useCreateSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; category: string; description?: string; instructions?: string }) =>
      api.post<SurveyRow>("/surveys/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["surveys"] }),
  });
}

export function useCreateSection(surveyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { code: string; title: Record<string, string> }) =>
      api.post<Section>(`/surveys/${surveyId}/draft/sections/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: surveyKeys.draft(surveyId) }),
  });
}

export function useCreateQuestion(surveyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      section: string;
      code: string;
      type: string;
      label: Record<string, string>;
      is_required?: string;
      relevant?: string;
      choice_list?: string | null;
      config?: Record<string, unknown>;
    }) => api.post<Question>(`/surveys/${surveyId}/draft/questions/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: surveyKeys.draft(surveyId) }),
  });
}

export function useCreateQuestionFromBank(surveyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { bank_question_id: string; section_id: string }) =>
      api.post<Question>(`/surveys/${surveyId}/draft/questions/from-bank/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: surveyKeys.draft(surveyId) }),
  });
}

export function useUpdateQuestion(surveyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      questionId,
      data,
    }: {
      questionId: string;
      data: {
        code: string;
        type: string;
        label: Record<string, string>;
        is_required?: string;
        relevant?: string;
        choice_list?: string | null;
        config?: Record<string, unknown>;
      };
    }) => api.patch<Question>(`/surveys/${surveyId}/draft/questions/${questionId}/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: surveyKeys.draft(surveyId) }),
  });
}

export function useDeleteQuestion(surveyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) => api.delete(`/surveys/${surveyId}/draft/questions/${questionId}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: surveyKeys.draft(surveyId) }),
  });
}

/** Persists a drag-reordered section: the full ordered list of that
 * section's question ids. The server re-applies branch adjacency on top
 * of whatever order this sends (apps/surveys/views.py::QuestionViewSet.
 * reorder), so a drop that would split a branch from its parent
 * self-corrects there too -- this call doesn't need to get that right on
 * its own, just reflect what self-corrected on the client. */
export function useReorderQuestions(surveyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionIds: string[]) =>
      api.post(`/surveys/${surveyId}/draft/questions/reorder/`, { question_ids: questionIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: surveyKeys.draft(surveyId) }),
  });
}

export function useCreateChoiceList(surveyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      choices: { value: string; label: Record<string, string>; order: number }[];
    }) => api.post<ChoiceListItem>(`/surveys/${surveyId}/draft/choice-lists/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: surveyKeys.draft(surveyId) }),
  });
}

export function useUpdateChoiceList(surveyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      choiceListId,
      data,
    }: {
      choiceListId: string;
      data: { choices: { value: string; label: Record<string, string>; order: number }[] };
    }) => api.patch<ChoiceListItem>(`/surveys/${surveyId}/draft/choice-lists/${choiceListId}/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: surveyKeys.draft(surveyId) }),
  });
}

export interface ValidationIssue {
  code: string;
  message: string;
  location?: string;
}

export function useValidateSurvey(surveyId: string) {
  return useMutation({
    mutationFn: () =>
      api.post<{ valid: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[] }>(
        `/surveys/${surveyId}/validate/`,
      ),
  });
}

export function usePublishSurvey(surveyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (change_note: string) =>
      api.post<{ version_number: number }>(`/surveys/${surveyId}/publish/`, { change_note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: surveyKeys.detail(surveyId) });
      qc.invalidateQueries({ queryKey: surveyKeys.draft(surveyId) });
      qc.invalidateQueries({ queryKey: ["surveys"] });
    },
  });
}

// --- Demographic fields -----------------------------------------------------
// The Respondent step's counterpart to Section/Question -- a survey selects
// which admin-defined demographic questions (apps.respondents
// .DemographicQuestion, managed under Admin -> Demographic questions) apply
// to it. Mirrors useCreateQuestionFromBank/useReorderQuestions exactly, one
// level up (no section).

export function useAddDemographicFieldFromBank(surveyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (demographic_question_id: string) =>
      api.post<SurveyDemographicFieldRow>(`/surveys/${surveyId}/draft/demographic-fields/from-bank/`, {
        demographic_question_id,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: surveyKeys.draft(surveyId) }),
  });
}

export function useReorderDemographicFields(surveyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fieldIds: string[]) =>
      api.post(`/surveys/${surveyId}/draft/demographic-fields/reorder/`, { field_ids: fieldIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: surveyKeys.draft(surveyId) }),
  });
}

export function useRemoveDemographicField(surveyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fieldId: string) => api.delete(`/surveys/${surveyId}/draft/demographic-fields/${fieldId}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: surveyKeys.draft(surveyId) }),
  });
}

// --- Agent assignment -----------------------------------------------------
// An agent can hold assignments on any number of surveys at once (see
// backend apps/assignments/models.py -- the uniqueness constraint is
// per-survey-per-agent, not per-agent). This is the "assign an *existing*
// agent" path: unlike `useAssignSurveysToUser` in admin/_hooks/use-admin.ts,
// it doesn't go through the invite-a-new-user endpoint, so it works for
// agents who already hold other surveys.

export interface SurveyAssignmentRow {
  id: string;
  assignee_type: "user" | "team";
  assignee_user_id: string | null;
}

export function useSurveyAssignments(surveyId: string) {
  return useQuery({
    queryKey: assignmentKeys.list({ survey: surveyId, assignee_type: "user", status: "active" }),
    queryFn: () =>
      api.list<SurveyAssignmentRow>("/assignments/", { survey: surveyId, assignee_type: "user", status: "active" }),
    enabled: !!surveyId,
  });
}

export function useAssignAgents(surveyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) =>
      api.post("/assignments/", { survey: surveyId, assignees: userIds.map((id) => ({ type: "user", id })) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments"] }),
  });
}

export function useRevokeAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => api.post(`/assignments/${assignmentId}/revoke/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments"] }),
  });
}
