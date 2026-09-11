"use client";

import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { canAccess, useMyPermissions } from "@/hooks/use-permissions";

/**
 * UX-only. Denial is rendered so the sidebar and header stay visible --
 * a blocked user is not stranded on a blank page. The server's
 * HasPermission check is the real boundary; this only hides a button the
 * caller cannot use.
 */
export function PermissionGate({
  module,
  action = "view",
  featureName,
  children,
}: {
  module: string;
  action?: string;
  featureName: string;
  children: React.ReactNode;
}) {
  const perms = useMyPermissions();

  if (perms.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!canAccess(perms.data, module, action)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="You don't have access to this"
        description={`Ask an administrator for access to ${featureName}.`}
      />
    );
  }

  return <>{children}</>;
}
