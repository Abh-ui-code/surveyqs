"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DrawerField } from "@/components/ui/drawer-form";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/api-client/client";
import { useRejectResponse } from "../../_hooks/use-responses";

const REASONS = [
  { value: "incomplete_inconsistent", label: "Incomplete or inconsistent answers" },
  { value: "photo_unclear", label: "Photo missing, unclear, or of the wrong subject" },
  { value: "location_mismatch", label: "Location does not match the assigned area" },
  { value: "suspected_not_conducted", label: "Suspected not conducted" },
  { value: "duplicate", label: "Duplicate of another response" },
  { value: "other", label: "Other" },
];

export function RejectDialog({ responseId, trigger }: { responseId: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0].value);
  const [notes, setNotes] = useState("");
  const reject = useRejectResponse(responseId);

  const onSubmit = () => {
    reject.mutate(
      { reason_code: reason, notes },
      {
        onSuccess: () => {
          toast.success("Response rejected — the agent can now correct and resubmit it");
          setOpen(false);
        },
        onError: (err) => toast.error("Couldn't reject", { description: apiErrorMessage(err) }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent side="center">
        <DialogHeader>
          <DialogTitle>Reject this response</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <DrawerField label="Reason" required>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </DrawerField>
          <DrawerField label="Notes for the agent" hint="Be specific -- this is what they'll act on.">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What needs to be fixed?" />
          </DrawerField>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onSubmit} loading={reject.isPending}>
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
