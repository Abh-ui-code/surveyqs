"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { respondentKeys } from "@/lib/query-keys";

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
  geography_node_id: string | null;
  custom_fields: Record<string, unknown>;
  consent_status: "none" | "granted" | "withdrawn";
  is_anonymised: boolean;
  client_ref_id: string | null;
  created_at: string;
}

export interface RespondentFilters {
  search?: string;
  page?: number;
  page_size?: number;
}

export function useRespondents(params: RespondentFilters) {
  return useQuery({
    queryKey: respondentKeys.list(params),
    queryFn: () => api.list<Respondent>("/respondents/", params),
    placeholderData: (prev) => prev,
  });
}

export function useRespondent(id: string) {
  return useQuery({
    queryKey: respondentKeys.detail(id),
    queryFn: () => api.get<Respondent>(`/respondents/${id}/`),
    enabled: !!id,
  });
}

export function useWithdrawRespondentConsent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Respondent>(`/respondents/${id}/withdraw-consent/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: respondentKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ["respondents"] });
    },
  });
}

export function useAnonymiseRespondent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Respondent>(`/respondents/${id}/anonymise/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: respondentKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ["respondents"] });
    },
  });
}
