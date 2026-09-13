"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiErrorMessage } from "@/lib/api-client/client";
import { useAnonymiseRespondent } from "../../_hooks/use-respondents";

export function AnonymiseDialog({ respondentId, trigger }: { respondentId: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const anonymise = useAnonymiseRespondent(respondentId);

  const onConfirm = () => {
    anonymise.mutate(undefined, {
      onSuccess: () => {
        toast.success("Respondent anonymised");
        setOpen(false);
      },
      onError: (err) => toast.error("Couldn't anonymise", { description: apiErrorMessage(err) }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent side="center">
        <DialogHeader>
          <DialogTitle>Anonymise this respondent?</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-ink-muted">
            This permanently scrubs their name, phone, email, address, date of birth and identity number. Their past
            survey answers stay intact, but they can no longer be identified. This cannot be undone.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} loading={anonymise.isPending}>
            Anonymise
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
