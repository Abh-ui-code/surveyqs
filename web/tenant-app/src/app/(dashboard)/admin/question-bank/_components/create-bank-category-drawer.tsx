"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { apiErrorMessage } from "@/lib/api-client/client";
import { useCreateQuestionBankCategory } from "../_hooks/use-question-bank";

export function CreateBankCategoryDrawer({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const createCategory = useCreateQuestionBankCategory();

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCategory.mutate(name, {
      onSuccess: () => {
        toast.success("Category created");
        setOpen(false);
      },
      onError: (err) => toast.error("Couldn't create category", { description: apiErrorMessage(err) }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent side="right">
        <form className="flex h-full flex-col" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New bank category</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DrawerSection title="Category">
              <DrawerField
                label="Name"
                required
                hint="Groups bank questions by topic -- independent of survey categories, so any survey can pull from it regardless of its own category."
              >
                <Input placeholder="Agriculture" value={name} onChange={(e) => setName(e.target.value)} required />
              </DrawerField>
            </DrawerSection>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createCategory.isPending}>
              Create category
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
