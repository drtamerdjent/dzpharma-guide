/** Shared DTOs between the API layer and the UI. */

export interface Medication {
  id: string;
  dci: string;
  nom_commercial: string;
  laboratoire: string;
  forme_galenique: string;
  dosage: string;
  prix_approximatif_dzd: number | null;
  /** CNAS reimbursement rate: 0, 70 or 100. */
  taux_cnas: number;
  is_available: boolean;
}

/** Per-result metadata (alternatives count, rupture reports). */
export interface MedicationMeta {
  /** Number of other brands with the same active molecule (available only). */
  altCount: number;
  /** Crowd-sourced rupture reports in the last 30 days. */
  ruptureCount: number;
}

export interface SearchResponse {
  items: Medication[];
  /** Metadata keyed by medication id (same ids as `items`). */
  meta: Record<string, MedicationMeta>;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  /** Which backend answered: managed Supabase or the Prisma fallback (SQLite in dev, PostgreSQL in prod). */
  source: "supabase" | "prisma";
}

export interface DatabaseStats {
  total: number;
  available: number;
  withPrice: number;
  source: "supabase" | "prisma";
}
