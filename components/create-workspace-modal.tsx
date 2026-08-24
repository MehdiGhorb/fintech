"use client";

import { useMemo, useState } from "react";
import { ETFS, EXCHANGES, STOCKS, suggestedWorkspaceName } from "@/lib/catalog";
import type { Instrument, MarketKind } from "@/lib/types";

const TABS: { id: MarketKind; label: string }[] = [
  { id: "exchange", label: "Exchanges" },
  { id: "stock", label: "Stocks" },
  { id: "etf", label: "ETFs" },
];

export function CreateWorkspaceModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, instrument: Instrument) => void;
}) {
  const [tab, setTab] = useState<MarketKind>("stock");
  const [selected, setSelected] = useState<Instrument | null>(STOCKS[0]);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const source = tab === "exchange" ? EXCHANGES : tab === "stock" ? STOCKS : ETFS;
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter(
      (item) =>
        item.symbol.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.venue.toLowerCase().includes(q),
    );
  }, [tab, query]);

  if (!open) return null;

  const placeholder = selected ? suggestedWorkspaceName(selected) : "Workspace name";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-xl border border-line bg-paper">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-medium">New workspace</h2>
            <p className="mt-1 text-sm text-mute">Pick a market, then name the board.</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-mute hover:text-ink">
            Close
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="flex gap-1 rounded-md border border-line p-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setQuery("");
                  const first = item.id === "exchange" ? EXCHANGES[0] : item.id === "stock" ? STOCKS[0] : ETFS[0];
                  setSelected(first);
                }}
                className={`flex-1 rounded px-3 py-1.5 text-sm ${
                  tab === item.id ? "bg-ink text-paper" : "text-mute hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="mt-3 w-full border-b border-line bg-transparent py-2 text-sm outline-none"
          />
        </div>

        <div className="max-h-72 overflow-y-auto px-5 py-3">
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {list.map((item) => {
              const active = selected?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item)}
                  className={`rounded-md border px-3 py-2 text-left ${
                    active ? "border-ink" : "border-transparent hover:border-line"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-sm">{item.symbol}</span>
                    <span className="text-[11px] text-mute">{item.venue}</span>
                  </div>
                  <div className="truncate text-xs text-mute">{item.name}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-line px-5 py-4">
          <label className="text-xs text-mute">Workspace name</label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={placeholder}
            className="mt-1 w-full border-b border-line bg-transparent py-2 outline-none"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="h-9 px-3 text-sm text-mute">
              Cancel
            </button>
            <button
              type="button"
              disabled={!selected}
              onClick={() => {
                if (!selected) return;
                onCreate(name.trim() || suggestedWorkspaceName(selected), selected);
              }}
              className="h-9 rounded-md bg-ink px-4 text-sm text-paper disabled:opacity-40"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
