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

/** Full answers + review history for one response — fetched on demand
 * when the agent taps "Edit and resubmit" on a rejected one. */
export function useResponseDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["responses", "detail", id],
    queryFn: () => api.get<ResponseDetail>(`/responses/${id}/`),
    enabled: Boolean(id),
  });
}
