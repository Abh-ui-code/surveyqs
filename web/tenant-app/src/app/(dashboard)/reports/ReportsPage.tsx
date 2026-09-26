"use client";

import { ArrowRight, FileSpreadsheet, Filter, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PermissionGate } from "@/components/permission-gate";
import { cn } from "@/lib/utils";

interface ReportCard {
  href: string;
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  description: string;
  bullets: string[];
}

const REPORTS: ReportCard[] = [
  {
    href: "/reports/master",
    icon: FileSpreadsheet,
    iconClassName: "bg-brand-soft text-brand-strong",
    title: "All Responses Report",
    description: "Every response, from every agent, across every survey.",
    bullets: [
      "Respondent name, phone, email",
      "All demographic answers",
      "Every survey's question answers",
      "No filters -- everything you can see",
    ],
  },
  {
    href: "/reports/filtered",
    icon: Filter,
    iconClassName: "bg-amber-soft text-amber",
    title: "Custom Response Report",
    description: "Scope a download to a specific agent, survey, or date range.",
    bullets: [
      "Filter by agent",
      "Filter by survey",
      "Filter by date range",
      "Same columns as the master report, narrowed down",
    ],
  },
];

function ReportsContent() {
  return (
    <div>
      <PageHeader title="Reports" description="Download response data as Excel workbooks." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {REPORTS.map((report) => (
          <Link key={report.href} href={report.href} className="block">
            <Card className="h-full transition-colors hover:border-brand/40">
              <CardContent className="flex h-full flex-col gap-3 py-5">
                <div className="flex items-start justify-between">
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", report.iconClassName)}>
                    <report.icon className="h-5 w-5" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-ink-faint" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink">{report.title}</h3>
                  <p className="mt-0.5 text-sm text-ink-muted">{report.description}</p>
                </div>
                <ul className="mt-1 grid flex-1 grid-cols-1 content-start gap-x-4 gap-y-1.5 text-xs text-ink-muted sm:grid-cols-2">
                  {report.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-1.5">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <span className="text-sm font-medium text-brand-strong">
                  Open report <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <PermissionGate module="reports" action="export" featureName="reports">
      <ReportsContent />
    </PermissionGate>
  );
}
