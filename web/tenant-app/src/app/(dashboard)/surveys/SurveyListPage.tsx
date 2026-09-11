"use client";

import { ClipboardCheck, ListChecks, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { type ColumnDef, DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { SurveyStatusBadge } from "@/components/ui/status-badge";
import { PermissionGate } from "@/components/permission-gate";
import { canAccess, useMyPermissions } from "@/hooks/use-permissions";
import { CreateSurveyDrawer } from "./_components/create-survey-drawer";
import { useCategories, useSurveys, type SurveyRow } from "./_hooks/use-surveys";

function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useMemo(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function SurveysContent() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const debouncedSearch = useDebounced(search);
  const router = useRouter();
  const perms = useMyPermissions();
  const categories = useCategories();

  const params = { search: debouncedSearch.length >= 2 ? debouncedSearch : undefined, category: category || undefined, status: status || undefined };
  const surveys = useSurveys(params);
  const canCreate = canAccess(perms.data, "surveys", "create");
  const canEdit = canAccess(perms.data, "surveys", "edit");
  const canCollect = canAccess(perms.data, "responses", "create");

  const columns: ColumnDef<SurveyRow>[] = [
    {
      key: "title",
      label: "Survey",
      render: (row) => (
        <div>
          <div className="font-medium text-ink">{row.title}</div>
          <div className="text-xs text-ink-muted">{row.category.label}</div>
        </div>
      ),
    },
    { key: "status", label: "Status", render: (row) => <SurveyStatusBadge status={row.status} /> },
    {
      key: "questions",
      label: "Questions",
      render: (row) => <span className="font-mono-data text-ink">{row.question_count}</span>,
    },
    {
      key: "responses",
      label: "Responses",
      render: (row) => <span className="font-mono-data font-medium text-ink">{row.response_count}</span>,
    },
    ...(canCollect
      ? [
          {
            key: "actions",
            label: "",
            className: "text-right",
            render: (row: SurveyRow) =>
              row.status === "published" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/surveys/${row.id}/collect`);
                  }}
                >
                  <ClipboardCheck className="h-3.5 w-3.5" /> Collect
                </Button>
              ),
          } satisfies ColumnDef<SurveyRow>,
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Surveys"
        description="Every survey across every topic."
        actions={
          canCreate && (
            <CreateSurveyDrawer
              trigger={
                <Button>
                  <Plus className="h-4 w-4" /> New survey
                </Button>
              }
            />
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput className="max-w-xs" value={search} onChange={setSearch} placeholder="Search surveys..." />
        <Select className="w-44" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.data?.results.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="paused">Paused</option>
          <option value="closed">Closed</option>
          <option value="archived">Archived</option>
        </Select>
        {(category || status || search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCategory("");
              setStatus("");
              setSearch("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={surveys.data?.results ?? []}
        isLoading={surveys.isPending}
        isFetching={surveys.isFetching}
        isError={surveys.isError}
        onRowClick={(row) => {
          if (canEdit) {
            router.push(`/surveys/${row.id}`);
          } else if (canCollect && row.status === "published") {
            router.push(`/surveys/${row.id}/collect`);
          }
        }}
        emptyIcon={ListChecks}
        emptyTitle="No surveys yet"
        emptyDescription="Create your first survey to start collecting data."
        emptyAction={
          canCreate && (
            <CreateSurveyDrawer
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4" /> New survey
                </Button>
              }
            />
          )
        }
      />
    </div>
  );
}

export default function SurveyListPage() {
  return (
    <PermissionGate module="surveys" action="view" featureName="surveys">
      <SurveysContent />
    </PermissionGate>
  );
}
