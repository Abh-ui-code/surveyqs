"use client";

import { Plus, Trash2 } from "lucide-react";
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
import { DrawerField } from "@/components/ui/drawer-form";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/api-client/client";
import { cn } from "@/lib/utils";
import {
  useCreateChoiceList,
  useCreateQuestion,
  useCreateQuestionFromBank,
  type ChoiceListItem,
  type Section,
} from "../../_hooks/use-surveys";
import { useBankQuestions, useQuestionBankCategories } from "../../../admin/question-bank/_hooks/use-question-bank";
import { QUESTION_TYPES, typeLabel } from "../_question-types";
import {
  buildConfigPayload,
  ChoiceOptionsEditor,
  defaultOptions,
  NUMERIC_TYPES,
  NumericConfigFields,
  OPTION_TYPES,
  RatingConfigField,
  type ChoiceOption,
  type NumericConfig,
} from "./question-config-fields";
import {
  compileCondition,
  ConditionEditor,
  eligibleConditionSources,
  emptyCondition,
  type ConditionState,
} from "./question-condition-field";

const CODE_RE = /^[a-z][a-z0-9_]{0,62}$/;

type Mode = "create" | "bank";

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 63) || "question";
}

interface QuestionRow {
  id: string;
  label: string;
  code: string;
  codeEdited: boolean;
  type: string;
  required: boolean;
  options: ChoiceOption[];
  numericConfig: NumericConfig;
  ratingMax: string;
}

interface RowErrors {
  label?: string;
  code?: string;
  options?: string;
}

function newRow(): QuestionRow {
  return {
    id: crypto.randomUUID(),
    label: "",
    code: "",
    codeEdited: false,
    type: "text",
    required: false,
    options: defaultOptions(),
    numericConfig: {},
    ratingMax: "5",
  };
}

/** The "From bank" panel of the drawer: browse/search the admin-managed
 * question bank and insert copies into this section. Bank categories are
 * independent of a survey's own category (a "Wheat Farming" survey should
 * still see questions filed under a "Farming" bank category), so this
 * always starts unfiltered -- the category select here is just a manual
 * way to narrow down, never a default tied to the current survey.
 *
 * Inserted questions never carry the bank item's visibility condition -- a
 * bank item has no fixed position, so any baked-in `relevant` referencing
 * another survey's question codes would be meaningless here; the user wires
 * up skip logic afterward via the normal edit drawer, same as any newly
 * created question. */
