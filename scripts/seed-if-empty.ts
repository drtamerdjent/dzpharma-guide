/**
 * DzPharma Guide — garde-fou de seed (idempotent), utilisé par l'entrypoint
 * Docker. Les scripts classiques (seed-medications / seed-reports) sont
 * destructifs (deleteMany d'abord) : ils ne doivent donc tourner que sur une
 * base vide, au premier lancement.
 *
 * Run: bun scripts/seed-if-empty.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const medications = await prisma.medication.count();
  if (medications === 0) {
    console.log("[seed] Table medications vide — import du dump (5 380 lignes)…");
    await import("./seed-medications");
  } else {
    console.log(`[seed] medications déjà présentes (${medications}) — skip.`);
  }

  const reports = await prisma.shortageReport.count();
  if (reports === 0 && process.env.SEED_DEMO_REPORTS === "true") {
    console.log("[seed] shortage_reports vide — insertion des données de démo…");
    await import("./seed-reports");
  } else {
    console.log(
      reports === 0
        ? "[seed] SEED_DEMO_REPORTS != true — pas de données de démo pour les ruptures."
        : `[seed] shortage_reports déjà présents (${reports}) — skip.`
    );
  }
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
