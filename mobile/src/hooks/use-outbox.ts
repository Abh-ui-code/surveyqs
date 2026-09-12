import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { list, onOutboxChange, resolveConflict, remove, retryItem } from "@/lib/outbox";

const OUTBOX_KEY = ["outbox"] as const;

export function useOutbox() {
  const qc = useQueryClient();
  useEffect(() => onOutboxChange(() => void qc.invalidateQueries({ queryKey: OUTBOX_KEY })), [qc]);
  return useQuery({ queryKey: OUTBOX_KEY, queryFn: list });
}

export { resolveConflict, remove as removeOutboxItem, retryItem };
