"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { reportKeys } from "@/lib/query-keys";

export interface DashboardData {
  total_responses: number;
  by_category: Array<{ label: string; count: number }>;
  by_status: Array<{ status: string; count: number }>;
  flagged_count: number;
}

export function useDashboard() {
  return useQuery({
    queryKey: reportKeys.dashboard({}),
    queryFn: () => api.get<DashboardData>("/reports/dashboard/"),
    staleTime: 60_000,
  });
}
