"use client";

import { ArrowUpRight, FileCheck2, FileText, Layers, ScrollText, ShieldCheck, Users2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGate } from "@/components/permission-gate";
import { formatDate, formatRelativeShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useConsentVersions, type ConsentSurveySummary } from "./_hooks/use-consent-versions";

type Filter = "all" | "required" | "none";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All surveys" },
  { key: "required", label: "Uses consent" },
  { key: "none", label: "No consent" },
];

function ConsentVersionsContent() {
  const overview = useConsentVersions();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const surveys = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (overview.data?.surveys ?? []).filter(
      (s) =>
        (filter === "all" || (filter === "required" ? s.consent_required || s.versions > 0 : !s.consent_required && s.versions === 0)) &&
        (!q || s.title.toLowerCase().includes(q) || s.category_label.toLowerCase().includes(q)),
    );
  }, [overview.data, filter, search]);

  const totals = overview.data?.totals;

  return (
    <div>
      <PageHeader
        title="Consent versions"
        description="The consent document each survey has used over time, and every consent captured against it."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={ScrollText} label="Surveys" accent="slate" value={totals?.surveys ?? "—"} />
        <Kpi icon={ShieldCheck} label="Using consent" accent="brand" value={totals?.with_consent ?? "—"} />
        <Kpi icon={Layers} label="Document versions" accent="amber" value={totals?.versions ?? "—"} />
        <Kpi icon={FileCheck2} label="Consents captured" accent="moss" value={totals ? totals.consents.toLocaleString() : "—"} />
      </div>

      <div className="mb-4 mt-6 flex flex-wrap items-center gap-3">
        <SearchInput className="max-w-xs" value={search} onChange={setSearch} placeholder="Search surveys..." />
        <div role="tablist" aria-label="Filter" className="inline-flex gap-1 rounded-lg border border-line bg-paper-sunken p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.key ? "bg-paper-raised text-ink shadow-sm" : "text-ink-muted hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {overview.isPending ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : overview.isError ? (
        <Card>
          <EmptyState icon={ScrollText} title="Couldn't load consent versions" description="Please try again in a moment." />
        </Card>
      ) : surveys.length === 0 ? (
        <Card>
          <EmptyState icon={ScrollText} title="No surveys match" description="Try a different search or filter." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {surveys.map((s) => (
            <SurveyCard key={s.survey_id} survey={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function SurveyCard({ survey: s }: { survey: ConsentSurveySummary }) {
  const hasConsent = s.versions > 0;
  return (
    <Link
      href={`/consents/${s.survey_id}`}
      className={cn(
        "group flex flex-col rounded-xl border border-line bg-paper-raised p-5 transition-all",
        "hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        !hasConsent && "bg-paper-sunken/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-ink group-hover:text-brand">{s.title}</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone="neutral">{s.category_label}</Badge>
            <Badge tone={s.survey_status === "published" ? "moss" : "neutral"} dot>
              {s.survey_status}
            </Badge>
          </div>
        </div>
        {hasConsent ? (
          <span className="flex h-12 min-w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-soft px-2 text-brand-strong">
            <span className="text-2xs font-medium uppercase leading-none tracking-wide opacity-70">Latest</span>
            <span className="font-mono-data text-lg font-semibold leading-tight">v{s.latest_version}</span>
          </span>
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-paper-sunken text-ink-faint">
            <ScrollText className="h-5 w-5" />
          </span>
        )}
      </div>

      {hasConsent ? (
        <>
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4">
            <Stat icon={FileCheck2} label="Consents" value={s.consents.toLocaleString()} />
            <Stat icon={Layers} label={s.versions === 1 ? "Version" : "Versions"} value={s.versions} />
            <Stat icon={Users2} label="Withdrawn" value={s.withdrawn} muted={s.withdrawn === 0} />
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 text-xs text-ink-faint">
            <span className="flex min-w-0 items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {s.latest_has_file ? "Document uploaded" : "Typed text"}
                {s.latest_uploaded_at && ` · ${formatDate(s.latest_uploaded_at)}`}
              </span>
            </span>
            <span className="shrink-0">{s.last_consent_at ? `Last consent ${formatRelativeShort(s.last_consent_at)}` : "No consents yet"}</span>
          </div>
        </>
      ) : (
        <p className="mt-5 border-t border-line pt-4 text-sm text-ink-muted">
          {s.consent_required ? "Consent is switched on but no document has been added yet." : "This survey doesn't collect consent."}
        </p>
      )}

      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        View versions <ArrowUpRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-ink-faint">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={cn("font-mono-data mt-0.5 text-xl font-semibold", muted ? "text-ink-faint" : "text-ink")}>{value}</div>
    </div>
  );
}

export default function ConsentVersionsPage() {
  return (
    <PermissionGate module="settings" action="view" featureName="consent versions">
      <ConsentVersionsContent />
    </PermissionGate>
  );
}
