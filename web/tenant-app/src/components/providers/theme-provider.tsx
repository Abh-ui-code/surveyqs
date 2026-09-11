"use client";

import { createContext, useContext, useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "system";
const STORAGE_KEY = "surveyqs.theme";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const resolved = mode === "system" ? (systemPrefersDark() ? "dark" : "light") : mode;
  root.setAttribute("data-theme", resolved);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const initial = stored ?? "system";
    setModeState(initial);
    applyTheme(initial);
    setResolved(initial === "system" ? (systemPrefersDark() ? "dark" : "light") : initial);

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = (window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? "system";
      if (current === "system") {
        applyTheme("system");
        setResolved(systemPrefersDark() ? "dark" : "light");
      }
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    setResolved(next === "system" ? (systemPrefersDark() ? "dark" : "light") : next);
  };

  return <ThemeContext.Provider value={{ mode, resolved, setMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback for anything rendered outside the provider (shouldn't
    // happen -- ThemeProvider wraps the whole app in layout.tsx -- but a
    // primitive that can render before the provider mounts must not crash.
    return { mode: "system", resolved: "light", setMode: () => {} };
  }
  return ctx;
}
