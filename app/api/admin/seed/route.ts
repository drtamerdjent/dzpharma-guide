/**
 * DzPharma Guide — one-time browser-triggered seeding endpoint.
 *
 * Purpose: lets a non-technical operator seed the freshly deployed
 * (empty) production database with the 5,380 medications by simply
 * visiting a URL — no local tooling required.
 *
 * Usage:
 *   GET /api/admin/seed?secret=<SEED_SECRET>            → seeds only if table is empty
 *   GET /api/admin/seed?secret=<SEED_SECRET>&force=true → wipes + reseeds
 *
 * Security:
 *   - Returns 404 when SEED_SECRET is not configured (endpoint disabled).
 *   - Returns 401 when the provided secret does not match.
 *
 * On Vercel, the SQL dump is shipped inside this function's bundle via
 * `outputFileTracingIncludes` in next.config.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { parseMedicationDump } from "@/lib/medication-dump";

export const dynamic = "force-dynamic";
// 5,380 inserts chunked — stay within Vercel Hobby max function duration.
export const maxDuration = 60;

const CHUNK = 400;

export async function GET(request: NextRequest) {
  const expected = process.env.SEED_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "Endpoint désactivé : SEED_SECRET n'est pas configuré." },
      { status: 404 }
    );
  }

  const provided =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("x-seed-secret");
  if (!provided || provided !== expected) {
    return NextResponse.json(
      { error: "Accès refusé : secret invalide." },
      { status: 401 }
    );
  }

  const force = request.nextUrl.searchParams.get("force") === "true";

  try {
    const existing = await db.medication.count();
    if (existing > 0 && !force) {
      return NextResponse.json({
        status: "already_seeded",
        count: existing,
        message:
          "La base contient déjà des médicaments. Ajoutez &force=true à l'URL pour réimporter.",
      });
    }

    const sqlPath = path.join(process.cwd(), "upload", "medications_rows.sql");
    const sql = readFileSync(sqlPath, "utf8");
    const rows = parseMedicationDump(sql);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Dump SQL vide ou illisible." },
        { status: 500 }
      );
    }

    if (existing > 0 && force) {
      await db.medication.deleteMany({});
    }

    for (let i = 0; i < rows.length; i += CHUNK) {
      await db.medication.createMany({ data: rows.slice(i, i + CHUNK) });
    }

    const [total, withPrice, unavailable] = await Promise.all([
      db.medication.count(),
      db.medication.count({ where: { prix_approximatif_dzd: { not: null } } }),
      db.medication.count({ where: { is_available: false } }),
    ]);

    return NextResponse.json({
      status: force && existing > 0 ? "reseeded" : "seeded",
      parsed: rows.length,
      total,
      withPrice,
      unavailable,
      message: `✅ ${total} médicaments importés avec succès.`,
    });
  } catch (error) {
    console.error("[admin/seed] failed:", error);
    return NextResponse.json(
      {
        error: "Échec de l'import.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
