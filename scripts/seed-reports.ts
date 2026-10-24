/**
 * DzPharma Guide — demo shortage reports seed
 * Adds crowd-sourced "rupture" reports on a few widely-prescribed drugs so
 * the alerts feed, badges and leaderboard have realistic demo data.
 *
 * Run: bun scripts/seed-reports.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface DemoReport {
  nomLike: string;
  reporter: string;
  note: string;
  hoursAgo: number;
}

const DEMO_REPORTS: DemoReport[] = [
  { nomLike: "AUGMENTIN", reporter: "Dr. Amine B.", note: "Rupture totale en officine depuis 3 jours (Alger centre).", hoursAgo: 5 },
  { nomLike: "AUGMENTIN", reporter: "Ph. Sarah K.", note: "Approvisionnement erratique, pédiatrie surtout.", hoursAgo: 26 },
  { nomLike: "DOLIPRANE", reporter: "Contributeur #2214", note: "", hoursAgo: 9 },
  { nomLike: "VENTOLINE", reporter: "Dr. Nadia M.", note: "Aérosol 100µg introuvable, sirop disponible.", hoursAgo: 12 },
  { nomLike: "OMEPRAZOLE", reporter: "Dr. Yacine T.", note: "", hoursAgo: 30 },
  { nomLike: "INSULINE", reporter: "Ph. Karim L.", note: "Rupture signalée par plusieurs patients diabétiques.", hoursAgo: 48 },
  { nomLike: "DAFALGAN", reporter: "Dr. Leïla H.", note: "", hoursAgo: 70 },
];

async function main() {
  await prisma.shortageReport.deleteMany({});

  let inserted = 0;
  for (const demo of DEMO_REPORTS) {
    const meds = await prisma.medication.findMany({
      where: { nom_commercial: { contains: demo.nomLike } },
      take: 2,
      select: { id: true, nom_commercial: true },
    });
    for (const med of meds) {
      await prisma.shortageReport.create({
        data: {
          medication_id: med.id,
          reporter: demo.reporter,
          note: demo.note || null,
          reported_at: new Date(Date.now() - demo.hoursAgo * 3_600_000),
        },
      });
      inserted += 1;
    }
  }

  const total = await prisma.shortageReport.count();
  const grouped = await prisma.shortageReport.groupBy({
    by: ["reporter"],
    _count: { _all: true },
  });
  console.log(`Seeded ${inserted} demo reports (total in DB: ${total}).`);
  console.log(
    `Reporters: ${grouped.map((g) => `${g.reporter} (${g._count._all})`).join(", ")}`
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
