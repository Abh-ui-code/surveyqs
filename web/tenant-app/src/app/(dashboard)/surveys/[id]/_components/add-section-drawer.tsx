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
import { useCreateSection } from "../../_hooks/use-surveys";

export function AddSectionDrawer({ surveyId, trigger }: { surveyId: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const createSection = useCreateSection(surveyId);

  useEffect(() => {
    if (open) {
      setTitle("");
      setCode("");
    }
  }, [open]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = code || title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "section";
    createSection.mutate(
      { code: finalCode, title: { en: title } },
      {
        onSuccess: () => {
          toast.success("Section added");
          setOpen(false);
        },
        onError: (err) => toast.error("Couldn't add section", { description: apiErrorMessage(err) }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent side="right">
        <form className="flex h-full flex-col" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New section</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DrawerSection title="Section">
              <DrawerField label="Title" required>
                <Input placeholder="Farm Details" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </DrawerField>
            </DrawerSection>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createSection.isPending}>
              Add section
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
