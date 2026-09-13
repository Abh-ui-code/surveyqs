"use client";

import { ArrowLeft, Check, Flag, MapPin, X } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponseStatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGate } from "@/components/permission-gate";
import { canAccess, useMyPermissions } from "@/hooks/use-permissions";
import { apiErrorMessage } from "@/lib/api-client/client";
import { branchParentCode, displayAnswer, type ChoiceListDef } from "@/lib/form-schema";
import { formatDateTime, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useVersionSchema } from "../../surveys/[id]/collect/_hooks/use-collect";
import { RejectDialog } from "./_components/reject-dialog";
import { useApproveResponse, useResponse } from "../_hooks/use-responses";

function DetailContent({ responseId }: { responseId: string }) {
  const response = useResponse(responseId);
  const schema = useVersionSchema(response.data?.survey ?? "", response.data?.version_number);
  const approve = useApproveResponse(responseId);
  const perms = useMyPermissions();
  const canReview = canAccess(perms.data, "responses", "approve");

  const choiceLists = useMemo(() => {
    const map: Record<string, ChoiceListDef> = {};
    schema.data?.choice_lists.forEach((cl) => {
      map[cl.name] = cl;
    });
    return map;
  }, [schema.data]);

  const choiceLabel = (listName: string, value: string) => {
    const choice = choiceLists[listName]?.choices.find((c) => c.value === value);
    return choice?.label.en ?? value;
  };

  if (response.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (response.isError || !response.data) {
    return <EmptyState title="Couldn't load this response" description="It may have been removed, or you may not have access to it." />;
  }

  const r = response.data;
  const answerCodes = new Set(Object.keys(r.answers));
  const codesShownFromSchema = new Set<string>(
    schema.data?.sections.flatMap((s) => s.questions.map((q) => q.code)).filter((code) => answerCodes.has(code)) ?? [],
  );

  return (
    <div>
      <Link href="/responses" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> All responses
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono-data text-lg font-semibold text-ink">{r.response_code}</h1>
            <ResponseStatusBadge status={r.status} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {r.survey_title} · {r.respondent_name ?? "Anonymous respondent"}
          </p>
        </div>
        {canReview && r.status !== "approved" && r.status !== "rejected" && (
          <div className="flex gap-2">
            <RejectDialog
              responseId={responseId}
              trigger={
                <Button variant="secondary">
                  <X className="h-4 w-4" /> Reject
                </Button>
              }
            />
            <Button
              onClick={() =>
                approve.mutate(undefined, {
                  onSuccess: () => toast.success("Response approved"),
                  onError: (err) => toast.error("Couldn't approve", { description: apiErrorMessage(err) }),
                })
              }
              loading={approve.isPending}
            >
              <Check className="h-4 w-4" /> Approve
            </Button>
          </div>
        )}
      </div>

      {r.flags.length > 0 && (
        <div className="mb-4 space-y-2">
          {r.flags.map((f) => (
            <div key={f.id} className="flex items-start gap-2 rounded-md border border-amber/30 bg-amber-soft px-3 py-2 text-sm text-amber">
              <Flag className="mt-0.5 h-4 w-4 shrink-0" />
              {f.message}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Answers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {Object.keys(r.answers).length === 0 ? (
                <p className="text-sm text-ink-muted">No answers recorded.</p>
              ) : schema.isPending ? (
                <Skeleton className="h-40 w-full" />
              ) : schema.data ? (
                <>
                  {schema.data.sections
                    .filter((section) => section.questions.some((q) => answerCodes.has(q.code)))
                    .map((section) => (
                      <div key={section.id} className="space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-strong">
                          {section.title.en ?? section.code}
                        </h4>
                        <div className="space-y-3">
                          {section.questions
                            .filter((q) => answerCodes.has(q.code))
                            .map((q) => {
                              const isBranch = branchParentCode(section, q) !== null;
                              return (
                                <div
                                  key={q.id}
                                  className={cn(
                                    "border-b border-line pb-3 last:border-0 last:pb-0",
                                    isBranch && "ml-4 border-l-2 border-brand/25 pl-4",
                                  )}
                                >
                                  <p className="text-xs text-ink-faint">{q.label.en ?? q.code}</p>
                                  <p className="mt-0.5 text-sm text-ink">
                                    {displayAnswer(q, r.answers[q.code], choiceLabel)}
                                  </p>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ))}

                  {Object.entries(r.answers).filter(([code]) => !codesShownFromSchema.has(code)).length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Other answers</h4>
                      <div className="space-y-3">
                        {Object.entries(r.answers)
                          .filter(([code]) => !codesShownFromSchema.has(code))
                          .map(([code, value]) => (
                            <div key={code} className="border-b border-line pb-3 last:border-0 last:pb-0">
                              <p className="font-mono-data text-xs text-ink-faint">{code}</p>
                              <p className="mt-0.5 text-sm text-ink">
                                {Array.isArray(value) ? value.join(", ") : String(value)}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                // The version schema couldn't be loaded -- fall back to the
                // raw stored answers rather than showing nothing.
                Object.entries(r.answers).map(([code, value]) => (
                  <div key={code} className="border-b border-line pb-3 last:border-0 last:pb-0">
                    <p className="font-mono-data text-xs text-ink-faint">{code}</p>
                    <p className="mt-0.5 text-sm text-ink">
                      {Array.isArray(value) ? value.join(", ") : String(value)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {r.reviews.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {r.reviews.map((rev) => (
                  <div key={rev.id} className="text-sm">
                    <span className="font-medium capitalize text-ink">{rev.action}</span>
                    {rev.notes && <span className="text-ink-muted"> — {rev.notes}</span>}
                    <div className="text-xs text-ink-faint">{formatDateTime(rev.created_at)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-muted">Duration</span>
                <span className="font-mono-data text-ink">{formatDuration(r.duration_seconds)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Submitted</span>
                <span className="text-ink">{formatDateTime(r.submitted_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Category</span>
                <Badge tone="neutral">{r.category_label}</Badge>
              </div>
              {r.was_offline && (
                <div className="flex justify-between">
                  <span className="text-ink-muted">Collected</span>
                  <span className="text-ink">Offline</span>
                </div>
              )}
              {r.gps_lat != null && r.gps_lng != null && (
                <div className="flex items-center gap-1.5 pt-1 text-ink-muted">
                  <MapPin className="h-3.5 w-3.5" />
                  {r.gps_lat.toFixed(5)}, {r.gps_lng.toFixed(5)}
                  {r.gps_accuracy_m != null && <span className="text-xs">(±{r.gps_accuracy_m.toFixed(0)}m)</span>}
                </div>
              )}
            </CardContent>
          </Card>

          {r.attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Attachments</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {r.attachments.map((a) =>
                  a.url ? (
                    <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-line">
                      {a.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.url} alt={a.question_code} className="h-24 w-full object-cover" />
                      ) : (
                        <div className="flex h-24 items-center justify-center bg-paper-sunken text-xs text-ink-muted">
                          {a.filename}
                        </div>
                      )}
                    </a>
                  ) : null,
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResponseDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <PermissionGate module="responses" action="view" featureName="responses">
      <DetailContent responseId={params.id} />
    </PermissionGate>
  );
}
