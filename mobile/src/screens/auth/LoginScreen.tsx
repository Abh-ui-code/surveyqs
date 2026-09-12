import { useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ActivityIndicator, Text, View } from "react-native";
import { loginSchema, apiErrorMessage, type LoginValues } from "@surveyqs/shared";

import { Btn, FieldError, FieldLabel, FormScroll, Input } from "@/components/primitives";
import { useTheme } from "@/theme/ThemeProvider";
import { biometricUnlock, biometricUnlockAvailable, useLogin } from "@/hooks/use-auth";
import { hydrateSession, getStoredUserId } from "@/lib/api";
import { setAuthActive } from "@/lib/auth-store";
import { startOutboxMonitor } from "@/lib/outbox";

export default function LoginScreen() {
  const { colors } = useTheme();
  const login = useLogin();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [checkingBiometric, setCheckingBiometric] = useState(true);
  const [biometricReady, setBiometricReady] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const tryBiometric = useCallback(async (userId: string) => {
    setBiometricBusy(true);
    const ok = await biometricUnlock();
    setBiometricBusy(false);
    if (ok) {
      setAuthActive(true, userId);
      startOutboxMonitor();
    } else {
      setShowPasswordForm(true);
    }
  }, []);

  // Fires the OS biometric prompt on mount when a session is already on
  // this device — per docs/guides/AGENT_MOBILE_GUIDE.md, biometrics unlock
  // an existing session, they never replace the first email+password sign-in.
  useEffect(() => {
    (async () => {
      const [hasSession, storedUserId, available] = await Promise.all([
        hydrateSession(),
        getStoredUserId(),
        biometricUnlockAvailable(),
      ]);
      setCheckingBiometric(false);
      if (hasSession && storedUserId && available) {
        setBiometricReady(true);
        void tryBiometric(storedUserId);
      } else {
        setShowPasswordForm(true);
      }
    })();
  }, [tryBiometric]);

  if (checkingBiometric) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (biometricReady && !showPasswordForm) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: colors.accent,
            opacity: 0.5,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 38 }}>🫆</Text>
        </View>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>Hey there</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center" }}>
          {biometricBusy ? "Waiting for Face ID / fingerprint…" : "Unlock to pick up right where you left off."}
        </Text>
        <View style={{ height: 8 }} />
        <Btn title="Use password instead" variant="ghost" onPress={() => setShowPasswordForm(true)} />
      </View>
    );
  }

  return (
    <FormScroll
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
      style={{ backgroundColor: colors.bg }}
    >
      <View style={{ alignItems: "center", marginBottom: 28, gap: 8 }}>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.accentInk, fontWeight: "800", fontSize: 22 }}>S</Text>
        </View>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>Sign in</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>Enter your workspace credentials to continue.</Text>
      </View>

      <View style={{ gap: 16 }}>
        <View>
          <FieldLabel required>Email</FieldLabel>
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <Input
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                error={!!errors.email}
                onChangeText={field.onChange}
                value={field.value}
              />
            )}
          />
          <FieldError message={errors.email?.message} />
        </View>

        <View>
          <FieldLabel required>Password</FieldLabel>
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <Input
                secureTextEntry
                autoComplete="current-password"
                error={!!errors.password}
                onChangeText={field.onChange}
                value={field.value}
              />
            )}
          />
          <FieldError message={errors.password?.message} />
        </View>

        {login.isError && (
          <View style={{ backgroundColor: colors.rustSoft, borderRadius: 12, padding: 12 }}>
            <Text style={{ color: colors.rust, fontSize: 13 }}>
              {apiErrorMessage(login.error, "Couldn't sign in. Check your email and password.")}
            </Text>
          </View>
        )}

        <Btn
          title="Sign in"
          loading={login.isPending}
          onPress={handleSubmit((values) => login.mutate(values))}
        />

        {biometricReady && (
          <Btn title="Cancel — go back" variant="ghost" onPress={() => setShowPasswordForm(false)} />
        )}
      </View>
    </FormScroll>
  );
}
