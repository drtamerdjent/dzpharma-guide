import { NextResponse } from "next/server";
import { getReportSummary } from "@/lib/reports";

export const dynamic = "force-dynamic";

/** GET /api/reports/summary — per-medication rupture counts (last 30 days). */
export async function GET() {
  try {
    const summary = await getReportSummary();
    return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[API] /reports/summary failed:", error);
    return NextResponse.json(
      { error: "Impossible de charger le résumé des signalements." },
      { status: 500 }
    );
  }
}
