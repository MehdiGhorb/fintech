import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import MarketOverview from "@/components/MarketOverview";
import { ChatbotProvider, MainContent } from "@/components/ChatbotContext";
import ConditionalLayout from "@/components/ConditionalLayout";
import { Analytics } from '@vercel/analytics/react';

const SITE_NAME = 'Northline Finance';
const SITE_DOMAIN = 'https://northline-finance.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_DOMAIN),
  title: {
    default: `${SITE_NAME}`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    'Northline Finance — AI-assisted market research, real-time data, charts and curated news for investors.',
  openGraph: {
    title: SITE_NAME,
    description:
      'AI-assisted market research, real-time data, charts and curated news for investors.',
    url: SITE_DOMAIN,
    siteName: SITE_NAME,
    images: [],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description:
      'AI-assisted market research, real-time data, charts and curated news for investors.',
    images: [],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ChatbotProvider>
          <ConditionalLayout>
            {children}
          </ConditionalLayout>
        </ChatbotProvider>
        <Analytics />
      </body>
    </html>
  );
}
