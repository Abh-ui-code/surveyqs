import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Btn, Card, EmptyState } from "@/components/primitives";
import { useTheme } from "@/theme/ThemeProvider";
import { useOutbox, resolveConflict, removeOutboxItem, retryItem } from "@/hooks/use-outbox";
import { flush } from "@/lib/outbox";
import type { OutboxIndexEntry } from "@/lib/outbox";

export default function SyncScreen() {
  const { colors } = useTheme();
  const outbox = useOutbox();
  const entries = outbox.data ?? [];

  const conflicts = entries.filter((e) => e.status === "conflict");
  const failed = entries.filter((e) => e.status === "failed");
  const waiting = entries.filter((e) => e.status === "pending" || e.status === "in_flight");

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 18 }}>
      <View>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>Sync</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12.5, marginTop: 2 }}>
          {entries.length === 0 ? "All work synced" : `${waiting.length} waiting`}
        </Text>
      </View>

      {entries.length === 0 ? (
        <EmptyState emoji="✓" title="All work synced" subtitle="Everything you've collected has reached the office." />
      ) : (
        <>
          {conflicts.length > 0 && (
            <Group label="Needs attention">
              {conflicts.map((e) => (
                <ConflictCard key={e.id} entry={e} />
              ))}
            </Group>
          )}

          {failed.length > 0 && (
            <Group label="Failed">
              {failed.map((e) => (
                <FailedCard key={e.id} entry={e} />
              ))}
            </Group>
          )}

          {waiting.length > 0 && (
            <Group label={`Waiting (${waiting.length})`}>
              <Card style={{ gap: 0, paddingVertical: 2 }}>
                {waiting.map((e, i) => (
                  <View key={e.id} style={{ paddingVertical: 10, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border }}>
                    <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>{e.label}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11.5, marginTop: 2 }}>
                      {e.status === "in_flight" ? "Sending…" : `queued · ${e.attempts} attempt${e.attempts === 1 ? "" : "s"}`}
                    </Text>
                  </View>
                ))}
              </Card>
            </Group>
          )}

          <Btn title="Sync now" variant="secondary" onPress={() => void flush()} />
        </>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 9 }}>
      <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", color: colors.textFaint }}>{label}</Text>
      {children}
    </View>
  );
}

function ConflictCard({ entry }: { entry: OutboxIndexEntry }) {
  const { colors } = useTheme();
  const c = entry.conflict;
  return (
    <View style={{ backgroundColor: colors.amberSoft, borderWidth: 1, borderColor: colors.amber + "55", borderRadius: 16, padding: 13, gap: 8 }}>
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{entry.label}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{c?.detail ?? "This person already exists in the office records."}</Text>
      <View style={{ flexDirection: "row", gap: 7, flexWrap: "wrap" }}>
        {(c?.resolutions ?? ["merge", "keep_both", "discard"]).map((r) => (
          <Btn
            key={r}
            title={r === "merge" ? "Merge" : r === "keep_both" ? "Keep both" : "Delete"}
            variant="secondary"
            fullWidth={false}
            onPress={() => void resolveConflict(entry.id, r as "merge" | "keep_both" | "discard", c?.existing?.id)}
          />
        ))}
      </View>
    </View>
  );
}

function FailedCard({ entry }: { entry: OutboxIndexEntry }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.rustSoft, borderWidth: 1, borderColor: colors.rust + "55", borderRadius: 16, padding: 13, gap: 8 }}>
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{entry.label}</Text>
      <Text style={{ color: colors.rust, fontSize: 12 }}>{entry.lastError ?? "The office rejected this interview."}</Text>
      <View style={{ flexDirection: "row", gap: 7 }}>
        <Btn title="Retry" variant="secondary" fullWidth={false} onPress={() => void retryItem(entry.id)} />
        <Btn title="Delete" variant="danger" fullWidth={false} onPress={() => void removeOutboxItem(entry.id)} />
      </View>
    </View>
  );
}
