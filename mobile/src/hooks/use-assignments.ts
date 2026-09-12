import { useQuery } from "@tanstack/react-query";
import type { FormPackage, SyncAssignment } from "@surveyqs/shared";

import { api } from "@/lib/api";
import { useIsAuthActive } from "@/lib/auth-store";

export function useAssignments() {
  const active = useIsAuthActive();
  return useQuery({
    queryKey: ["sync", "assignments"],
    queryFn: async () => {
      const res = await api.get<{ assignments: SyncAssignment[] }>("/sync/assignments/");
      return res.assignments;
    },
    enabled: active,
    staleTime: 30_000,
  });
}

/** The frozen form package for one survey version — cached hard by
 * TanStack Query (a version is immutable, per FORM_SCHEMA.md) so a screen
 * revisited later never re-downloads it. */
export function useFormPackage(versionId: string | undefined) {
  return useQuery({
    queryKey: ["sync", "package", versionId],
    queryFn: () => api.get<FormPackage>(`/sync/packages/${versionId}/`),
    enabled: Boolean(versionId),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
