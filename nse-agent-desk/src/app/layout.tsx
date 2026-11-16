import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import "@fontsource-variable/inter";
import { Shell } from "@/components/desk/shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "NSE Agent Desk",
  description: "An AI stock research team for the Indian market. Research tool only, not investment advice.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Shell>{children}</Shell>
        </ThemeProvider>
      </body>
    </html>
  );
}
