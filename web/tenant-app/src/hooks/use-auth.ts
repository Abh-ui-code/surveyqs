"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { authKeys } from "@/lib/query-keys";
import { getTenantFromHost } from "@/lib/tenant";

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  is_superadmin: boolean;
  tenant: { name: string; subdomain: string } | null;
}

interface LoginResponse {
  access: string;
  refresh: string;
  user: { id: string; email: string; full_name: string; is_superadmin: boolean };
  two_factor_required?: boolean;
  memberships?: Array<{ tenant_id: string; name: string; subdomain: string; role_code: string }>;
}

/** Where a signed-in user lands after login. */
function resolvePostLoginPath(user: { is_superadmin: boolean }): string {
  if (getTenantFromHost()) return "/";
  if (user.is_superadmin) return "/platform";
  return "/hub";
}

export function useMe(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: () => api.get<CurrentUser>("/auth/me/"),
    staleTime: 60_000,
    enabled: options?.enabled,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.post<LoginResponse>("/auth/login/", { email, password }),
    onSuccess: (data) => {
      if (data.two_factor_required) return; // not yet implemented in this build
      qc.clear();
      window.localStorage.setItem("surveyqs.access", data.access);
      window.localStorage.setItem("surveyqs.refresh", data.refresh);
      router.push(resolvePostLoginPath(data.user));
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => api.post("/auth/logout/", { refresh: window.localStorage.getItem("surveyqs.refresh") }),
    onSettled: () => {
      window.localStorage.removeItem("surveyqs.access");
      window.localStorage.removeItem("surveyqs.refresh");
      qc.clear();
      router.push("/login");
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => api.post("/auth/forgot-password/", { email }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (full_name: string) => api.patch<CurrentUser>("/auth/me/", { full_name }),
    onSuccess: (data) => qc.setQueryData(authKeys.me(), data),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      api.post("/auth/change-password/", data),
  });
}
