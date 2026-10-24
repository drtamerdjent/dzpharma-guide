import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/reports";

export const dynamic = "force-dynamic";

/** GET /api/reports/leaderboard — "Top Contributeur du Mois" (gamification). */
export async function GET() {
  try {
    const leaderboard = await getLeaderboard(5);
    return NextResponse.json(
      { leaderboard },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[API] /reports/leaderboard failed:", error);
    return NextResponse.json(
      { error: "Impossible de charger le classement." },
      { status: 500 }
    );
  }
}
