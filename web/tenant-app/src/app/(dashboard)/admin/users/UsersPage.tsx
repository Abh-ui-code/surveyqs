"use client";

import { MoreHorizontal, UserPlus, Users2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { type ColumnDef, DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/ui/page-header";
import { PermissionGate } from "@/components/permission-gate";
import { apiErrorMessage } from "@/lib/api-client/client";
import { formatDateTime, formatRelativeShort } from "@/lib/format";
import { InviteUserDrawer } from "./_components/invite-user-drawer";
import { useSetUserActive, useTenantUsers, useUpdateUserRole, type TenantUser } from "../_hooks/use-admin";

const ROLE_TONE: Record<string, { label: string; tone: "brand" | "amber" | "moss" | "neutral" }> = {
  admin: { label: "Admin", tone: "brand" },
  supervisor: { label: "Supervisor", tone: "amber" },
  agent: { label: "Agent", tone: "moss" },
  analyst: { label: "Analyst", tone: "neutral" },
};

const ROLES = ["admin", "supervisor", "agent", "analyst"];

function UsersContent() {
  const users = useTenantUsers();
  const updateRole = useUpdateUserRole();
  const setActive = useSetUserActive();
  const [pendingDeactivate, setPendingDeactivate] = useState<TenantUser | null>(null);

  const columns: ColumnDef<TenantUser & { id: string }>[] = [
    {
      key: "user",
      label: "User",
      render: (row) => (
        <div>
          <div className="font-medium text-ink">{row.full_name}</div>
          <div className="text-xs text-ink-muted">{row.email}</div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (row) => {
        const tone = ROLE_TONE[row.role_code] ?? { label: row.role_code, tone: "neutral" as const };
        return <Badge tone={tone.tone}>{tone.label}</Badge>;
      },
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <Badge tone={row.is_active ? "moss" : "neutral"} dot>{row.is_active ? "Active" : "Deactivated"}</Badge>,
    },
    {
      key: "last_login",
      label: "Last active",
      render: (row) => <span className="text-ink-muted">{row.last_login_at ? formatRelativeShort(row.last_login_at) : "Never signed in"}</span>,
    },
    {
      key: "joined",
      label: "Joined",
      render: (row) => <span className="text-ink-muted">{formatDateTime(row.joined_at)}</span>,
    },
    {
      key: "actions",
      label: "",
      className: "w-10 text-right",
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-md p-1.5 text-ink-faint hover:bg-paper-sunken hover:text-ink">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Change role</DropdownMenuLabel>
            {ROLES.map((role) => (
              <DropdownMenuItem
                key={role}
                disabled={role === row.role_code}
                onClick={() =>
                  updateRole.mutate(
                    { userId: row.id, role_code: role },
                    {
                      onSuccess: () => toast.success(`${row.full_name} is now ${ROLE_TONE[role]?.label ?? role}`),
                      onError: (err) => toast.error("Couldn't change role", { description: apiErrorMessage(err) }),
                    },
                  )
                }
              >
                {ROLE_TONE[role]?.label ?? role}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {row.is_active ? (
              <DropdownMenuItem destructive onClick={() => setPendingDeactivate(row)}>
                Deactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() =>
                  setActive.mutate(
                    { userId: row.id, active: true },
                    {
                      onSuccess: () => toast.success(`${row.full_name} reactivated`),
                      onError: (err) => toast.error("Couldn't reactivate", { description: apiErrorMessage(err) }),
                    },
                  )
                }
              >
                Reactivate
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        description="Everyone with access to this workspace."
        actions={
          <InviteUserDrawer
            trigger={
              <Button>
                <UserPlus className="h-4 w-4" /> Invite user
              </Button>
            }
          />
        }
      />

      <DataTable
        columns={columns}
        data={users.data ?? []}
        isLoading={users.isPending}
        isFetching={users.isFetching}
        isError={users.isError}
        emptyIcon={Users2}
        emptyTitle="No users yet"
        emptyDescription="Invite your team to get started."
      />

      <ConfirmDialog
        open={!!pendingDeactivate}
        onOpenChange={(open) => !open && setPendingDeactivate(null)}
        title={`Deactivate ${pendingDeactivate?.full_name}?`}
        description="They will no longer be able to sign in to this workspace. Nothing they've collected or created is deleted, and you can reactivate them at any time."
        variant="danger"
        confirmLabel="Deactivate"
        loading={setActive.isPending}
        onConfirm={() => {
          if (!pendingDeactivate) return;
          setActive.mutate(
            { userId: pendingDeactivate.id, active: false },
            {
              onSuccess: () => {
                toast.success(`${pendingDeactivate.full_name} deactivated`);
                setPendingDeactivate(null);
              },
              onError: (err) => {
                toast.error("Couldn't deactivate", { description: apiErrorMessage(err) });
                setPendingDeactivate(null);
              },
            },
          );
        }}
      />
    </div>
  );
}

export default function UsersPage() {
  return (
    <PermissionGate module="users" action="view" featureName="user management">
      <UsersContent />
    </PermissionGate>
  );
}
