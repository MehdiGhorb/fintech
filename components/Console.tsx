'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Depth = 'quick' | 'standard' | 'deep' | 'exhaustive';
type Provider = 'openai' | 'anthropic' | 'openrouter';

interface KeyStatus {
  configured: boolean;
  provider?: Provider;
  model?: string;
  keyHint?: string;
  suggested?: { deep: string; fast: string };
}

interface RunSummary {
  id: string;
  createdAt: number;
  status: string;
  phase: string | null;
  progress: number;
  query: string;
  depth: Depth;
  symbol?: string;
  action?: string;
  error?: string | null;
}

interface DeskEvent {
  seq?: number;
  ts?: number;
  phase?: string;
  agent?: string;
  type: string;
  message?: string;
  data?: any;
}

interface FollowUp {
  role: 'user' | 'assistant';
  content: string;
}

const DEPTHS: Array<{ id: Depth; label: string; hint: string }> = [
  { id: 'quick', label: 'Quick', hint: 'Core desk, lighter tool budget' },
  { id: 'standard', label: 'Standard', hint: 'Full desk, one debate round' },
  { id: 'deep', label: 'Deep', hint: 'More tools, a rebuttal round' },
  { id: 'exhaustive', label: 'Exhaustive', hint: 'Maximum reading and debate' },
];

const EXAMPLES = [
  'Analyse NVDA for the next month. I want to know if a long still makes sense after the run-up.',
  'Bitcoin, next two weeks. Directional view with invalidation.',
  'Is SPY extended here for a 1-week trade, or is this still a dip-buy?',
  'Apple vs Microsoft over the next quarter — which is the better risk/reward?',
];

