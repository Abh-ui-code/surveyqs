"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyButton } from "@/components/ui/copy-button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/api-client/client";
import { useSurveys } from "../../../surveys/_hooks/use-surveys";
import { useAssignSurveysToUser, useInviteUser, type InviteUserResult } from "../../_hooks/use-admin";

const schema = z.object({
  email: z.string().email("Enter a valid email address."),
  full_name: z.string().min(1, "Enter their name."),
  role_code: z.string().min(1, "Choose a role."),
});
type Values = z.infer<typeof schema>;

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "supervisor", label: "Supervisor" },
  { value: "agent", label: "Agent" },
  { value: "analyst", label: "Analyst" },
];

export function InviteUserDrawer({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [invited, setInvited] = useState<InviteUserResult | null>(null);
  const [surveyIds, setSurveyIds] = useState<string[]>([]);
  const [assignedCount, setAssignedCount] = useState(0);
  const invite = useInviteUser();
  const assignSurveys = useAssignSurveysToUser();
  const publishedSurveys = useSurveys({ status: "published" });
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { role_code: "agent" } });
  const isAgent = watch("role_code") === "agent";

  useEffect(() => {
    if (open) {
      reset({ email: "", full_name: "", role_code: "agent" });
      setInvited(null);
      setSurveyIds([]);
      setAssignedCount(0);
    }
  }, [open, reset]);

  const onSubmit = (values: Values) => {
    invite.mutate(values, {
      onSuccess: async (result) => {
        toast.success(`${result.full_name} was added to this workspace`);
        if (values.role_code === "agent" && surveyIds.length > 0) {
          try {
            const { assigned, failed } = await assignSurveys.mutateAsync({ userId: result.id, surveyIds });
            setAssignedCount(assigned);
            if (failed > 0) {
              toast.warning(`${assigned} of ${surveyIds.length} surveys were assigned`, {
                description: "The rest couldn't be assigned -- you can assign them later from the survey.",
              });
            }
          } catch {
            toast.warning("Account created, but survey assignment failed. Try assigning it again later.");
          }
        }
        setInvited(result);
      },
      onError: (err) => toast.error("Couldn't invite this person", { description: apiErrorMessage(err) }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent side="right">
        {invited ? (
          <div className="flex h-full flex-col">
            <DialogHeader>
              <DialogTitle>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-moss" /> {invited.full_name} is set up
                </span>
              </DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-4">
              {invited.temporary_password ? (
                <>
                  <p className="text-sm text-ink-muted">
                    Share this temporary password with <span className="font-medium text-ink">{invited.email}</span>{" "}
                    through a channel you trust. It won&rsquo;t be shown again after you close this.
                  </p>
                  <div className="flex items-center gap-2 rounded-md border border-line bg-paper-sunken px-3 py-2">
                    <code className="flex-1 font-mono-data text-sm font-semibold text-ink">{invited.temporary_password}</code>
                  </div>
                  <CopyButton value={invited.temporary_password} label="Copy temporary password" className="w-full" />
                  <p className="text-xs text-ink-faint">
                    They&rsquo;ll be asked to choose their own password the moment they sign in with this one.
                  </p>
                </>
              ) : (
                <p className="text-sm text-ink-muted">
                  <span className="font-medium text-ink">{invited.email}</span> already has an account and can sign
                  in with their existing password.
                </p>
              )}
              {assignedCount > 0 && (
                <p className="rounded-md bg-paper-sunken px-3 py-2 text-sm text-ink-muted">
                  Assigned to {assignedCount} survey{assignedCount === 1 ? "" : "s"} -- they can start collecting
                  responses as soon as they sign in.
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  reset({ email: "", full_name: "", role_code: "agent" });
                  setInvited(null);
                  setSurveyIds([]);
                  setAssignedCount(0);
                }}
              >
                Invite another
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form className="flex h-full flex-col" onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Invite a user</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <DrawerSection title="Details">
                <DrawerField label="Full name" required error={errors.full_name?.message}>
                  <Input placeholder="Priya Sharma" {...register("full_name")} />
                </DrawerField>
                <DrawerField label="Email" required error={errors.email?.message}>
                  <Input type="email" placeholder="priya@example.com" {...register("email")} />
                </DrawerField>
                <DrawerField label="Role" required error={errors.role_code?.message}>
                  <Select {...register("role_code")}>
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                </DrawerField>
              </DrawerSection>

              {isAgent && (
                <DrawerSection title="Assign surveys" className="mt-5">
                  <p className="-mt-1 text-xs text-ink-faint">
                    An agent can only collect responses for surveys assigned to them. You can pick more than one, or
                    skip this and assign surveys later.
                  </p>
                  {publishedSurveys.isPending ? (
                    <div className="space-y-2">
                      <Skeleton className="h-9 w-full" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  ) : publishedSurveys.data && publishedSurveys.data.results.length > 0 ? (
                    <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border border-line p-3">
                      {publishedSurveys.data.results.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 text-sm text-ink">
                          <Checkbox
                            checked={surveyIds.includes(s.id)}
                            onCheckedChange={(checked) =>
                              setSurveyIds((ids) => (checked ? [...ids, s.id] : ids.filter((id) => id !== s.id)))
                            }
                          />
                          <span className="min-w-0 flex-1 truncate">{s.title}</span>
                          <span className="shrink-0 text-xs text-ink-faint">{s.category.label}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-ink-faint">No published surveys yet -- publish one first, then assign it here.</p>
                  )}
                </DrawerSection>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={invite.isPending || assignSurveys.isPending}>
                Send invitation
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
