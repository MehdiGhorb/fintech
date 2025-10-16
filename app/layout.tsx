import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import MarketOverview from "@/components/MarketOverview";
import { ChatbotProvider, MainContent } from "@/components/ChatbotContext";
import ConditionalLayout from "@/components/ConditionalLayout";

export const metadata: Metadata = {
  title: "FinanceGPT | AI-Powered Financial Intelligence",
  description: "Real-time financial analysis with AI-powered insights, market data, and news",
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
      </body>
    </html>
  );
}