export default function Console() {
  const [keys, setKeys] = useState<KeyStatus | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [depth, setDepth] = useState<Depth>('standard');
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [events, setEvents] = useState<DeskEvent[]>([]);
  const [report, setReport] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [phase, setPhase] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [followup, setFollowup] = useState('');
  const [followBusy, setFollowBusy] = useState(false);
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [provider, setProvider] = useState<Provider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [fastModel, setFastModel] = useState('');
  const [keyError, setKeyError] = useState('');
  const [keySaving, setKeySaving] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const loadKeys = useCallback(async () => {
    const res = await fetch('/api/keys');
    const data = await res.json();
    setKeys(data);
    if (!data.configured) setShowKeyForm(true);
    if (data.suggested) {
      setModel((m) => m || data.suggested.deep);
      setFastModel((m) => m || data.suggested.fast);
    }
  }, []);

  const loadRuns = useCallback(async () => {
    const res = await fetch('/api/runs');
    const data = await res.json();
    setRuns(data.runs ?? []);
  }, []);

  useEffect(() => {
    loadKeys();
    loadRuns();
  }, [loadKeys, loadRuns]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events]);

  const attachStream = useCallback((runId: string) => {
    const source = new EventSource(`/api/runs/${runId}/events`);
    source.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as DeskEvent;
        if (data.type === 'hello') {
          setPhase(data.data?.run?.phase || data.phase || '');
          setStatus(data.data?.run?.status || '');
          return;
        }
        setEvents((prev) => [...prev, data]);
        if (data.phase) setPhase(data.phase);
        if (data.type === 'done') {
          setStatus(data.data?.status || 'done');
          setBusy(false);
          source.close();
          fetch(`/api/runs/${runId}`)
            .then((r) => r.json())
            .then((full) => {
              setReport(full.report || '');
              setFollowups(
                (full.messages || []).map((m: any) => ({
                  role: m.role === 'user' ? 'user' : 'assistant',
                  content: m.content,
                })),
              );
            });
          loadRuns();
        }
        if (data.type === 'error') setError(data.message || 'Run failed');
      } catch {
        /* ignore malformed chunks */
      }
    };
    source.onerror = () => {
      source.close();
      fetch(`/api/runs/${runId}`)
        .then((r) => r.json())
        .then((full) => {
          setStatus(full.status);
          setPhase(full.phase);
          setReport(full.report || '');
          setBusy(full.status === 'running');
          if (full.error) setError(full.error);
        })
        .catch(() => setBusy(false));
    };
    return source;
  }, [loadRuns]);

  const openRun = useCallback(
    async (id: string) => {
      setActiveId(id);
      setError('');
      setEvents([]);
      setReport('');
      setFollowups([]);
      const res = await fetch(`/api/runs/${id}`);
      const full = await res.json();
      setStatus(full.status);
      setPhase(full.phase);
      setReport(full.report || '');
      setFollowups(
        (full.messages || []).map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
      );
      if (full.status === 'running') {
        setBusy(true);
        const source = attachStream(id);
        return () => source.close();
      }
      setBusy(false);
    },
    [attachStream],
  );

  async function saveKey(e: FormEvent) {
    e.preventDefault();
    setKeySaving(true);
    setKeyError('');
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, model, fastModel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save the key');
      setApiKey('');
      setShowKeyForm(false);
      await loadKeys();
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : 'Could not save the key');
    } finally {
      setKeySaving(false);
    }
  }

  async function startAnalysis(text?: string) {
    const q = (text ?? query).trim();
    if (!q || busy) return;
    if (!keys?.configured) {
      setShowKeyForm(true);
      return;
    }
    setBusy(true);
    setError('');
    setEvents([]);
    setReport('');
    setFollowups([]);
    setQuery('');
    setStatus('running');
    setPhase('intake');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, depth }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start');
      setActiveId(data.runId);
      setEvents([{ type: 'phase', message: q, phase: 'intake' }]);
      attachStream(data.runId);
      loadRuns();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : 'Could not start the analysis');
    }
  }

  async function sendFollowup(e: FormEvent) {
    e.preventDefault();
    if (!activeId || !followup.trim() || followBusy) return;
    const text = followup.trim();
    setFollowup('');
    setFollowups((p) => [...p, { role: 'user', content: text }]);
    setFollowBusy(true);
    try {
      const res = await fetch(`/api/runs/${activeId}/followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Follow-up failed');
      setFollowups((p) => [...p, { role: 'assistant', content: data.content }]);
    } catch (err) {
      setFollowups((p) => [
        ...p,
        { role: 'assistant', content: err instanceof Error ? err.message : 'Follow-up failed' },
      ]);
    } finally {
      setFollowBusy(false);
    }
  }

  const live = useMemo(() => events.filter((e) => e.type !== 'hello'), [events]);

  return (
    <div className="h-screen flex flex-col bg-[#0b0c0e] text-zinc-200">
      <header className="flex items-center justify-between px-5 h-12 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold tracking-tight text-zinc-100">Northline Finance</span>
          <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Research desk</span>
          {activeId && (
            <button
              onClick={() => {
                setActiveId(null);
                setEvents([]);
                setReport('');
                setFollowups([]);
                setStatus('');
                setPhase('');
                setError('');
                setBusy(false);
              }}
              className="text-[11px] text-zinc-500 hover:text-zinc-200"
            >
              New
            </button>
          )}
        </div>
        <button
          onClick={() => setShowKeyForm(true)}
          className="text-xs text-zinc-400 hover:text-zinc-200"
        >
          {keys?.configured ? `${keys.provider} · ${keys.keyHint}` : 'Add API key'}
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-64 border-r border-zinc-800 flex flex-col shrink-0 bg-[#0e1013]">
          <div className="px-4 py-3 text-[11px] uppercase tracking-widest text-zinc-500">Runs</div>
          <div className="flex-1 overflow-y-auto">
            {runs.length === 0 && (
              <p className="px-4 text-xs text-zinc-600">No analyses yet.</p>
            )}
            {runs.map((r) => (
              <button
                key={r.id}
                onClick={() => openRun(r.id)}
                className={`w-full text-left px-4 py-3 border-b border-zinc-900 hover:bg-zinc-900/60 ${
                  activeId === r.id ? 'bg-zinc-900' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-zinc-200 truncate">{r.symbol || r.query.slice(0, 28)}</span>
                  <span className={`text-[10px] uppercase ${
                    r.status === 'done' ? 'text-emerald-500' : r.status === 'error' ? 'text-red-400' : 'text-amber-400'
                  }`}>
                    {r.action || r.status}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 truncate mt-0.5">{r.query}</p>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 flex min-w-0">
          <section className="flex-1 flex flex-col min-w-0 border-r border-zinc-800">
            <div ref={logRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              {!activeId && !busy && (
                <div className="max-w-2xl mt-10">
                  <h1 className="text-2xl font-semibold text-zinc-100 mb-2">What should the desk work on?</h1>
                  <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
                    Name a stock, ETF or token and a horizon. A swarm of specialists will scrape filings,
                    news and market data, run a quantitative engine, debate, and return a call.
                  </p>
                  <div className="grid gap-2">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        onClick={() => startAnalysis(ex)}
                        className="text-left text-sm px-4 py-3 rounded-lg border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-zinc-200"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {live.map((e, i) => (
                <LogLine key={`${e.seq ?? i}-${e.type}`} event={e} />
              ))}

              {error && <p className="text-sm text-red-400">{error}</p>}

              {followups.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'text-zinc-100' : 'text-zinc-300'}>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">
                    {m.role === 'user' ? 'You' : 'Desk'}
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{m.content}</pre>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (activeId && status === 'done') sendFollowup(e);
                else startAnalysis();
              }}
              className="border-t border-zinc-800 p-4"
            >
              <div className="flex gap-2 mb-2">
                {DEPTHS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDepth(d.id)}
                    title={d.hint}
                    className={`text-[11px] px-2.5 py-1 rounded-full border ${
                      depth === d.id
                        ? 'border-zinc-300 text-zinc-100'
                        : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
                {phase && (
                  <span className="ml-auto text-[11px] text-zinc-500 self-center">
                    {busy ? `Working · ${phase}` : status}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={activeId && status === 'done' ? followup : query}
                  onChange={(e) =>
                    activeId && status === 'done' ? setFollowup(e.target.value) : setQuery(e.target.value)
                  }
                  placeholder={
                    activeId && status === 'done'
                      ? 'Ask a follow-up about this file…'
                      : 'e.g. Analyse NVDA for the next month and tell me if I should buy'
                  }
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm outline-none focus:border-zinc-600"
                  disabled={busy || followBusy}
                />
                <button
                  type="submit"
                  disabled={busy || followBusy}
                  className="px-4 py-3 bg-zinc-100 text-black text-sm font-medium rounded-lg disabled:opacity-40"
                >
                  {busy ? 'Running' : activeId && status === 'done' ? 'Ask' : 'Analyse'}
                </button>
              </div>
            </form>
          </section>

          <section className="w-[46%] min-w-[360px] max-w-[720px] flex flex-col bg-[#0c0d10]">
            <div className="px-5 py-3 border-b border-zinc-800 text-[11px] uppercase tracking-widest text-zinc-500">
              Call
            </div>
            <div ref={reportRef} className="flex-1 overflow-y-auto px-5 py-5">
              {report ? (
                <article className="prose-report text-[13.5px] leading-6 text-zinc-300 whitespace-pre-wrap">
                  {report}
                </article>
              ) : (
                <p className="text-sm text-zinc-600">
                  {busy ? 'The call will land here as the desk finishes.' : 'No report yet.'}
                </p>
              )}
            </div>
          </section>
        </main>
      </div>

      {showKeyForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-20 p-4">
          <form onSubmit={saveKey} className="w-full max-w-md bg-[#12141a] border border-zinc-800 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">API key</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Stored locally, encrypted on disk. Used only to run the research desk. Never sent anywhere except your chosen provider.
              </p>
            </div>
            <label className="block text-xs text-zinc-500">
              Provider
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as Provider)}
                className="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openrouter">OpenRouter</option>
              </select>
            </label>
            <label className="block text-xs text-zinc-500">
              API key
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
                className="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200"
                placeholder="sk-…"
              />
            </label>
            <label className="block text-xs text-zinc-500">
              Deep model
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200"
              />
            </label>
            <label className="block text-xs text-zinc-500">
              Fast model
              <input
                value={fastModel}
                onChange={(e) => setFastModel(e.target.value)}
                className="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200"
              />
            </label>
            {keyError && <p className="text-sm text-red-400">{keyError}</p>}
            <div className="flex gap-2 justify-end">
              {keys?.configured && (
                <button
                  type="button"
                  onClick={() => setShowKeyForm(false)}
                  className="px-3 py-2 text-sm text-zinc-400"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={keySaving}
                className="px-4 py-2 bg-zinc-100 text-black text-sm font-medium rounded-lg"
              >
                {keySaving ? 'Checking…' : 'Save key'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function LogLine({ event }: { event: DeskEvent }) {
  const label =
    event.type === 'phase'
      ? 'phase'
      : event.type === 'agent-start'
        ? 'start'
        : event.type === 'agent-finish'
          ? 'done'
          : event.type === 'tool-call'
            ? 'tool'
            : event.type === 'tool-result'
              ? 'data'
              : event.type === 'warning'
                ? 'warn'
                : event.type === 'error'
                  ? 'error'
                  : event.type === 'report'
                    ? 'memo'
                    : event.type === 'artifact'
                      ? 'src'
                      : event.type === 'agent-thought'
                        ? 'note'
                        : event.type;

  const color =
    event.type === 'error'
      ? 'text-red-400'
      : event.type === 'warning'
        ? 'text-amber-400'
        : event.type === 'phase'
          ? 'text-zinc-100'
          : event.type === 'agent-finish' || event.type === 'report'
            ? 'text-emerald-400/90'
            : 'text-zinc-500';

  return (
    <div className="text-[12.5px] leading-5">
      <span className={`font-mono uppercase tracking-wide mr-2 ${color}`}>{label}</span>
      {event.agent && <span className="text-zinc-500 mr-2">{event.agent}</span>}
      <span className="text-zinc-300">{event.message}</span>
    </div>
  );
}
