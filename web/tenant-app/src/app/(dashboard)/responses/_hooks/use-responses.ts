"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { responseKeys } from "@/lib/query-keys";

export interface ResponseRow {
  id: string;
  response_code: string;
  survey: string;
  survey_title: string;
  category_label: string;
  respondent: string | null;
  respondent_name: string | null;
  collected_by_id: string;
  status: string;
  submitted_at: string;
  duration_seconds: number | null;
  flag_count: number;
  was_offline: boolean;
}

export interface ResponseDetail extends ResponseRow {
  answers: Record<string, unknown>;
  started_at: string;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy_m: number | null;
  device_id: string;
  app_version: string;
  is_edited: boolean;
  attachments: Array<{ id: string; question_code: string; kind: string; filename: string; url: string | null }>;
  flags: Array<{ id: string; code: string; severity: string; message: string }>;
  reviews: Array<{ id: string; action: string; reason_code: string; notes: string; created_at: string }>;
}

export interface ResponseFilters {
  survey?: string;
  status?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export function useResponses(params: ResponseFilters) {
  return useQuery({
    queryKey: responseKeys.list(params),
    queryFn: () => api.list<ResponseRow>("/responses/", params),
    placeholderData: (prev) => prev,
  });
}

export function useResponse(id: string) {
  return useQuery({
    queryKey: responseKeys.detail(id),
    queryFn: () => api.get<ResponseDetail>(`/responses/${id}/`),
    enabled: !!id,
  });
}

export function useApproveResponse(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/responses/${id}/approve/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: responseKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ["responses"] });
    },
  });
}

export function useRejectResponse(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { reason_code: string; notes?: string }) => api.post(`/responses/${id}/reject/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: responseKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ["responses"] });
    },
  });
}
