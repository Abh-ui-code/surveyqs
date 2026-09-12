/**
 * Theme tokens — single source of truth for light + dark colors.
 *
 * Matched directly against a reference app's screens (button color/size,
 * card borders, pill badges) at the user's explicit request — not this
 * app's own earlier brand pass. Primary actions are blue, Submit-type
 * final actions are green, cards are white with a thin border rather than
 * a heavy shadow, and status pills are flat colored chips.
 */

export type ColorScheme = "light" | "dark";

export interface ThemeColors {
  bg: string;
  surface: string; // s1 — cards
  surfaceRaised: string; // s2 — modals, sheets, inputs
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string; // primary action — blue
  accentStrong: string;
  accentSoft: string;
  accentInk: string; // text sitting on the accent fill
  success: string; // Submit / final-confirm actions — green
  successStrong: string;
  successSoft: string;
  successInk: string;
  moss: string; // approved / synced / up to date (status pill only)
  mossSoft: string;
  amber: string; // needs a look / new version / in-progress
  amberSoft: string;
  rust: string; // rejected / destructive
  rustSoft: string;
  statusBarStyle: "light" | "dark";
  /** Pastel icon-tile backgrounds, keyed by survey category code so a
   * screen stays declarative (`colors.tile[category] ?? colors.tile.default`). */
  tile: Record<string, string>;
}

const DARK: ThemeColors = {
  bg: "#0e1614",
  surface: "#17211f",
  surfaceRaised: "#202c2a",
  border: "#313f3d",
  text: "#f0f4f2",
  textMuted: "#a7b4ad",
  textFaint: "#6e7c75",
  accent: "#3b82f6",
  accentStrong: "#60a5fa",
  accentSoft: "#1e3a5f",
  accentInk: "#ffffff",
  success: "#22c55e",
  successStrong: "#4ade80",
  successSoft: "#14361f",
  successInk: "#052e0f",
  moss: "#3db872",
  mossSoft: "#1b3727",
  amber: "#f6ae31",
  amberSoft: "#433214",
  rust: "#ee6853",
  rustSoft: "#471b15",
  statusBarStyle: "light",
  tile: { farming: "#1d4d2b", electronics: "#15324f", health: "#4a2a14", housing: "#1f2547", default: "#202c2a" },
};

const LIGHT: ThemeColors = {
  bg: "#ffffff",
  surface: "#ffffff",
  surfaceRaised: "#f3f4f6",
  border: "#e5e7eb",
  text: "#111827",
  textMuted: "#6b7280",
  textFaint: "#9ca3af",
  accent: "#2563eb",
  accentStrong: "#1d4ed8",
  accentSoft: "#dbeafe",
  accentInk: "#ffffff",
  success: "#16a34a",
  successStrong: "#15803d",
  successSoft: "#dcfce7",
  successInk: "#ffffff",
  moss: "#16a34a",
  mossSoft: "#dcfce7",
  amber: "#d97706",
  amberSoft: "#fef3c7",
  rust: "#dc2626",
  rustSoft: "#fee2e2",
  statusBarStyle: "dark",
  tile: { farming: "#dcfce7", electronics: "#dbeafe", health: "#fee2e2", housing: "#fef3c7", default: "#f3f4f6" },
};

export const themes = { light: LIGHT, dark: DARK } as const;
