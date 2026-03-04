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
  description: "The complete platform for contract intelligence. AI-powered products for contract creation, negotiation, training, and signing.",
  keywords: ["contract intelligence", "AI mediation", "contract negotiation", "contract management", "legal tech", "contract creation", "digital signing", "tender management", "negotiation training"],
  authors: [{ name: "CLARENCE" }],
  openGraph: {
    title: "CLARENCE | The Honest Broker",
    description: "The complete platform for contract intelligence. Create, Negotiate, Agree.",
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