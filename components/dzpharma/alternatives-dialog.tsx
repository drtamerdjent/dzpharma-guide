"use client";

/**
 * AlternativesDialog — "Trouvez la bonne alternative thérapeutique en 3s".
 *
 * Lists all Algerian brands sharing the same active molecule (DCI), ranked:
 *   - "recommandé" : disponibles d'abord, puis prix croissant, puis CNAS
 *   - "prix"       : prix public croissant
 *   - "cnas"       : meilleur remboursement d'abord
 *
 * Freemium: free users see the 2 first alternatives; the rest are blurred
 * behind a Premium unlock block. Premium shows everything + reste à charge.
 */
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  FileText,
  Loader2,
  PackageCheck,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPrice } from "@/components/dzpharma/medication-card";
import type { Medication } from "@/lib/types";

export const FREE_ALTERNATIVES_LIMIT = 2;

type SortKey = "recommande" | "prix" | "cnas";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "recommande", label: "Recommandé" },
  { key: "prix", label: "Prix croissant" },
  { key: "cnas", label: "Meilleur CNAS" },
];

interface AlternativesResponse {
  medication: Medication;
  moleculeKey: string;
  alternatives: Medication[];
  total: number;
  sort: SortKey;
}

interface AlternativesDialogProps {
  medication: Medication | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPremium: boolean;
  onUpgrade: () => void;
  onPrescription: (medication: Medication) => void;
}

function cnasLabel(taux: number): string {
  if (taux >= 100) return "CNAS 100%";
  return `CNAS ${taux}%`;
}

function cnasClass(taux: number): string {
  if (taux >= 100) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (taux === 70) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

export function AlternativesDialog({
  medication,
  open,
  onOpenChange,
  isPremium,
  onUpgrade,
  onPrescription,
}: AlternativesDialogProps) {
  const [data, setData] = useState<AlternativesResponse | null>(null);
  const [sort, setSort] = useState<SortKey>("recommande");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlternatives = useCallback(
    async (id: string, sortKey: SortKey) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/medications/alternatives?id=${encodeURIComponent(id)}&sort=${sortKey}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData((await res.json()) as AlternativesResponse);
      } catch {
        setError("Impossible de charger les alternatives. Réessayez.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (open && medication) {
      fetchAlternatives(medication.id, sort);
    }
  }, [open, medication?.id, fetchAlternatives]);

  const handleSortChange = (key: SortKey) => {
    setSort(key);
    if (medication) fetchAlternatives(medication.id, key);
  };

  const visibleCount = isPremium ? data?.alternatives.length ?? 0 : Math.min(FREE_ALTERNATIVES_LIMIT, data?.alternatives.length ?? 0);
  const hiddenCount = (data?.alternatives.length ?? 0) - visibleCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg grid-cols-1 overflow-y-auto sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-left">
            Alternatives thérapeutiques
          </DialogTitle>
          <DialogDescription className="text-left">
            {data ? (
              <>
                Même molécule que{" "}
                <span className="font-semibold text-slate-700">
                  {data.medication.nom_commercial}
                </span>{" "}
                —{" "}
                <span className="break-all font-mono text-xs">
                  {data.moleculeKey}
                </span>
              </>
            ) : (
              "Recherche des marques algériennes de la même molécule…"
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Sort controls */}
        <div
          className="flex flex-wrap items-center gap-1.5 pb-1"
          role="group"
          aria-label="Trier les alternatives"
        >
          <ArrowDownUp className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => handleSortChange(option.key)}
              aria-pressed={sort === option.key}
              className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors ${
                sort === option.key
                  ? "border-sky-500 bg-sky-50 text-sky-700"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-sky-500" aria-hidden />
            Classement des alternatives…
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-slate-600">{error}</p>
            {medication && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchAlternatives(medication.id, sort)}
              >
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                Réessayer
              </Button>
            )}
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-2">
            {data.alternatives.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">
                Aucune autre marque de cette molécule dans la base.
              </p>
            )}

            <ul className="list-none space-y-2">
              {data.alternatives.slice(0, visibleCount).map((alt, index) => {
                const reste =
                  alt.prix_approximatif_dzd != null && isPremium
                    ? Math.max(
                        0,
                        alt.prix_approximatif_dzd * (1 - alt.taux_cnas / 100)
                      )
                    : null;
                return (
                  <li
                    key={alt.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-sky-200 hover:bg-sky-50/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">
                          <span className="mr-1.5 text-xs font-semibold text-slate-400">
                            #{index + 1}
                          </span>
                          {alt.nom_commercial}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {alt.laboratoire} · {alt.forme_galenique}
                          {alt.dosage ? ` · ${alt.dosage}` : ""}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`shrink-0 ${cnasClass(alt.taux_cnas)}`}
                      >
                        {cnasLabel(alt.taux_cnas)}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-2">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        {alt.is_available ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                            <PackageCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            Disponible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            Indisponible
                          </span>
                        )}
                        {reste != null && (
                          <span className="truncate text-[11px] text-slate-500">
                            Reste à charge{" "}
                            <span className="font-semibold">{formatPrice(reste)}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {alt.prix_approximatif_dzd != null
                            ? formatPrice(alt.prix_approximatif_dzd)
                            : "Prix n.c."}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 px-2.5 text-[11px]"
                          onClick={() => {
                            onOpenChange(false);
                            onPrescription(alt);
                          }}
                          aria-label={`Ordonnance pour ${alt.nom_commercial}`}
                        >
                          <FileText className="h-3.5 w-3.5" aria-hidden />
                          Ordonnance
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Freemium lock for the remaining alternatives */}
            {hiddenCount > 0 && (
              <div className="relative overflow-hidden rounded-xl border border-amber-200">
                <div
                  aria-hidden
                  className="pointer-events-none select-none space-y-2 p-3 opacity-70 blur-md"
                >
                  {[0, 1].map((i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5"
                    >
                      <div className="space-y-1.5">
                        <div className="h-3.5 w-28 rounded bg-slate-200" />
                        <div className="h-2.5 w-20 rounded bg-slate-100" />
                      </div>
                      <div className="h-4 w-14 rounded bg-slate-200" />
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/55 p-3 text-center">
                  <p className="text-sm font-bold text-slate-900">
                    + {hiddenCount} alternative{hiddenCount > 1 ? "s" : ""} verrouillée
                    {hiddenCount > 1 ? "s" : ""}
                  </p>
                  <p className="text-[11px] leading-snug text-slate-600">
                    Passez à Premium (3 600 DZD/an) pour voir toutes les marques,
                    triées par prix et remboursement CNAS.
                  </p>
                  <Button
                    size="sm"
                    className="h-10 gap-1.5 font-semibold"
                    onClick={onUpgrade}
                  >
                    Débloquer
                  </Button>
                </div>
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
