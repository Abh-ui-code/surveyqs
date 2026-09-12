"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useIsAuthActive } from "@/hooks/use-auth";
import { authKeys } from "@/lib/query-keys";

export interface MyPermissions {
  is_superadmin: boolean;
  is_admin: boolean;
  role_code: string | null;
  modules: string[];
  permissions: Record<string, string[]>;
}

export function useMyPermissions() {
  const isAuthActive = useIsAuthActive();
  return useQuery({
    queryKey: authKeys.permissions(),
    queryFn: () => api.get<MyPermissions>("/auth/my-permissions/"),
    staleTime: 5 * 60_000,
    enabled: isAuthActive,
  });
}

/** `canAccess(perms, "responses", "approve")`. Admins and superadmins pass
 * every check -- see the identical rule enforced server-side in
 * backend apps/rbac/services.py::user_has_permission. This function is UX
 * only; the server is the sole authority. */
export function canAccess(perms: MyPermissions | undefined, module: string, action = "view"): boolean {
  if (!perms) return false;
  if (perms.is_superadmin || perms.is_admin) return true;
  return perms.permissions[module]?.includes(action) ?? false;
}
