/**
 * NativeWind config. Kept for utility spacing/layout classes only — colors
 * are read from src/theme/tokens.ts (ThemeProvider), same split the web app
 * uses between Tailwind utilities and CSS-variable-driven color tokens.
 */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: { extend: {} },
  plugins: [],
};
