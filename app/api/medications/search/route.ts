import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  getDataSource,
  searchMedications,
} from "@/lib/medications";
import { getMoleculeIndex, moleculeKey } from "@/lib/moleculeIndex";
import { getReportSummary } from "@/lib/reports";
import type { MedicationMeta, SearchResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const EMPTY: SearchResponse = {
  items: [],
  meta: {},
  total: 0,
  limit: DEFAULT_PAGE_SIZE,
  offset: 0,
  hasMore: false,
  source: getDataSource(),
};

/**
 * GET /api/medications/search
 * Query params:
 *   q             – search term (matched against dci AND nom_commercial)
 *   availableOnly – "false" to include out-of-stock drugs (default true)
 *   limit         – page size (1..100, default 30)
 *   offset        – pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = (searchParams.get("q") ?? "").trim().slice(0, 100);
    const availableOnly = searchParams.get("availableOnly") !== "false";
    const limitParam = Number.parseInt(searchParams.get("limit") ?? "", 10);
    const offsetParam = Number.parseInt(searchParams.get("offset") ?? "", 10);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
    const offset = Number.isFinite(offsetParam) && offsetParam > 0 ? offsetParam : 0;

    if (!query) {
      return NextResponse.json({ ...EMPTY, limit, offset });
    }

    const result = await searchMedications({ query, availableOnly, limit, offset });

    // Enrich results with alternatives + rupture metadata (all in-memory).
    const [index, rupture] = await Promise.all([getMoleculeIndex(), getReportSummary()]);
    const meta: Record<string, MedicationMeta> = {};
    for (const item of result.items) {
      const key = moleculeKey(item.dci);
      const group = index.byMolecule.get(key) ?? [];
      meta[item.id] = {
        altCount: group.filter((m) => m.id !== item.id && m.is_available).length,
        ruptureCount: rupture.counts[item.id] ?? 0,
      };
    }

    return NextResponse.json(
      { ...result, meta },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("[API] /medications/search failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la recherche. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
