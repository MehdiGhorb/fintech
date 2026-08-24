"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (!response.ok) {
      setError(true);
      return;
    }
    router.replace(params.get("next") || "/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <form onSubmit={onSubmit} className="w-full max-w-sm">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-mute">Desk</p>
        <h1 className="mt-3 text-2xl font-medium tracking-tight">Enter password</h1>
        <p className="mt-2 text-sm text-mute">Personal workspace. No account.</p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-8 w-full border-b border-line bg-transparent py-3 outline-none placeholder:text-mute"
          placeholder="Password"
        />
        {error && <p className="mt-3 text-sm text-mute">Wrong password.</p>}
        <button
          type="submit"
          disabled={busy || !password}
          className="mt-8 w-full rounded-md bg-ink py-2.5 text-sm text-paper disabled:opacity-40"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
