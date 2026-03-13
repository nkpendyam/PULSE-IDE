import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = localFont({
  src: "../assets/fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "../assets/fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kyro IDE - AI-Powered Development",
  description: "Open-source AI-native code editor built with Tauri, Next.js, and Rust. Local-first, privacy-respecting, with built-in AI assistance.",
  keywords: ["Kyro IDE", "AI IDE", "code editor", "Tauri", "Next.js", "TypeScript", "Rust", "open source"],
  authors: [{ name: "Kyro IDE Team" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Kyro IDE",
    description: "Open-source AI-native code editor — local-first, privacy-respecting",
    siteName: "Kyro IDE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kyro IDE",
    description: "Open-source AI-native code editor — local-first, privacy-respecting",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
