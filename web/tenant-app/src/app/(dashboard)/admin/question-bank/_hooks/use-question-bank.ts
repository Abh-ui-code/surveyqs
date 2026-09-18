"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { questionBankCategoryKeys, questionBankKeys } from "@/lib/query-keys";

export interface QuestionBankCategory {
  id: string;
  name: string;
}

export function useQuestionBankCategories() {
  return useQuery({
    queryKey: questionBankCategoryKeys.list(),
    queryFn: () => api.list<QuestionBankCategory>("/question-bank/categories/"),
  });
}

export function useCreateQuestionBankCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<QuestionBankCategory>("/question-bank/categories/", { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionBankCategoryKeys.list() }),
  });
}

export interface BankQuestionChoice {
  value: string;
  label: Record<string, string>;
  order: number;
}

export interface BankQuestion {
  id: string;
  category: string | null;
  code: string;
  type: string;
  label: Record<string, string>;
  hint: Record<string, string>;
  is_required: string;
  is_pii: boolean;
  constraint: string;
  constraint_message: Record<string, string>;
  config: Record<string, unknown>;
  choices: BankQuestionChoice[];
}

export interface BankQuestionInput {
  category: string | null;
  code: string;
  type: string;
  label: Record<string, string>;
  hint?: Record<string, string>;
  is_required?: string;
  is_pii?: boolean;
  constraint?: string;
  constraint_message?: Record<string, string>;
  config?: Record<string, unknown>;
  choices?: BankQuestionChoice[];
}

export function useBankQuestions(params: { category?: string; search?: string }) {
  return useQuery({
    queryKey: questionBankKeys.list(params),
    queryFn: () => api.list<BankQuestion>("/question-bank/questions/", params),
    placeholderData: (prev) => prev,
  });
}

export function useCreateBankQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BankQuestionInput) => api.post<BankQuestion>("/question-bank/questions/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["question-bank"] }),
  });
}

export function useUpdateBankQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BankQuestionInput }) =>
      api.patch<BankQuestion>(`/question-bank/questions/${id}/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["question-bank"] }),
  });
}

export function useDeleteBankQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/question-bank/questions/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["question-bank"] }),
  });
}
