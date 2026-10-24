/**
 * DzPharma Guide — molecule index (SERVER-ONLY)
 *
 * Core of the "alternatives thérapeutiques" feature: groups medications by
 * active molecule so the app can rank same-DCI alternatives instantly.
 *
 * The full medications table (5,380 rows) is loaded once into an in-memory
 * index (local memory cache — no external middleware), rebuilt on a TTL.
 * Works identically on top of the managed Supabase table or the local
 * SQLite mirror, so the feature behaves the same in dev and production.
 *
 * Molecule normalization handles Algerian DCI quirks:
 *   "AMOXICILLINE TRIHYDRATEE EXPRIME EN AMOXICILLINE" -> "AMOXICILLINE"
 *   "ESOMEPRAZOLE MAGNESIUM TRIHYDRATE EXPRIME EN ESOMEPRAZOLE" -> "ESOMEPRAZOLE"
 *   "PARACETAMOL/CODEINE PHOSPHATE HEMIHYDRATE" -> "PARACETAMOL/CODEINE"
 */
import type { Medication as PrismaMedication } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  MEDICATIONS_TABLE,
} from "@/lib/supabaseClient";
import type { Medication } from "@/lib/types";

const INDEX_TTL_MS = 5 * 60_000;

/* ------------------------------------------------------------------ */
/* DCI normalization                                                   */
/* ------------------------------------------------------------------ */

/** Salt / ester / qualifier tokens that do NOT change the active molecule. */
const DCI_QUALIFIERS = new Set([
  "TRIHYDRATE",
  "TRIHYDRATEE",
  "DIHYDRATE",
  "MONOHYDRATE",
  "HEMIHYDRATE",
  "ANHYDRE",
  "SODIQUE",
  "POTASSIQUE",
  "CALCIQUE",
  "MAGNESIUM",
  "BESYLATE",
  "MALEATE",
  "CHLORHYDRATE",
  "HYDROCHLORURE",
  "PHOSPHATE",
  "SULFATE",
  "TARTRATE",
  "SUCCINATE",
  "CITRATE",
  "ACETATE",
  "FUMARATE",
  "CAMSYLATE",
  "PROPIONATE",
  "VALERATE",
  "DIPROPIONATE",
  "PALMITATE",
  "STEARATE",
  "MICRONISE",
  "MICRONISEE",
  "EXPRIME",
  "EN",
]);

/**
 * Reduces an Algerian DCI string to its base molecule key.
 * Combination drugs (with "/") keep their full combination key.
 */
export function moleculeKey(dci: string): string {
  const raw = dci.toUpperCase().normalize("NFC").trim();
  let key = raw;
  if (!key.includes("/") && key.includes(" EXPRIME EN ")) {
    key = key.split(" EXPRIME EN ").pop() ?? key;
  }
  const tokens = key.split(/[\s\-]+/).filter((t) => t && !DCI_QUALIFIERS.has(t));
  const joined = tokens.join(" ").trim();
  return joined || raw;
}

/* ------------------------------------------------------------------ */
/* Index                                                               */
/* ------------------------------------------------------------------ */

export interface MoleculeIndex {
  byId: Map<string, Medication>;
  byMolecule: Map<string, Medication[]>;
}

let cache: { index: MoleculeIndex; builtAt: number } | null = null;
let building: Promise<MoleculeIndex> | null = null;

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

async function loadAllMedications(): Promise<Medication[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const columns =
      "id, dci, nom_commercial, laboratoire, forme_galenique, dosage, prix_approximatif_dzd, taux_cnas, is_available";
    const all: Medication[] = [];
    const chunk = 1000;
    for (let from = 0; ; from += chunk) {
      const { data, error } = await supabase
        .from(MEDICATIONS_TABLE)
        .select(columns)
        .range(from, from + chunk - 1);
      if (error) {
        throw new Error(`Chargement Supabase échoué : ${error.message}`);
      }
      all.push(...((data ?? []) as Medication[]));
      if (!data || data.length < chunk) break;
    }
    return all;
  }
  const rows = await db.medication.findMany();
  return rows.map(toDto);
}

async function buildIndex(): Promise<MoleculeIndex> {
  const meds = await loadAllMedications();
  const byId = new Map<string, Medication>();
  const byMolecule = new Map<string, Medication[]>();

  for (const med of meds) {
    byId.set(med.id, med);
    const key = moleculeKey(med.dci);
    const group = byMolecule.get(key);
    if (group) group.push(med);
    else byMolecule.set(key, [med]);
  }
  for (const group of byMolecule.values()) {
    group.sort((a, b) => a.nom_commercial.localeCompare(b.nom_commercial, "fr"));
  }
  return { byId, byMolecule };
}

export async function getMoleculeIndex(): Promise<MoleculeIndex> {
  if (cache && Date.now() - cache.builtAt < INDEX_TTL_MS) return cache.index;
  if (!building) {
    building = buildIndex()
      .then((index) => {
        cache = { index, builtAt: Date.now() };
        return index;
      })
      .finally(() => {
        building = null;
      });
  }
  return building;
}

/** Forces a rebuild on the next access (after data changes). */
export function invalidateMoleculeIndex(): void {
  cache = null;
}

export async function getMedicationById(id: string): Promise<Medication | null> {
  const index = await getMoleculeIndex();
  return index.byId.get(id) ?? null;
}

/** All medications sharing the same active molecule (excluding the drug itself). */
export async function getMoleculeAlternatives(id: string): Promise<{
  medication: Medication | null;
  key: string;
  alternatives: Medication[];
}> {
  const index = await getMoleculeIndex();
  const medication = index.byId.get(id) ?? null;
  if (!medication) return { medication: null, key: "", alternatives: [] };
  const key = moleculeKey(medication.dci);
  const group = index.byMolecule.get(key) ?? [];
  const alternatives = group.filter((m) => m.id !== id);
  return { medication, key, alternatives };
}

/* ------------------------------------------------------------------ */
/* Alternative ranking                                                 */
/* ------------------------------------------------------------------ */

export type AlternativeSort = "recommande" | "prix" | "cnas";

function priceOf(m: Medication): number {
  // Missing prices sort last: treated as +Infinity.
  return m.prix_approximatif_dzd ?? Number.POSITIVE_INFINITY;
}

/**
 * Ranking per the product spec:
 *  - "recommande": available first, then cheapest, then best CNAS coverage.
 *  - "prix":       available first, then lowest public price.
 *  - "cnas":       best CNAS coverage first, then cheapest.
 */
export function sortAlternatives(
  items: Medication[],
  sort: AlternativeSort
): Medication[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    if (sort !== "cnas") {
      if (a.is_available !== b.is_available) return a.is_available ? -1 : 1;
    }
    if (sort === "cnas") {
      if (b.taux_cnas !== a.taux_cnas) return b.taux_cnas - a.taux_cnas;
    }
    const priceDiff = priceOf(a) - priceOf(b);
    if (priceDiff !== 0) return priceDiff;
    if (b.taux_cnas !== a.taux_cnas) return b.taux_cnas - a.taux_cnas;
    return a.nom_commercial.localeCompare(b.nom_commercial, "fr");
  });
  return sorted;
}

/** Out-of-pocket cost for the patient (public price − CNAS coverage). */
export function resteACharge(medication: Medication): number | null {
  if (medication.prix_approximatif_dzd == null) return null;
  return Math.max(
    0,
    Math.round(medication.prix_approximatif_dzd * (1 - medication.taux_cnas / 100) * 100) / 100
  );
}
