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
import { useCreateCategory } from "../../../surveys/_hooks/use-surveys";

function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function CreateCategoryDrawer({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const createCategory = useCreateCategory();

  useEffect(() => {
    if (open) setLabel("");
  }, [open]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCategory.mutate(
      { code: slugify(label), label },
      {
        onSuccess: () => {
          toast.success("Category created");
          setOpen(false);
        },
        onError: (err) => toast.error("Couldn't create category", { description: apiErrorMessage(err) }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent side="right">
        <form className="flex h-full flex-col" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DrawerSection title="Category">
              <DrawerField label="Name" required hint="The topic surveys are grouped under -- Farming, Electronics, Automotive.">
                <Input placeholder="Electronics" value={label} onChange={(e) => setLabel(e.target.value)} required />
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
