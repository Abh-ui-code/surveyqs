import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Btn, Card, Input, SectionLabel, Toggle } from "@/components/primitives";
import { useTheme, type ThemeMode } from "@/theme/ThemeProvider";
import { useChangePassword, useMe, useMyPermissions, useLogout, biometricUnlockAvailable } from "@/hooks/use-auth";
import { useOutbox } from "@/hooks/use-outbox";

/** Matched to crediqs's own profile screen structure: avatar + role pill
 * up top, then one Card per fact (Role / Workspace / Account), an
 * Appearance segmented picker, Language, Security, Change password, and
 * Sign out. Recovery email is the one crediqs card with no surveyqs
 * backend equivalent, so it's left out rather than faked. */
export default function ProfileScreen() {
  const { colors } = useTheme();
  const me = useMe();
  const perms = useMyPermissions();
  const logout = useLogout();
  const outbox = useOutbox();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(true);

  useEffect(() => {
    void biometricUnlockAvailable().then(setBiometricAvailable);
    void AsyncStorage.getItem("surveyqs.biometric.enabled").then((v) => setBiometricEnabled(v !== "false"));
  }, []);

  const pendingCount = (outbox.data ?? []).filter((e) => e.status !== "done").length;
  const roleLabel = perms.data?.role_code ? humanizeRole(perms.data.role_code) : undefined;
  const initials = (me.data?.full_name ?? me.data?.email ?? "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function toggleBiometric(next: boolean) {
    setBiometricEnabled(next);
    void AsyncStorage.setItem("surveyqs.biometric.enabled", String(next));
  }

  function handleSignOut() {
    if (pendingCount > 0) {
      Alert.alert(
        "Work still waiting to sync",
        `${pendingCount} interview${pendingCount === 1 ? "" : "s"} haven't reached the office yet. Sign out anyway?`,
        [
          { text: "Stay signed in", style: "cancel" },
          { text: "Sign out anyway", style: "destructive", onPress: () => logout.mutate() },
        ],
      );
      return;
    }
    logout.mutate();
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 12 }}>
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: "800", color: colors.accent }}>{initials}</Text>
          </View>
          <Text style={{ fontWeight: "700", fontSize: 18, color: colors.text }}>{me.data?.full_name}</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 2 }}>{me.data?.email}</Text>
          {roleLabel && (
            <View style={{ marginTop: 10, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.accentSoft }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.accentStrong }}>{roleLabel}</Text>
            </View>
          )}
        </View>

        <Card>
          <SectionLabel>Role</SectionLabel>
          <Text style={{ fontWeight: "600", color: colors.text, marginTop: 2 }}>{roleLabel ?? "—"}</Text>
        </Card>

        <Card>
          <SectionLabel>Workspace</SectionLabel>
          <Text style={{ fontWeight: "600", color: colors.text, marginTop: 2 }}>{me.data?.tenant?.name ?? "—"}</Text>
          {me.data?.tenant?.subdomain && (
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{me.data.tenant.subdomain}.surveyqs.local</Text>
          )}
        </Card>

        <Card>
          <SectionLabel>Account</SectionLabel>
          <Text style={{ fontWeight: "600", color: colors.text, marginTop: 2 }}>{me.data?.email}</Text>
        </Card>

        <Card>
          <SectionLabel>Appearance</SectionLabel>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: 12, lineHeight: 18 }}>
            Pick light, dark, or follow your phone's system setting.
          </Text>
          <ThemeSegmentedPicker />
        </Card>

        <Card>
          <SectionLabel>Language</SectionLabel>
          <Text style={{ fontWeight: "600", color: colors.text, marginTop: 2 }}>English</Text>
        </Card>

        {biometricAvailable && (
          <Card>
            <SectionLabel>Security</SectionLabel>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 14, color: colors.text, fontWeight: "600" }}>Biometric unlock</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 }}>
                  Quickly unlock the app after your first sign-in.
                </Text>
              </View>
              <Toggle value={biometricEnabled} onChange={toggleBiometric} />
            </View>
          </Card>
        )}

        <ChangePasswordCard />

        <Btn title={logout.isPending ? "Signing out…" : "Sign out"} variant="danger" loading={logout.isPending} onPress={handleSignOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

/** Same track/pill idiom as crediqs's SegmentedPicker: a muted track, a
 * white raised pill under the selected option — reads clearly in both
 * light and dark rather than a filled-brand selected state. */
function ThemeSegmentedPicker() {
  const { mode, setMode, colors, scheme } = useTheme();
  const options: { value: ThemeMode; label: string }[] = [
    { value: "light", label: "☀️ Light" },
    { value: "dark", label: "🌙 Dark" },
    { value: "system", label: "📱 System" },
  ];
  const pillBg = scheme === "dark" ? "#2d3a50" : "#ffffff";
  return (
    <View style={{ flexDirection: "row", gap: 4, backgroundColor: colors.surfaceRaised, padding: 4, borderRadius: 14 }}>
      {options.map((opt) => {
        const selected = opt.value === mode;
        return (
          <Pressable
            key={opt.value}
            onPress={() => setMode(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: selected ? pillBg : "transparent",
              shadowColor: "#000",
              shadowOpacity: selected ? 0.1 : 0,
              shadowRadius: selected ? 4 : 0,
              shadowOffset: { width: 0, height: 1 },
              elevation: selected ? 2 : 0,
            }}
          >
            <Text numberOfLines={1} style={{ color: selected ? colors.accent : colors.textMuted, fontWeight: selected ? "800" : "600", fontSize: 13 }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function humanizeRole(code: string): string {
  if (code === "superadmin") return "Super Admin";
  return code
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function ChangePasswordCard() {
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const mutation = useChangePassword();
  const canSave = newPw.length >= 8 && newPw === confirm && current.trim().length > 0;

  function reset() {
    setCurrent("");
    setNewPw("");
    setConfirm("");
    mutation.reset();
  }

  function cancel() {
    setEditing(false);
    reset();
  }

  async function save() {
    try {
      await mutation.mutateAsync({ current_password: current, new_password: newPw });
      Alert.alert("Password updated ✓", "Your new password is active.");
      setEditing(false);
      reset();
    } catch (err) {
      const data = (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
      Alert.alert("Update failed", data?.current_password?.[0] ?? data?.new_password?.[0] ?? "Something went wrong.");
    }
  }

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: editing ? 14 : 4 }}>
        <SectionLabel>Change password</SectionLabel>
        {!editing && (
          <Pressable onPress={() => setEditing(true)} hitSlop={10}>
            <Text style={{ fontSize: 12, color: colors.accent, fontWeight: "700" }}>Update →</Text>
          </Pressable>
        )}
      </View>

      {!editing ? (
        <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 17 }}>Keep your account secure with a strong password.</Text>
      ) : (
        <View style={{ gap: 12 }}>
          <Input value={current} onChangeText={setCurrent} placeholder="Current password" secureTextEntry autoCapitalize="none" editable={!mutation.isPending} />
          <Input value={newPw} onChangeText={setNewPw} placeholder="New password (min 8 characters)" secureTextEntry autoCapitalize="none" editable={!mutation.isPending} />
          <Input value={confirm} onChangeText={setConfirm} placeholder="Confirm new password" secureTextEntry autoCapitalize="none" editable={!mutation.isPending} />
          {confirm.length > 0 && newPw !== confirm && <Text style={{ fontSize: 11, color: colors.rust }}>Passwords do not match</Text>}
          <Btn title="Update password" onPress={save} loading={mutation.isPending} disabled={!canSave} />
          <Pressable onPress={cancel} hitSlop={10} style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
}
