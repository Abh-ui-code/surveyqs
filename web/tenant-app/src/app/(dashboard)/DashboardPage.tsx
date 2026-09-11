"use client";

import { AlertTriangle, ClipboardCheck, FileStack, Flag } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGate } from "@/components/permission-gate";
import { useDashboard } from "./_hooks/use-dashboard";

const CATEGORY_COLORS = ["#1F6F5C", "#B8763E", "#6B8CAE", "#7A5AA3", "#B4432F"];
const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Awaiting review",
  approved: "Approved",
  rejected: "Rejected",
};

function DashboardContent() {
  const dashboard = useDashboard();

  const approved = dashboard.data?.by_status.find((s) => s.status === "approved")?.count ?? 0;
  const underReview = dashboard.data?.by_status.find((s) => s.status === "under_review")?.count ?? 0;

  return (
    <div>
      <PageHeader title="Dashboard" description="What's happening across every survey right now." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={FileStack} label="Total responses" accent="brand" value={dashboard.data?.total_responses ?? "—"} />
        <Kpi icon={ClipboardCheck} label="Approved" accent="moss" value={approved} />
        <Kpi icon={AlertTriangle} label="Awaiting review" accent="amber" value={underReview} />
        <Kpi icon={Flag} label="Flagged" accent="rust" value={dashboard.data?.flagged_count ?? "—"} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Responses by category</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.isPending ? (
              <Skeleton className="h-56 w-full" />
            ) : dashboard.data && dashboard.data.by_category.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={dashboard.data.by_category}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {dashboard.data.by_category.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-14 text-center text-sm text-ink-muted">No responses collected yet.</p>
            )}
            {dashboard.data && dashboard.data.by_category.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {dashboard.data.by_category.map((c, i) => (
                  <li key={c.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-ink-muted">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                      />
                      {c.label}
                    </span>
                    <span className="font-mono-data font-medium text-ink">{c.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.isPending ? (
              <Skeleton className="h-56 w-full" />
            ) : dashboard.data && dashboard.data.by_status.length > 0 ? (
              dashboard.data.by_status.map((s) => {
                const total = dashboard.data!.total_responses || 1;
                const pct = Math.round((s.count / total) * 100);
                return (
                  <div key={s.status}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-ink-muted">{STATUS_LABEL[s.status] ?? s.status}</span>
                      <span className="font-mono-data font-medium text-ink">{s.count}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-sunken">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="py-14 text-center text-sm text-ink-muted">No responses collected yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <PermissionGate module="reports" action="view" featureName="the dashboard">
      <DashboardContent />
    </PermissionGate>
  );
}
