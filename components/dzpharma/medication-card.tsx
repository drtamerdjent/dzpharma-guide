"use client";

/**
 * MedicationCard — result card for DzPharma Guide.
 *
 * Layout (mobile-first):
 *   Top    : nom_commercial (bold, large) + laboratoire (small, gray)
 *            [Rupture signalée] badge when crowd-sourced reports exist
 *   Middle : dci (brand blue) + forme_galenique - dosage
 *   Bottom : CNAS badge + price (+ reste à charge patient, Premium)
 *   Actions: Alternatives · Signaler une rupture · Ordonnance (Premium)
 *
 * Freemium: when `locked` is true, the price + CNAS badge are blurred
 * behind an overlay inviting the doctor to upgrade to Premium.
 */
import {
  AlertTriangle,
  ArrowLeftRight,
  Building2,
  FileText,
  Info,
  Lock,
  Pill,
  ShieldPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Medication, MedicationMeta } from "@/lib/types";

export const PREMIUM_PITCH =
  "Passez à Premium (3 600 DZD/an) pour un accès illimité aux prix et remboursements CNAS.";

export const DISCLAIMER =
  "Les disponibilités sont basées sur les dernières données connues. Veuillez confirmer avec votre pharmacien.";

const priceFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPrice(price: number): string {
  return `${priceFormatter.format(price)} DZD`;
}

function CnasBadge({ taux }: { taux: number }) {
  if (taux >= 100) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-200 bg-emerald-50 text-emerald-700"
        aria-label="Remboursé à 100% par la CNAS"
      >
        Remboursé 100%
      </Badge>
    );
  }
  if (taux === 70) {
    return (
      <Badge
        variant="outline"
        className="border-amber-200 bg-amber-50 text-amber-700"
        aria-label="Remboursé à 70% par la CNAS"
      >
        Remboursé 70%
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-red-200 bg-red-50 text-red-700"
      aria-label="Non remboursé par la CNAS"
    >
      Non remboursé 0%
    </Badge>
  );
}

interface MedicationCardProps {
  medication: Medication;
  meta?: MedicationMeta;
  /** Freemium lock: blur price + CNAS badge behind the Premium overlay. */
  locked: boolean;
  isPremium: boolean;
  onUpgrade: () => void;
  onShowAlternatives: (medication: Medication) => void;
  onReportRupture: (medication: Medication) => void;
  onPrescription: (medication: Medication) => void;
}

export function MedicationCard({
  medication,
  meta,
  locked,
  isPremium,
  onUpgrade,
  onShowAlternatives,
  onReportRupture,
  onPrescription,
}: MedicationCardProps) {
  const { nom_commercial, laboratoire, dci, forme_galenique, dosage } = medication;
  const hasPrice = medication.prix_approximatif_dzd != null;
  const posologie = [forme_galenique, dosage].filter(Boolean).join(" - ");
  const ruptureCount = meta?.ruptureCount ?? 0;
  const altCount = meta?.altCount ?? 0;

  const reste = hasPrice && isPremium
    ? Math.max(0, (medication.prix_approximatif_dzd as number) * (1 - medication.taux_cnas / 100))
    : null;

  return (
    <Card className="flex h-full flex-col gap-3 p-4 shadow-sm transition-shadow duration-200 hover:shadow-md focus-within:shadow-md">
      {/* Top */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold leading-tight text-slate-900">
            {nom_commercial}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{laboratoire}</span>
          </p>
        </div>
        {ruptureCount > 0 ? (
          <Badge
            variant="outline"
            className="shrink-0 border-amber-300 bg-amber-100 text-amber-800"
            title="Signalements de la communauté (30 derniers jours)"
          >
            <AlertTriangle className="mr-1 h-3 w-3" aria-hidden />
            Rupture signalée
          </Badge>
        ) : (
          !medication.is_available && (
            <Badge
              variant="outline"
              className="shrink-0 border-slate-200 bg-slate-50 text-slate-500"
            >
              Indisponible
            </Badge>
          )
        )}
      </div>

      {/* Middle */}
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-sky-600">{dci}</p>
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <Pill className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="line-clamp-2">{posologie}</span>
        </p>
      </div>

      {/* Bottom — sensitive zone (price + CNAS) */}
      <div className="relative border-t border-slate-100 pt-3">
        {/* Real content (blurred when locked) */}
        <div
          aria-hidden={locked}
          className={`flex min-h-9 flex-wrap items-center justify-between gap-2 ${
            locked ? "pointer-events-none select-none blur-md" : ""
          }`}
        >
          <div className="space-y-0.5">
            <CnasBadge taux={medication.taux_cnas} />
            {reste != null && (
              <p className="text-[11px] font-medium text-slate-500">
                Reste à charge :{" "}
                <span className="font-bold text-slate-700">{formatPrice(reste)}</span>
              </p>
            )}
          </div>
          {hasPrice ? (
            <span className="text-base font-bold text-slate-900">
              {formatPrice(medication.prix_approximatif_dzd as number)}
            </span>
          ) : (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    className="inline-flex cursor-help items-center gap-1 text-sm text-slate-400 outline-none"
                  >
                    Prix non communiqué
                    <Info className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-56 text-center">
                  Prix non référencé dans la base. Renseignez-vous auprès de votre
                  officine.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Freemium overlay */}
        {locked && (
          <button
            type="button"
            onClick={onUpgrade}
            aria-label={PREMIUM_PITCH}
            className="absolute inset-0 -m-1 flex flex-col items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-white/60 p-2 text-center backdrop-blur-[2px] transition-colors hover:bg-amber-50/80"
          >
            <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              Contenu Premium
            </span>
            <span className="text-[11px] leading-snug text-slate-600">
              Passez à Premium (3 600 DZD/an) pour un accès illimité aux prix et
              remboursements CNAS.
            </span>
          </button>
        )}
      </div>

      {/* Actions row */}
      <div className="mt-auto grid grid-cols-3 gap-1.5 border-t border-slate-100 pt-2.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 min-h-9 flex-col gap-0.5 px-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50 hover:text-sky-800"
          onClick={() => onShowAlternatives(medication)}
          aria-label={`Voir les alternatives à ${nom_commercial}`}
        >
          <ArrowLeftRight className="h-4 w-4" aria-hidden />
          Alternatives{altCount > 0 ? ` (${altCount})` : ""}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`h-9 min-h-9 flex-col gap-0.5 px-1 text-[11px] font-medium ${
            ruptureCount > 0
              ? "text-amber-700 hover:bg-amber-50 hover:text-amber-800"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          }`}
          onClick={() => onReportRupture(medication)}
          aria-label={`Signaler une rupture de ${nom_commercial}`}
        >
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {ruptureCount > 0 ? "Rupture" : "Signaler"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 min-h-9 flex-col gap-0.5 px-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          onClick={() => onPrescription(medication)}
          aria-label={`Générer une ordonnance pour ${nom_commercial}`}
        >
          {isPremium ? (
            <FileText className="h-4 w-4" aria-hidden />
          ) : (
            <ShieldPlus className="h-4 w-4" aria-hidden />
          )}
          Ordonnance
        </Button>
      </div>
    </Card>
  );
}

/** Skeleton used while a search is in flight. */
export function MedicationCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="space-y-2">
        <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-4 w-1/2 animate-pulse rounded bg-sky-100" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="h-5 w-24 animate-pulse rounded-full bg-slate-100" />
        <div className="h-5 w-20 animate-pulse rounded bg-slate-100" />
      </div>
    </Card>
  );
}
