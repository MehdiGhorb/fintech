"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AGENT_META } from "@/lib/catalog";
import type { AgentNodeData } from "@/lib/types";

export function AgentNode({ data, selected }: NodeProps) {
  const node = data as AgentNodeData;
  const meta = AGENT_META[node.type];

  return (
    <div
      className={`w-[220px] rounded-lg border bg-paper ${
        selected ? "border-ink" : "border-line"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-ink !bg-paper" />
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">{meta.short}</span>
        <span className={`h-1.5 w-1.5 rounded-full ${node.config.enabled ? "bg-ink" : "bg-line"}`} />
      </div>
      <div className="px-3 py-2.5">
        <div className="text-sm font-medium leading-tight">{node.config.name}</div>
        <div className="mt-1 truncate font-mono text-[11px] text-mute">{node.config.model}</div>
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-ink !bg-paper" />
    </div>
  );
}
