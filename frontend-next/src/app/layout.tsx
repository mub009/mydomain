import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Markkito — Local Business Directory & Marketplace",
    template: "%s | Markkito",
  },
  description:
    "Find, book, and review local businesses near you — restaurants, home services, healthcare, beauty, and B2B suppliers, all in one directory.",
  openGraph: {
    siteName: "Markkito",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`}>
      <body className="min-h-full flex flex-col bg-gray-50 font-sans">
        <Header />
        <main className="flex-1 container-page py-6 sm:py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
