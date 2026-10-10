"use client";

import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  FileStack,
  Trophy,
  Users2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Kpi } from "@/components/ui/kpi";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGate } from "@/components/permission-gate";
import { formatDate, formatRelativeShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useUserOverview, type UserOverviewSurvey } from "../../_hooks/use-admin";

const ROLE_TONE: Record<string, { label: string; tone: "brand" | "amber" | "moss" | "neutral" }> = {
  admin: { label: "Admin", tone: "brand" },
  supervisor: { label: "Supervisor", tone: "amber" },
  agent: { label: "Agent", tone: "moss" },
  analyst: { label: "Analyst", tone: "neutral" },
};

// Distinct, colour-blind-considerate hues. A survey keeps the same colour in
// the donut, its row dot and its progress bar so the eye can link them.
const PALETTE = ["#1F6F5C", "#C2823F", "#4F7CAC", "#8A5FB5", "#B4432F", "#3E9A8A", "#9A8A2F", "#C26A8A"];
const colorAt = (i: number) => PALETTE[i % PALETTE.length];

type PresetKey = "all" | "today" | "7d" | "30d" | "month" | "custom";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom" },
];

/** Local-calendar YYYY-MM-DD (not UTC) so "Today" matches the user's day. */
function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function presetRange(key: PresetKey): { from: string; to: string } {
  const now = new Date();
  const today = isoDay(now);
  if (key === "today") return { from: today, to: today };
  if (key === "7d") return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)), to: today };
  if (key === "30d") return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)), to: today };
  if (key === "month") return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  return { from: "", to: "" };
}

