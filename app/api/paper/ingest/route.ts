import { NextResponse } from "next/server";
import { setPaper } from "@/lib/paper-store";
import type { PaperState } from "@/lib/paper-types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.INGEST_SECRET;
  if (secret && request.headers.get("x-ingest-secret") !== secret) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = (await request.json()) as PaperState;
  if (!body || typeof body.equity !== "number") {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }
  setPaper(body);
  return NextResponse.json({ ok: true });
}
