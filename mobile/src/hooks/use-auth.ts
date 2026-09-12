import * as LocalAuthentication from "expo-local-authentication";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CurrentUser, MyPermissions, SyncBootstrap } from "@surveyqs/shared";

import { api, clearSession, persistSession, persistUserId } from "@/lib/api";
import { setAuthActive, useIsAuthActive } from "@/lib/auth-store";
import { startOutboxMonitor } from "@/lib/outbox";

interface LoginResponse {
  access: string;
  refresh: string;
  user: { id: string; email: string; full_name: string; is_superadmin: boolean };
  two_factor_required?: boolean;
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { email: string; password: string }) => {
      const data = await api.post<LoginResponse>("/auth/login/", vars);
      if (data.two_factor_required) {
        throw new Error("Two-factor authentication isn't supported in this app yet. Please contact your administrator.");
      }
      return data;
    },
    onSuccess: (data) => {
      persistSession(data.access, data.refresh);
      persistUserId(data.user.id);
      setAuthActive(true, data.user.id);
      startOutboxMonitor();
      void qc.invalidateQueries();
    },
  });
}

export function useBootstrap() {
  const active = useIsAuthActive();
  return useQuery({
    queryKey: ["sync", "bootstrap"],
    queryFn: () => api.get<SyncBootstrap>("/sync/bootstrap/"),
    enabled: active,
    staleTime: 60_000,
  });
}

export function useMyPermissions() {
  const active = useIsAuthActive();
  return useQuery({
    queryKey: ["auth", "permissions"],
    queryFn: () => api.get<MyPermissions>("/auth/my-permissions/"),
    enabled: active,
    staleTime: 5 * 60_000,
  });
}

export function useMe() {
  const active = useIsAuthActive();
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<CurrentUser>("/auth/me/"),
    enabled: active,
    staleTime: 60_000,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/auth/logout/", {}),
    onMutate: () => {
      // Same fix as the web app's logout flash: flip auth-active off
      // synchronously, before anything is cleared, so no mounted query can
      // race a stale refetch against the redirect.
      setAuthActive(false);
    },
    onSettled: () => {
      clearSession();
      qc.clear();
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      api.post("/auth/change-password/", data),
  });
}

export async function biometricUnlockAvailable(): Promise<boolean> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

export async function biometricUnlock(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock SurveyQs",
    fallbackLabel: "Use password instead",
  });
  return result.success;
}
