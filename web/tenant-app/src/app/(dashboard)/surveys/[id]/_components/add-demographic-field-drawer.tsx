"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/api-client/client";
import { useDemographicQuestions } from "../../../admin/demographic-questions/_hooks/use-demographic-questions";
import { typeLabel } from "../_question-types";
import { useAddDemographicFieldFromBank } from "../../_hooks/use-surveys";

export function AddDemographicFieldDrawer({
  surveyId,
  alreadySelectedCodes,
  trigger,
}: {
  surveyId: string;
  alreadySelectedCodes: Set<string>;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const questions = useDemographicQuestions({ search: search.length >= 2 ? search : undefined });
  const addFromBank = useAddDemographicFieldFromBank(surveyId);

  const resetDrawer = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setSearch("");
      setSelectedIds(new Set());
    }
  };

  const toggle = (id: string) => {
    setSelectedIds((ids) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    try {
      // Sequential, not Promise.all -- the server assigns each field's
      // `order` as a count of fields in the version so far, same reason as
      // AddQuestionDrawer's bank-insert path.
      for (const id of selectedIds) {
        await addFromBank.mutateAsync(id);
      }
      toast.success(selectedIds.size > 1 ? `${selectedIds.size} questions added` : "Question added");
      setOpen(false);
    } catch (err) {
      toast.error("Couldn't add question(s)", { description: apiErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={resetDrawer}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent side="right">
        <form className="flex h-full flex-col" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Add demographic fields</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search demographic questions..." />
            <div className="max-h-96 overflow-y-auto rounded-md border border-line">
              {questions.isPending ? (
                <div className="space-y-2 p-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : !questions.data?.results.length ? (
                <p className="p-4 text-sm text-ink-faint">
                  No demographic questions yet -- add some under Admin -&gt; Demographic questions first.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {questions.data.results.map((q) => {
                    const alreadyAdded = alreadySelectedCodes.has(q.code);
                    return (
                      <li key={q.id}>
                        <label
                          className={`flex items-center gap-3 px-3 py-2.5 ${
                            alreadyAdded ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-paper-sunken/60"
                          }`}
                        >
                          <Checkbox
                            checked={alreadyAdded || selectedIds.has(q.id)}
                            disabled={alreadyAdded}
                            onCheckedChange={() => toggle(q.id)}
                          />
                          <span className="flex-1 truncate text-sm text-ink">{q.label.en ?? q.code}</span>
                          <span className="shrink-0 text-xs text-ink-faint">
                            {alreadyAdded ? "Already added" : typeLabel(q.type)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={selectedIds.size === 0}>
              {selectedIds.size > 1 ? `Add ${selectedIds.size} questions` : "Add question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
