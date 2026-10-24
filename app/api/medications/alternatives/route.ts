import { NextResponse, type NextRequest } from "next/server";
import {
  getMoleculeAlternatives,
  sortAlternatives,
  type AlternativeSort,
} from "@/lib/moleculeIndex";

export const dynamic = "force-dynamic";

const SORTS: AlternativeSort[] = ["recommande", "prix", "cnas"];

/**
 * GET /api/medications/alternatives?id=<medication-id>&sort=recommande|prix|cnas
 * Returns all brands sharing the same active molecule (DCI), ranked.
 */
export async function GET(request: NextRequest) {
  try {
    const id = (request.nextUrl.searchParams.get("id") ?? "").trim();
    const sortParam = (request.nextUrl.searchParams.get("sort") ?? "recommande") as AlternativeSort;
    const sort: AlternativeSort = SORTS.includes(sortParam) ? sortParam : "recommande";

    if (!id) {
      return NextResponse.json({ error: "Paramètre 'id' requis." }, { status: 400 });
    }

    const { medication, key, alternatives } = await getMoleculeAlternatives(id);
    if (!medication) {
      return NextResponse.json({ error: "Médicament introuvable." }, { status: 404 });
    }

    return NextResponse.json(
      {
        medication,
        moleculeKey: key,
        alternatives: sortAlternatives(alternatives, sort),
        total: alternatives.length,
        sort,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[API] /medications/alternatives failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la recherche d'alternatives." },
      { status: 500 }
    );
  }
}
