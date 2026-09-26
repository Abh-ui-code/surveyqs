import { useMemo } from "react";
import { ActivityIndicator, Image, ScrollView, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ChoiceList, Question, ResponseListItem } from "@surveyqs/shared";

import { Card, SectionLabel, StatusChip, type ChipStatus } from "@/components/primitives";
import { useTheme } from "@/theme/ThemeProvider";
import { useFormPackage } from "@/hooks/use-assignments";
import { useRespondentDetail, useResponseDetail } from "@/hooks/use-responses";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "ResponseDetail">;

function choiceLabel(choiceLists: ChoiceList[], listName: string | undefined, value: string): string {
  const list = choiceLists.find((l) => l.name === listName);
  return list?.choices.find((c) => c.value === value)?.label.en ?? value;
}

/** Mirrors the web app's displayAnswer (web/tenant-app/src/lib/form-schema.ts)
 * -- a choice's label rather than its stored value, "Yes"/"No" rather than
 * true/false, etc. `question` is undefined when the code isn't recognized
 * (an older answer from before a question was removed), in which case the
 * raw stored value is shown as-is. */
function formatAnswer(question: Question | undefined, value: unknown, choiceLists: ChoiceList[]): string {
  if (value === undefined || value === null || value === "") return "—";
  if (!question) return Array.isArray(value) ? value.join(", ") : String(value);
  const listName = question.config?.choice_list as string | undefined;
  switch (question.type) {
    case "yes_no":
      return value ? "Yes" : "No";
    case "select_one":
      return choiceLabel(choiceLists, listName, value as string);
    case "select_multiple":
      return (value as string[]).map((v) => choiceLabel(choiceLists, listName, v)).join(", ");
    case "geopoint": {
      const g = value as { lat: number; lng: number };
      return `${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}`;
    }
    default:
      return Array.isArray(value) ? value.join(", ") : String(value);
  }
}

const STATUS_CHIP: Record<string, { status: ChipStatus; label: string }> = {
  submitted: { status: "ok", label: "Submitted" },
};

/** See the identical helper in home/MyWorkScreen.tsx -- a response's
 * `status` is only ever "submitted" going forward, but older rows can
 * still carry a status from a since-removed review workflow
 * (under_review/approved/rejected). Falls back to a neutral, humanized
 * chip instead of crashing on that legacy data. */
