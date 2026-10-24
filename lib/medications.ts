/**
 * DzPharma Guide — medication search service (SERVER-ONLY)
 *
 * Hybrid data layer:
 *  - When SUPABASE_URL + SUPABASE_ANON_KEY are configured, queries run
 *    against the managed Supabase `public.medications` table (Postgres
 *    ILIKE = case-insensitive partial match).
 *  - Otherwise, it transparently falls back to Prisma — SQLite mirror in
 *    development, PostgreSQL (Supabase/Neon) in production on Vercel —
 *    so the app always works.
 *
 * Search matches BOTH `dci` and `nom_commercial`, case-insensitively,
 * with partial matching, and ranks prefix matches (e.g. "para…" for
 * "PARACETAMOL") before infix matches.
 */
import { Prisma, type Medication as PrismaMedication } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  MEDICATIONS_TABLE,
} from "@/lib/supabaseClient";
import type { DatabaseStats, Medication, SearchResponse } from "@/lib/types";

export const DEFAULT_PAGE_SIZE = 30;
export const MAX_PAGE_SIZE = 100;

export interface SearchParams {
  query: string;
  availableOnly?: boolean;
  limit?: number;
  offset?: number;
}

/** Characters that would corrupt LIKE / PostgREST `or()` filter syntax. */
function sanitizeQuery(input: string): string {
  return input.replace(/[%_,()\\]/g, " ").trim().slice(0, 100);
}

function toDto(row: PrismaMedication): Medication {
  return {
    id: row.id,
    dci: row.dci,
    nom_commercial: row.nom_commercial,
    laboratoire: row.laboratoire,
    forme_galenique: row.forme_galenique,
    dosage: row.dosage,
    prix_approximatif_dzd: row.prix_approximatif_dzd,
    taux_cnas: row.taux_cnas,
    is_available: row.is_available,
  };
}

/* ------------------------------------------------------------------ */
/* Supabase (Postgres) implementation                                  */
/* ------------------------------------------------------------------ */

const MEDICATION_COLUMNS =
  "id, dci, nom_commercial, laboratoire, forme_galenique, dosage, prix_approximatif_dzd, taux_cnas, is_available";

async function searchViaSupabase(params: SearchParams): Promise<SearchResponse> {
  const { availableOnly = true, limit = DEFAULT_PAGE_SIZE, offset = 0 } = params;
  const term = sanitizeQuery(params.query);
  const pattern = `%${term}%`;

  const supabase = getSupabaseClient();
  let request = supabase
    .from(MEDICATIONS_TABLE)
    .select(MEDICATION_COLUMNS, { count: "exact" })
    .or(`dci.ilike.${pattern},nom_commercial.ilike.${pattern}`);

  if (availableOnly) {
    request = request.eq("is_available", true);
  }

  const { data, error, count } = await request
    .order("nom_commercial", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Recherche Supabase échouée : ${error.message}`);
  }

  const total = count ?? data.length;
  return {
    items: (data ?? []) as Medication[],
    meta: {},
    total,
    limit,
    offset,
    hasMore: offset + data.length < total,
    source: "supabase",
  };
}

async function statsViaSupabase(): Promise<DatabaseStats> {
  const supabase = getSupabaseClient();
  const [totalRes, availableRes] = await Promise.all([
    supabase.from(MEDICATIONS_TABLE).select("id", { count: "exact", head: true }),
    supabase
      .from(MEDICATIONS_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("is_available", true),
  ]);
  if (totalRes.error) {
    throw new Error(`Statistiques Supabase échouées : ${totalRes.error.message}`);
  }
  return {
    total: totalRes.count ?? 0,
    available: availableRes.count ?? 0,
    withPrice: 0,
    source: "supabase",
  };
}

/* ------------------------------------------------------------------ */
/* Prisma fallback implementation (SQLite in dev, PostgreSQL in prod)  */
/* ------------------------------------------------------------------ */

// Raw SQL below is written to be valid on BOTH SQLite and PostgreSQL:
//  - boolean comparison with TRUE (SQLite ≥ 3.23 keyword, native PG)
//  - LOWER() instead of COLLATE NOCASE (SQLite-only)
async function searchViaPrisma(params: SearchParams): Promise<SearchResponse> {
  const { availableOnly = true, limit = DEFAULT_PAGE_SIZE, offset = 0 } = params;
  const term = sanitizeQuery(params.query).toLowerCase();
  const like = `%${term}%`;
  const prefix = `${term}%`;

  const availabilityClause = availableOnly
    ? Prisma.sql`AND is_available = TRUE`
    : Prisma.empty;

  const rows = await db.$queryRaw<PrismaMedication[]>(Prisma.sql`
    SELECT * FROM medications
    WHERE (LOWER(dci) LIKE ${like} OR LOWER(nom_commercial) LIKE ${like})
    ${availabilityClause}
    ORDER BY
      CASE
        WHEN LOWER(nom_commercial) LIKE ${prefix} THEN 0
        WHEN LOWER(dci) LIKE ${prefix} THEN 1
        ELSE 2
      END,
      nom_commercial ASC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const countRows = await db.$queryRaw<Array<{ n: number }>>(Prisma.sql`
    SELECT COUNT(*) AS n FROM medications
    WHERE (LOWER(dci) LIKE ${like} OR LOWER(nom_commercial) LIKE ${like})
    ${availabilityClause}
  `);

  const total = Number(countRows[0]?.n ?? 0);
  return {
    items: rows.map(toDto),
    meta: {},
    total,
    limit,
    offset,
    hasMore: offset + rows.length < total,
    source: "prisma",
  };
}

async function statsViaPrisma(): Promise<DatabaseStats> {
  const [total, available, withPrice] = await Promise.all([
    db.medication.count(),
    db.medication.count({ where: { is_available: true } }),
    db.medication.count({ where: { prix_approximatif_dzd: { not: null } } }),
  ]);
  return { total, available, withPrice, source: "prisma" };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** "supabase" when credentials exist, otherwise the Prisma fallback. */
export function getDataSource(): "supabase" | "prisma" {
  return isSupabaseConfigured() ? "supabase" : "prisma";
}

export async function searchMedications(
  params: SearchParams
): Promise<SearchResponse> {
  const clamped: SearchParams = {
    ...params,
    limit: Math.min(Math.max(params.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE),
    offset: Math.max(params.offset ?? 0, 0),
  };
  return isSupabaseConfigured() ? searchViaSupabase(clamped) : searchViaPrisma(clamped);
}

export async function getDatabaseStats(): Promise<DatabaseStats> {
  return isSupabaseConfigured() ? statsViaSupabase() : statsViaPrisma();
}
