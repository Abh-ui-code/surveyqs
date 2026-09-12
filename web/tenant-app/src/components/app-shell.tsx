"use client";

import { ChevronDown, LogOut, Menu, Settings as SettingsIcon, User, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMe, useLogout } from "@/hooks/use-auth";
import { canAccess, useMyPermissions } from "@/hooks/use-permissions";
import { activeNavHref, filterNavByModules, NAV } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  collapsed,
  indent,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  collapsed: boolean;
  indent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive ? "bg-brand-soft text-brand-strong" : "text-ink-muted hover:bg-paper-sunken hover:text-ink",
        collapsed && "justify-center px-0",
        indent && !collapsed && "pl-8",
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const me = useMe();
  const perms = useMyPermissions();
  const logout = useLogout();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const visibleNav = useMemo(
    () => filterNavByModules(NAV, perms.data && ((module) => canAccess(perms.data, module, "view"))),
    [perms.data],
  );
  const activeHref = activeNavHref(pathname, visibleNav);

  // Both queries must resolve before the shell renders its real nav --
  // otherwise a role with a small nav briefly sees the full one and it
  // narrows a beat later, which reads as a permissions bug every time.
  const stillLoading = me.isPending || perms.isPending;

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-line bg-paper-raised transition-[width] duration-150",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-line px-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand text-sm font-bold text-brand-contrast">
            S
          </span>
          {!collapsed && <span className="text-sm font-semibold text-ink">SurveyQs</span>}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {!stillLoading &&
            visibleNav.map((entry) => {
              if (entry.kind === "leaf") {
                return (
                  <NavLink
                    key={entry.href}
                    href={entry.href}
                    label={entry.label}
                    icon={entry.icon}
                    isActive={entry.href === activeHref}
                    collapsed={collapsed}
                  />
                );
              }
              const isOpen = openGroups[entry.id] ?? true;
              return (
                <div key={entry.id} className="pt-3">
                  {!collapsed && (
                    <button
                      onClick={() => setOpenGroups((g) => ({ ...g, [entry.id]: !isOpen }))}
                      className="flex w-full items-center gap-1.5 rounded-md px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint hover:text-ink"
                    >
                      <entry.icon className="h-3.5 w-3.5" />
                      <span className="flex-1 text-left">{entry.label}</span>
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !isOpen && "-rotate-90")} />
                    </button>
                  )}
                  {(isOpen || collapsed) && (
                    <div className="space-y-0.5">
                      {entry.items.map((item) => (
                        <NavLink
                          key={item.href}
                          href={item.href}
                          label={item.label}
                          icon={item.icon}
                          isActive={item.href === activeHref}
                          collapsed={collapsed}
                          indent
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </nav>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-10 items-center justify-center border-t border-line text-ink-faint hover:bg-paper-sunken hover:text-ink"
        >
          <Menu className="h-4 w-4" />
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-paper-raised px-5">
          <div className="text-sm text-ink-muted">
            {me.data?.tenant ? (
              <span>
                <span className="font-medium text-ink">{me.data.tenant.name}</span>
                <span className="mx-1.5 text-line-strong">/</span>
                {me.data.tenant.subdomain}
              </span>
            ) : (
              <span>&nbsp;</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-paper-sunken">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong">
                  {(me.data?.full_name ?? me.data?.email ?? "?").charAt(0).toUpperCase()}
                </span>
                <span className="max-w-[160px] truncate text-ink">{me.data?.full_name ?? me.data?.email}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="h-4 w-4" /> My profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings">
                    <SettingsIcon className="h-4 w-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onClick={() => logout.mutate()}>
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
