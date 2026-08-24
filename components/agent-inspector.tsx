"use client";

import type { ReactNode } from "react";
import { AGENT_META, MODELS } from "@/lib/catalog";
import type { AgentConfig, AgentType, Cadence, MemoryMode } from "@/lib/types";

const CADENCE: Cadence[] = ["realtime", "1m", "5m", "15m", "1h", "1d", "manual"];
const MEMORY: MemoryMode[] = ["none", "session", "persistent"];
const FIELDS = ["open", "high", "low", "close", "adj close", "volume", "vwap", "bid/ask"];
const SOURCES = ["SEC filings", "Earnings transcripts", "News", "Competitors", "Valuation notes", "Guidance"];

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.16em] text-mute">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const input = "w-full rounded-md border border-line bg-transparent px-2.5 py-1.5 text-sm outline-none";

export function AgentInspector({
  type,
  config,
  onChange,
  onClose,
  onDelete,
}: {
  type: AgentType;
  config: AgentConfig;
  onChange: (next: AgentConfig) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const meta = AGENT_META[type];
  const patch = (partial: Partial<AgentConfig>) => onChange({ ...config, ...partial });

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-line bg-paper">
      <div className="flex items-start justify-between border-b border-line px-4 py-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">{meta.label}</p>
          <p className="mt-1 text-sm text-mute">{meta.description}</p>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-mute hover:text-ink">
          Close
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <Field label="Name">
          <input className={input} value={config.name} onChange={(e) => patch({ name: e.target.value })} />
        </Field>

        <Field label="Instructions">
          <textarea
            rows={7}
            className={`${input} resize-y leading-relaxed`}
            value={config.instructions}
            onChange={(e) => patch({ instructions: e.target.value })}
          />
        </Field>

        <Field label="Model">
          <select
            className={input}
            value={config.model}
            onChange={(e) => patch({ model: e.target.value as AgentConfig["model"] })}
          >
            {MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.vendor} — {model.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={`Temperature ${config.temperature.toFixed(2)}`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={config.temperature}
              onChange={(e) => patch({ temperature: Number(e.target.value) })}
              className="w-full"
            />
          </Field>
          <Field label="Max tokens">
            <input
              type="number"
              className={input}
              value={config.maxTokens}
              onChange={(e) => patch({ maxTokens: Number(e.target.value) })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cadence">
            <select className={input} value={config.cadence} onChange={(e) => patch({ cadence: e.target.value as Cadence })}>
              {CADENCE.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Memory">
            <select className={input} value={config.memory} onChange={(e) => patch({ memory: e.target.value as MemoryMode })}>
              {MEMORY.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Max iterations">
          <input
            type="number"
            className={input}
            value={config.maxIterations}
            onChange={(e) => patch({ maxIterations: Number(e.target.value) })}
          />
        </Field>

        <Field label="Tools">
          <div className="flex flex-wrap gap-1.5">
            {meta.tools.map((tool) => {
              const on = config.tools.includes(tool);
              return (
                <button
                  key={tool}
                  type="button"
                  onClick={() =>
                    patch({
                      tools: on ? config.tools.filter((t) => t !== tool) : [...config.tools, tool],
                    })
                  }
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    on ? "border-ink bg-ink text-paper" : "border-line text-mute"
                  }`}
                >
                  {tool}
                </button>
              );
            })}
          </div>
        </Field>

        {type === "market" && (
          <>
            <Field label="Fields">
              <div className="flex flex-wrap gap-1.5">
                {FIELDS.map((field) => {
                  const on = config.fields.includes(field);
                  return (
                    <button
                      key={field}
                      type="button"
                      onClick={() =>
                        patch({
                          fields: on ? config.fields.filter((f) => f !== field) : [...config.fields, field],
                        })
                      }
                      className={`rounded-full border px-2.5 py-1 text-xs ${
                        on ? "border-ink bg-ink text-paper" : "border-line text-mute"
                      }`}
                    >
                      {field}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Lookback (days)">
              <input
                type="number"
                className={input}
                value={config.lookbackDays}
                onChange={(e) => patch({ lookbackDays: Number(e.target.value) })}
              />
            </Field>
          </>
        )}

        {type === "research" && (
          <Field label="Sources">
            <div className="flex flex-wrap gap-1.5">
              {SOURCES.map((source) => {
                const on = config.sources.includes(source);
                return (
                  <button
                    key={source}
                    type="button"
                    onClick={() =>
                      patch({
                        sources: on ? config.sources.filter((s) => s !== source) : [...config.sources, source],
                      })
                    }
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      on ? "border-ink bg-ink text-paper" : "border-line text-mute"
                    }`}
                  >
                    {source}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {type === "trading" && (
          <>
            <Field label="Horizon">
              <select
                className={input}
                value={config.horizon}
                onChange={(e) => patch({ horizon: e.target.value as AgentConfig["horizon"] })}
              >
                <option value="intraday">Intraday</option>
                <option value="swing">Swing</option>
                <option value="position">Position</option>
              </select>
            </Field>
            <Field label={`Confidence threshold ${Math.round(config.confidence * 100)}%`}>
              <input
                type="range"
                min={0.3}
                max={0.9}
                step={0.05}
                value={config.confidence}
                onChange={(e) => patch({ confidence: Number(e.target.value) })}
                className="w-full"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.longOnly}
                onChange={(e) => patch({ longOnly: e.target.checked })}
              />
              Long only
            </label>
          </>
        )}

        {type === "risk" && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Max DD">
              <input
                type="number"
                step={0.01}
                className={input}
                value={config.maxDrawdown}
                onChange={(e) => patch({ maxDrawdown: Number(e.target.value) })}
              />
            </Field>
            <Field label="Max pos.">
              <input
                type="number"
                step={0.01}
                className={input}
                value={config.maxPosition}
                onChange={(e) => patch({ maxPosition: Number(e.target.value) })}
              />
            </Field>
            <Field label="Stop">
              <input
                type="number"
                step={0.01}
                className={input}
                value={config.stopLoss}
                onChange={(e) => patch({ stopLoss: Number(e.target.value) })}
              />
            </Field>
          </div>
        )}

        <label className="flex items-center justify-between text-sm">
          <span>Enabled</span>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
        </label>
      </div>

      <div className="border-t border-line px-4 py-3">
        <button type="button" onClick={onDelete} className="text-xs text-mute hover:text-ink">
          Remove agent
        </button>
      </div>
    </aside>
  );
}
