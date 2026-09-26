"use client";

import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PermissionGate } from "@/components/permission-gate";
import { apiErrorMessage } from "@/lib/api-client/client";
import { useExportResponses } from "../_hooks/use-reports";

function MasterReportContent() {
  const exportResponses = useExportResponses();

  return (
    <div>
      <Link href="/reports" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> All reports
      </Link>
      <PageHeader
        title="All Responses Report"
        description="Every response, from every agent, across every survey -- with respondent and demographic details included. No filters; use the Custom Response Report to narrow it down."
      />

      <Card>
        <CardContent className="flex items-center justify-between py-6">
          <p className="text-sm text-ink-muted">
            Downloads an Excel (.xlsx) file with one row per response and one column per question, plus the
            respondent&rsquo;s name, phone, email and demographic answers.
          </p>
          <Button
            className="shrink-0"
            loading={exportResponses.isPending}
            onClick={() =>
              exportResponses.mutate(
                {},
                { onError: (err) => toast.error("Couldn't generate the report", { description: apiErrorMessage(err) }) },
              )
            }
          >
            <Download className="h-4 w-4" /> Download report (.xlsx)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MasterReportPage() {
  return (
    <PermissionGate module="reports" action="export" featureName="the master report">
      <MasterReportContent />
    </PermissionGate>
  );
}
