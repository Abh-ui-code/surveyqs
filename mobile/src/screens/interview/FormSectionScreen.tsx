import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { evaluateExpression, type AnswerMap, type AnswerValue, type PendingAttachment, type Question } from "@surveyqs/shared";

import { Btn, FieldError, FieldLabel } from "@/components/primitives";
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

  const visibleQuestions = useMemo(() => {
    if (!section) return [];
    return section.questions.filter((q) => evaluateExpression(q.relevant, { answers: localAnswers }, true));
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>
          {section.title.en ?? Object.values(section.title)[0]}{" "}
          <Text style={{ color: colors.textFaint, fontWeight: "600", fontSize: 12.5 }}>
            {sectionIndex + 1} / {pkg.data?.sections.length}
          </Text>
        </Text>
        <View style={{ height: 5, borderRadius: 99, backgroundColor: colors.surface, marginTop: 8, overflow: "hidden" }}>
          <View
            style={{
              width: `${Math.round(((sectionIndex + 1) / (pkg.data?.sections.length ?? 1)) * 100)}%`,
              height: "100%",
              backgroundColor: colors.accent,
            }}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 22 }} keyboardShouldPersistTaps="handled">
        {visibleQuestions.map((q) => {
          const Widget = widgetFor(q.type);
          return (
            <View key={q.id}>
              {q.type !== "note" && (
                <FieldLabel required={isRequired(q)}>{q.label.en ?? Object.values(q.label)[0]}</FieldLabel>
              )}
              {q.type === "note" ? (
                <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>{q.label.en ?? Object.values(q.label)[0]}</Text>
              ) : (
                <>
                  {q.hint && <Text style={{ color: colors.textFaint, fontSize: 11.5, marginBottom: 6 }}>{q.hint.en}</Text>}
                  <Widget
                    question={q}
                    value={localAnswers[q.code] ?? null}
                    onChange={(value: AnswerValue) => handleAnswerChange(q.code, value)}
                    choiceLists={pkg.data?.choice_lists ?? []}
                    onAttachment={(att) => setAttachments((prev) => [...prev, att])}
                  />
                  <FieldError message={errors[q.code]} />
                </>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={{ flexDirection: "row", gap: 10, padding: 16, paddingBottom: insets.bottom + 16, borderTopWidth: 1, borderTopColor: colors.border }}>
        <View style={{ flex: 1 }}>
          <Btn title="Save draft" variant="ghost" onPress={saveAndExit} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn title="Next ›" loading={updateDraft.isPending} onPress={onNext} />
        </View>
      </View>
    </View>
  );
}
