"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { AgentInspector } from "@/components/agent-inspector";
import { AppHeader } from "@/components/app-header";
import { MarketPane } from "@/components/market-pane";
import { AgentPicker, WorkspaceBoard, addAgentNode } from "@/components/workspace-board";
import { getWorkspace, upsertWorkspace } from "@/lib/storage";
import type { AgentConfig, AgentType, Workspace } from "@/lib/types";

type Tab = "board" | "market";

export default function WorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [tab, setTab] = useState<Tab>("board");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const found = getWorkspace(params.id);
    if (!found) {
      setMissing(true);
      return;
    }
    setWorkspace(found);
  }, [params.id]);

  const selected = useMemo(
    () => workspace?.nodes.find((node) => node.id === selectedId) ?? null,
    [workspace, selectedId],
  );

  function commit(next: Workspace) {
    const saved = { ...next, updatedAt: new Date().toISOString() };
    setWorkspace(saved);
    upsertWorkspace(saved);
  }

  function createAgent(type: AgentType) {
    if (!workspace) return;
    const node = addAgentNode(type, workspace.nodes.length);
    commit({ ...workspace, nodes: [...workspace.nodes, node] });
    setSelectedId(node.id);
    setPicker(false);
  }

  function updateConfig(config: AgentConfig) {
    if (!workspace || !selectedId) return;
    commit({
      ...workspace,
      nodes: workspace.nodes.map((node) =>
        node.id === selectedId ? { ...node, data: { ...node.data, config } } : node,
      ),
    });
  }

  function removeAgent() {
    if (!workspace || !selectedId) return;
    commit({
      ...workspace,
      nodes: workspace.nodes.filter((node) => node.id !== selectedId),
      edges: workspace.edges.filter((edge) => edge.source !== selectedId && edge.target !== selectedId),
    });
    setSelectedId(null);
  }

  if (missing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm">Workspace not found.</p>
        <button type="button" onClick={() => router.push("/")} className="text-sm underline">
          Back
        </button>
      </div>
    );
  }

  if (!workspace) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppHeader
        title={workspace.name}
        subtitle={`${workspace.instrument.symbol} · ${workspace.instrument.name}`}
        right={
          <>
            <div className="flex rounded-md border border-line p-0.5">
              <button
                type="button"
                onClick={() => setTab("board")}
                className={`h-7 rounded px-2.5 text-xs ${tab === "board" ? "bg-ink text-paper" : "text-mute"}`}
              >
                Board
              </button>
              <button
                type="button"
                onClick={() => setTab("market")}
                className={`h-7 rounded px-2.5 text-xs ${tab === "market" ? "bg-ink text-paper" : "text-mute"}`}
              >
                Switch tab
              </button>
            </div>
            {tab === "board" && (
              <button
                type="button"
                onClick={() => setPicker(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-ink px-3 text-xs text-paper"
              >
                <Plus size={14} />
                New agent
              </button>
            )}
          </>
        }
      />

      <div className="relative flex min-h-0 flex-1">
        {tab === "board" ? (
          <>
            <div className="relative min-h-0 min-w-0 flex-1">
              <div className="absolute inset-0">
                <WorkspaceBoard
                  workspace={workspace}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onChange={(nodes, edges) => commit({ ...workspace, nodes, edges })}
                />
              </div>
            </div>
            {selected && (
              <AgentInspector
                type={selected.data.type}
                config={selected.data.config}
                onChange={updateConfig}
                onClose={() => setSelectedId(null)}
                onDelete={removeAgent}
              />
            )}
          </>
        ) : (
          <MarketPane instrument={workspace.instrument} />
        )}
      </div>

      {picker && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-xl border border-line bg-paper p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium">New agent</h2>
                <p className="mt-1 text-sm text-mute">Choose a type, then set instructions and model on the right.</p>
              </div>
              <button type="button" onClick={() => setPicker(false)} className="text-mute hover:text-ink">
                <X size={16} />
              </button>
            </div>
            <AgentPicker onPick={createAgent} />
          </div>
        </div>
      )}
    </div>
  );
}
