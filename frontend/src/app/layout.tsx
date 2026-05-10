import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Navbar from "@/components/Navbar";
import CursorEnforcer from "@/components/CursorEnforcer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bungee = localFont({
  src: "../../node_modules/@fontsource/bungee/files/bungee-latin-400-normal.woff2",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sentinel — Raid Your AI Agents",
  description:
    "Choose your fighter. Equip your loadout. Raid your AI agents to find where their guardrails break.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bungee.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <CursorEnforcer />
        <Navbar />
        <main className="flex-1 pt-14">{children}</main>
      </body>
    </html>
  );
}
