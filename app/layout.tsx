import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

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
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
          <Navigation />
          <main className="pt-16 lg:pr-96">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
