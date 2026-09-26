import { useState } from "react";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { evaluateExpression, type AnswerMap, type AnswerValue } from "@surveyqs/shared";

import { Btn, FieldError, FieldLabel, FormScroll, Input } from "@/components/primitives";
import { widgetFor } from "@/components/widgets";
import { useTheme } from "@/theme/ThemeProvider";
import { useFormPackage } from "@/hooks/use-assignments";
import { useCreateDraft, useDraft, useUpdateDraft } from "@/hooks/use-drafts";
import { useRespondentMatch } from "@/hooks/use-respondent-lookup";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "RespondentCapture">;

export default function RespondentCaptureScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const params = route.params;
  // A fresh interview (mode "new") has no draft yet — nothing is created
  // here until Continue is tapped, so backing out beforehand leaves
  // nothing behind to show up as a phantom "in progress" card. Resuming
  // (mode "resume") loads the draft that already exists.
  const existingDraft = useDraft(params.mode === "resume" ? params.draftId : undefined);
  const versionId = params.mode === "resume" ? existingDraft.data?.versionId : params.versionId;
  // The survey's admin-selected demographic questions (see the web app's
  // Admin -> Demographic questions), same frozen package FormSectionScreen
  // reads its own questions from -- rendered here instead of a hardcoded
  // gender/address pair, per FormPackage.demographic_questions.
  const pkg = useFormPackage(versionId);
  const createDraft = useCreateDraft();
  const updateDraft = useUpdateDraft();
  const [fullName, setFullName] = useState(existingDraft.data?.respondent?.full_name ?? "");
  const [phone, setPhone] = useState(existingDraft.data?.respondent?.phone ?? "");
  const [email, setEmail] = useState(existingDraft.data?.respondent?.email ?? "");
  const [customFields, setCustomFields] = useState<Record<string, AnswerValue>>(
    (existingDraft.data?.respondent?.custom_fields as Record<string, AnswerValue>) ?? {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const match = useRespondentMatch(phone);
  const [usedMatch, setUsedMatch] = useState(false);
  const [saving, setSaving] = useState(false);

  function useMatch() {
    if (!match) return;
    setFullName(match.full_name);
    setUsedMatch(true);
  }

  function isRequired(required: boolean | string | undefined): boolean {
    if (typeof required === "boolean") return required;
    if (typeof required === "string") return evaluateExpression(required, { answers: customFields as AnswerMap }, false);
    return false;
  }

  function validateDemographics(): boolean {
    const next: Record<string, string> = {};
    for (const q of pkg.data?.demographic_questions ?? []) {
      const value = customFields[q.code];
      const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
      if (isRequired(q.required) && empty) {
        next[q.code] = q.required_message?.en ?? "This question needs an answer before you can continue.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const respondent = {
    phone,
    full_name: fullName,
    email: email || undefined,
    existingId: usedMatch ? (match?.id ?? undefined) : undefined,
    custom_fields: customFields,
  };

  async function next() {
    if (!validateDemographics()) return;
    setSaving(true);
    try {
      if (params.mode === "resume") {
        await updateDraft.mutateAsync({ id: params.draftId, patch: { respondent } });
        navigation.navigate("FormSection", { draftId: params.draftId, sectionIndex: 0 });
        return;
      }
      const draft = await createDraft.mutateAsync({
        surveyId: params.surveyId,
        surveyTitle: params.surveyTitle,
        assignmentId: params.assignmentId,
        versionId: params.versionId,
        schemaHash: params.schemaHash,
      });
      await updateDraft.mutateAsync({ id: draft.id, patch: { respondent } });
      navigation.navigate("FormSection", { draftId: draft.id, sectionIndex: 0 });
    } finally {
      setSaving(false);
    }
  }

  const locked = usedMatch && Boolean(match);

  return (
    <FormScroll
      style={{ backgroundColor: colors.bg }}
      bottomBar={<Btn title="Continue" loading={saving} disabled={phone.trim().length < 6} onPress={next} />}
    >
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700", marginBottom: 16 }}>Who are you speaking to?</Text>

      <View style={{ gap: 14 }}>
        <View style={{ opacity: locked ? 0.6 : 1 }}>
          <FieldLabel>Full name</FieldLabel>
          <Input value={fullName} onChangeText={setFullName} editable={!locked} placeholder="Jane Farmer" />
        </View>

        <View>
          <FieldLabel required>Phone number</FieldLabel>
          <Input
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              setUsedMatch(false);
            }}
            placeholder="+91 98421 03000"
          />
        </View>

        {match && !usedMatch && (
          <View style={{ backgroundColor: colors.amberSoft, borderWidth: 1, borderColor: colors.amber + "55", borderRadius: 14, padding: 13, gap: 8 }}>
            <Text style={{ color: colors.amber, fontWeight: "700", fontSize: 12.5 }}>⚠ This person may already exist</Text>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13.5 }}>{match.full_name}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>Last updated {new Date(match.updated_at).toLocaleDateString()}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Btn title="Use this person" fullWidth={false} onPress={useMatch} />
              <Btn title="New person" variant="secondary" fullWidth={false} onPress={() => setUsedMatch(true)} />
            </View>
          </View>
        )}

        <View style={{ opacity: locked ? 0.6 : 1 }}>
          <FieldLabel>Email</FieldLabel>
          <Input
            value={email}
            onChangeText={setEmail}
            editable={!locked}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="name@example.com"
          />
        </View>

        {(pkg.data?.demographic_questions ?? []).map((q) => {
          const Widget = widgetFor(q.type);
          return (
            <View key={q.id} style={{ opacity: locked ? 0.6 : 1 }}>
              <FieldLabel required={isRequired(q.required)}>{q.label.en ?? Object.values(q.label)[0]}</FieldLabel>
              <Widget
                question={q}
                value={customFields[q.code] ?? null}
                onChange={(value) => setCustomFields((f) => ({ ...f, [q.code]: value }))}
                choiceLists={pkg.data?.choice_lists ?? []}
                onAttachment={() => {}}
              />
              <FieldError message={errors[q.code]} />
            </View>
          );
        })}
      </View>
    </FormScroll>
  );
}
