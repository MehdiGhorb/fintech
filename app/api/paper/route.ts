import { NextResponse } from "next/server";
import { bookFrom } from "@/lib/paper-book";
import { getPaper } from "@/lib/paper-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(bookFrom(getPaper()), {
    headers: { "Cache-Control": "no-store" },
  });
}
