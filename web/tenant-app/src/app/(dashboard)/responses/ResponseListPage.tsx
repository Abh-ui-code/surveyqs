"use client";

import { BarChart3, Flag, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { type ColumnDef, DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ResponseStatusBadge } from "@/components/ui/status-badge";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { PermissionGate } from "@/components/permission-gate";
import { formatDateTime, formatDuration } from "@/lib/format";
import { useSurveys } from "../surveys/_hooks/use-surveys";
import { useResponses, type ResponseRow } from "./_hooks/use-responses";

function ResponsesContent() {
  const [survey, setSurvey] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const router = useRouter();

  const surveys = useSurveys({});
  const responses = useResponses({
    survey: survey || undefined,
    status: status || undefined,
    search: search.length >= 2 ? search : undefined,
    page,
    page_size: pageSize,
  });

  const columns: ColumnDef<ResponseRow>[] = [
    {
      key: "response",
      label: "Response",
      render: (row) => (
        <div>
          <div className="font-mono-data text-xs text-ink-faint">{row.response_code}</div>
          <div className="font-medium text-ink">{row.respondent_name ?? "Anonymous"}</div>
        </div>
      ),
    },
    {
      key: "survey",
      label: "Survey",
      render: (row) => (
        <div>
          <div className="text-ink">{row.survey_title}</div>
          <Badge tone="neutral" className="mt-1">
            {row.category_label}
          </Badge>
        </div>
      ),
    },
    { key: "status", label: "Status", render: (row) => <ResponseStatusBadge status={row.status} /> },
    {
      key: "duration",
      label: "Duration",
      render: (row) => <span className="font-mono-data text-ink">{formatDuration(row.duration_seconds)}</span>,
    },
    {
      key: "submitted",
      label: "Submitted",
      render: (row) => (
        <div className="flex items-center gap-1.5 text-ink-muted">
          {row.was_offline && <WifiOff className="h-3.5 w-3.5 text-ink-faint" />}
          {formatDateTime(row.submitted_at)}
        </div>
      ),
    },
    {
      key: "flags",
      label: "Flags",
      render: (row) =>
        row.flag_count > 0 ? (
          <span className="flex items-center gap-1 text-amber">
            <Flag className="h-3.5 w-3.5" /> {row.flag_count}
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader title="Responses" description="Every response, across every survey and topic." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          className="max-w-xs"
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by respondent or code..."
        />
        <Select
          className="w-52"
          value={survey}
          onChange={(e) => {
            setSurvey(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All surveys</option>
          {surveys.data?.results.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </Select>
        <Select
          className="w-44"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Awaiting review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </Select>
        {(survey || status || search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSurvey("");
              setStatus("");
              setSearch("");
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={responses.data?.results ?? []}
        isLoading={responses.isPending}
        isFetching={responses.isFetching}
        isError={responses.isError}
        onRowClick={(row) => router.push(`/responses/${row.id}`)}
        emptyIcon={BarChart3}
        emptyTitle="No responses yet"
        emptyDescription="Once agents start submitting, responses will appear here."
        pagination={{ page, pageSize, total: responses.data?.count ?? 0 }}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </div>
  );
}

export default function ResponseListPage() {
  return (
    <PermissionGate module="responses" action="view" featureName="responses">
      <ResponsesContent />
    </PermissionGate>
  );
}
