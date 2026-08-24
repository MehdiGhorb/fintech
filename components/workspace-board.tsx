"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo } from "react";
import { AgentNode } from "@/components/agent-node";
import { AGENT_META, defaultConfig } from "@/lib/catalog";
import { uid } from "@/lib/storage";
import type { AgentNodeData, AgentType, Workspace } from "@/lib/types";

const nodeTypes = { agent: AgentNode };

export function WorkspaceBoard({
  workspace,
  selectedId,
  onSelect,
  onChange,
}: {
  workspace: Workspace;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (nodes: Workspace["nodes"], edges: Workspace["edges"]) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(workspace.nodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(workspace.edges as Edge[]);

  useEffect(() => {
    setNodes(workspace.nodes as Node[]);
    setEdges(workspace.edges as Edge[]);
  }, [workspace.id, setNodes, setEdges]);

  const persist = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      onChange(
        nextNodes.map((node) => ({
          id: node.id,
          type: "agent" as const,
          position: node.position,
          data: node.data as AgentNodeData,
        })),
        nextEdges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
        })),
      );
    },
    [onChange],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) => {
        const next = addEdge({ ...connection, animated: true, style: { stroke: "rgb(var(--ink))" } }, current);
        persist(nodes, next);
        return next;
      });
    },
    [nodes, persist, setEdges],
  );

  useEffect(() => {
    persist(nodes, edges);
  }, [nodes, edges, persist]);

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        animated: true,
        style: { stroke: "rgb(var(--ink))", strokeWidth: 1.25 },
      })),
    [edges],
  );

  return (
    <ReactFlowProvider>
    <ReactFlow
      nodes={nodes}
      edges={styledEdges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={(_, _node, all) => persist(all, edges)}
      onConnect={onConnect}
      onPaneClick={() => onSelect(null)}
      onNodeClick={(_, node) => onSelect(node.id)}
      fitView
      proOptions={{ hideAttribution: true }}
      colorMode="system"
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgb(var(--line))" />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable maskColor="transparent" />
    </ReactFlow>
    </ReactFlowProvider>
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
