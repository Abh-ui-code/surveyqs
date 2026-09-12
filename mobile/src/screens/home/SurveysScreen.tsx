import { Alert, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { SyncAssignment } from "@surveyqs/shared";

import { Btn, StatCard } from "@/components/primitives";
import { SurveyListSkeleton } from "@/components/Skeleton";
import { useTheme } from "@/theme/ThemeProvider";
import { useAssignments } from "@/hooks/use-assignments";
import { useDeleteDraft, useDrafts } from "@/hooks/use-drafts";
import { useMe } from "@/hooks/use-auth";
import { useRootNavigation } from "@/navigation/use-root-navigation";
import { resumeRouteFor } from "@/lib/resume";
import type { InterviewDraft } from "@/lib/drafts-store";

const CATEGORY_TINT: Record<string, string> = {
  farming: "#dcfce7",
  electronics: "#dbeafe",
  health: "#fee2e2",
  housing: "#fef3c7",
};

export default function SurveysScreen() {
  const { colors } = useTheme();
  const nav = useRootNavigation();
  const me = useMe();
  const assignments = useAssignments();
  const drafts = useDrafts();
  const deleteDraft = useDeleteDraft();

  const loading = assignments.isPending || drafts.isPending;
  const inProgress = drafts.data ?? [];
  const list = assignments.data ?? [];
  const completedTotal = list.reduce((sum, a) => sum + a.submitted_count, 0);

  function resume(draft: InterviewDraft) {
    const route = resumeRouteFor(draft);
    // resumeRouteFor returns a discriminated {name, params} pair that's
    // already correct for whichever screen it names — expressing that as
    // a single call signature TS accepts isn't worth the ceremony here.
    (nav.navigate as (name: string, params: object | undefined) => void)(route.name, route.params);
  }

  // Tapping "Start" goes straight into the interview — no intro screen in
  // between. No draft is created yet, deliberately: if the agent backs out
  // of Respondent capture without entering anything, there must be nothing
  // left behind to show up as a phantom "in progress" card. A draft is
  // only created once they actually enter a respondent and tap Continue.
  function start(assignment: SyncAssignment) {
    if (!assignment.version) return;
    nav.navigate("RespondentCapture", {
      mode: "new",
      assignmentId: assignment.id,
      surveyId: assignment.survey.id,
      surveyTitle: assignment.survey.title,
      versionId: assignment.version.id,
      schemaHash: assignment.version.schema_hash,
    });
  }

  function discard(draft: InterviewDraft) {
    Alert.alert("Discard this interview?", "Everything recorded so far will be deleted. This cannot be undone.", [
      { text: "Keep it", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => deleteDraft.mutate(draft.id) },
    ]);
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 20 }}
        refreshControl={<RefreshControl refreshing={assignments.isFetching} onRefresh={() => assignments.refetch()} tintColor={colors.accent} />}
      >
        <View>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>
            {greeting()}, {(me.data?.full_name ?? "there").split(" ")[0]} 👋
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 3 }}>Let's get started today.</Text>
        </View>

        {loading ? (
          <SurveyListSkeleton />
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <StatCard value={list.length} label="Assigned" numberColor={colors.accent} />
              <StatCard value={inProgress.length} label="In Progress" numberColor={colors.amber} />
              <StatCard value={completedTotal} label="Completed" numberColor={colors.success} />
            </View>

            {inProgress.length > 0 && (
              <View style={{ gap: 10 }}>
                <SectionLabelInline>In progress</SectionLabelInline>
                {inProgress.map((draft) => (
                  <SurveyRow
                    key={draft.id}
                    emoji="📋"
                    tint={colors.surfaceRaised}
                    title={draft.surveyTitle}
                    subtitle={`${draft.respondent?.full_name || "New respondent"} · started ${timeAgo(draft.startedAt)}`}
                    actionLabel="Resume"
                    onAction={() => resume(draft)}
                    onSecondary={() => discard(draft)}
                    secondaryLabel="Discard"
                  />
                ))}
              </View>
            )}

            <View style={{ gap: 10 }}>
              <SectionLabelInline>Assigned surveys</SectionLabelInline>
              {list.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 20 }}>
                  No surveys assigned yet. Pull down to check again.
                </Text>
              ) : (
                list.map((a) => <AssignmentRow key={a.id} assignment={a} onStart={() => start(a)} />)
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AssignmentRow({ assignment, onStart }: { assignment: SyncAssignment; onStart: () => void }) {
  const dueSoon = assignment.due_date ? daysUntil(assignment.due_date) <= 3 : false;
  const progress = assignment.target_count != null ? `${assignment.submitted_count}/${assignment.target_count}` : `${assignment.submitted_count} collected`;
  return (
    <SurveyRow
      emoji={emojiFor(assignment.survey.category.code)}
      tint={CATEGORY_TINT[assignment.survey.category.code] ?? "#f3f4f6"}
      title={assignment.survey.title}
      subtitle={`${progress} · ${assignment.due_date ? `Due ${dueLabel(assignment.due_date)}` : "Up to date"}`}
      subtitleWarn={dueSoon}
      actionLabel="Start"
      onAction={onStart}
    />
  );
}

/** One row: circular colored icon, title + subtitle, a pill action button —
 * matched to the reference app's "Today's Surveys" list rows. */
function SurveyRow({
  emoji,
  tint,
  title,
  subtitle,
  subtitleWarn,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  emoji: string;
  tint: string;
  title: string;
  subtitle: string;
  subtitleWarn?: boolean;
  actionLabel: string;
  onAction: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        padding: 12,
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: tint, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ color: subtitleWarn ? colors.rust : colors.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {secondaryLabel && onSecondary && (
        <Btn title={secondaryLabel} variant="ghost" fullWidth={false} onPress={onSecondary} style={{ paddingVertical: 8, paddingHorizontal: 10 }} />
      )}
      <Btn title={actionLabel} fullWidth={false} onPress={onAction} style={{ paddingVertical: 9, paddingHorizontal: 16 }} />
    </View>
  );
}

function SectionLabelInline({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>{children}</Text>;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} hr ago`;
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function dueLabel(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  return `${d}d`;
}

function emojiFor(categoryCode: string): string {
  const map: Record<string, string> = { farming: "🌾", electronics: "📱", health: "🩺", housing: "🏠" };
  return map[categoryCode] ?? "📋";
}
