"use client";

import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Download,
  FileCheck2,
  FileText,
  Layers,
  PenLine,
  ScrollText,
  Undo2,
  Users2,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ColumnDef, DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Kpi } from "@/components/ui/kpi";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGate } from "@/components/permission-gate";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  useConsentRecords,
  useConsentSurvey,
  useDownloadConsentVersion,
  type ConsentRecordRow,
  type ConsentVersion,
} from "../_hooks/use-consent-versions";

const METHOD_LABEL: Record<string, string> = {
  signature: "Signature",
  verbal_confirmed: "Verbal",
  checkbox: "Checkbox",
  uploaded_form: "Uploaded form",
};

function ConsentVersionDetailContent() {
  const { id } = useParams<{ id: string }>();
  const detail = useConsentSurvey(id);
  const [versionFilter, setVersionFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const records = useConsentRecords(id, { version: versionFilter, page, page_size: pageSize });

  const data = detail.data;
  const versions = data?.versions ?? [];
  const latest = versions.find((v) => v.is_latest);

  if (detail.isError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <EmptyState icon={ScrollText} title="Couldn't load this survey" description="It may have been removed, or you may not have access." />
        </Card>
      </div>
    );
  }

  const chooseVersion = (v: number | undefined) => {
    setVersionFilter(v);
    setPage(1);
    // Bring the table into view when it's chosen from the timeline.
    document.getElementById("consents-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const columns: ColumnDef<ConsentRecordRow>[] = [
    {
      key: "respondent",
      label: "Respondent",
      render: (r) =>
        r.respondent ? (
          <Link href={`/respondents/${r.respondent}`} className="font-medium text-ink hover:text-brand hover:underline">
            {r.respondent_name || "Unnamed"}
          </Link>
        ) : (
          <span className="text-ink-faint">Anonymous</span>
        ),
    },
    {
      key: "version",
      label: "Version",
      render: (r) => <VersionPill n={r.version_number} muted={r.version_number !== latest?.version_number} />,
    },
    { key: "method", label: "Method", render: (r) => <span className="text-ink-muted">{METHOD_LABEL[r.method] ?? r.method}</span> },
    {
      key: "granted",
      label: "Consented on",
      render: (r) => (
        <div className="flex items-center gap-1.5 text-ink-muted">
          {r.captured_offline && <WifiOff className="h-3.5 w-3.5 text-ink-faint" aria-label="Captured offline" />}
          {formatDateTime(r.granted_at)}
        </div>
      ),
    },
    { key: "by", label: "Collected by", render: (r) => <span className="text-ink-muted">{r.captured_by_name ?? "—"}</span> },
    {
      key: "responses",
      label: "Responses",
      render: (r) => <span className="font-mono-data text-ink">{r.response_count}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) =>
        r.is_withdrawn ? (
          <Badge tone="rust" dot>
            Withdrawn
          </Badge>
        ) : (
          <Badge tone="moss" dot>
            Active
          </Badge>
        ),
    },
    {
      key: "signature",
      label: "Signature",
      render: (r) =>
        r.signature_url ? (
          <a href={r.signature_url} target="_blank" rel="noreferrer" className="block w-16 rounded border border-line bg-white p-0.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.signature_url} alt="Signature" className="h-7 w-full object-contain" />
          </a>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Title */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {data ? (
            <>
              <h1 className="text-xl font-semibold tracking-tight text-ink">{data.survey.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="neutral">{data.survey.category_label}</Badge>
                <Badge tone={data.survey.status === "published" ? "moss" : "neutral"} dot>
                  {data.survey.status}
                </Badge>
                {!data.survey.consent_required && <Badge tone="amber">Consent switched off</Badge>}
              </div>
            </>
          ) : (
            <Skeleton className="h-12 w-72" />
          )}
        </div>
        <Link href={`/surveys/${id}`} className="text-sm text-ink-muted hover:text-brand hover:underline">
          Open survey →
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Layers} label="Latest version" accent="brand" value={data?.totals.latest_version ? `v${data.totals.latest_version}` : "—"} sub={data ? `${data.totals.versions} in total` : undefined} />
        <Kpi icon={FileCheck2} label="Consents captured" accent="moss" value={data ? data.totals.consents.toLocaleString() : "—"} sub="Across all versions" />
        <Kpi icon={Users2} label="Respondents" accent="slate" value={data ? data.totals.respondents.toLocaleString() : "—"} sub="Who gave consent" />
        <Kpi icon={Undo2} label="Withdrawn" accent="rust" value={data ? data.totals.withdrawn : "—"} sub="Consent taken back" />
      </div>

      {detail.isPending ? (
        <Skeleton className="h-48" />
      ) : versions.length === 0 ? (
        <Card>
          <EmptyState
            icon={ScrollText}
            title="No consent document yet"
            description="Add a consent document in the survey builder and its versions will be tracked here."
          />
        </Card>
      ) : (
        <>
          {latest && <LatestCard version={latest} surveyTitle={data?.survey.title ?? "consent"} />}

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle>Version history</CardTitle>
              <span className="text-xs text-ink-faint">
                {versions.length} {versions.length === 1 ? "version" : "versions"}
              </span>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-0">
                {versions.map((v, i) => (
                  <TimelineItem
                    key={v.id}
                    version={v}
                    totalConsents={data?.totals.consents ?? 0}
                    last={i === versions.length - 1}
                    onViewConsents={() => chooseVersion(v.version_number)}
                    surveyTitle={data?.survey.title ?? "consent"}
                  />
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Consents */}
          <section id="consents-table" className="scroll-mt-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink">
                Captured consents
                {records.data && <span className="ml-2 font-normal text-ink-faint">{records.data.count.toLocaleString()}</span>}
              </h2>
              <div role="tablist" aria-label="Filter by version" className="inline-flex flex-wrap gap-1 rounded-lg border border-line bg-paper-sunken p-1">
                {[undefined, ...versions.map((v) => v.version_number)].map((v) => (
                  <button
                    key={v ?? "all"}
                    role="tab"
                    aria-selected={versionFilter === v}
                    onClick={() => {
                      setVersionFilter(v);
                      setPage(1);
                    }}
                    className={cn(
                      "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                      versionFilter === v ? "bg-paper-raised text-ink shadow-sm" : "text-ink-muted hover:text-ink",
                    )}
                  >
                    {v === undefined ? "All" : `v${v}`}
                  </button>
                ))}
              </div>
            </div>
            <DataTable
              columns={columns}
              data={records.data?.results ?? []}
              isLoading={records.isPending}
              isFetching={records.isFetching}
              isError={records.isError}
              emptyIcon={FileCheck2}
              emptyTitle="No consents captured"
              emptyDescription={versionFilter ? `Nobody has consented to v${versionFilter} yet.` : "Consents appear here as agents collect them."}
              pagination={{ page, pageSize, total: records.data?.count ?? 0 }}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </section>
        </>
      )}
    </div>
  );
}

function VersionPill({ n, muted }: { n: number | null; muted?: boolean }) {
  if (n == null) return <span className="text-ink-faint">—</span>;
  return (
    <span
      className={cn(
        "font-mono-data inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        muted ? "bg-paper-sunken text-ink-muted" : "bg-brand-soft text-brand-strong",
      )}
    >
      v{n}
    </span>
  );
}

function DownloadButton({ version, surveyTitle, variant = "secondary" }: { version: ConsentVersion; surveyTitle: string; variant?: "secondary" | "primary" | "ghost" }) {
  const download = useDownloadConsentVersion();
  return (
    <Button
      variant={variant}
      size="sm"
      loading={download.isPending}
      onClick={() =>
        download.mutate({
          noticeId: version.id,
          fallbackName: `${surveyTitle.replace(/\s+/g, "-")}-consent-v${version.version_number}.${version.has_file ? "pdf" : "txt"}`,
        })
      }
    >
      <Download className="h-4 w-4" /> Download{version.has_file ? "" : " text"}
    </Button>
  );
}

function LatestCard({ version: v, surveyTitle: title }: { version: ConsentVersion; surveyTitle: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden border-brand/30">
      <div className="flex flex-wrap items-center gap-5 bg-gradient-to-br from-brand-soft via-brand-soft/60 to-transparent p-6">
        <span className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand text-brand-contrast shadow-sm">
          <span className="text-2xs font-medium uppercase tracking-wider opacity-80">Version</span>
          <span className="font-mono-data text-3xl font-semibold leading-none">{v.version_number}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-ink">Current consent document</h2>
            <Badge tone="brand">
              <CheckCircle2 className="h-3 w-3" /> Latest
            </Badge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              {v.has_file ? v.filename : "Typed text (no file uploaded)"}
            </span>
            <span>Uploaded {formatDate(v.uploaded_at)}</span>
            <span>
              <span className="font-mono-data font-semibold text-ink">{v.consents}</span> {v.consents === 1 ? "consent" : "consents"}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? "Hide text" : "Read text"}
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </Button>
          <DownloadButton version={v} surveyTitle={title} variant="primary" />
        </div>
      </div>
      {open && <ConsentText text={v.text} />}
    </Card>
  );
}

function ConsentText({ text }: { text: string }) {
  return (
    <div className="border-t border-line bg-paper-raised p-5">
      <p className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{text || "No text was extracted from this document."}</p>
    </div>
  );
}

function TimelineItem({
  version: v,
  totalConsents,
  last,
  onViewConsents,
  surveyTitle,
}: {
  version: ConsentVersion;
  totalConsents: number;
  last: boolean;
  onViewConsents: () => void;
  surveyTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const share = totalConsents > 0 ? (v.consents / totalConsents) * 100 : 0;
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {!last && <span aria-hidden className="absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-px bg-line" />}
      <span
        className={cn(
          "font-mono-data z-[1] flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          v.is_latest ? "bg-brand text-brand-contrast" : "border border-line-strong bg-paper-raised text-ink-muted",
        )}
      >
        v{v.version_number}
      </span>

      <div className="min-w-0 flex-1 rounded-lg border border-line p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-ink">Uploaded {formatDate(v.uploaded_at)}</span>
              {v.is_latest ? <Badge tone="brand">Latest</Badge> : <Badge tone="neutral">Previous</Badge>}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{v.has_file ? v.filename : "Typed text · no file uploaded"}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? "Hide text" : "Read text"}
            </Button>
            <DownloadButton version={v} surveyTitle={surveyTitle} />
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <button onClick={onViewConsents} className="inline-flex items-center gap-1 font-medium text-brand hover:underline disabled:cursor-default disabled:text-ink-faint disabled:no-underline" disabled={v.consents === 0}>
              <PenLine className="h-3 w-3" />
              {v.consents} {v.consents === 1 ? "consent" : "consents"}
              {v.withdrawn > 0 && <span className="text-rust"> · {v.withdrawn} withdrawn</span>}
            </button>
            <span className="text-ink-faint">
              {v.first_consent_at
                ? v.first_consent_at.slice(0, 10) === v.last_consent_at?.slice(0, 10)
                  ? formatDate(v.first_consent_at)
                  : `${formatDate(v.first_consent_at)} – ${formatDate(v.last_consent_at)}`
                : "No consents yet"}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-paper-sunken">
            <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${share}%` }} />
          </div>
        </div>

        {open && (
          <div className="mt-3 overflow-hidden rounded-md border border-line">
            <ConsentText text={v.text} />
          </div>
        )}
      </div>
    </li>
  );
}

function BackLink() {
  return (
    <Link href="/consents" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
      <ArrowLeft className="h-4 w-4" /> Consent versions
    </Link>
  );
}

export default function ConsentVersionDetailPage() {
  return (
    <PermissionGate module="settings" action="view" featureName="consent versions">
      <ConsentVersionDetailContent />
    </PermissionGate>
  );
}
