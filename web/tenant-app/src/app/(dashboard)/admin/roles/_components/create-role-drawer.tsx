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
import { useCreateRole } from "../../_hooks/use-admin";

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function CreateRoleDrawer({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const createRole = useCreateRole();

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createRole.mutate(
      { code: slugify(name), name },
      {
        onSuccess: () => {
          toast.success("Role created — grant it permissions below");
          setOpen(false);
        },
        onError: (err) => toast.error("Couldn't create role", { description: apiErrorMessage(err) }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent side="right">
        <form className="flex h-full flex-col" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New custom role</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DrawerSection title="Role">
              <DrawerField label="Name" required hint="A short, descriptive name -- you'll grant it permissions next.">
                <Input placeholder="Data entry clerk" value={name} onChange={(e) => setName(e.target.value)} required />
              </DrawerField>
            </DrawerSection>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createRole.isPending}>
              Create role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
