import type { Metadata, Viewport } from "next";
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
  title: "DzPharma Guide — Médicaments & alternatives thérapeutiques (Algérie)",
  description:
    "Recherchez parmi 5 380 médicaments référencés en Algérie par DCI ou nom commercial. Prix approximatifs en DZD, taux de remboursement CNAS et disponibilité.",
  keywords: [
    "médicaments Algérie",
    "DCI",
    "CNAS",
    "prix médicament DZD",
    "alternative thérapeutique",
    "DzPharma Guide",
  ],
  applicationName: "DzPharma Guide",
  icons: {
    icon: "/logo.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0ea5e9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
