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
import { useCreateQuestion } from "../../_hooks/use-surveys";
import { QUESTION_TYPES } from "../_question-types";

const CODE_RE = /^[a-z][a-z0-9_]{0,62}$/;
const schema = z.object({
  label: z.string().min(1, "Give the question a label."),
  code: z.string().regex(CODE_RE, "Lowercase letters, numbers and underscores, starting with a letter."),
  type: z.string().min(1),
  required: z.boolean(),
});
type Values = z.infer<typeof schema>;

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 63) || "question";
}

export function AddQuestionDrawer({
  surveyId,
  sectionId,
  trigger,
}: {
  surveyId: string;
  sectionId: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [codeEdited, setCodeEdited] = useState(false);
  const createQuestion = useCreateQuestion(surveyId);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { required: false, type: "text" } });

  const label = watch("label");

  useEffect(() => {
    if (open) {
      reset({ label: "", code: "", type: "text", required: false });
      setCodeEdited(false);
    }
  }, [open, reset]);

  useEffect(() => {
    // The code auto-derives from the label until the admin edits it
    // directly -- codes must be stable, but the first draft shouldn't
    // require thinking about a separate identifier.
    if (!codeEdited && label) setValue("code", slugify(label));
  }, [label, codeEdited, setValue]);

  const onSubmit = (values: Values) => {
    createQuestion.mutate(
      {
        section: sectionId,
        code: values.code,
        type: values.type,
        label: { en: values.label },
        is_required: values.required ? "true" : "false",
      },
      {
        onSuccess: () => {
          toast.success("Question added");
          setOpen(false);
        },
        onError: (err) => toast.error("Couldn't add question", { description: apiErrorMessage(err) }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent side="right">
        <form className="flex h-full flex-col" onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Add question</DialogTitle>
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
                <Input
                  className="font-mono-data"
                  {...register("code", {
                    onChange: () => setCodeEdited(true),
                  })}
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
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createQuestion.isPending}>
              Add question
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
