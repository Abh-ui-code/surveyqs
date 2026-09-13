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
import {
  type ChoiceListItem,
  type Question,
  type Section,
  useCreateChoiceList,
  useUpdateChoiceList,
  useUpdateQuestion,
} from "../../_hooks/use-surveys";
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
  parseCondition,
  type ConditionState,
} from "./question-condition-field";

const CODE_RE = /^[a-z][a-z0-9_]{0,62}$/;
const schema = z.object({
  label: z.string().min(1, "Give the question a label."),
  code: z.string().regex(CODE_RE, "Lowercase letters, numbers and underscores, starting with a letter."),
  type: z.string().min(1),
  required: z.boolean(),
});
type Values = z.infer<typeof schema>;

function numberToString(value: unknown): string {
  return typeof value === "number" ? String(value) : "";
}

export function EditQuestionDrawer({
  surveyId,
  question,
  sections,
  choiceLists,
  trigger,
}: {
  surveyId: string;
  question: Question;
  sections: Section[];
  choiceLists: ChoiceListItem[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ChoiceOption[]>(defaultOptions());
  const [numericConfig, setNumericConfig] = useState<NumericConfig>({});
  const [ratingMax, setRatingMax] = useState("5");
  const [condition, setCondition] = useState<ConditionState>({ mode: "always" });
  const updateQuestion = useUpdateQuestion(surveyId);
  const createChoiceList = useCreateChoiceList(surveyId);
  const updateChoiceList = useUpdateChoiceList(surveyId);

  const eligibleSources = eligibleConditionSources(sections, choiceLists, {
    uptoSectionId: question.section,
    excludeQuestionId: question.id,
    beforeOrder: question.order,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const type = watch("type");

  useEffect(() => {
    if (open) {
      reset({
        label: question.label.en ?? "",
        code: question.code,
        type: question.type,
        required: question.is_required === "true",
      });

      const existingList = question.choice_list
        ? choiceLists.find((cl) => cl.id === question.choice_list)
        : undefined;
      setOptions(
        existingList && existingList.choices.length > 0
          ? existingList.choices.map((c) => ({ value: c.value, label: c.label.en ?? c.value }))
          : defaultOptions(),
      );
      setNumericConfig({
        min: numberToString(question.config.min),
        max: numberToString(question.config.max),
        decimal_places: numberToString(question.config.decimal_places),
      });
      setRatingMax(numberToString(question.config.max) || "5");
      setCondition(parseCondition(question.relevant, eligibleSources));
    }
    // eligibleSources is derived from props on every render; re-parsing only
    // needs to happen when the drawer opens for a (possibly different) question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, question, choiceLists, reset]);

  const onSubmit = async (values: Values) => {
    const needsOptions = OPTION_TYPES.has(values.type);
    const validOptions = options
      .filter((o) => o.label.trim())
      .map((o, i) => ({ value: o.value, label: { en: o.label }, order: i }));

    if (needsOptions && validOptions.length === 0) {
      toast.error("Add at least one option.");
      return;
    }

    try {
      let choiceListId: string | null = question.choice_list;
      if (needsOptions) {
        if (question.choice_list) {
          await updateChoiceList.mutateAsync({ choiceListId: question.choice_list, data: { choices: validOptions } });
        } else {
          const list = await createChoiceList.mutateAsync({ name: values.code, choices: validOptions });
          choiceListId = list.id;
        }
      }
      const config = buildConfigPayload(values.type, numericConfig, ratingMax);
      const relevant = compileCondition(condition);

      updateQuestion.mutate(
        {
          questionId: question.id,
          data: {
            code: values.code,
            type: values.type,
            label: { ...question.label, en: values.label },
            is_required: values.required ? "true" : "false",
            relevant,
            choice_list: choiceListId,
            config,
          },
        },
        {
          onSuccess: () => {
            toast.success("Question updated");
            setOpen(false);
          },
          onError: (err) => toast.error("Couldn't update question", { description: apiErrorMessage(err) }),
        },
      );
    } catch (err) {
      toast.error("Couldn't update question", { description: apiErrorMessage(err) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent side="right">
        <form className="flex h-full flex-col" onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit question</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DrawerSection title="Question">
              <DrawerField label="Label" required error={errors.label?.message}>
                <Input placeholder="How many acres do you farm?" {...register("label")} />
              </DrawerField>
              <DrawerField
                label="Code"
                required
                error={errors.code?.message}
                hint="Used in logic and exports. Stable once published."
              >
                <Input className="font-mono-data" {...register("code")} />
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

            <ConditionEditor sources={eligibleSources} condition={condition} onChange={setCondition} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={updateQuestion.isPending || createChoiceList.isPending || updateChoiceList.isPending}
            >
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
