'use client';

import { createContext, useContext, useState, useEffect } from 'react';

interface ChatbotContextType {
  isChatbotOpen: boolean;
  setIsChatbotOpen: (open: boolean) => void;
}

const ChatbotContext = createContext<ChatbotContextType>({
  isChatbotOpen: true,
  setIsChatbotOpen: () => {},
});

export const useChatbot = () => useContext(ChatbotContext);

export function ChatbotProvider({ children }: { children: React.ReactNode }) {
  const [isChatbotOpen, setIsChatbotOpen] = useState(true);

  return (
    <ChatbotContext.Provider value={{ isChatbotOpen, setIsChatbotOpen }}>
      {children}
    </ChatbotContext.Provider>
  );
}

export function MainContent({ children }: { children: React.ReactNode }) {
  const { isChatbotOpen } = useChatbot();

  return (
    <main 
      className={`pt-16 transition-all duration-300 ${
        isChatbotOpen ? 'lg:pr-96' : 'lg:pr-0'
      }`}
    >
      {children}
    </main>
  );
}