function chipFor(status: ResponseListItem["status"]): { status: ChipStatus; label: string } {
  return STATUS_CHIP[status] ?? { status: "neutral", label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ") };
}

/**
 * Same information the web app's response detail page shows (answers,
 * submission details, attachments) — see
 * web/tenant-app/.../responses/[id]/ResponseDetailPage.tsx. A submission
 * is final the moment it lands, so there's no review state or history to
 * show here.
 */
export default function ResponseDetailScreen({ route }: Props) {
  const { colors } = useTheme();
  const detail = useResponseDetail(route.params.responseId);
  // The published version's sections/questions (for real labels instead of
  // raw codes) and its selected demographic questions -- the same frozen
  // package FormSectionScreen renders the survey's own questions from.
  const pkg = useFormPackage(detail.data?.survey_version);
  const respondentDetail = useRespondentDetail(detail.data?.respondent ?? undefined);

  const questionsByCode = useMemo(() => {
    const map = new Map<string, Question>();
    for (const section of pkg.data?.sections ?? []) {
      for (const q of section.questions) map.set(q.code, q);
    }
    return map;
  }, [pkg.data]);

  const demographicByCode = useMemo(() => {
    const map = new Map<string, Question>();
    for (const q of pkg.data?.demographic_questions ?? []) map.set(q.code, q);
    return map;
  }, [pkg.data]);

  const choiceLists = pkg.data?.choice_lists ?? [];

  if (detail.isPending || !detail.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const r = detail.data;
  const chip = chipFor(r.status);
  const answers = Object.entries(r.answers);
  const demographicAnswers = Object.entries(respondentDetail.data?.custom_fields ?? {});

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15, fontFamily: "monospace" }}>{r.response_code}</Text>
        <StatusChip status={chip.status} label={chip.label} />
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 12.5, marginTop: -6 }}>
        {r.survey_title} · {r.respondent_name ?? "Anonymous respondent"}
      </Text>

      {r.flags.map((f) => (
        <View key={f.id} style={{ flexDirection: "row", gap: 8, backgroundColor: colors.amberSoft, borderRadius: 12, padding: 12 }}>
          <Text>🚩</Text>
          <Text style={{ color: colors.amber, fontSize: 12.5, flex: 1 }}>{f.message}</Text>
        </View>
      ))}

      <Card>
        <SectionLabel>Answers</SectionLabel>
        {answers.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>No answers recorded.</Text>
        ) : (
          answers.map(([code, value], i) => {
            const q = questionsByCode.get(code);
            return (
              <View key={code} style={{ paddingVertical: 9, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border }}>
                <Text
                  style={
                    q
                      ? { color: colors.textMuted, fontSize: 12.5 }
                      : { color: colors.textMuted, fontSize: 11, fontFamily: "monospace" }
                  }
                >
                  {q?.label.en ?? Object.values(q?.label ?? {})[0] ?? code}
                </Text>
                <Text style={{ color: colors.text, fontSize: 13.5, marginTop: 2, fontWeight: "600" }}>
                  {formatAnswer(q, value, choiceLists)}
                </Text>
              </View>
            );
          })
        )}
      </Card>

      {respondentDetail.data && (
        <Card>
          <SectionLabel>Demographic details</SectionLabel>
          <View style={{ paddingVertical: 9 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12.5 }}>Full name</Text>
            <Text style={{ color: colors.text, fontSize: 13.5, marginTop: 2, fontWeight: "600" }}>
              {respondentDetail.data.full_name || "—"}
            </Text>
          </View>
          <View style={{ paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text style={{ color: colors.textMuted, fontSize: 12.5 }}>Phone</Text>
            <Text style={{ color: colors.text, fontSize: 13.5, marginTop: 2, fontWeight: "600" }}>
              {respondentDetail.data.phone || "—"}
            </Text>
          </View>
          <View style={{ paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text style={{ color: colors.textMuted, fontSize: 12.5 }}>Email</Text>
            <Text style={{ color: colors.text, fontSize: 13.5, marginTop: 2, fontWeight: "600" }}>
              {respondentDetail.data.email || "—"}
            </Text>
          </View>
          {demographicAnswers.map(([code, value]) => {
            const q = demographicByCode.get(code);
            return (
              <View key={code} style={{ paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text
                  style={
                    q
                      ? { color: colors.textMuted, fontSize: 12.5 }
                      : { color: colors.textMuted, fontSize: 11, fontFamily: "monospace" }
                  }
                >
                  {q?.label.en ?? Object.values(q?.label ?? {})[0] ?? code}
                </Text>
                <Text style={{ color: colors.text, fontSize: 13.5, marginTop: 2, fontWeight: "600" }}>
                  {formatAnswer(q, value, choiceLists)}
                </Text>
              </View>
            );
          })}
        </Card>
      )}

      <Card style={{ gap: 8 }}>
        <SectionLabel>Details</SectionLabel>
        <DetailRow label="Duration" value={formatDuration(r.duration_seconds)} />
        <DetailRow label="Submitted" value={new Date(r.submitted_at).toLocaleString()} />
        <DetailRow label="Category" value={r.category_label} />
        {r.was_offline && <DetailRow label="Collected" value="Offline" />}
        {r.gps_lat != null && r.gps_lng != null && (
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            📍 {r.gps_lat.toFixed(5)}, {r.gps_lng.toFixed(5)}
            {r.gps_accuracy_m != null ? ` (±${Math.round(r.gps_accuracy_m)}m)` : ""}
          </Text>
        )}
      </Card>

      {r.attachments.length > 0 && (
        <Card>
          <SectionLabel>Attachments</SectionLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {r.attachments.map((a) =>
              a.url && a.kind === "image" ? (
                <Image key={a.id} source={{ uri: a.url }} style={{ width: 96, height: 96, borderRadius: 10, backgroundColor: colors.surfaceRaised }} />
              ) : (
                <View key={a.id} style={{ width: 96, height: 96, borderRadius: 10, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center", padding: 6 }}>
                  <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: "center" }} numberOfLines={2}>
                    {a.filename}
                  </Text>
                </View>
              ),
            )}
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