function initials(name: string, email: string): string {
  const parts = (name || email).trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function UserDetailContent() {
  const { id } = useParams<{ id: string }>();
  const [preset, setPreset] = useState<PresetKey>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);

  const range = useMemo(
    () => (preset === "custom" ? { from: customFrom, to: customTo } : presetRange(preset)),
    [preset, customFrom, customTo],
  );
  const invalidRange = !!range.from && !!range.to && range.from > range.to;
  const overview = useUserOverview(id, invalidRange ? {} : { dateFrom: range.from, dateTo: range.to });

  const data = overview.data;
  const surveys = useMemo(() => data?.surveys ?? [], [data]);
  const total = data?.totals.collected ?? 0;
  const colorBySurvey = useMemo(() => new Map(surveys.map((s, i) => [s.survey_id, colorAt(i)])), [surveys]);
  const pieData = surveys.filter((s) => s.collected > 0);
  const top = pieData[0];
  const filtered = preset !== "all" && (!!range.from || !!range.to);
  const hoveredSurvey = surveys.find((s) => s.survey_id === hovered);

  if (overview.isError && !data) {
    return (
      <div>
        <BackLink />
        <Card>
          <EmptyState
            icon={Users2}
            title="Couldn't load this user"
            description="They may not belong to this workspace, or you may not have access."
          />
        </Card>
      </div>
    );
  }

  const user = data?.user;
  const roleTone = user ? (ROLE_TONE[user.role_code] ?? { label: user.role_code, tone: "neutral" as const }) : null;

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Identity */}
      <Card className="overflow-hidden">
        <div className="h-16 bg-gradient-to-r from-brand-strong via-brand to-brand/60" />
        <CardContent className="flex flex-wrap items-end justify-between gap-4 pb-4 pt-3">
          <div className="flex items-end gap-4">
            {user ? (
              <span className="-mt-10 flex h-[72px] w-[72px] items-center justify-center rounded-2xl border-4 border-paper-raised bg-brand-soft text-2xl font-semibold text-brand-strong shadow-sm">
                {initials(user.full_name, user.email)}
              </span>
            ) : (
              <Skeleton className="-mt-10 h-[72px] w-[72px] rounded-2xl" />
            )}
            <div className="pb-1">
              {user ? (
                <>
                  <h1 className="text-xl font-semibold tracking-tight text-ink">{user.full_name || user.email}</h1>
                  <p className="text-sm text-ink-muted">{user.email}</p>
                </>
              ) : (
                <Skeleton className="h-10 w-56" />
              )}
            </div>
          </div>
          {user && roleTone && (
            <div className="flex flex-wrap items-center gap-2 pb-1">
              <Badge tone={roleTone.tone}>{roleTone.label}</Badge>
              <Badge tone={user.is_active ? "moss" : "neutral"} dot>
                {user.is_active ? "Active" : "Deactivated"}
              </Badge>
              <span className="text-xs text-ink-faint">
                {user.last_login_at ? `Last active ${formatRelativeShort(user.last_login_at)}` : "Never signed in"} · Joined{" "}
                {formatDate(user.joined_at)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label="Date range"
          className="inline-flex flex-wrap gap-1 rounded-lg border border-line bg-paper-sunken p-1"
        >
          {PRESETS.map((p) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={preset === p.key}
              onClick={() => setPreset(p.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                preset === p.key ? "bg-paper-raised text-ink shadow-sm" : "text-ink-muted hover:text-ink",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <CalendarRange className="h-4 w-4 text-ink-faint" />
            <Input
              type="date"
              aria-label="From date"
              className="w-40"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <span className="text-sm text-ink-faint">to</span>
            <Input
              type="date"
              aria-label="To date"
              className="w-40"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
            />
            {(customFrom || customTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCustomFrom("");
                  setCustomTo("");
                }}
              >
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        )}

        {filtered && !invalidRange && (
          <span className="text-xs text-ink-muted">
            Showing {range.from ? formatDate(range.from) : "the beginning"} – {range.to ? formatDate(range.to) : "today"}
          </span>
        )}
        {invalidRange && <span className="text-xs text-rust">The start date is after the end date.</span>}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          icon={ClipboardList}
          label="Surveys assigned"
          accent="brand"
          value={data ? data.totals.assigned_surveys : "—"}
          sub="Direct or via a team"
        />
        <Kpi
          icon={FileStack}
          label="Responses collected"
          accent="moss"
          value={data ? total.toLocaleString() : "—"}
          sub={filtered ? "In the selected range" : "All time"}
        />
        <Kpi
          icon={CalendarDays}
          label="Surveys worked on"
          accent="slate"
          value={data ? data.totals.surveys_with_responses : "—"}
          sub={data ? `of ${surveys.length} listed` : undefined}
        />
        <Kpi
          icon={Trophy}
          label="Top survey"
          accent="amber"
          value={<span className="block truncate text-base">{top ? top.title : "—"}</span>}
          sub={top ? `${top.collected} responses · ${Math.round((top.collected / total) * 100)}%` : "No responses yet"}
        />
      </div>

      {/* Breakdown + donut */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Surveys &amp; responses</CardTitle>
            {data && <span className="text-xs text-ink-faint">{surveys.length} surveys</span>}
          </CardHeader>
          {overview.isPending ? (
            <CardContent className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </CardContent>
          ) : surveys.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No surveys assigned"
              description="Assign this user to a survey and their collected responses will show up here."
            />
          ) : (
            <ul className={cn("divide-y divide-line transition-opacity", overview.isFetching && "opacity-60")}>
              {surveys.map((s) => (
                <SurveyRow
                  key={s.survey_id}
                  survey={s}
                  color={colorBySurvey.get(s.survey_id) ?? PALETTE[0]}
                  total={total}
                  showTarget={!filtered}
                  dimmed={hovered !== null && hovered !== s.survey_id}
                  onHover={setHovered}
                />
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Share of responses</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.isPending ? (
              <Skeleton className="mx-auto h-56 w-56 rounded-full" />
            ) : pieData.length === 0 ? (
              <EmptyState
                title="Nothing to chart"
                description={filtered ? "No responses were collected in this date range." : "No responses collected yet."}
                className="py-10"
              />
            ) : (
              <>
                <div className="relative mx-auto h-60 w-full max-w-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="collected"
                        nameKey="title"
                        innerRadius="62%"
                        outerRadius="92%"
                        paddingAngle={pieData.length > 1 ? 2 : 0}
                        stroke="none"
                        onMouseEnter={(_, i) => setHovered(pieData[i]?.survey_id ?? null)}
                        onMouseLeave={() => setHovered(null)}
                        animationDuration={500}
                      >
                        {pieData.map((s) => (
                          <Cell
                            key={s.survey_id}
                            fill={colorBySurvey.get(s.survey_id)}
                            opacity={hovered === null || hovered === s.survey_id ? 1 : 0.3}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={() => null} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
                    <span className="font-mono-data text-3xl font-semibold text-ink">
                      {(hoveredSurvey && hoveredSurvey.collected > 0 ? hoveredSurvey.collected : total).toLocaleString()}
                    </span>
                    <span className="line-clamp-2 text-xs text-ink-muted">
                      {hoveredSurvey && hoveredSurvey.collected > 0 ? hoveredSurvey.title : "responses"}
                    </span>
                    {hoveredSurvey && hoveredSurvey.collected > 0 && (
                      <span className="mt-0.5 text-xs font-medium text-brand">
                        {Math.round((hoveredSurvey.collected / total) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
                <ul className="mt-3 space-y-1">
                  {pieData.map((s) => (
                    <li
                      key={s.survey_id}
                      onMouseEnter={() => setHovered(s.survey_id)}
                      onMouseLeave={() => setHovered(null)}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-md px-2 py-1 text-sm transition-colors",
                        hovered === s.survey_id && "bg-paper-sunken",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2 text-ink-muted">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorBySurvey.get(s.survey_id) }} />
                        <span className="truncate">{s.title}</span>
                      </span>
                      <span className="font-mono-data shrink-0 text-ink">
                        {s.collected}
                        <span className="ml-1.5 text-xs text-ink-faint">{Math.round((s.collected / total) * 100)}%</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily trend */}
      {data && data.daily.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Responses per day</CardTitle>
            <span className="text-xs text-ink-faint">Peak {Math.max(...data.daily.map((d) => d.count))} / day</span>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.daily} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "currentColor" }}
                  className="text-ink-faint"
                  tickFormatter={(d: string) => formatDate(d).replace(/,?\s\d{4}$/, "")}
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "currentColor" }}
                  className="text-ink-faint"
                />
                <Tooltip
                  cursor={{ fill: "currentColor", opacity: 0.06 }}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(d) => formatDate(String(d))}
                  formatter={(v) => [String(v), "Responses"]}
                />
                <Bar dataKey="count" fill={PALETTE[0]} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SurveyRow({
  survey: s,
  color,
  total,
  showTarget,
  dimmed,
  onHover,
}: {
  survey: UserOverviewSurvey;
  color: string;
  total: number;
  showTarget: boolean;
  dimmed: boolean;
  onHover: (id: string | null) => void;
}) {
  const share = total > 0 ? (s.collected / total) * 100 : 0;
  const target = s.assignment?.target_count ?? null;
  return (
    <li
      onMouseEnter={() => onHover(s.survey_id)}
      onMouseLeave={() => onHover(null)}
      className={cn("px-5 py-4 transition-opacity hover:bg-paper-sunken/50", dimmed && "opacity-50")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
            <Link href={`/surveys/${s.survey_id}`} className="truncate font-medium text-ink hover:text-brand hover:underline">
              {s.title}
            </Link>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-[18px]">
            <Badge tone="neutral">{s.category_label}</Badge>
            {s.assigned ? (
              <Badge tone="brand">{s.assignment?.source === "team" ? `Team · ${s.assignment.team_name}` : "Assigned directly"}</Badge>
            ) : (
              <Badge tone="amber">No longer assigned</Badge>
            )}
            {s.assignment?.due_date && <span className="text-xs text-ink-faint">Due {formatDate(s.assignment.due_date)}</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono-data text-2xl font-semibold leading-none text-ink">{s.collected}</div>
          <div className="mt-1 text-xs text-ink-faint">
            {showTarget && target ? `of ${target} target` : s.collected === 1 ? "response" : "responses"}
          </div>
        </div>
      </div>

      <div className="mt-3 pl-[18px]">
        <div className="h-1.5 overflow-hidden rounded-full bg-paper-sunken">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${showTarget && target ? Math.min((s.collected / target) * 100, 100) : share}%`,
              background: color,
            }}
          />
        </div>
        <div className="mt-1 flex justify-between text-2xs text-ink-faint">
          <span>
            {showTarget && target
              ? `${Math.round((s.collected / target) * 100)}% of target`
              : `${Math.round(share)}% of collected`}
          </span>
          <span>{s.last_collected_at ? `Last response ${formatRelativeShort(s.last_collected_at)}` : "No responses"}</span>
        </div>
      </div>
    </li>
  );
}

function BackLink() {
  return (
    <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
      <ArrowLeft className="h-4 w-4" /> Users
    </Link>
  );
}

export default function UserDetailPage() {
  return (
    <PermissionGate module="users" action="view" featureName="user management">
      <UserDetailContent />
    </PermissionGate>
  );
}
