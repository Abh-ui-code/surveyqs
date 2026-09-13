"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { categoryKeys, surveyKeys } from "@/lib/query-keys";

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
  settings?: { consent_required?: boolean; anonymous?: boolean; auto_approve?: boolean } & Record<string, unknown>;
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

export interface SurveyDraft {
  id: string;
  version_number: number;
  status: string;
  sections: Section[];
  choice_lists: ChoiceListItem[];
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
