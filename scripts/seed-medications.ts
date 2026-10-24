/**
 * DzPharma Guide — seed script
 * Imports every medication row from the uploaded Postgres dump
 * (upload/medications_rows.sql) into the configured database via Prisma.
 *
 * The dump-parsing logic lives in src/lib/medication-dump.ts (shared with
 * the browser-triggered /api/admin/seed endpoint).
 *
 * Run: bun scripts/seed-medications.ts
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { parseMedicationDump } from "../src/lib/medication-dump";

const SQL_PATH = "upload/medications_rows.sql";

async function main() {
  const sql = readFileSync(SQL_PATH, "utf8");
  const rows = parseMedicationDump(sql);
  console.log(`Parsed ${rows.length} medication rows from dump.`);

  const prisma = new PrismaClient();
  try {
    await prisma.medication.deleteMany({});
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      await prisma.medication.createMany({ data: rows.slice(i, i + CHUNK) });
    }
    const total = await prisma.medication.count();
    const withPrice = await prisma.medication.count({
      where: { prix_approximatif_dzd: { not: null } },
    });
    const unavailable = await prisma.medication.count({
      where: { is_available: false },
    });
    const tauxDistribution = await prisma.medication.groupBy({
      by: ["taux_cnas"],
      _count: { _all: true },
    });
    console.log(`Imported ${total} medications.`);
    console.log(`  - with price: ${withPrice}`);
    console.log(`  - unavailable: ${unavailable}`);
    console.log(
      `  - taux_cnas: ${tauxDistribution
        .map((t) => `${t.taux_cnas} (${t._count._all})`)
        .join(", ")}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
