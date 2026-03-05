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
    default: "CLARENCE | Built to Agree",
    template: "%s | CLARENCE"
  },
  description: "The principled platform for contract creation, negotiation, and agreement. Neutral mediation that serves the deal, not a side.",
  keywords: ["contract negotiation", "agreement platform", "neutral mediation", "contract management", "legal tech", "contract creation", "honest broker", "principled negotiation", "negotiation training"],
  authors: [{ name: "CLARENCE" }],
  openGraph: {
    title: "CLARENCE | Built to Agree",
    description: "Agreements, not arguments. The principled platform for contract negotiation and agreement.",
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