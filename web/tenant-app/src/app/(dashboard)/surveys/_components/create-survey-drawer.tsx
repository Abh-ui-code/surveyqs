"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DrawerField, DrawerSection } from "@/components/ui/drawer-form";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/api-client/client";
import { useCategories, useCreateSurvey } from "../_hooks/use-surveys";

const schema = z.object({
  title: z.string().min(1, "Give the survey a title."),
  category: z.string().min(1, "Choose a category."),
  description: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export function CreateSurveyDrawer({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const categories = useCategories();
  const createSurvey = useCreateSurvey();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) reset({ title: "", category: "", description: "" });
  }, [open, reset]);

  const onSubmit = (values: Values) => {
    createSurvey.mutate(values, {
      onSuccess: (survey) => {
        toast.success("Survey created");
        setOpen(false);
        router.push(`/surveys/${survey.id}`);
      },
      onError: (err) => toast.error("Couldn't create survey", { description: apiErrorMessage(err) }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent side="right">
        <form className="flex h-full flex-col" onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>New survey</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DrawerSection title="Details">
              <DrawerField label="Title" required error={errors.title?.message}>
                <Input placeholder="Farming Survey" {...register("title")} />
              </DrawerField>
              <DrawerField label="Category" required error={errors.category?.message}>
                <Select {...register("category")}>
                  <option value="">Choose a category</option>
                  {categories.data?.results.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </DrawerField>
              <DrawerField label="Description" hint="For your own reference -- agents don't see this.">
                <Textarea placeholder="What this survey is for" {...register("description")} />
              </DrawerField>
            </DrawerSection>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createSurvey.isPending}>
              Create survey
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
