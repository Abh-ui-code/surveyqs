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
import { useUpdateQuestion, type Question } from "../../_hooks/use-surveys";
import { QUESTION_TYPES } from "../_question-types";

const CODE_RE = /^[a-z][a-z0-9_]{0,62}$/;
const schema = z.object({
  label: z.string().min(1, "Give the question a label."),
  code: z.string().regex(CODE_RE, "Lowercase letters, numbers and underscores, starting with a letter."),
  type: z.string().min(1),
  required: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function EditQuestionDrawer({
  surveyId,
  question,
  trigger,
}: {
  surveyId: string;
  question: Question;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const updateQuestion = useUpdateQuestion(surveyId);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset({
        label: question.label.en ?? "",
        code: question.code,
        type: question.type,
        required: question.is_required === "true",
      });
    }
  }, [open, question, reset]);

  const onSubmit = (values: Values) => {
    updateQuestion.mutate(
      {
        questionId: question.id,
        data: {
          code: values.code,
          type: values.type,
          label: { ...question.label, en: values.label },
          is_required: values.required ? "true" : "false",
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
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={updateQuestion.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
