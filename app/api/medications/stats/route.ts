import { NextResponse } from "next/server";
import { getDatabaseStats } from "@/lib/medications";

export const dynamic = "force-dynamic";

/** GET /api/medications/stats — dataset counters for the landing header. */
export async function GET() {
  try {
    const stats = await getDatabaseStats();
    return NextResponse.json(stats, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[API] /medications/stats failed:", error);
    return NextResponse.json(
      { error: "Impossible de charger les statistiques." },
      { status: 500 }
    );
  }
}
