"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface TenantUser {
  id: string;
  email: string;
  full_name: string;
  role_code: string;
  is_active: boolean;
  last_login_at: string | null;
  joined_at: string;
}

export interface InviteUserResult extends TenantUser {
  /** Set only for a brand-new account (or an existing one that never set
   * its own password) -- shown once, here, and never retrievable again.
   * The account is flagged to force a real password choice on first sign-in
   * -- see backend apps/users/tenant_views.py and
   * apps/authentication/views.py::ChangePasswordView. */
  temporary_password: string | null;
}

export function useTenantUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api.get<TenantUser[]>("/users/"),
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; full_name: string; role_code: string }) =>
      api.post<InviteUserResult>("/users/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role_code }: { userId: string; role_code: string }) =>
      api.patch(`/users/${userId}/`, { role_code }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

/** Fires one `POST /assignments/` per survey -- the endpoint assigns many
 * agents to one survey, not one agent to many surveys, so a brand-new
 * agent picking several surveys at once means several calls. See
 * [[field-agent-survey-assignment]]: an agent can't collect a survey's
 * responses without one of these existing for them. */
export function useAssignSurveysToUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, surveyIds }: { userId: string; surveyIds: string[] }) => {
      const results = await Promise.allSettled(
        surveyIds.map((surveyId) =>
          api.post("/assignments/", { survey: surveyId, assignees: [{ type: "user", id: userId }] }),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      return { assigned: surveyIds.length - failed, failed };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments"] }),
  });
}

export function useSetUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, active }: { userId: string; active: boolean }) =>
      api.post(`/users/${userId}/${active ? "reactivate" : "deactivate"}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

// --- Roles & permissions ------------------------------------------------

export interface RbacModule {
  id: string;
  code: string;
  label: string;
  is_enabled: boolean;
}

export interface RbacRole {
  id: string;
  code: string;
  name: string;
  is_system: boolean;
  is_active: boolean;
  user_count: number;
}

export interface PermissionMatrix {
  modules: RbacModule[];
  roles: RbacRole[];
  matrix: Record<string, Record<string, string[]>>;
}

export function usePermissionMatrix() {
  return useQuery({
    queryKey: ["admin", "permission-matrix"],
    queryFn: () => api.get<PermissionMatrix>("/rbac/permission-matrix/"),
  });
}

export function useSetPermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { role: string; module: string; action: string; is_granted: boolean }) =>
      api.post("/rbac/permission-matrix/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "permission-matrix"] }),
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { code: string; name: string }) => api.post<RbacRole>("/rbac/roles/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "permission-matrix"] });
      qc.invalidateQueries({ queryKey: ["admin", "roles"] });
    },
  });
}

// --- Workspace settings ---------------------------------------------------

export interface WorkspaceSettings {
  name: string;
  subdomain: string;
  settings: {
    date_format?: string;
    timezone?: string;
    default_language?: string;
    accent_color?: string;
  };
}

export function useWorkspaceSettings() {
  return useQuery({
    queryKey: ["admin", "workspace-settings"],
    queryFn: () => api.get<WorkspaceSettings>("/settings/workspace/"),
  });
}

export function useUpdateWorkspaceSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<WorkspaceSettings["settings"]>) =>
      api.patch<WorkspaceSettings>("/settings/workspace/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "workspace-settings"] }),
  });
}
