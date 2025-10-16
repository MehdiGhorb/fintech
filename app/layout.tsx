import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import MarketOverview from "@/components/MarketOverview";
import { ChatbotProvider, MainContent } from "@/components/ChatbotContext";

export const metadata: Metadata = {
  title: "FinTech Analysis | Markets, News & AI Insights",
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
          <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
            <Navigation />
            <MarketOverview />
            <MainContent>
              {children}
            </MainContent>
          </div>
        </ChatbotProvider>
      </body>
    </html>
  );
}
