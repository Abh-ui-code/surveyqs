import {
  BarChart3,
  LayoutDashboard,
  ListChecks,
  ShieldCheck,
  Sliders,
  Users2,
  type LucideIcon,
} from "lucide-react";

export interface NavLeaf {
  kind: "leaf";
  href: string;
  label: string;
  icon: LucideIcon;
  module: string;
}

export interface NavGroup {
  kind: "group";
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavLeaf[];
}

export type NavEntry = NavLeaf | NavGroup;

function leaf(href: string, label: string, icon: LucideIcon, module: string): NavLeaf {
  return { kind: "leaf", href, label, icon, module };
}

/**
 * Every leaf carries the module it gates on. Filtering by module happens
 * once, in AppShell -- the nav array itself is a plain data structure.
 *
 * Scoped to what has been built: dashboard, surveys, responses, and an
 * Administration group (users, roles & permissions, workspace settings).
 * Assignments, respondents and audit have working backend endpoints
 * (see backend/apps/*) but no web screens yet -- adding their nav entries
 * before the pages exist would just be dead links.
 */
export const NAV: NavEntry[] = [
  leaf("/", "Dashboard", LayoutDashboard, "reports"),
  leaf("/surveys", "Surveys", ListChecks, "surveys"),
  leaf("/responses", "Responses", BarChart3, "responses"),
  {
    kind: "group",
    id: "administration",
    label: "Administration",
    icon: ShieldCheck,
    items: [
      leaf("/admin/users", "Users", Users2, "users"),
      leaf("/admin/roles", "Roles & permissions", ShieldCheck, "settings"),
      leaf("/admin/settings", "Settings", Sliders, "settings"),
    ],
  },
];

function flatten(nav: NavEntry[]): NavLeaf[] {
  return nav.flatMap((entry) => (entry.kind === "leaf" ? [entry] : entry.items));
}

/**
 * `hasAccess` should reflect real per-role grants (e.g. `canAccess(perms,
 * module, "view")`), not merely that a module is enabled for the tenant --
 * every module is "enabled" for every user, so filtering on that would be a
 * no-op and every nav item would show regardless of role.
 */
export function filterNavByModules(nav: NavEntry[], hasAccess: ((module: string) => boolean) | undefined): NavEntry[] {
  // A request that hasn't resolved yet shows everything rather than an
  // empty sidebar, which reads as a broken app on every cold load.
  if (!hasAccess) return nav;
  return nav
    .filter((entry) => entry.kind !== "leaf" || hasAccess(entry.module))
    .map((entry) =>
      entry.kind === "leaf" ? entry : { ...entry, items: entry.items.filter((item) => hasAccess(item.module)) },
    )
    .filter((entry) => entry.kind === "leaf" || entry.items.length > 0);
}

/** The single longest matching href across the whole (flattened) nav,
 * computed once per render rather than per item -- avoids an O(n^2) scan
 * and correctly distinguishes `/surveys` from `/surveys/new`. */
export function activeNavHref(pathname: string, nav: NavEntry[]): string | null {
  let best: string | null = null;
  for (const item of flatten(nav)) {
    if (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) {
      if (!best || item.href.length > best.length) best = item.href;
    }
  }
  return best;
}
