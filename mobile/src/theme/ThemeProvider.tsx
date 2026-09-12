/**
 * ThemeProvider — wraps the app with theme state and exposes useTheme().
 *
 * Default is "light" (see tokens.ts). Profile → Theme lets an agent switch
 * to "dark" or "system" explicitly.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance } from "react-native";

import { themes, type ColorScheme, type ThemeColors } from "./tokens";

// Versioned: bumped when the default flipped from dark to light, so a
// preference already persisted on a test device (from before that flip)
// doesn't silently pin it back to dark forever.
const STORAGE_KEY = "surveyqs.theme.mode.v2";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  colors: ThemeColors;
  scheme: ColorScheme;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolve(mode: ThemeMode): ColorScheme {
  if (mode === "system") return Appearance.getColorScheme() === "light" ? "light" : "dark";
  return mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [scheme, setScheme] = useState<ColorScheme>("light");

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        const next: ThemeMode = stored === "light" || stored === "dark" || stored === "system" ? stored : "light";
        setModeState(next);
        setScheme(resolve(next));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== "system") return;
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme(colorScheme === "light" ? "light" : "dark");
    });
    return () => sub.remove();
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    setScheme(resolve(next));
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ colors: themes[scheme], scheme, mode, setMode }),
    [scheme, mode, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme() called outside <ThemeProvider>");
  return ctx;
}
