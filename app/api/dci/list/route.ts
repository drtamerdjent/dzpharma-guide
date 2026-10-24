/**
 * /api/dci/list — liste des DCI uniques de la base (5 380 médicaments).
 *
 * Utilisée par le vérificateur d'interactions (autocomplétion Command) et
 * disponible pour tout futur outil nécessitant l'index des molécules.
 * Couche hybride identique au reste de l'app : Supabase si configuré,
 * sinon le fallback Prisma (SQLite en dev, PostgreSQL en production sur
 * Vercel). Réponse mise en cache mémoire (données statiques) + en-tête
 * HTTP de cache court.
 */
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  MEDICATIONS_TABLE,
} from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

interface DciListResponse {
  dcis: string[];
  count: number;
  source: "supabase" | "prisma";
}

let cache: DciListResponse | null = null;

export async function GET() {
  if (cache) {
    return NextResponse.json(cache, { headers: { "Cache-Control": "public, max-age=600" } });
  }

  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from(MEDICATIONS_TABLE).select("dci");
      if (error) {
        throw new Error(`Supabase: ${error.message}`);
      }
      const unique = new Set<string>();
      for (const row of data ?? []) {
        const dci = typeof row?.dci === "string" ? row.dci.trim() : "";
        if (dci) unique.add(dci);
      }
      const dcis = Array.from(unique).sort((a, b) => a.localeCompare(b, "fr"));
      cache = { dcis, count: dcis.length, source: "supabase" };
    } else {
      // LOWER() instead of COLLATE NOCASE → valid on SQLite AND PostgreSQL
      const rows = await db.$queryRaw<Array<{ dci: string }>>(Prisma.sql`
        SELECT DISTINCT dci FROM medications ORDER BY LOWER(dci) ASC
      `);
      const dcis = rows.map((row) => row.dci);
      cache = { dcis, count: dcis.length, source: "prisma" };
    }

    return NextResponse.json(cache, {
      headers: { "Cache-Control": "public, max-age=600" },
    });
  } catch (error) {
    console.error("[api/dci/list]", error);
    return NextResponse.json(
      { error: "Liste des DCI indisponible." },
      { status: 500 }
    );
  }
}
