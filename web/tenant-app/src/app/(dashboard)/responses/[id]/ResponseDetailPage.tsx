"use client";

import { ArrowLeft, Flag, MapPin } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponseStatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGate } from "@/components/permission-gate";
import { branchParentCode, displayAnswer, sortSectionQuestions, type ChoiceListDef } from "@/lib/form-schema";
import { formatDateTime, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRespondent } from "../../respondents/_hooks/use-respondents";
import { useVersionSchema } from "../../surveys/[id]/collect/_hooks/use-collect";
import { useResponse } from "../_hooks/use-responses";

function DetailContent({ responseId }: { responseId: string }) {
  const response = useResponse(responseId);
  const schema = useVersionSchema(response.data?.survey ?? "", response.data?.version_number);
  // `/responses/{id}/` only carries the respondent's id + display name, not
  // their demographic answers -- fetched separately for the section below.
  const respondent = useRespondent(response.data?.respondent ?? "");

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
          {respondent.data && (
            <Card>
              <CardHeader>
                <CardTitle>Demographic details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="border-b border-line pb-3">
                  <p className="text-xs text-ink-faint">Full name</p>
                  <p className="mt-0.5 text-sm text-ink">{respondent.data.full_name || "—"}</p>
                </div>
                <div className="border-b border-line pb-3">
                  <p className="text-xs text-ink-faint">Phone</p>
                  <p className="mt-0.5 text-sm text-ink">{respondent.data.phone || "—"}</p>
                </div>
                <div className="border-b border-line pb-3 last:border-0 last:pb-0">
                  <p className="text-xs text-ink-faint">Email</p>
                  <p className="mt-0.5 text-sm text-ink">{respondent.data.email || "—"}</p>
                </div>
                {Object.entries(respondent.data.custom_fields).map(([code, value]) => {
                  const q = schema.data?.demographic_questions.find((dq) => dq.code === code);
                  return (
                    <div key={code} className="border-b border-line pb-3 last:border-0 last:pb-0">
                      <p className="text-xs text-ink-faint">{q?.label.en ?? code}</p>
                      <p className="mt-0.5 text-sm text-ink">
                        {q ? displayAnswer(q, value, choiceLabel) : String(value)}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

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
                          {sortSectionQuestions(section)
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

          {respondent.data?.consent_signature_url && (
            <Card>
              <CardHeader>
                <CardTitle>Consent Signature</CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href={respondent.data.consent_signature_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-md border border-line bg-paper-sunken"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={respondent.data.consent_signature_url}
                    alt="Respondent's consent signature"
                    className="h-24 w-full object-contain"
                  />
                </a>
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
