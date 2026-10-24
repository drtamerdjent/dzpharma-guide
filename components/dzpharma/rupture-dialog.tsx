"use client";

/**
 * RuptureDialog — crowd-sourced shortage alerts feed ("Alertes ruptures").
 *
 * - Lists recent "rupture" reports from the doctor/pharmacist community.
 * - Premium: full feed. Free: 1 alert visible, rest blurred + upsell.
 * - Footer: "Top Contributeur du Mois" gamification leaderboard + the
 *   contributor handle of the current device.
 */
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RecentReport {
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

interface LeaderboardEntry {
  reporter: string;
  count: number;
}

const FREE_ALERTS_LIMIT = 1;

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "à l'instant";
  if (hours === 1) return "il y a 1 h";
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "il y a 1 jour" : `il y a ${days} jours`;
}

interface RuptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPremium: boolean;
  onUpgrade: () => void;
}

export function RuptureDialog({
  open,
  onOpenChange,
  isPremium,
  onUpgrade,
}: RuptureDialogProps) {
  const [reports, setReports] = useState<RecentReport[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [feedRes, boardRes] = await Promise.all([
        fetch("/api/reports?limit=20"),
        fetch("/api/reports/leaderboard"),
      ]);
      if (!feedRes.ok || !boardRes.ok) throw new Error("HTTP error");
      const feed = (await feedRes.json()) as { reports: RecentReport[] };
      const board = (await boardRes.json()) as { leaderboard: LeaderboardEntry[] };
      setReports(feed.reports);
      setLeaderboard(board.leaderboard);
    } catch {
      setError("Impossible de charger les alertes. Réessayez.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchFeed();
  }, [open]);

  const visibleCount = isPremium ? reports.length : Math.min(FREE_ALERTS_LIMIT, reports.length);
  const hiddenCount = reports.length - visibleCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg grid-cols-1 overflow-y-auto sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
            </span>
            Alertes ruptures — communauté
          </DialogTitle>
          <DialogDescription className="text-left">
            Signalements en temps réel par les médecins et pharmaciens
            utilisateurs.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-sky-500" aria-hidden />
            Chargement des alertes…
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-slate-600">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchFeed}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              Réessayer
            </Button>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-2">
            {reports.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">
                Aucune rupture signalée récemment. Merci de signaler depuis les
                fiches médicaments !
              </p>
            )}

            <ul className="list-none space-y-2">
              {reports.slice(0, visibleCount).map((report) => (
                <li
                  key={report.id}
                  className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {report.medication?.nom_commercial ?? "Médicament inconnu"}
                        {report.medication?.dosage
                          ? ` · ${report.medication.dosage}`
                          : ""}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {report.medication?.dci ?? "—"} ·{" "}
                        {report.medication?.laboratoire ?? "—"}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] font-medium text-slate-400">
                      {timeFormatter.format(new Date(report.reported_at))}
                    </span>
                  </div>
                  {report.note && (
                    <p className="mt-1.5 text-xs leading-snug text-slate-600">
                      «&nbsp;{report.note}&nbsp;»
                    </p>
                  )}
                  <p className="mt-1.5 text-[10px] text-slate-400">
                    Signalé par {report.reporter} · {timeAgo(report.reported_at)}
                  </p>
                </li>
              ))}
            </ul>

            {/* Freemium lock */}
            {hiddenCount > 0 && (
              <div className="relative overflow-hidden rounded-xl border border-amber-200">
                <div
                  aria-hidden
                  className="pointer-events-none select-none space-y-2 p-3 opacity-70 blur-md"
                >
                  {[0, 1].map((i) => (
                    <div key={i} className="rounded-lg bg-amber-50 p-2.5">
                      <div className="h-3.5 w-36 rounded bg-slate-200" />
                      <div className="mt-1.5 h-2.5 w-24 rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/55 p-3 text-center">
                  <p className="text-sm font-bold text-slate-900">
                    + {hiddenCount} alerte{hiddenCount > 1 ? "s" : ""} verrouillée
                    {hiddenCount > 1 ? "s" : ""}
                  </p>
                  <p className="text-[11px] leading-snug text-slate-600">
                    Passez à Premium (3 600 DZD/an) pour accéder à toutes les
                    alertes ruptures en temps réel.
                  </p>
                  <Button size="sm" className="h-10 font-semibold" onClick={onUpgrade}>
                    Débloquer
                  </Button>
                </div>
              </div>
            )}

            {/* Gamification */}
            {leaderboard.length > 0 && (
              <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3">
                <p className="flex items-center gap-1.5 text-xs font-bold text-sky-800">
                  <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
                  Top Contributeur du Mois
                </p>
                <ol className="mt-2 list-none space-y-1">
                  {leaderboard.map((entry, index) => (
                    <li
                      key={entry.reporter}
                      className="flex items-center justify-between text-xs text-slate-600"
                    >
                      <span className="truncate">
                        <span className="mr-1.5 font-semibold text-sky-700">
                          #{index + 1}
                        </span>
                        {entry.reporter}
                      </span>
                      <span className="font-semibold text-slate-700">
                        {entry.count} signalement{entry.count > 1 ? "s" : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <p className="pt-1 text-center text-[10px] leading-relaxed text-slate-400">
              Les disponibilités sont basées sur les dernières données connues.
              Veuillez confirmer avec votre pharmacien.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
