"use client";

import { ArrowLeft, UserX } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponseStatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGate } from "@/components/permission-gate";
import { canAccess, useMyPermissions } from "@/hooks/use-permissions";
import { formatDate, formatDateTime } from "@/lib/format";
import { useResponses } from "../../responses/_hooks/use-responses";
import { AnonymiseDialog } from "./_components/anonymise-dialog";
import { useRespondent } from "../_hooks/use-respondents";

function DetailContent({ respondentId }: { respondentId: string }) {
  const respondent = useRespondent(respondentId);
  const responses = useResponses({ respondent: respondentId, page: 1, page_size: 10 });
  const perms = useMyPermissions();
  const canEdit = canAccess(perms.data, "respondents", "edit");
  const router = useRouter();

  if (respondent.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (respondent.isError || !respondent.data) {
    return <EmptyState title="Couldn't load this respondent" description="They may have been removed, or you may not have access to them." />;
  }

  const r = respondent.data;

  return (
    <div>
      <Link href="/respondents" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> All respondents
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-ink">{r.full_name}</h1>
            {r.is_anonymised && <Badge tone="neutral">Anonymised</Badge>}
          </div>
          <p className="mt-1 text-sm text-ink-muted">Added {formatDate(r.created_at)}</p>
        </div>
        {canEdit && !r.is_anonymised && (
          <div className="flex gap-2">
            <AnonymiseDialog
              respondentId={respondentId}
              trigger={
                <Button variant="destructive">
                  <UserX className="h-4 w-4" /> Anonymise
                </Button>
              }
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Responses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {responses.isPending ? (
                <Skeleton className="h-16 w-full" />
              ) : (responses.data?.results.length ?? 0) === 0 ? (
                <p className="text-sm text-ink-muted">No survey responses recorded for this respondent yet.</p>
              ) : (
                responses.data?.results.map((resp) => (
                  <button
                    key={resp.id}
                    onClick={() => router.push(`/responses/${resp.id}`)}
                    className="flex w-full items-center justify-between border-b border-line pb-3 text-left last:border-0 last:pb-0 hover:opacity-80"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">{resp.survey_title}</p>
                      <p className="font-mono-data text-xs text-ink-faint">{resp.response_code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-muted">{formatDateTime(resp.submitted_at)}</span>
                      <ResponseStatusBadge status={resp.status} />
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {Object.keys(r.custom_fields).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Custom fields</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(r.custom_fields).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-ink-muted">{key}</span>
                    <span className="text-ink">{String(value)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Demographics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-muted">Phone</span>
                <span className="font-mono-data text-ink">{r.phone || "—"}</span>
              </div>
              {r.alt_phone && (
                <div className="flex justify-between">
                  <span className="text-ink-muted">Alt. phone</span>
                  <span className="font-mono-data text-ink">{r.alt_phone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-ink-muted">Email</span>
                <span className="text-ink">{r.email || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Gender</span>
                <span className="text-ink">{r.gender || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Date of birth</span>
                <span className="text-ink">{formatDate(r.date_of_birth)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">ID number</span>
                <span className="font-mono-data text-ink">{r.identity_number || "—"}</span>
              </div>
              {r.address && (
                <div>
                  <span className="text-ink-muted">Address</span>
                  <p className="mt-0.5 text-ink">{r.address}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function RespondentDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <PermissionGate module="respondents" action="view" featureName="respondents">
      <DetailContent respondentId={params.id} />
    </PermissionGate>
  );
}
