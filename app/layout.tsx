import type { Metadata } from "next";
import { DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "CLARENCE | The Honest Broker",
    template: "%s | CLARENCE"
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${dmMono.variable} antialiased`}
        style={{ fontFamily: 'var(--font-dm-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
      >
        {children}
      </body>
    </html>
  );
}