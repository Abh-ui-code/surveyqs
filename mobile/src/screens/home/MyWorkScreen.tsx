import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ResponseListItem } from "@surveyqs/shared";

import { EmptyState, StatusChip, type ChipStatus } from "@/components/primitives";
import { ResponseListSkeleton } from "@/components/Skeleton";
import { useTheme } from "@/theme/ThemeProvider";
import { useMyResponses } from "@/hooks/use-responses";
import { useRootNavigation } from "@/navigation/use-root-navigation";

const STATUS_CHIP: Record<string, { status: ChipStatus; label: string }> = {
  submitted: { status: "ok", label: "Submitted" },
};

/** A response's `status` is only ever "submitted" going forward (see
 * backend apps/responses/models.py), but the column has held other values
 * in the past (under_review/approved/rejected, from an earlier review
 * workflow) and nothing rewrites old rows when a status vocabulary
 * shrinks -- so older responses can still carry one of those. Falling back
 * to a humanized, neutral chip instead of indexing STATUS_CHIP directly
 * keeps this screen from crashing on that legacy data. */
function chipFor(status: ResponseListItem["status"]): { status: ChipStatus; label: string } {
  return STATUS_CHIP[status] ?? { status: "neutral", label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ") };
}

export default function MyWorkScreen() {
  const { colors } = useTheme();
  const nav = useRootNavigation();
  const responses = useMyResponses();

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
              onPress={() => nav.navigate("ResponseDetail", { responseId: item.id })}
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
  onPress,
}: {
  item: ResponseListItem;
  divider: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const chip = chipFor(item.status);
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
            {new Date(item.submitted_at).toLocaleDateString()}
          </Text>
        </View>
        <StatusChip status={chip.status} label={chip.label} />
      </View>
    </Pressable>
  );
}
