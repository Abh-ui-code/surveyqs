import { useQuery } from "@tanstack/react-query";
import type { PaginatedResponse, ResponseDetail, ResponseListItem } from "@surveyqs/shared";

import { api } from "@/lib/api";
import { useIsAuthActive } from "@/lib/auth-store";

/** My Work — GET /api/responses/ is scoped server-side to the signed-in
 * agent's own responses (apps/responses/scoping.py), so no extra filter
 * is needed here beyond ordering. */
export function useMyResponses() {
  const active = useIsAuthActive();
  return useQuery({
    queryKey: ["responses", "mine"],
    queryFn: () => api.list<ResponseListItem>("/responses/", { ordering: "-submitted_at" }),
    enabled: active,
    staleTime: 15_000,
    select: (res: PaginatedResponse<ResponseListItem>) => res.results,
  });
}

/** Full answers, attachments and flags for one response. */
export function useResponseDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["responses", "detail", id],
    queryFn: () => api.get<ResponseDetail>(`/responses/${id}/`),
    enabled: Boolean(id),
  });
}

export interface RespondentDetail {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  /** Answers to this survey's admin-selected demographic questions
   * (FormPackage.demographic_questions), keyed by question code. */
  custom_fields: Record<string, unknown>;
}

/** The respondent record behind a response, for its demographic answers --
 * `/responses/{id}/` only carries the id + display name, not
 * `custom_fields`, so the detail screen fetches it separately. */
export function useRespondentDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: ["respondents", "detail", id],
    queryFn: () => api.get<RespondentDetail>(`/respondents/${id}/`),
    enabled: Boolean(id),
  });
}
