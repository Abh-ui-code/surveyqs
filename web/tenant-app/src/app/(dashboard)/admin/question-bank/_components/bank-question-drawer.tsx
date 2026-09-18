"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import { DrawerField, DrawerSection } from "@/components/ui/drawer-form";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiErrorMessage } from "@/lib/api-client/client";
import { QUESTION_TYPES } from "../../../surveys/[id]/_question-types";
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
} from "../../../surveys/[id]/_components/question-config-fields";
import {
  useCreateBankQuestion,
  useQuestionBankCategories,
  useUpdateBankQuestion,
  type BankQuestion,
} from "../_hooks/use-question-bank";

const CODE_RE = /^[a-z][a-z0-9_]{0,62}$/;
const schema = z.object({
  category: z.string(),
  label: z.string().min(1, "Give the question a label."),
  code: z.string().regex(CODE_RE, "Lowercase letters, numbers and underscores, starting with a letter."),
  type: z.string().min(1),
  required: z.boolean(),
});
type Values = z.infer<typeof schema>;

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 63) || "question"
  );
}

function numberToString(value: unknown): string {
  return typeof value === "number" ? String(value) : "";
}

function emptyValues(): Values {
  return { category: "", label: "", code: "", type: "text", required: false };
}

export function BankQuestionDrawer({
  question,
  trigger,
}: {
  question?: BankQuestion;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [codeEdited, setCodeEdited] = useState(!!question);
  const [options, setOptions] = useState<ChoiceOption[]>(defaultOptions());
  const [numericConfig, setNumericConfig] = useState<NumericConfig>({});
  const [ratingMax, setRatingMax] = useState("5");
  const categories = useQuestionBankCategories();
  const createBankQuestion = useCreateBankQuestion();
  const updateBankQuestion = useUpdateBankQuestion();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: emptyValues() });

  const type = watch("type");

  useEffect(() => {
    if (!open) return;
    setCodeEdited(!!question);
    if (question) {
      reset({
        category: question.category ?? "",
        label: question.label.en ?? "",
        code: question.code,
        type: question.type,
        required: question.is_required === "true",
      });
      setOptions(
        question.choices.length > 0
          ? question.choices.map((c) => ({ value: c.value, label: c.label.en ?? c.value }))
          : defaultOptions(),
      );
      setNumericConfig({
        min: numberToString(question.config.min),
        max: numberToString(question.config.max),
        decimal_places: numberToString(question.config.decimal_places),
      });
      setRatingMax(numberToString(question.config.max) || "5");
    } else {
      reset(emptyValues());
      setOptions(defaultOptions());
      setNumericConfig({});
      setRatingMax("5");
    }
  }, [open, question, reset]);

  const onLabelChange = (label: string) => {
    setValue("label", label);
    if (!codeEdited) setValue("code", slugify(label));
  };

  const onSubmit = (values: Values) => {
    const needsOptions = OPTION_TYPES.has(values.type);
    const validOptions = options
      .filter((o) => o.label.trim())
      .map((o, i) => ({ value: o.value, label: { en: o.label }, order: i }));

    if (needsOptions && validOptions.length === 0) {
      toast.error("Add at least one option.");
      return;
    }

    const data = {
      category: values.category || null,
      code: values.code,
      type: values.type,
      label: { en: values.label },
      is_required: values.required ? "true" : "false",
      config: buildConfigPayload(values.type, numericConfig, ratingMax),
      choices: needsOptions ? validOptions : [],
    };

    const onSuccess = () => {
      toast.success(question ? "Question updated" : "Question added to bank");
      setOpen(false);
    };
    const onError = (err: unknown) =>
      toast.error(question ? "Couldn't update question" : "Couldn't add question", { description: apiErrorMessage(err) });

    if (question) {
      updateBankQuestion.mutate({ id: question.id, data }, { onSuccess, onError });
    } else {
      createBankQuestion.mutate(data, { onSuccess, onError });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent side="right">
        <form className="flex h-full flex-col" onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{question ? "Edit bank question" : "New bank question"}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DrawerSection title="Question">
              <DrawerField
                label="Category"
                hint="Which bank this question belongs to, e.g. Agriculture -- independent of survey categories, so any survey can pull it in."
              >
                <Select {...register("category")}>
                  <option value="">No category</option>
                  {categories.data?.results.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </DrawerField>
              <DrawerField label="Label" required error={errors.label?.message}>
                <Input
                  placeholder="How many acres do you farm?"
                  value={watch("label")}
                  onChange={(e) => onLabelChange(e.target.value)}
                />
              </DrawerField>
              <DrawerField
                label="Code"
                required
                error={errors.code?.message}
                hint="Used in logic and exports once inserted into a survey."
              >
                <Input
                  className="font-mono-data"
                  {...register("code")}
                  onChange={(e) => {
                    setCodeEdited(true);
                    setValue("code", e.target.value);
                  }}
                />
              </DrawerField>
              <DrawerField label="Type" required>
                <Select {...register("type")}>
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </DrawerField>
              <label className="flex items-center gap-2 text-sm text-ink">
                <Checkbox
                  checked={watch("required")}
                  onCheckedChange={(checked) => setValue("required", checked === true)}
                />
                Required
              </label>
            </DrawerSection>

            {OPTION_TYPES.has(type) && <ChoiceOptionsEditor options={options} onChange={setOptions} />}
            {NUMERIC_TYPES.has(type) && (
              <NumericConfigFields type={type} config={numericConfig} onChange={setNumericConfig} />
            )}
            {type === "rating" && <RatingConfigField max={ratingMax} onChange={setRatingMax} />}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createBankQuestion.isPending || updateBankQuestion.isPending}>
              {question ? "Save changes" : "Add question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
