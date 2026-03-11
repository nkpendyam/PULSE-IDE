import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
