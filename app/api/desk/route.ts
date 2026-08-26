import { NextResponse } from "next/server";
import { buildDesk } from "@/lib/engine";
import { loadUniverse, usMarketOpen } from "@/lib/market";
import { bookFrom } from "@/lib/paper-book";
import { getPaper } from "@/lib/paper-store";
import { isListed, nameOf } from "@/lib/universe";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function nextSessions(from: string, count: number) {
  const out: string[] = [];
  const d = new Date(`${from}T20:00:00Z`);
  while (out.length < count) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day === 0 || day === 6) continue;
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") || "AAPL").toUpperCase();
  if (!isListed(symbol)) {
    return NextResponse.json({ error: "Unknown ticker" }, { status: 400 });
  }

  try {
    const pack = await loadUniverse(symbol);
    if (!pack.bars[symbol]) {
      return NextResponse.json({ error: `No data for ${symbol}` }, { status: 502 });
    }
    const payload = buildDesk(symbol, pack, usMarketOpen());
    const paper = getPaper();
    const sig = paper.signals?.[symbol];
    const pos = paper.positions.find((p) => p.symbol === symbol);
    const lastClose = payload.quote.price;
    if (sig?.path?.length) {
      const dates = nextSessions(sig.date || payload.asOf, sig.path.length);
      const expectedPct = sig.predRet;
      const direction = expectedPct > 0.25 ? "up" : expectedPct < -0.25 ? "down" : "flat";
      const verb = direction === "up" ? "rise" : direction === "down" ? "fall" : "stay roughly flat";
      payload.forecast = {
        horizonDays: 21,
        direction,
        expectedPct,
        lowPct: expectedPct,
        highPct: expectedPct,
        expectedPrice: sig.predEnd,
        lowPrice: Math.min(...sig.path),
        highPrice: Math.max(...sig.path),
        confidence: 1,
        summary: sig.long
          ? `FinCast expects ${nameOf(symbol)} to ${verb} about ${Math.abs(expectedPct).toFixed(1)}% over the next 21 sessions, so the paper book is long.`
          : `FinCast expects ${nameOf(symbol)} to ${verb} about ${Math.abs(expectedPct).toFixed(1)}% over the next 21 sessions, so the paper book stays in cash.`,
        path: [
          { date: sig.date || payload.asOf, close: lastClose, lo: lastClose, hi: lastClose },
          ...sig.path.map((close, i) => ({
            date: dates[i] || dates[dates.length - 1],
            close,
            lo: close,
            hi: close,
          })),
        ],
      };
      payload.selected = {
        action: sig.long ? "buy" : "hold",
        weight: paper.nLong ? 1 / paper.nLong : 0,
        reason: pos
          ? `Paper long ${pos.qty.toFixed(4)} shares at ${pos.entry.toFixed(2)}.`
          : "Not in the book this month. Cash.",
      };
      payload.performance = {
        directionalAcc: 0,
        sharpe: 0,
        maxDrawdown: 0,
        sample: 0,
      };
    }
    payload.source = `${pack.source} · FinCast 21d`;
    payload.book = bookFrom(paper);
    payload.orders = paper.positions.map((p) => ({
      action: "buy" as const,
      symbol: p.symbol,
      name: p.name || nameOf(p.symbol),
      weight: paper.equity ? (p.qty * p.last) / paper.equity : 0,
      reason: `FinCast +${p.predRet.toFixed(1)}% over 21 sessions`,
      isSelected: p.symbol === symbol,
    }));
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load desk";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
