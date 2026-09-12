"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { authKeys } from "@/lib/query-keys";
import { getTenantFromHost } from "@/lib/tenant";

/**
 * Whether the app should currently be running authenticated queries. Flipped
 * to `false` the instant a sign-out starts (in `onMutate`, synchronously --
 * before the logout request, `qc.clear()`, or the redirect) so every mounted
 * `useMe`/`useMyPermissions` observer stops being "active" before the cache
 * is wiped. Without this, clearing the cache while those queries are still
 * enabled makes them refetch with no token, 401, and trigger a second, hard
 * redirect that races the soft one already in flight -- the reported
 * sign-out "flash".
 */
let authActive = typeof window !== "undefined" ? Boolean(window.localStorage.getItem("surveyqs.access")) : true;
const authActiveListeners = new Set<() => void>();

function setAuthActive(value: boolean) {
  authActive = value;
  authActiveListeners.forEach((listener) => listener());
}

function subscribeAuthActive(listener: () => void) {
  authActiveListeners.add(listener);
  return () => authActiveListeners.delete(listener);
}

export function useIsAuthActive(): boolean {
  return useSyncExternalStore(
    subscribeAuthActive,
    () => authActive,
    () => authActive,
  );
}

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
  const isAuthActive = useIsAuthActive();
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: () => api.get<CurrentUser>("/auth/me/"),
    staleTime: 60_000,
    enabled: isAuthActive && (options?.enabled ?? true),
  });
}

export function useLogin() {
  const qc = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const data = await api.post<LoginResponse>("/auth/login/", { email, password });
      if (data.two_factor_required) {
        throw new Error("Two-factor authentication isn't supported in this app yet. Please contact your administrator.");
      }
      return data;
    },
    onSuccess: (data) => {
      qc.clear();
      window.localStorage.setItem("surveyqs.access", data.access);
      window.localStorage.setItem("surveyqs.refresh", data.refresh);
      setAuthActive(true);
      router.push(resolvePostLoginPath(data.user));
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => api.post("/auth/logout/", { refresh: window.localStorage.getItem("surveyqs.refresh") }),
    onMutate: () => {
      // Synchronous, before the request fires: stop every mounted auth
      // query from being active so nothing refetches once the cache below
      // is cleared.
      setAuthActive(false);
    },
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
