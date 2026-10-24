/**
 * DzPharma Guide — shortage reports service (SERVER-ONLY)
 *
 * Crowd-sourced "Signaler une rupture" data. Reports live in the local
 * Prisma database (SQLite mirror); in production mirror this table as
 * `public.shortage_reports` in Supabase.
 */
import { db } from "@/lib/db";

export const REPORT_RECENCY_DAYS = 30;

export interface ReportSummary {
  /** medicationId -> number of reports in the last 30 days. */
  counts: Record<string, number>;
  /** Reports in the last 7 days (header badge). */
  last7Days: number;
}

export interface RecentReport {
  id: string;
  reporter: string;
  note: string | null;
  reported_at: string;
  medication: {
    id: string;
    nom_commercial: string;
    dci: string;
    forme_galenique: string;
    dosage: string;
    laboratoire: string;
  } | null;
}

export interface LeaderboardEntry {
  reporter: string;
  count: number;
}

function since(days: number): Date {
  return new Date(Date.now() - days * 24 * 3_600_000);
}

export async function getReportSummary(): Promise<ReportSummary> {
  const [counts, week] = await Promise.all([
    db.shortageReport.groupBy({
      by: ["medication_id"],
      _count: { _all: true },
      where: { reported_at: { gte: since(REPORT_RECENCY_DAYS) } },
    }),
    db.shortageReport.count({
      where: { reported_at: { gte: since(7) } },
    }),
  ]);
  const map: Record<string, number> = {};
  for (const entry of counts) {
    map[entry.medication_id] = entry._count._all;
  }
  return { counts: map, last7Days: week };
}

export async function getRecentReports(limit = 20): Promise<RecentReport[]> {
  const rows = await db.shortageReport.findMany({
    orderBy: { reported_at: "desc" },
    take: Math.min(Math.max(limit, 1), 50),
  });
  const medIds = [...new Set(rows.map((r) => r.medication_id))];
  const meds = medIds.length
    ? await db.medication.findMany({
        where: { id: { in: medIds } },
        select: {
          id: true,
          nom_commercial: true,
          dci: true,
          forme_galenique: true,
          dosage: true,
          laboratoire: true,
        },
      })
    : [];
  const medMap = new Map(meds.map((m) => [m.id, m]));
  return rows.map((r) => ({
    id: r.id,
    reporter: r.reporter,
    note: r.note,
    reported_at: r.reported_at.toISOString(),
    medication: medMap.get(r.medication_id) ?? null,
  }));
}

export async function getLeaderboard(limit = 5): Promise<LeaderboardEntry[]> {
  const grouped = await db.shortageReport.groupBy({
    by: ["reporter"],
    _count: { _all: true },
    where: { reported_at: { gte: since(REPORT_RECENCY_DAYS) } },
    orderBy: { _count: { reporter: "desc" } },
    take: Math.min(Math.max(limit, 1), 10),
  });
  return grouped.map((g) => ({ reporter: g.reporter, count: g._count._all }));
}

export async function createReport(input: {
  medicationId: string;
  reporter?: string;
  note?: string;
}): Promise<{ ok: boolean; medicationFound: boolean }> {
  const med = await db.medication.findUnique({
    where: { id: input.medicationId },
    select: { id: true },
  });
  if (!med) return { ok: false, medicationFound: false };
  await db.shortageReport.create({
    data: {
      medication_id: input.medicationId,
      reporter: (input.reporter ?? "").trim().slice(0, 60) || "Contributeur anonyme",
      note: (input.note ?? "").trim().slice(0, 240) || null,
    },
  });
  return { ok: true, medicationFound: true };
}