function BankPanel({ selectedIds, onToggle }: { selectedIds: Set<string>; onToggle: (id: string) => void }) {
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const categories = useQuestionBankCategories();
  const bankQuestions = useBankQuestions({
    category: category || undefined,
    search: search.length >= 2 ? search : undefined,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select className="w-44" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.data?.results.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <SearchInput className="max-w-xs flex-1" value={search} onChange={setSearch} placeholder="Search bank..." />
      </div>

      <div className="max-h-72 overflow-y-auto rounded-md border border-line">
        {bankQuestions.isPending ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : !bankQuestions.data?.results.length ? (
          <p className="p-4 text-sm text-ink-faint">No matching questions in the bank.</p>
        ) : (
          <ul className="divide-y divide-line">
            {bankQuestions.data.results.map((q) => (
              <li key={q.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-paper-sunken/60">
                  <Checkbox checked={selectedIds.has(q.id)} onCheckedChange={() => onToggle(q.id)} />
                  <span className="flex-1 truncate text-sm text-ink">{q.label.en ?? q.code}</span>
                  <span className="shrink-0 text-xs text-ink-faint">{typeLabel(q.type)}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function AddQuestionDrawer({
  surveyId,
  sectionId,
  sections,
  choiceLists,
  trigger,
}: {
  surveyId: string;
  sectionId: string;
  sections: Section[];
  choiceLists: ChoiceListItem[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [condition, setCondition] = useState<ConditionState>(emptyCondition());
  const [rows, setRows] = useState<QuestionRow[]>([newRow()]);
  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({});
  const [selectedBankIds, setSelectedBankIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const createQuestion = useCreateQuestion(surveyId);
  const createChoiceList = useCreateChoiceList(surveyId);
  const createQuestionFromBank = useCreateQuestionFromBank(surveyId);

  const eligibleSources = eligibleConditionSources(sections, choiceLists, { uptoSectionId: sectionId });

  const resetDrawer = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setMode("create");
      setCondition(emptyCondition());
      setRows([newRow()]);
      setRowErrors({});
      setSelectedBankIds(new Set());
    }
  };

  const toggleBankSelection = (id: string) => {
    setSelectedBankIds((ids) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateRow = (id: string, patch: Partial<QuestionRow>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const updateLabel = (id: string, label: string) => {
    setRows((rs) =>
      rs.map((r) => (r.id === id ? { ...r, label, code: r.codeEdited ? r.code : slugify(label) } : r)),
    );
  };

  const addRow = () => setRows((rs) => [...rs, newRow()]);
  const removeRow = (id: string) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));

  const validateRows = (): boolean => {
    const nextErrors: Record<string, RowErrors> = {};
    const seenCodes = new Set<string>();
    for (const row of rows) {
      const errors: RowErrors = {};
      if (!row.label.trim()) errors.label = "Give the question a label.";
      if (!CODE_RE.test(row.code)) {
        errors.code = "Lowercase letters, numbers and underscores, starting with a letter.";
      } else if (seenCodes.has(row.code)) {
        errors.code = "Codes must be unique.";
      }
      seenCodes.add(row.code);
      if (OPTION_TYPES.has(row.type) && row.options.filter((o) => o.label.trim()).length === 0) {
        errors.options = "Add at least one option.";
      }
      if (Object.keys(errors).length > 0) nextErrors[row.id] = errors;
    }
    setRowErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitFromBank = async () => {
    if (selectedBankIds.size === 0) return;
    setSubmitting(true);
    try {
      // Sequential, not Promise.all -- same reason as the "create" path
      // below: the server assigns each question's `order` as a count of
      // questions in the section so far, so concurrent inserts would race.
      for (const bankQuestionId of selectedBankIds) {
        await createQuestionFromBank.mutateAsync({ bank_question_id: bankQuestionId, section_id: sectionId });
      }
      toast.success(selectedBankIds.size > 1 ? `${selectedBankIds.size} questions added` : "Question added");
      setOpen(false);
    } catch (err) {
      toast.error("Couldn't add question(s)", { description: apiErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const submitCreate = async () => {
    if (!validateRows()) return;

    setSubmitting(true);
    const relevant = compileCondition(condition);
    try {
      // Sequential, not Promise.all: the server assigns each question's
      // `order` as `count of questions in the section so far`, so creating
      // them concurrently would race and could hand out duplicate orders.
      for (const row of rows) {
        let choiceListId: string | undefined;
        if (OPTION_TYPES.has(row.type)) {
          const validOptions = row.options
            .filter((o) => o.label.trim())
            .map((o, i) => ({ value: o.value, label: { en: o.label }, order: i }));
          const list = await createChoiceList.mutateAsync({ name: row.code, choices: validOptions });
          choiceListId = list.id;
        }
        const config = buildConfigPayload(row.type, row.numericConfig, row.ratingMax);
        await createQuestion.mutateAsync({
          section: sectionId,
          code: row.code,
          type: row.type,
          label: { en: row.label },
          is_required: row.required ? "true" : "false",
          relevant,
          choice_list: choiceListId,
          config,
        });
      }
      toast.success(rows.length > 1 ? `${rows.length} questions added` : "Question added");
      setOpen(false);
    } catch (err) {
      toast.error("Couldn't add question(s)", { description: apiErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "bank") {
      submitFromBank();
    } else {
      submitCreate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={resetDrawer}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent side="right">
        <form className="flex h-full flex-col" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === "bank" ? "Add from bank" : `Add question${rows.length > 1 ? "s" : ""}`}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <div className="flex gap-1 rounded-md bg-paper-sunken p-1">
              <button
                type="button"
                onClick={() => setMode("create")}
                className={cn(
                  "flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                  mode === "create" ? "bg-paper-raised text-ink shadow-sm" : "text-ink-muted hover:text-ink",
                )}
              >
                Create new
              </button>
              <button
                type="button"
                onClick={() => setMode("bank")}
                className={cn(
                  "flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                  mode === "bank" ? "bg-paper-raised text-ink shadow-sm" : "text-ink-muted hover:text-ink",
                )}
              >
                From bank
              </button>
            </div>

            {mode === "bank" ? (
              <BankPanel selectedIds={selectedBankIds} onToggle={toggleBankSelection} />
            ) : (
              <>
                <ConditionEditor sources={eligibleSources} condition={condition} onChange={setCondition} />
                <p className="-mt-3 text-xs text-ink-faint">
                  {condition.mode === "always"
                    ? "Add one or more questions below."
                    : "This condition applies to every question you add below."}
                </p>

                {rows.map((row, index) => (
                  <div key={row.id} className="space-y-3 rounded-md border border-line p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-strong">
                        Question {index + 1}
                      </h4>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="rounded-md p-1 text-ink-faint hover:bg-rust-soft hover:text-rust"
                          title="Remove this question"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <DrawerField label="Label" required error={rowErrors[row.id]?.label}>
                      <Input
                        placeholder="How many acres do you farm?"
                        value={row.label}
                        onChange={(e) => updateLabel(row.id, e.target.value)}
                      />
                    </DrawerField>
                    <DrawerField
                      label="Code"
                      required
                      error={rowErrors[row.id]?.code}
                      hint="Used in logic and exports. Stable once published."
                    >
                      <Input
                        className="font-mono-data"
                        value={row.code}
                        onChange={(e) => updateRow(row.id, { code: e.target.value, codeEdited: true })}
                      />
                    </DrawerField>
                    <DrawerField label="Type" required>
                      <Select value={row.type} onChange={(e) => updateRow(row.id, { type: e.target.value })}>
                        {QUESTION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </Select>
                    </DrawerField>
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <Checkbox
                        checked={row.required}
                        onCheckedChange={(checked) => updateRow(row.id, { required: checked === true })}
                      />
                      Required
                    </label>

                    {OPTION_TYPES.has(row.type) && (
                      <>
                        <ChoiceOptionsEditor options={row.options} onChange={(options) => updateRow(row.id, { options })} />
                        {rowErrors[row.id]?.options && <p className="text-xs text-rust">{rowErrors[row.id]?.options}</p>}
                      </>
                    )}
                    {NUMERIC_TYPES.has(row.type) && (
                      <NumericConfigFields
                        type={row.type}
                        config={row.numericConfig}
                        onChange={(numericConfig) => updateRow(row.id, { numericConfig })}
                      />
                    )}
                    {row.type === "rating" && (
                      <RatingConfigField max={row.ratingMax} onChange={(ratingMax) => updateRow(row.id, { ratingMax })} />
                    )}
                  </div>
                ))}

                <Button type="button" variant="secondary" size="sm" onClick={addRow}>
                  <Plus className="h-4 w-4" /> Add another question
                </Button>
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={mode === "bank" && selectedBankIds.size === 0}>
              {mode === "bank"
                ? `Insert${selectedBankIds.size > 1 ? ` ${selectedBankIds.size} questions` : selectedBankIds.size === 1 ? " question" : ""}`
                : `Add ${rows.length > 1 ? `${rows.length} questions` : "question"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
