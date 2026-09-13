"use client";

import { Users2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type ColumnDef, DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { PermissionGate } from "@/components/permission-gate";
import { formatDate } from "@/lib/format";
import { useRespondents, type Respondent } from "./_hooks/use-respondents";

function RespondentsContent() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const router = useRouter();

  const respondents = useRespondents({
    search: search.length >= 2 ? search : undefined,
    page,
    page_size: pageSize,
  });

  const columns: ColumnDef<Respondent>[] = [
    {
      key: "name",
      label: "Respondent",
      render: (row) => (
        <div>
          <div className="font-medium text-ink">{row.full_name}</div>
          {row.identity_number && <div className="font-mono-data text-xs text-ink-faint">{row.identity_number}</div>}
        </div>
      ),
    },
    {
      key: "contact",
      label: "Contact",
      render: (row) => (
        <div>
          <div className="text-ink">{row.phone || "—"}</div>
          {row.email && <div className="text-xs text-ink-faint">{row.email}</div>}
        </div>
      ),
    },
    { key: "gender", label: "Gender", render: (row) => <span className="text-ink">{row.gender || "—"}</span> },
    { key: "dob", label: "Date of birth", render: (row) => <span className="text-ink">{formatDate(row.date_of_birth)}</span> },
    { key: "created", label: "Added", render: (row) => <span className="text-ink-muted">{formatDate(row.created_at)}</span> },
  ];

  return (
    <div>
      <PageHeader title="Respondents" description="Everyone who's been surveyed, independent of any one survey's answers." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          className="max-w-xs"
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by name, phone or ID..."
        />
      </div>

      <DataTable
        columns={columns}
        data={respondents.data?.results ?? []}
        isLoading={respondents.isPending}
        isFetching={respondents.isFetching}
        isError={respondents.isError}
        onRowClick={(row) => router.push(`/respondents/${row.id}`)}
        emptyIcon={Users2}
        emptyTitle="No respondents yet"
        emptyDescription="Once agents start collecting responses, respondents will appear here."
        pagination={{ page, pageSize, total: respondents.data?.count ?? 0 }}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </div>
  );
}

export default function RespondentListPage() {
  return (
    <PermissionGate module="respondents" action="view" featureName="respondents">
      <RespondentsContent />
    </PermissionGate>
  );
}
