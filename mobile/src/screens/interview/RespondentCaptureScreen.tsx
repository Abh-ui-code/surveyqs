import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { Btn, FieldLabel, FormScroll, Input } from "@/components/primitives";
import { useTheme } from "@/theme/ThemeProvider";
import { useCreateDraft, useDraft, useUpdateDraft } from "@/hooks/use-drafts";
import { useRespondentMatch } from "@/hooks/use-respondent-lookup";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "RespondentCapture">;

// Same field set AND order as the web app's respondent form
// (RespondentStep in web/tenant-app/.../collect/_components): full name
// first, then phone, email, gender, address. "" reads as "Prefer not to
// say" there too.
const GENDER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Prefer not to say" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
];

export default function RespondentCaptureScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const params = route.params;
  // A fresh interview (mode "new") has no draft yet — nothing is created
  // here until Continue is tapped, so backing out beforehand leaves
  // nothing behind to show up as a phantom "in progress" card. Resuming
  // (mode "resume") loads the draft that already exists.
  const existingDraft = useDraft(params.mode === "resume" ? params.draftId : undefined);
  const createDraft = useCreateDraft();
  const updateDraft = useUpdateDraft();
  const [fullName, setFullName] = useState(existingDraft.data?.respondent?.full_name ?? "");
  const [phone, setPhone] = useState(existingDraft.data?.respondent?.phone ?? "");
  const [email, setEmail] = useState(existingDraft.data?.respondent?.email ?? "");
  const [gender, setGender] = useState(existingDraft.data?.respondent?.gender ?? "");
  const [address, setAddress] = useState(existingDraft.data?.respondent?.address ?? "");
  const match = useRespondentMatch(phone);
  const [usedMatch, setUsedMatch] = useState(false);
  const [saving, setSaving] = useState(false);

  function useMatch() {
    if (!match) return;
    setFullName(match.full_name);
    setUsedMatch(true);
  }

  const respondent = {
    phone,
    full_name: fullName,
    email: email || undefined,
    gender: gender || undefined,
    address: address || undefined,
    existingId: usedMatch ? (match?.id ?? undefined) : undefined,
  };

  async function next() {
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

        <View style={{ opacity: locked ? 0.6 : 1 }}>
          <FieldLabel>Gender</FieldLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {GENDER_OPTIONS.map((opt) => {
              const selected = gender === opt.value;
              return (
                <Pressable
                  key={opt.label}
                  disabled={locked}
                  onPress={() => setGender(opt.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: selected ? colors.accent : colors.border,
                    backgroundColor: selected ? colors.accentSoft : colors.surface,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: selected ? colors.accentStrong : colors.text, fontWeight: "600", fontSize: 12.5 }}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ opacity: locked ? 0.6 : 1 }}>
          <FieldLabel>Address</FieldLabel>
          <Input value={address} onChangeText={setAddress} editable={!locked} placeholder="Village / street" />
        </View>
      </View>
    </FormScroll>
  );
}
