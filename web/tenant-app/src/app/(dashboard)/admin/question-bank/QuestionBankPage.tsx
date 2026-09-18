"use client";

import { BookOpen, MoreHorizontal, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { Select } from "@/components/ui/select";
import { PermissionGate } from "@/components/permission-gate";
import { apiErrorMessage } from "@/lib/api-client/client";
import { typeLabel } from "../../surveys/[id]/_question-types";
import { BankQuestionDrawer } from "./_components/bank-question-drawer";
import { CreateBankCategoryDrawer } from "./_components/create-bank-category-drawer";
import {
  useBankQuestions,
  useDeleteBankQuestion,
  useQuestionBankCategories,
  type BankQuestion,
} from "./_hooks/use-question-bank";

function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useMemo(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function QuestionBankContent() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [pendingDelete, setPendingDelete] = useState<BankQuestion | null>(null);
  const debouncedSearch = useDebounced(search);
  const categories = useQuestionBankCategories();
  const categoryLabel = useMemo(
    () => new Map(categories.data?.results.map((c) => [c.id, c.name])),
    [categories.data],
  );

  const questions = useBankQuestions({
    category: category || undefined,
    search: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
  });
  const deleteBankQuestion = useDeleteBankQuestion();

  const columns: ColumnDef<BankQuestion>[] = [
    {
      key: "category",
      label: "Category",
      render: (row) => (
        <Badge tone={row.category ? "brand" : "neutral"}>
          {row.category ? categoryLabel.get(row.category) ?? "—" : "Uncategorized"}
        </Badge>
      ),
    },
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
            <BankQuestionDrawer question={row} trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Edit</DropdownMenuItem>} />
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
        title="Question bank"
        description="Reusable questions, organized by category, that any survey can pull from instead of creating them from scratch."
        actions={
          <div className="flex gap-2">
            <CreateBankCategoryDrawer
              trigger={
                <Button variant="secondary">
                  <Plus className="h-4 w-4" /> New category
                </Button>
              }
            />
            <BankQuestionDrawer
              trigger={
                <Button>
                  <Plus className="h-4 w-4" /> New question
                </Button>
              }
            />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput className="max-w-xs" value={search} onChange={setSearch} placeholder="Search questions..." />
        <Select className="w-44" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.data?.results.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        {(category || search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCategory("");
              setSearch("");
            }}
          >
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
        emptyIcon={BookOpen}
        emptyTitle="No questions in the bank yet"
        emptyDescription="Add questions here so surveys can pull them in instead of being created from scratch each time."
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete "${pendingDelete?.label.en ?? pendingDelete?.code}"?`}
        description="Surveys that already inserted this question keep their own copy -- only future inserts from the bank are affected."
        variant="danger"
        confirmLabel="Delete"
        loading={deleteBankQuestion.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteBankQuestion.mutate(pendingDelete.id, {
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

export default function QuestionBankPage() {
  return (
    <PermissionGate module="settings" action="view" featureName="the question bank">
      <QuestionBankContent />
    </PermissionGate>
  );
}
