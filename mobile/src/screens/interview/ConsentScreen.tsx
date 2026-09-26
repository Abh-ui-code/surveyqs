import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { Btn, Card } from "@/components/primitives";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { useTheme } from "@/theme/ThemeProvider";
import { useFormPackage } from "@/hooks/use-assignments";
import { useCreateDraft, useUpdateDraft } from "@/hooks/use-drafts";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "ConsentCapture">;

/**
 * The first screen of every interview that requires it — shown before the
 * respondent's name, phone or any other field is asked for. Nothing is
 * persisted here beyond this screen: the signed consent only becomes a
 * real draft once the agent agrees (see onAgree), matching the "no draft
 * until real progress" rule the rest of the interview flow follows
 * (SurveysScreen.tsx). A survey that doesn't require consent never routes
 * here at all — see SurveysScreen.tsx's `start()`.
 */
export default function ConsentScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = route.params;
  const pkg = useFormPackage(params.versionId);
  const createDraft = useCreateDraft();
  const updateDraft = useUpdateDraft();
  const sigRef = useRef<SignaturePadHandle>(null);
  const [signed, setSigned] = useState(false);
  const [saving, setSaving] = useState(false);

  const notice = pkg.data?.consent_notice ?? null;
  const consentRequired = Boolean(pkg.data?.settings?.consent_required);

  useEffect(() => {
    // A survey can flip this setting after an agent already had it cached,
    // or a notice can go missing — either way, don't strand the agent on a
    // consent screen with nothing to show; just continue the interview.
    if (pkg.data && (!consentRequired || !notice)) {
      navigation.replace("RespondentCapture", { mode: "new", ...params });
    }
  }, [pkg.data, consentRequired, notice, navigation, params]);

  if (pkg.isPending || !pkg.data || !consentRequired || !notice) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  async function onAgree() {
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    setSaving(true);
    try {
      const signatureBase64 = await sigRef.current!.toBase64();
      const draft = await createDraft.mutateAsync({
        surveyId: params.surveyId,
        surveyTitle: params.surveyTitle,
        assignmentId: params.assignmentId,
        versionId: params.versionId,
        schemaHash: params.schemaHash,
      });
      await updateDraft.mutateAsync({
        id: draft.id,
        patch: {
          consent: {
            notice_id: notice!.id,
            language: notice!.language,
            method: "signature",
            granted_at: new Date().toISOString(),
            signature_base64: signatureBase64,
          },
        },
      });
      navigation.replace("RespondentCapture", { mode: "resume", draftId: draft.id });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={{ color: colors.text, fontSize: 19, fontWeight: "800" }}>Consent</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
            Read this to the respondent before starting "{params.surveyTitle}".
          </Text>
        </View>

        <Card style={{ padding: 16 }}>
          <Text style={{ color: colors.text, fontSize: 14, lineHeight: 21 }}>{notice.text}</Text>
        </Card>

        <View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: colors.text, fontSize: 13.5, fontWeight: "700" }}>Respondent's signature</Text>
              {signed && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.mossSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: colors.moss, fontSize: 11, fontWeight: "700" }}>✓ Signed</Text>
                </View>
              )}
            </View>
            <Btn
              title="Clear"
              variant="ghost"
              size="sm"
              fullWidth={false}
              onPress={() => {
                sigRef.current?.clear();
                setSigned(false);
              }}
            />
          </View>
          <SignaturePad ref={sigRef} height={170} onChange={(empty) => setSigned(!empty)} />
        </View>
      </ScrollView>

      <View
        style={{
          padding: 16,
          paddingBottom: insets.bottom + 16,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Btn title={signed ? "I agree — start interview" : "Sign above to continue"} disabled={!signed} loading={saving} onPress={onAgree} />
      </View>
    </View>
  );
}
