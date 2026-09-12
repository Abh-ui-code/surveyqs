import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { RespondentLookupResult } from "@surveyqs/shared";

import { api } from "@/lib/api";
import { useIsAuthActive } from "@/lib/auth-store";

/**
 * Pulls the lightweight dedupe slice (docs/api/SYNC_API.md's
 * `GET /sync/respondents/`) once and caches it — this is meant to be an
 * offline-first local index, not a live per-keystroke lookup, since the
 * whole point is that a village with no signal can still catch a
 * duplicate. RespondentCaptureScreen matches against it locally.
 */
export function useRespondentIndex() {
  const active = useIsAuthActive();
  return useQuery({
    queryKey: ["sync", "respondents"],
    queryFn: async () => {
      const res = await api.get<{ respondents: RespondentLookupResult[]; next_cursor: string | null }>("/sync/respondents/");
      return res.respondents;
    },
    enabled: active,
    staleTime: 5 * 60_000,
  });
}

const normalize = (phone: string) => phone.replace(/[^0-9]/g, "").slice(-10);

export function useRespondentMatch(phone: string): RespondentLookupResult | null {
  const { data } = useRespondentIndex();
  return useMemo(() => {
    if (!data || normalize(phone).length < 6) return null;
    const target = normalize(phone);
    return data.find((r) => r.phone && normalize(r.phone) === target) ?? null;
  }, [data, phone]);
}
