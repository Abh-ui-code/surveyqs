/**
 * CRUD hooks over drafts-store.ts, wired through TanStack Query so every
 * screen that lists or edits a draft stays in sync without its own
 * refetch logic — the same create/read/update/delete surface the rest of
 * the app uses for server data, just backed by AsyncStorage instead of
 * the API.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createDraft,
  deleteDraft,
  getDraft,
  listDrafts,
  updateDraft,
  type CreateDraftInput,
  type InterviewDraft,
} from "@/lib/drafts-store";

const DRAFTS_KEY = ["drafts"] as const;

export function useDrafts() {
  return useQuery({ queryKey: DRAFTS_KEY, queryFn: listDrafts });
}

export function useDraft(id: string | undefined) {
  return useQuery({
    queryKey: [...DRAFTS_KEY, id],
    queryFn: () => getDraft(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDraftInput) => createDraft(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: DRAFTS_KEY }),
  });
}

export function useUpdateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; patch: Partial<Omit<InterviewDraft, "id" | "userId">> }) =>
      updateDraft(args.id, args.patch),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: [...DRAFTS_KEY, vars.id] });
      void qc.invalidateQueries({ queryKey: DRAFTS_KEY });
    },
  });
}

export function useDeleteDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDraft(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: DRAFTS_KEY }),
  });
}
