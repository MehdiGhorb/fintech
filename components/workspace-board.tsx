"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { AgentNode } from "@/components/agent-node";
import { AGENT_META, defaultConfig } from "@/lib/catalog";
import { uid } from "@/lib/storage";
import type { AgentType, Workspace } from "@/lib/types";

const nodeTypes = { agent: AgentNode };

function toFlowNodes(nodes: Workspace["nodes"]): Node[] {
  return nodes.map((node) => ({
    ...node,
    type: "agent",
    style: { width: 220, height: 92 },
    width: 220,
    height: 92,
  }));
}

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
  const colorMode = resolvedTheme === "light" ? "light" : "dark";
  const [nodes, setNodes, onNodesChange] = useNodesState(toFlowNodes(workspace.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(workspace.edges);

  useEffect(() => {
    setNodes((current) => {
      const incoming = toFlowNodes(workspace.nodes);
      const sameIds =
        current.length === incoming.length && current.every((node, i) => node.id === incoming[i]?.id);
      if (!sameIds) return incoming;
      return current.map((node) => {
        const next = incoming.find((item) => item.id === node.id);
        if (!next) return node;
        return { ...node, data: next.data };
      });
    });
    setEdges(workspace.edges);
  }, [workspace.nodes, workspace.edges, setNodes, setEdges]);

  function save(nextNodes: Node[], nextEdges: typeof edges) {
    onChange(
      nextNodes.map((node) => ({
        id: node.id,
        type: "agent" as const,
        position: node.position,
        data: node.data as Workspace["nodes"][number]["data"],
        width: 220,
        height: 92,
      })) as Workspace["nodes"],
      nextEdges.map((edge) => ({
        id: edge.id,
        source: String(edge.source),
        target: String(edge.target),
      })),
    );
  }

  return (
    <div className="relative h-full w-full">
      {workspace.nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-lg border border-line bg-paper px-5 py-4 text-center">
            <p className="text-sm font-medium">This board is empty</p>
            <p className="mt-1 text-xs text-mute">Click + New agent, pick a type, and the box appears here.</p>
          </div>
        </div>
      )}
      <ReactFlow
        className="h-full w-full"
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={colorMode}
        minZoom={0.4}
        maxZoom={1.6}
        defaultViewport={{ x: 80, y: 60, zoom: 1 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        onNodesChange={onNodesChange}
        onEdgesChange={(changes) => {
          onEdgesChange(changes);
        }}
        onNodeDragStop={(_, _node, all) => save(all, edges)}
        onConnect={(connection: Connection) => {
          setEdges((current) => {
            const next = addEdge(connection, current);
            save(nodes, next);
            return next;
          });
        }}
        onPaneClick={() => onSelect(null)}
        onNodeClick={(_, node) => onSelect(node.id)}
        defaultEdgeOptions={{ type: "smoothstep", animated: true }}
      >
        <Background
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
    position: { x: 72 + col * 260, y: 72 + row * 140 },
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
