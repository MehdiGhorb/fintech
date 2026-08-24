"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { CreateWorkspaceModal } from "@/components/create-workspace-modal";
import { deleteWorkspace, loadWorkspaces, uid, upsertWorkspace } from "@/lib/storage";
import type { Instrument, Workspace } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setWorkspaces(loadWorkspaces());
    setReady(true);
  }, []);

  function create(name: string, instrument: Instrument) {
    const now = new Date().toISOString();
    const workspace: Workspace = {
      id: uid("ws"),
      name,
      instrument,
      createdAt: now,
      updatedAt: now,
      nodes: [],
      edges: [],
    };
    setWorkspaces(upsertWorkspace(workspace));
    setOpen(false);
    router.push(`/workspace/${workspace.id}`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        title="Workspaces"
        subtitle="Boards for agents, research, and market context"
        right={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-ink px-3 text-xs text-paper"
          >
            <Plus size={14} />
            New workspace
          </button>
        }
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
        {!ready ? null : workspaces.length === 0 ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex w-full flex-col items-start rounded-xl border border-dashed border-line px-6 py-16 text-left hover:border-ink"
          >
            <span className="text-base font-medium">Create your first workspace</span>
            <span className="mt-2 max-w-md text-sm text-mute">
              Choose an exchange, stock, or ETF. Then drop agents on the board and wire them together.
            </span>
          </button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((item) => (
              <article key={item.id} className="group relative rounded-xl border border-line p-4 hover:border-ink">
                <a href={`/workspace/${item.id}`} className="block">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">
                    {item.instrument.kind} · {item.instrument.symbol}
                  </p>
                  <h2 className="mt-2 text-base font-medium">{item.name}</h2>
                  <p className="mt-1 truncate text-sm text-mute">{item.instrument.name}</p>
                  <p className="mt-6 font-mono text-[11px] text-mute">
                    {item.nodes.length} agents · {item.edges.length} links
                  </p>
                </a>
                <button
                  type="button"
                  onClick={() => setWorkspaces(deleteWorkspace(item.id))}
                  className="absolute right-3 top-3 hidden h-7 w-7 items-center justify-center rounded-md border border-line text-mute hover:text-ink group-hover:flex"
                  aria-label="Delete workspace"
                >
                  <Trash2 size={13} />
                </button>
              </article>
            ))}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-xl border border-dashed border-line p-4 text-left text-sm text-mute hover:border-ink hover:text-ink"
            >
              + New workspace
            </button>
          </div>
        )}
      </main>

      <CreateWorkspaceModal open={open} onClose={() => setOpen(false)} onCreate={create} />
    </div>
  );
}
