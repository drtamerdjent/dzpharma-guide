import { NextResponse, type NextRequest } from "next/server";
import { createReport, getRecentReports } from "@/lib/reports";

export const dynamic = "force-dynamic";

/** GET /api/reports?limit=20 — recent crowd-sourced rupture alerts. */
export async function GET(request: NextRequest) {
  try {
    const limitParam = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "", 10);
    const limit = Number.isFinite(limitParam) ? limitParam : 20;
    const reports = await getRecentReports(limit);
    return NextResponse.json({ reports }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[API] GET /reports failed:", error);
    return NextResponse.json(
      { error: "Impossible de charger les signalements." },
      { status: 500 }
    );
  }
}

interface CreateReportBody {
  medicationId?: string;
  reporter?: string;
  note?: string;
}

/** POST /api/reports — "Signaler une rupture" (free, crowd-sourced). */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as CreateReportBody | null;
    const medicationId = body?.medicationId?.trim();
    if (!medicationId) {
      return NextResponse.json({ error: "medicationId requis." }, { status: 400 });
    }
    const result = await createReport({
      medicationId,
      reporter: body?.reporter,
      note: body?.note,
    });
    if (!result.medicationFound) {
      return NextResponse.json({ error: "Médicament introuvable." }, { status: 404 });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("[API] POST /reports failed:", error);
    return NextResponse.json(
      { error: "Impossible d'enregistrer le signalement." },
      { status: 500 }
    );
  }
}
