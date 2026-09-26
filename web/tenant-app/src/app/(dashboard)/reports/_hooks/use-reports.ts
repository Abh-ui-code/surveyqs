"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ExportFilters {
  survey?: string;
  agent?: string;
  date_from?: string;
  date_to?: string;
}

function filenameFromContentDisposition(value: string | undefined): string | undefined {
  return value ? /filename="?([^"]+)"?/.exec(value)?.[1] : undefined;
}

/** Downloads the .xlsx from `/reports/export/` and saves it -- backs both
 * the Master Report (called with `{}`) and the Filtered Report (called
 * with whatever the admin picked). One backend endpoint, one query, per
 * backend/apps/reports/services.py. */
export function useExportResponses() {
  return useMutation({
    mutationFn: async (filters: ExportFilters) => {
      const { blob, headers } = await api.getBlob("/reports/export/", { ...filters });
      const filename = filenameFromContentDisposition(headers["content-disposition"]) ?? "responses.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  });
}
