import { ActivityIndicator, Image, ScrollView, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { Card, SectionLabel, StatusChip, type ChipStatus } from "@/components/primitives";
import { useTheme } from "@/theme/ThemeProvider";
import { useResponseDetail } from "@/hooks/use-responses";
import type { RootStackParamList } from "@/navigation/types";
import type { ResponseListItem } from "@surveyqs/shared";

type Props = NativeStackScreenProps<RootStackParamList, "ResponseDetail">;

const STATUS_CHIP: Record<ResponseListItem["status"], { status: ChipStatus; label: string }> = {
  submitted: { status: "neutral", label: "Submitted" },
  under_review: { status: "neutral", label: "Awaiting review" },
  approved: { status: "ok", label: "Approved" },
  rejected: { status: "bad", label: "Rejected" },
};

/**
 * Same information the web app's response detail page shows (answers,
 * review history, submission details, attachments) — see
 * web/tenant-app/.../responses/[id]/ResponseDetailPage.tsx. Approve/
 * reject actions are left out: those are a supervisor's review of
 * someone else's work, not something an agent does on their own
 * submission here.
 */
export default function ResponseDetailScreen({ route }: Props) {
  const { colors } = useTheme();
  const detail = useResponseDetail(route.params.responseId);

  if (detail.isPending || !detail.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const r = detail.data;
  const chip = STATUS_CHIP[r.status];
  const answers = Object.entries(r.answers);

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
          answers.map(([code, value], i) => (
            <View key={code} style={{ paddingVertical: 9, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border }}>
              <Text style={{ color: colors.textFaint, fontSize: 10.5, fontFamily: "monospace" }}>{code}</Text>
              <Text style={{ color: colors.text, fontSize: 13.5, marginTop: 2 }}>
                {Array.isArray(value) ? value.join(", ") : String(value)}
              </Text>
            </View>
          ))
        )}
      </Card>

      {r.reviews.length > 0 && (
        <Card>
          <SectionLabel>History</SectionLabel>
          {r.reviews.map((rev, i) => (
            <View key={rev.id} style={{ paddingVertical: 8, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600", textTransform: "capitalize" }}>
                {rev.action}
                {rev.notes ? <Text style={{ color: colors.textMuted, fontWeight: "400" }}> — {rev.notes}</Text> : null}
              </Text>
              <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 2 }}>{new Date(rev.created_at).toLocaleString()}</Text>
            </View>
          ))}
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
