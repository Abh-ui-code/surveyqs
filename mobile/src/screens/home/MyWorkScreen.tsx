import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import type { ResponseDetail, ResponseListItem } from "@surveyqs/shared";

import { Btn, EmptyState, StatusChip, type ChipStatus } from "@/components/primitives";
import { ResponseListSkeleton } from "@/components/Skeleton";
import { useTheme } from "@/theme/ThemeProvider";
import { useMyResponses } from "@/hooks/use-responses";
import { useCreateDraft, useUpdateDraft } from "@/hooks/use-drafts";
import { api } from "@/lib/api";
import { useRootNavigation } from "@/navigation/use-root-navigation";

const STATUS_CHIP: Record<ResponseListItem["status"], { status: ChipStatus; label: string }> = {
  submitted: { status: "neutral", label: "Submitted" },
  under_review: { status: "neutral", label: "Awaiting review" },
  approved: { status: "ok", label: "Approved" },
  rejected: { status: "bad", label: "Rejected" },
};

export default function MyWorkScreen() {
  const { colors } = useTheme();
  const nav = useRootNavigation();
  const qc = useQueryClient();
  const responses = useMyResponses();
  const createDraft = useCreateDraft();
  const updateDraft = useUpdateDraft();
  const [resubmittingId, setResubmittingId] = useState<string | null>(null);

  async function editAndResubmit(item: ResponseListItem) {
    setResubmittingId(item.id);
    try {
      const detail = await qc.fetchQuery({
        queryKey: ["responses", "detail", item.id],
        queryFn: () => api.get<ResponseDetail>(`/responses/${item.id}/`),
      });
      const draft = await createDraft.mutateAsync({
        surveyId: detail.survey,
        surveyTitle: detail.survey_title,
        versionId: detail.survey_version,
        resubmitOfResponseId: detail.id,
        initialAnswers: detail.answers,
      });
      // The original interview already established the respondent — a
      // resubmission edits answers, it doesn't re-ask.
      await updateDraft.mutateAsync({
        id: draft.id,
        patch: {
          respondent: detail.respondent
            ? { existingId: detail.respondent, phone: "", full_name: detail.respondent_name ?? "" }
            : null,
        },
      });
      nav.navigate("FormSection", { draftId: draft.id, sectionIndex: 0 });
    } finally {
      setResubmittingId(null);
    }
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 14 }}
        refreshControl={<RefreshControl refreshing={responses.isFetching} onRefresh={() => responses.refetch()} tintColor={colors.accent} />}
      >
      <View>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>My work</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12.5, marginTop: 2 }}>
          {responses.data ? `${responses.data.length} response${responses.data.length === 1 ? "" : "s"}` : " "}
        </Text>
      </View>

      {responses.isPending ? (
        <ResponseListSkeleton />
      ) : (responses.data ?? []).length === 0 ? (
        <EmptyState emoji="📊" title="Nothing submitted yet" subtitle="Interviews you complete will show up here." />
      ) : (
        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16 }}>
          {(responses.data ?? []).map((item, i) => (
            <ResponseRow
              key={item.id}
              item={item}
              divider={i > 0}
              busy={resubmittingId === item.id}
              onPress={() => nav.navigate("ResponseDetail", { responseId: item.id })}
              onEditAndResubmit={() => editAndResubmit(item)}
            />
          ))}
        </View>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ResponseRow({
  item,
  divider,
  busy,
  onPress,
  onEditAndResubmit,
}: {
  item: ResponseListItem;
  divider: boolean;
  busy: boolean;
  onPress: () => void;
  onEditAndResubmit: () => void;
}) {
  const { colors } = useTheme();
  const chip = STATUS_CHIP[item.status];
  return (
    <Pressable
      onPress={onPress}
      style={{ paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: divider ? 1 : 0, borderTopColor: colors.border, gap: 8 }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13.5 }} numberOfLines={1}>
            {item.category_label} · {item.respondent_name ?? "Unnamed"}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 11.5, marginTop: 2 }} numberOfLines={2}>
            {item.status === "rejected" ? "Needs your attention" : new Date(item.submitted_at).toLocaleDateString()}
          </Text>
        </View>
        <StatusChip status={chip.status} label={chip.label} />
      </View>
      {item.status === "rejected" && (
        <Btn title={busy ? "Loading…" : "Edit and resubmit"} variant="secondary" loading={busy} onPress={onEditAndResubmit} />
      )}
    </Pressable>
  );
}
