import { NextResponse } from "next/server";
import { buildDesk } from "@/lib/engine";
import { loadUniverse, usMarketOpen } from "@/lib/market";
import { isListed } from "@/lib/universe";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load desk";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
