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
import { Select } from "@/components/ui/select";
import { apiErrorMessage } from "@/lib/api-client/client";
import { useCreateChoiceList, useCreateQuestion, type ChoiceListItem, type Section } from "../../_hooks/use-surveys";
import { QUESTION_TYPES } from "../_question-types";
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
  const [condition, setCondition] = useState<ConditionState>(emptyCondition());
  const [rows, setRows] = useState<QuestionRow[]>([newRow()]);
  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({});
  const [submitting, setSubmitting] = useState(false);
  const createQuestion = useCreateQuestion(surveyId);
  const createChoiceList = useCreateChoiceList(surveyId);

  const eligibleSources = eligibleConditionSources(sections, choiceLists, { uptoSectionId: sectionId });

  const resetDrawer = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setCondition(emptyCondition());
      setRows([newRow()]);
      setRowErrors({});
    }
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <Dialog open={open} onOpenChange={resetDrawer}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent side="right">
        <form className="flex h-full flex-col" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Add question{rows.length > 1 ? "s" : ""}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-5">
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
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Add {rows.length > 1 ? `${rows.length} questions` : "question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
