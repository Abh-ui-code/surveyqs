import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { evaluateExpression } from "@surveyqs/shared";

import { Btn } from "@/components/primitives";
import { useTheme } from "@/theme/ThemeProvider";
import { useFormPackage } from "@/hooks/use-assignments";
import { useDeleteDraft, useDraft } from "@/hooks/use-drafts";
import { buildSyncItems } from "@/lib/build-sync-items";
import { enqueueInterview, flush } from "@/lib/outbox";
import { isOnline } from "@/lib/net";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "ReviewSubmit">;

export default function ReviewSubmitScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const draft = useDraft(route.params.draftId);
  const pkg = useFormPackage(draft.data?.versionId);
  const deleteDraft = useDeleteDraft();
  const [submitting, setSubmitting] = useState(false);

  if (draft.isPending || pkg.isPending || !draft.data || !pkg.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const answers = draft.data.answers;

  async function submit() {
    setSubmitting(true);
    try {
      const items = buildSyncItems(draft.data!);
      await enqueueInterview({
        label: `${draft.data!.surveyTitle} · ${draft.data!.respondent?.full_name || "New respondent"}`,
        items,
        attachments: draft.data!.attachments,
      });
      await deleteDraft.mutateAsync(route.params.draftId);
      if (isOnline()) void flush();
      // ReviewSubmit is a direct screen of the root stack (a sibling of
      // "Tabs", not nested inside it), so `getParent()` here is undefined
      // and `?.navigate(...)` was silently doing nothing — the whole
      // Respondent → Form → Review chain stayed in the back-history even
      // after a successful submit, reachable by pressing back into a
      // screen whose draft had just been deleted (an infinite spinner,
      // nothing left to load). `reset` clears the stack down to Tabs.
      navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>Review &amp; submit</Text>

        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16 }}>
          <RowLine label="Respondent" value={draft.data.respondent?.full_name || "Not recorded"} done />
          {pkg.data.sections.map((section, i) => {
            const relevant = section.relevant == null || evaluateExpression(section.relevant, { answers }, true);
            const answeredCount = section.questions.filter((q) => q.type !== "note" && answers[q.code] !== undefined).length;
            const total = section.questions.filter((q) => q.type !== "note").length;
            return (
              <RowLine
                key={section.id}
                label={section.title.en ?? Object.values(section.title)[0]}
                value={relevant ? `${answeredCount} of ${total} answered` : "not asked"}
                done={relevant}
                last={i === pkg.data!.sections.length - 1}
              />
            );
          })}
        </View>

        {draft.data.attachments.length > 0 && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {draft.data.attachments.map((a) => (
              <View key={a.ref} style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
                <Text>📷</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={{ padding: 16, paddingBottom: insets.bottom + 16, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 }}>
        <Btn title="Submit interview" variant="success" loading={submitting} onPress={submit} />
        <Text style={{ textAlign: "center", fontSize: 11, color: colors.textFaint }}>
          {isOnline() ? "Sends now" : "Offline — will sync when you have signal"}
        </Text>
      </View>
    </View>
  );
}

function RowLine({ label, value, done, last }: { label: string; value: string; done: boolean; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
        opacity: done ? 1 : 0.5,
      }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 99,
          backgroundColor: done ? colors.mossSoft : colors.surfaceRaised,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: done ? colors.moss : colors.textFaint, fontSize: 10 }}>{done ? "✓" : "–"}</Text>
      </View>
      <Text style={{ flex: 1, color: colors.text, fontSize: 13 }} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, fontStyle: done ? "normal" : "italic" }}>{value}</Text>
    </View>
  );
}
