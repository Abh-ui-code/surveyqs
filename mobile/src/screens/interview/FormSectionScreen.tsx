import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  branchParentCode,
  evaluateExpression,
  sortByBranchAdjacency,
  type AnswerMap,
  type AnswerValue,
  type PendingAttachment,
  type Question,
} from "@surveyqs/shared";

import { Btn, Card, FieldError, ProgressBar } from "@/components/primitives";
import { widgetFor } from "@/components/widgets";
import { useTheme } from "@/theme/ThemeProvider";
import { useFormPackage } from "@/hooks/use-assignments";
import { useDraft, useUpdateDraft } from "@/hooks/use-drafts";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "FormSection">;

const EMPTY_ANSWERS: AnswerMap = {};
const PERSIST_DEBOUNCE_MS = 400;

export default function FormSectionScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { draftId, sectionIndex } = route.params;
  const draft = useDraft(draftId);
  const pkg = useFormPackage(draft.data?.versionId);
  const updateDraft = useUpdateDraft();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);

  // Answers live in local state while the agent is on this section —
  // typing used to write to AsyncStorage and invalidate the draft query
  // on every keystroke, which is what made typing feel laggy. Local state
  // renders every keystroke instantly; the actual persist is debounced
  // (and always flushed before leaving the screen, so nothing is lost).
  const [localAnswers, setLocalAnswers] = useState<AnswerMap>(EMPTY_ANSWERS);
  const seededRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPersistRef = useRef<AnswerMap | null>(null);

  useEffect(() => {
    if (!seededRef.current && draft.data) {
      setLocalAnswers(draft.data.answers);
      seededRef.current = true;
    }
  }, [draft.data]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const section = pkg.data?.sections[sectionIndex];

  // Sorted before filtering, not after -- a branch question must render
  // directly under its parent, and filtering first would lose the parent
  // whenever it happened to be hidden but the branch (already answered
  // some other way) was still visible.
  const visibleQuestions = useMemo(() => {
    if (!section) return [];
    return sortByBranchAdjacency(section.questions).filter((q) =>
      evaluateExpression(q.relevant, { answers: localAnswers }, true),
    );
  }, [section, localAnswers]);

  if (pkg.isPending || draft.isPending || !section) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  function isRequired(q: Question): boolean {
    if (typeof q.required === "boolean") return q.required;
    if (typeof q.required === "string") return evaluateExpression(q.required, { answers: localAnswers }, false);
    return false;
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    for (const q of visibleQuestions) {
      const value = localAnswers[q.code];
      const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
      if (isRequired(q) && empty) {
        next[q.code] = q.required_message?.en ?? "This question needs an answer before you can continue.";
        continue;
      }
      if (!empty && q.constraint) {
        const ok = evaluateExpression(q.constraint, { answers: localAnswers, current: value }, true);
        if (!ok) next[q.code] = q.constraint_message?.en ?? "This answer isn't valid.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleAnswerChange(code: string, value: AnswerValue) {
    setLocalAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined || value === null) delete next[code];
      else next[code] = value;
      pendingPersistRef.current = next;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => flushAnswers(next), PERSIST_DEBOUNCE_MS);
      return next;
    });
  }

  async function flushAnswers(answersToSave?: AnswerMap) {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const toSave = answersToSave ?? pendingPersistRef.current;
    if (!toSave) return;
    pendingPersistRef.current = null;
    await updateDraft.mutateAsync({ id: draftId, patch: { answers: toSave } });
  }

  async function onNext() {
    if (!validate()) return;
    await flushAnswers(localAnswers);
    if (attachments.length > 0) {
      await updateDraft.mutateAsync({ id: draftId, patch: { attachments: [...(draft.data?.attachments ?? []), ...attachments] } });
    }
    const isLast = sectionIndex >= (pkg.data?.sections.length ?? 1) - 1;
    if (isLast) {
      navigation.navigate("ReviewSubmit", { draftId });
    } else {
      await updateDraft.mutateAsync({ id: draftId, patch: { currentSectionIndex: sectionIndex + 1 } });
      navigation.push("FormSection", { draftId, sectionIndex: sectionIndex + 1 });
    }
  }

  async function saveAndExit() {
    await flushAnswers(localAnswers);
    // FormSection is a direct screen of the root stack (a sibling of
    // "Tabs", not nested inside it), so `getParent()` here is undefined
    // and `?.navigate(...)` was silently doing nothing — every pushed
    // RespondentCapture/FormSection screen stayed in the back-history.
    // `reset` clears this stack down to just Tabs.
    navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
  }

  const totalSections = pkg.data?.sections.length ?? 1;
  const percent = Math.round(((sectionIndex + 1) / totalSections) * 100);

  // Precomputed rather than incremented during the render map below —
  // mutating a counter while mapping trips the immutability lint rule.
  const questionNumbers = new Map<string, number>();
  let numbered = 0;
  for (const q of visibleQuestions) {
    if (q.type !== "note") questionNumbers.set(q.id, ++numbered);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 2,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={{ alignSelf: "flex-start", marginBottom: 6, marginLeft: -4, padding: 4 }}
        >
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: "600" }}>‹</Text>
        </Pressable>
        <Text style={{ color: colors.accent, fontSize: 11.5, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" }}>
          Section {sectionIndex + 1} of {totalSections}
        </Text>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800", marginTop: 2, marginBottom: 8 }}>
          {section.title.en ?? Object.values(section.title)[0]}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <ProgressBar value={percent} />
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700", minWidth: 34, textAlign: "right" }}>{percent}%</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 18, paddingBottom: 32, gap: 16 }} keyboardShouldPersistTaps="handled">
        {visibleQuestions.map((q) => {
          const Widget = widgetFor(q.type);
          const isNote = q.type === "note";
          const questionNumber = questionNumbers.get(q.id);
          // A question conditioned on an earlier one in this section renders
          // indented directly beneath it -- the same "branch" grouping the
          // web builder and web collection flow use (see
          // @surveyqs/shared::branchParentCode). Sorting visibleQuestions
          // above is what guarantees it's actually adjacent to render next
          // to; this only decides how to draw it.
          const isBranch = branchParentCode(q, section.questions) !== null;

          if (isNote) {
            return (
              <View
                key={q.id}
                style={{
                  backgroundColor: colors.accentSoft,
                  borderRadius: 14,
                  padding: 16,
                  flexDirection: "row",
                  gap: 10,
                  marginLeft: isBranch ? 20 : 0,
                }}
              >
                <Text style={{ fontSize: 16 }}>💡</Text>
                <Text style={{ flex: 1, color: colors.text, fontSize: 13.5, lineHeight: 20, fontWeight: "500" }}>
                  {q.label.en ?? Object.values(q.label)[0]}
                </Text>
              </View>
            );
          }

          const questionCard = (
            <Card style={{ padding: 18, borderRadius: 16 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 9,
                    backgroundColor: colors.accentSoft,
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 1,
                  }}
                >
                  <Text style={{ color: colors.accentStrong, fontSize: 12.5, fontWeight: "800" }}>{questionNumber}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15.5, fontWeight: "700", color: colors.text, lineHeight: 21 }}>
                    {q.label.en ?? Object.values(q.label)[0]}
                    {isRequired(q) && <Text style={{ color: colors.rust }}> *</Text>}
                  </Text>
                  {q.hint && (
                    <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 3, lineHeight: 17 }}>{q.hint.en}</Text>
                  )}
                  <View style={{ marginTop: 6 }}>
                    <Widget
                      question={q}
                      value={localAnswers[q.code] ?? null}
                      onChange={(value: AnswerValue) => handleAnswerChange(q.code, value)}
                      choiceLists={pkg.data?.choice_lists ?? []}
                      onAttachment={(att) => setAttachments((prev) => [...prev, att])}
                    />
                  </View>
                  <FieldError message={errors[q.code]} />
                </View>
              </View>
            </Card>
          );

          if (!isBranch) return <View key={q.id}>{questionCard}</View>;
          return (
            <View
              key={q.id}
              style={{ marginLeft: 20, borderLeftWidth: 2, borderLeftColor: colors.accentSoft, paddingLeft: 12 }}
            >
              {questionCard}
            </View>
          );
        })}
      </ScrollView>

      <View
        style={{
          flexDirection: "row",
          gap: 10,
          padding: 12,
          paddingBottom: insets.bottom + 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -2 },
          elevation: 6,
        }}
      >
        <View style={{ flex: 1 }}>
          <Btn title="Save draft" variant="ghost" size="sm" onPress={saveAndExit} />
        </View>
        <View style={{ flex: 2 }}>
          <Btn title="Next ›" size="sm" loading={updateDraft.isPending} onPress={onNext} />
        </View>
      </View>
    </View>
  );
}
