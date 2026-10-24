/**
 * DzPharma Guide — medication SQL dump parser (shared).
 *
 * Parses the uploaded Postgres dump (upload/medications_rows.sql, single
 * multi-tuple INSERT, 5,380 rows) into structured medication rows.
 *
 * Pure module — no database import — so it can be used both by:
 *   - scripts/seed-medications.ts (bun / local + Docker)
 *   - src/app/api/admin/seed/route.ts (Vercel serverless, browser-triggered)
 */

export interface MedicationRow {
  id: string;
  dci: string;
  nom_commercial: string;
  laboratoire: string;
  forme_galenique: string;
  dosage: string;
  prix_approximatif_dzd: number | null;
  taux_cnas: number;
  is_available: boolean;
  created_at: Date;
}

/** Parse a Postgres single-quoted string with '' escape handling. */
function parseStringAt(sql: string, start: number): [string, number] {
  let i = start + 1; // skip opening quote
  let out = "";
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    if (c === "'") {
      if (sql[i + 1] === "'") {
        out += "'";
        i += 2;
        continue;
      }
      return [out, i + 1]; // skip closing quote
    }
    out += c;
    i++;
  }
  throw new Error("Unterminated string literal in SQL dump");
}

/** Parse a bare token (number / boolean / null) until ',' or ')'. */
function parseTokenAt(sql: string, start: number): [string, number] {
  let i = start;
  let out = "";
  const n = sql.length;
  while (i < n && sql[i] !== "," && sql[i] !== ")") {
    out += sql[i];
    i++;
  }
  return [out.trim(), i];
}

/** Parse every (...) tuple of the INSERT INTO ... VALUES statement. */
function parseTuples(sql: string): (string | null)[][] {
  const marker = " VALUES ";
  const valuesIdx = sql.indexOf(marker);
  if (valuesIdx === -1) throw new Error("No VALUES clause found in dump");
  let i = valuesIdx + marker.length;
  const n = sql.length;
  const tuples: (string | null)[][] = [];

  while (i < n) {
    const c = sql[i];
    if (c !== "(") {
      i++;
      continue;
    }
    i++; // enter tuple
    const values: (string | null)[] = [];
    for (;;) {
      while (i < n && /\s/.test(sql[i])) i++;
      if (sql[i] === "'") {
        const [s, next] = parseStringAt(sql, i);
        values.push(s);
        i = next;
      } else {
        const [t, next] = parseTokenAt(sql, i);
        values.push(t.toLowerCase() === "null" ? null : t);
        i = next;
      }
      while (i < n && /\s/.test(sql[i])) i++;
      if (sql[i] === ",") {
        i++;
        continue;
      }
      if (sql[i] === ")") {
        i++;
        break;
      }
      throw new Error(`Unexpected character '${sql[i]}' at index ${i}`);
    }
    tuples.push(values);
  }
  return tuples;
}

function parsePgDate(s: string | null): Date {
  if (!s) return new Date();
  // '2026-10-21 13:37:22.856444+00' -> '2026-10-21T13:37:22.856Z'
  const iso = s
    .replace(" ", "T")
    .replace(/\+00$/, "Z")
    .replace(/(\.\d{3})\d+/, "$1");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function mapRow(v: (string | null)[]): MedicationRow {
  const [id, dci, nom, lab, forme, dosage, prix, taux, dispo, created] =
    v as [string, string, string, string, string, string, string | null, string, string, string];
  return {
    id,
    dci: dci ?? "",
    nom_commercial: nom ?? "",
    laboratoire: lab ?? "",
    forme_galenique: forme ?? "",
    dosage: dosage ?? "",
    prix_approximatif_dzd: prix == null ? null : Number.parseFloat(prix),
    taux_cnas: Number.parseInt(taux ?? "0", 10) || 0,
    is_available: dispo === "true",
    created_at: parsePgDate(created),
  };
}

/** Parse the full dump into typed medication rows. */
export function parseMedicationDump(sql: string): MedicationRow[] {
  return parseTuples(sql).map(mapRow);
}
