"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { useMe } from "@/hooks/use-auth";

/**
 * The one place AppShell is mounted, rather than by each page individually
 * -- a known drift to avoid rather than repeat. Every route under this
 * group is authenticated; a failed `me` fetch redirects to login here,
 * once, instead of on every page.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const me = useMe({ enabled: true });
  const router = useRouter();

  useEffect(() => {
    if (me.isError) router.replace("/login");
  }, [me.isError, router]);

  if (me.isPending || me.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line-strong border-t-brand" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
