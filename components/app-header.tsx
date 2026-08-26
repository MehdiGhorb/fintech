"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

export function AppHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-paper px-5 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <a href="/" className="font-mono text-[11px] uppercase tracking-[0.28em]">
            Northline
          </a>
          <span className="text-line">/</span>
          <h1 className="truncate text-sm font-medium">{title}</h1>
        </div>
        {subtitle && <p className="mt-0.5 truncate text-xs text-mute">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {right}
        <ThemeToggle />
        <button
          type="button"
          onClick={logout}
          className="h-8 rounded-md border border-line px-2.5 text-xs text-mute hover:text-ink"
        >
          Lock
        </button>
      </div>
    </header>
  );
}
