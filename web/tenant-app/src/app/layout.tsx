import type { Metadata } from "next";
import { Public_Sans, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-data",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SurveyQs",
  description: "Field survey collection and management",
};

// Runs before React hydrates, so the correct theme applies on first paint --
// without it, the page would flash light before ThemeProvider's effect runs.
const THEME_INIT_SCRIPT = `
  (function () {
    try {
      var stored = localStorage.getItem("surveyqs.theme") || "system";
      var dark = stored === "dark" || (stored === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    } catch (e) {}
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${publicSans.variable} ${plexMono.variable} font-sans antialiased`}>
        <ThemeProvider>
          <QueryProvider>
            {children}
            <Toaster richColors closeButton position="top-right" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
