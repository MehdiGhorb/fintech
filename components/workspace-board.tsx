"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { AGENT_META, defaultConfig } from "@/lib/catalog";
import { uid } from "@/lib/storage";
import type { AgentNodeData, AgentType, Workspace } from "@/lib/types";
import { AgentNode } from "@/components/agent-node";

const nodeTypes = { agent: AgentNode };

export function WorkspaceBoard({
  workspace,
  onSelect,
  onChange,
}: {
  workspace: Workspace;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (nodes: Workspace["nodes"], edges: Workspace["edges"]) => void;
}) {
  const { resolvedTheme } = useTheme();
  const nodes = workspace.nodes as Node[];
  const edges = workspace.edges as Edge[];
  const colorMode = resolvedTheme === "light" ? "light" : "dark";

  function persistNodes(next: Node[]) {
    onChange(
      next.map((node) => ({
        id: node.id,
        type: "agent" as const,
        position: node.position,
        data: node.data as AgentNodeData,
      })),
      workspace.edges,
    );
  }

  function persistEdges(next: Edge[]) {
    onChange(
      workspace.nodes,
      next.map((edge) => ({
        id: edge.id,
        source: String(edge.source),
        target: String(edge.target),
      })),
    );
  }

  return (
    <div className="relative h-full w-full">
      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-lg border border-line bg-paper/90 px-5 py-4 text-center">
            <p className="text-sm font-medium">This board is empty</p>
            <p className="mt-1 text-xs text-mute">Use + New agent, then drag and connect the boxes.</p>
          </div>
        </div>
      )}
      <ReactFlow
        className="h-full w-full"
        nodes={nodes}
        edges={edges.map((edge) => ({
          ...edge,
          animated: true,
          style: { stroke: "currentColor", strokeWidth: 1.25 },
        }))}
        nodeTypes={nodeTypes}
        colorMode={colorMode}
        fitView={nodes.length > 0}
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.4}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        onNodesChange={(changes: NodeChange[]) => {
          persistNodes(applyNodeChanges(changes, nodes));
        }}
        onEdgesChange={(changes: EdgeChange[]) => {
          persistEdges(applyEdgeChanges(changes, edges));
        }}
        onConnect={(connection: Connection) => {
          persistEdges(addEdge({ ...connection, animated: true }, edges));
        }}
        onPaneClick={() => onSelect(null)}
        onNodeClick={(_, node) => onSelect(node.id)}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background
          id="dots"
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.4}
          color={colorMode === "dark" ? "#3a3a3a" : "#d4d4d4"}
        />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}

export function addAgentNode(type: AgentType, existingCount: number): Workspace["nodes"][number] {
  const col = existingCount % 3;
  const row = Math.floor(existingCount / 3);
  return {
    id: uid("ag"),
    type: "agent",
    position: { x: 80 + col * 280, y: 80 + row * 160 },
    data: {
      type,
      config: defaultConfig(type),
    },
  };
}

export function AgentPicker({ onPick }: { onPick: (type: AgentType) => void }) {
  const types: AgentType[] = ["market", "research", "trading", "risk"];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {types.map((type) => {
        const meta = AGENT_META[type];
        return (
          <button
            key={type}
            type="button"
            onClick={() => onPick(type)}
            className="rounded-lg border border-line px-3 py-3 text-left hover:border-ink"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">{meta.short}</div>
            <div className="mt-1 text-sm font-medium">{meta.label}</div>
          </button>
        );
      })}
    </div>
  );
}
