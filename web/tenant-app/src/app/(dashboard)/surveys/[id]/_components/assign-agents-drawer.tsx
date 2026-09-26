"use client";

import { Users2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { DrawerSection } from "@/components/ui/drawer-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/api-client/client";
import { useTenantUsers } from "../../../admin/_hooks/use-admin";
import { useAssignAgents, useRevokeAssignment, useSurveyAssignments } from "../../_hooks/use-surveys";

export function AssignAgentsDrawer({ surveyId, trigger }: { surveyId: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [seeded, setSeeded] = useState(false);

  const agents = useTenantUsers();
  const assignments = useSurveyAssignments(surveyId);
  const assignAgents = useAssignAgents(surveyId);
  const revokeAssignment = useRevokeAssignment();

  const activeAgents = (agents.data ?? []).filter((u) => u.role_code === "agent" && u.is_active);
  const assignedRows = assignments.data?.results ?? [];
  const assignedUserIds = assignedRows
    .map((a) => a.assignee_user_id)
    .filter((id): id is string => !!id);

  useEffect(() => {
    if (!open) {
      setSeeded(false);
      return;
    }
    if (!seeded && assignments.isSuccess) {
      setSelected(assignedUserIds);
      setSeeded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seeded, assignments.isSuccess]);

  const isSaving = assignAgents.isPending || revokeAssignment.isPending;

  const onSave = async () => {
    const toAdd = selected.filter((id) => !assignedUserIds.includes(id));
    const toRemove = assignedRows.filter((a) => a.assignee_user_id && !selected.includes(a.assignee_user_id));

    try {
      if (toAdd.length > 0) {
        await assignAgents.mutateAsync(toAdd);
      }
      for (const assignment of toRemove) {
        await revokeAssignment.mutateAsync(assignment.id);
      }
      toast.success("Agent assignments updated");
      setOpen(false);
    } catch (err) {
      toast.error("Couldn't update assignments", { description: apiErrorMessage(err) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent side="right">
        <form
          className="flex h-full flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <DialogHeader>
            <DialogTitle>Assign agents</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DrawerSection title="Agents">
              <p className="-mt-1 text-xs text-ink-faint">
                An agent can only collect responses for surveys assigned to them. Agents already holding other
                surveys can still be assigned here.
              </p>
              {agents.isPending || assignments.isPending ? (
                <div className="space-y-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : activeAgents.length > 0 ? (
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-line p-3">
                  {activeAgents.map((a) => (
                    <label key={a.id} className="flex items-center gap-2 text-sm text-ink">
                      <Checkbox
                        checked={selected.includes(a.id)}
                        onCheckedChange={(checked) =>
                          setSelected((ids) => (checked ? [...ids, a.id] : ids.filter((id) => id !== a.id)))
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">{a.full_name}</span>
                      <span className="shrink-0 text-xs text-ink-faint">{a.email}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Users2}
                  title="No agents yet"
                  description="Invite an agent from Users, then assign them here."
                />
              )}
            </DrawerSection>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSaving}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
