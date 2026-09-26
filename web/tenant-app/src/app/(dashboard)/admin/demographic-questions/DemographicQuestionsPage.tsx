"use client";

import { MoreHorizontal, Plus, Users2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { type ColumnDef, DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { PermissionGate } from "@/components/permission-gate";
import { apiErrorMessage } from "@/lib/api-client/client";
import { typeLabel } from "../../surveys/[id]/_question-types";
import { DemographicQuestionDrawer } from "./_components/demographic-question-drawer";
import {
  useDeleteDemographicQuestion,
  useDemographicQuestions,
  type DemographicQuestion,
} from "./_hooks/use-demographic-questions";

function DemographicQuestionsContent() {
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<DemographicQuestion | null>(null);

  const questions = useDemographicQuestions({ search: search.length >= 2 ? search : undefined });
  const deleteDemographicQuestion = useDeleteDemographicQuestion();

  const columns: ColumnDef<DemographicQuestion>[] = [
    {
      key: "label",
      label: "Question",
      render: (row) => (
        <div>
          <div className="font-medium text-ink">{row.label.en ?? row.code}</div>
          <div className="font-mono-data text-xs text-ink-muted">{row.code}</div>
        </div>
      ),
    },
    { key: "type", label: "Type", render: (row) => <span className="text-ink-muted">{typeLabel(row.type)}</span> },
    {
      key: "actions",
      label: "",
      className: "w-10 text-right",
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-md p-1.5 text-ink-faint hover:bg-paper-sunken hover:text-ink">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DemographicQuestionDrawer
              question={row}
              trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Edit</DropdownMenuItem>}
            />
            <DropdownMenuItem destructive onClick={() => setPendingDelete(row)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Demographic questions"
        description="Reusable respondent questions -- Gender, Occupation, Household size -- that any survey can select for its Respondent step instead of a fixed field set."
        actions={
          <DemographicQuestionDrawer
            trigger={
              <Button>
                <Plus className="h-4 w-4" /> New question
              </Button>
            }
          />
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput className="max-w-xs" value={search} onChange={setSearch} placeholder="Search questions..." />
        {search && (
          <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
            Clear filters
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={questions.data?.results ?? []}
        isLoading={questions.isPending}
        isFetching={questions.isFetching}
        isError={questions.isError}
        emptyIcon={Users2}
        emptyTitle="No demographic questions yet"
        emptyDescription="Add questions here so surveys can select them for their Respondent step."
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete "${pendingDelete?.label.en ?? pendingDelete?.code}"?`}
        description="Surveys that already selected this question keep their own copy -- only future selections from the bank are affected."
        variant="danger"
        confirmLabel="Delete"
        loading={deleteDemographicQuestion.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteDemographicQuestion.mutate(pendingDelete.id, {
            onSuccess: () => {
              toast.success("Question removed from bank");
              setPendingDelete(null);
            },
            onError: (err) => {
              toast.error("Couldn't delete question", { description: apiErrorMessage(err) });
              setPendingDelete(null);
            },
          });
        }}
      />
    </div>
  );
}

export default function DemographicQuestionsPage() {
  return (
    <PermissionGate module="settings" action="view" featureName="demographic questions">
      <DemographicQuestionsContent />
    </PermissionGate>
  );
}
