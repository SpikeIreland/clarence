import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ============================================================================
// SECTION 1: DEFAULT METADATA (Fallback for all pages)
// ============================================================================

export const metadata: Metadata = {
  title: {
    default: "CLARENCE | The Honest Broker",
    template: "%s | CLARENCE"  // Pages can set just "Login" and it becomes "Login | CLARENCE"
  },
  description: "Create, Negotiate, Agree. AI-powered contract mediation that removes emotion and brings transparency to negotiations.",
  keywords: ["contract negotiation", "AI mediation", "contract management", "legal tech"],
  authors: [{ name: "CLARENCE" }],
  openGraph: {
    title: "CLARENCE | The Honest Broker",
    description: "Create, Negotiate, Agree. AI-powered contract mediation.",
    siteName: "CLARENCE",
    type: "website",
  },
};

// ============================================================================
// SECTION 2: ROOT LAYOUT COMPONENT
// ============================================================================

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}