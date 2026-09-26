"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { demographicQuestionKeys } from "@/lib/query-keys";

export interface DemographicQuestionChoice {
  value: string;
  label: Record<string, string>;
  order: number;
}

export interface DemographicQuestion {
  id: string;
  code: string;
  type: string;
  label: Record<string, string>;
  hint: Record<string, string>;
  is_required: string;
  is_pii: boolean;
  constraint: string;
  constraint_message: Record<string, string>;
  config: Record<string, unknown>;
  choices: DemographicQuestionChoice[];
}

export interface DemographicQuestionInput {
  code: string;
  type: string;
  label: Record<string, string>;
  hint?: Record<string, string>;
  is_required?: string;
  is_pii?: boolean;
  constraint?: string;
  constraint_message?: Record<string, string>;
  config?: Record<string, unknown>;
  choices?: DemographicQuestionChoice[];
}

export function useDemographicQuestions(params: { search?: string } = {}) {
  return useQuery({
    queryKey: demographicQuestionKeys.list(params),
    queryFn: () => api.list<DemographicQuestion>("/demographic-questions/", params),
    placeholderData: (prev) => prev,
  });
}

export function useCreateDemographicQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DemographicQuestionInput) =>
      api.post<DemographicQuestion>("/demographic-questions/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["demographic-questions"] }),
  });
}

export function useUpdateDemographicQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DemographicQuestionInput }) =>
      api.patch<DemographicQuestion>(`/demographic-questions/${id}/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["demographic-questions"] }),
  });
}

export function useDeleteDemographicQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/demographic-questions/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["demographic-questions"] }),
  });
}
