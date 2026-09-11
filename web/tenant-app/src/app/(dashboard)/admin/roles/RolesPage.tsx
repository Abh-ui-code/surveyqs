"use client";

import { Plus, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionGate } from "@/components/permission-gate";
import { apiErrorMessage } from "@/lib/api-client/client";
import { CreateRoleDrawer } from "./_components/create-role-drawer";
import { usePermissionMatrix, useSetPermission } from "../_hooks/use-admin";

const ACTIONS: { code: string; label: string }[] = [
  { code: "view", label: "View" },
  { code: "create", label: "Create" },
  { code: "edit", label: "Edit" },
  { code: "delete", label: "Delete" },
  { code: "approve", label: "Approve" },
  { code: "export", label: "Export" },
];

function RolesContent() {
  const matrixQuery = usePermissionMatrix();
  const setPermission = useSetPermission();
  const [activeRole, setActiveRole] = useState<string | null>(null);

  if (matrixQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (matrixQuery.isError || !matrixQuery.data) {
    return <EmptyState title="Couldn't load roles" description="Try refreshing the page." />;
  }

  const { modules, roles, matrix } = matrixQuery.data;
  const currentRoleCode = activeRole ?? roles[0]?.code;
  const currentRole = roles.find((r) => r.code === currentRoleCode);
  const isAdmin = currentRole?.code === "admin";

  const isGranted = (moduleCode: string, action: string) =>
    (matrix[currentRole?.code ?? ""]?.[moduleCode] ?? []).includes(action);

  const toggle = (moduleId: string, moduleCode: string, action: string) => {
    if (!currentRole || isAdmin) return;
    setPermission.mutate(
      { role: currentRole.id, module: moduleId, action, is_granted: !isGranted(moduleCode, action) },
      { onError: (err) => toast.error("Couldn't update permission", { description: apiErrorMessage(err) }) },
    );
  };

  return (
    <div>
      <PageHeader
        title="Roles & permissions"
        description="Decide what each role can see and do."
        actions={
          <CreateRoleDrawer
            trigger={
              <Button>
                <Plus className="h-4 w-4" /> New role
              </Button>
            }
          />
        }
      />

      <Tabs value={currentRoleCode} onValueChange={setActiveRole}>
        <TabsList>
          {roles.map((role) => (
            <TabsTrigger key={role.code} value={role.code}>
              {role.name}
              {role.user_count > 0 && <span className="ml-1.5 text-xs text-ink-faint">({role.user_count})</span>}
            </TabsTrigger>
          ))}
        </TabsList>

        {roles.map((role) => (
          <TabsContent key={role.code} value={role.code}>
            {role.code === currentRoleCode && (
              <Card>
                {isAdmin && (
                  <div className="flex items-center gap-2 border-b border-line bg-brand-soft px-5 py-2.5 text-sm text-brand-strong">
                    <ShieldCheck className="h-4 w-4" />
                    Admins always have full access to every module. This can&rsquo;t be changed.
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-line bg-paper-sunken/60">
                        <th className="px-5 py-2.5 text-xs font-medium text-ink-muted">Module</th>
                        {ACTIONS.map((a) => (
                          <th key={a.code} className="px-3 py-2.5 text-center text-xs font-medium text-ink-muted">
                            {a.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {modules.map((mod) => (
                        <tr key={mod.id} className="border-b border-line last:border-0">
                          <td className="px-5 py-2.5">
                            <span className="text-ink">{mod.label}</span>
                            {!mod.is_enabled && (
                              <Badge tone="neutral" className="ml-2">
                                Disabled for this workspace
                              </Badge>
                            )}
                          </td>
                          {ACTIONS.map((a) => (
                            <td key={a.code} className="px-3 py-2.5 text-center">
                              <Checkbox
                                checked={isAdmin || isGranted(mod.code, a.code)}
                                disabled={isAdmin || !mod.is_enabled}
                                onCheckedChange={() => toggle(mod.id, mod.code, a.code)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export default function RolesPage() {
  return (
    <PermissionGate module="settings" action="view" featureName="roles and permissions">
      <RolesContent />
    </PermissionGate>
  );
}
