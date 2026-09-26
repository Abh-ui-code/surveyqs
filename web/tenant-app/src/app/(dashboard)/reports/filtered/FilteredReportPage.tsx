"use client";

import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DrawerField } from "@/components/ui/drawer-form";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { PermissionGate } from "@/components/permission-gate";
import { apiErrorMessage } from "@/lib/api-client/client";
import { useTenantUsers } from "../../admin/_hooks/use-admin";
import { useSurveys } from "../../surveys/_hooks/use-surveys";
import { useExportResponses } from "../_hooks/use-reports";

function FilteredReportContent() {
  const [agent, setAgent] = useState("");
  const [survey, setSurvey] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const agents = useTenantUsers();
  const surveys = useSurveys({});
  const exportResponses = useExportResponses();

  const agentOptions = (agents.data ?? []).filter((u) => u.role_code === "agent" && u.is_active);

  const onDownload = () => {
    exportResponses.mutate(
      {
        agent: agent || undefined,
        survey: survey || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      },
      { onError: (err) => toast.error("Couldn't generate the report", { description: apiErrorMessage(err) }) },
    );
  };

  return (
    <div>
      <Link href="/reports" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> All reports
      </Link>
      <PageHeader
        title="Custom Response Report"
        description="Download a report scoped to a specific agent, survey, or date range -- pick any combination, or leave a filter on 'All' to skip it."
      />

      <Card>
        <CardContent className="space-y-4 py-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DrawerField label="Agent">
              <Select value={agent} onChange={(e) => setAgent(e.target.value)}>
                <option value="">All agents</option>
                {agentOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </Select>
            </DrawerField>
            <DrawerField label="Survey">
              <Select value={survey} onChange={(e) => setSurvey(e.target.value)}>
                <option value="">All surveys</option>
                {surveys.data?.results.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </Select>
            </DrawerField>
            <DrawerField label="From">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </DrawerField>
            <DrawerField label="To">
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </DrawerField>
          </div>

          <Button loading={exportResponses.isPending} onClick={onDownload}>
            <Download className="h-4 w-4" /> Download report (.xlsx)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function FilteredReportPage() {
  return (
    <PermissionGate module="reports" action="export" featureName="filtered reports">
      <FilteredReportContent />
    </PermissionGate>
  );
}
