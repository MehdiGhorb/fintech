import { nameOf } from "./universe";
import type { PaperState } from "./paper-types";
import type { Book } from "./types";

export function bookFrom(state: PaperState): Book {
  const equity = state.equity ?? state.budget;
  const pnl = equity - state.budget;
  const cashNames = Object.values(state.signals || {})
    .filter((s) => !s.long)
    .sort((a, b) => b.predRet - a.predRet)
    .map((s) => ({ symbol: s.symbol, name: s.name, predRet: s.predRet }));
  return {
    budget: state.budget,
    cash: state.cash,
    equity,
    pnl,
    pnlPct: state.budget ? (pnl / state.budget) * 100 : 0,
    origin: state.origin,
    asOf: state.asOf,
    model: state.model,
    horizon: state.horizon,
    nLong: state.nLong ?? state.positions.length,
    nUniverse: state.nUniverse ?? Object.keys(state.signals || {}).length,
    broker: state.broker ?? "local-paper",
    positions: state.positions.map((p) => ({
      symbol: p.symbol,
      name: p.name || nameOf(p.symbol),
      qty: p.qty,
      entry: p.entry,
      last: p.last,
      value: p.value ?? p.qty * p.last,
      pnl: p.pnl ?? p.qty * p.last - p.qty * p.entry,
      pnlPct: p.pnlPct ?? (p.entry ? (p.last / p.entry - 1) * 100 : 0),
      predRet: p.predRet,
      predEnd: p.predEnd,
    })),
    cashNames,
    fills: (state.fills || []).slice(-40).reverse(),
    marks: (state.marks || []).map((m) => ({ d: m.d, equity: m.equity })),
  };
}
