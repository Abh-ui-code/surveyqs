"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiErrorMessage } from "@/lib/api-client/client";
import { usePublishSurvey, useValidateSurvey } from "../../_hooks/use-surveys";

export function PublishDialog({ surveyId, trigger }: { surveyId: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const validate = useValidateSurvey(surveyId);
  const publish = usePublishSurvey(surveyId);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setChangeNote("");
      validate.mutate();
    }
  };

  const onPublish = () => {
    publish.mutate(changeNote, {
      onSuccess: (result) => {
        toast.success(`Version ${result.version_number} published`);
        setOpen(false);
      },
      onError: (err) => toast.error("Couldn't publish", { description: apiErrorMessage(err) }),
    });
  };

  const canPublish = validate.data?.valid === true;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent side="center">
        <DialogHeader>
          <DialogTitle>Publish this survey</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {validate.isPending && <p className="text-sm text-ink-muted">Checking the survey...</p>}

          {validate.data && validate.data.errors.length > 0 && (
            <div className="rounded-md border border-rust/30 bg-rust-soft p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-rust">
                <AlertCircle className="h-4 w-4" /> {validate.data.errors.length} issue(s) must be fixed first
              </div>
              <ul className="mt-2 space-y-1 text-sm text-rust">
                {validate.data.errors.map((e, i) => (
                  <li key={i}>
                    {e.message}
                    {e.location && <span className="text-rust/70"> — {e.location}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {validate.data && validate.data.warnings.length > 0 && (
            <div className="rounded-md border border-amber/30 bg-amber-soft p-3">
              <p className="text-sm font-medium text-amber">Worth a look, but won&rsquo;t block publishing</p>
              <ul className="mt-2 space-y-1 text-sm text-amber">
                {validate.data.warnings.map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
              </ul>
            </div>
          )}

          {validate.data?.valid && (
            <div className="flex items-center gap-2 text-sm text-moss">
              <CheckCircle2 className="h-4 w-4" /> This survey is ready to publish.
            </div>
          )}

          {canPublish && (
            <div className="space-y-1.5">
              <Label>What changed? (optional)</Label>
              <Input value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="Initial version" />
              <p className="text-xs text-ink-faint">
                Publishing freezes this exact structure. Editing afterwards opens a new version -- responses already
                collected stay on the version they were answered against.
              </p>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={onPublish} disabled={!canPublish} loading={publish.isPending}>
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
