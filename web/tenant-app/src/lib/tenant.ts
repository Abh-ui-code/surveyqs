/**
 * Host parsing for the multi-tenant portal. Multi-tenancy is routed off
 * the backend's Host header (see backend docs/architecture/MULTI_TENANCY.md),
 * so the web client must mirror the browser's hostname when building the
 * API base URL -- calling a platform host from a tenant subdomain lands on
 * the public schema, where tenant endpoints don't exist.
 */

const RESERVED_SUBDOMAINS = ["admin", "api", "www", "app"];

function baseDomain(): string {
  return process.env.NEXT_PUBLIC_TENANT_BASE_DOMAIN ?? "surveyqs.local";
}

/** Returns the tenant subdomain for the current host, or null if this is a
 * platform host (the bare base domain, or a reserved subdomain). */
export function getTenantFromHost(hostname?: string): string | null {
  const host = (hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")).split(":")[0];
  const base = baseDomain();
  if (host === base || host === "localhost" || host === "127.0.0.1") return null;
  if (!host.endsWith(`.${base}`)) return null;
  const subdomain = host.slice(0, -(`.${base}`.length));
  if (RESERVED_SUBDOMAINS.includes(subdomain)) return null;
  return subdomain;
}

export function isAppDomain(hostname?: string): boolean {
  const host = (hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")).split(":")[0];
  return host === `app.${baseDomain()}` || host === baseDomain() || host === "localhost";
}

/** Builds an absolute URL onto the platform ("app") host, for links that
 * must work regardless of which tenant subdomain the user is currently on. */
export function appUrl(path: string): string {
  if (typeof window === "undefined") return path;
  const protocol = window.location.protocol;
  const port = window.location.port ? `:${window.location.port}` : "";
  return `${protocol}//app.${baseDomain()}${port}${path}`;
}

/** Builds an absolute URL onto a specific tenant's subdomain. */
export function tenantUrl(subdomain: string, path: string): string {
  if (typeof window === "undefined") return path;
  const protocol = window.location.protocol;
  const port = window.location.port ? `:${window.location.port}` : "";
  return `${protocol}//${subdomain}.${baseDomain()}${port}${path}`;
}
