"use client";

/**
 * InteractionChecker — vérificateur d'interactions « focus génériques locaux ».
 *
 * Deux champs de recherche autonomes (Popover + Command de shadcn/ui) liés à
 * la liste des DCI uniques de la base (/api/dci/list). À la sélection des deux
 * médicaments, une Alert colorée affiche la sévérité + le mécanisme, puis :
 *
 * Freemium (logique isPremium existante) :
 *   - Gratuit  : sévérité (rouge/orange/jaune) + mécanisme pédagogique.
 *   - Premium  : conduite à tenir détaillée + alternatives thérapeutiques
 *     locales (floutées pour les comptes gratuits, bouton « Débloquer »).
 *
 * Le matching gère les marques algériennes (COUMADINE, DAKTARINE…) et les
 * classes (AINS, IEC, AVK…) via les alias de lib/interactions-data.ts.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  ChevronsUpDown,
  Info,
  Lock,
  ShieldAlert,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DRUG_INTERACTIONS,
  findInteraction,
  normalizeDrugName,
} from "@/lib/interactions-data";
import type { DrugInteraction, InteractionSeverity } from "@/lib/dzpharma/types";

export interface InteractionCheckerProps {
  isPremium: boolean;
  /** Ouvre le modal Premium depuis la page. */
  onUpgrade: () => void;
}

const SEVERITY_META: Record<
  InteractionSeverity,
  {
    label: string;
    badge: string;
    alertClass: string;
    iconClass: string;
  }
> = {
  RED: {
    label: "Interaction majeure — association déconseillée",
    badge: "border-red-600 bg-red-600 text-white",
    alertClass: "border-red-300 bg-red-50",
    iconClass: "text-red-600",
  },
  ORANGE: {
    label: "Interaction modérée — précautions nécessaires",
    badge: "border-amber-400 bg-amber-400 text-white",
    alertClass: "border-amber-300 bg-amber-50",
    iconClass: "text-amber-600",
  },
  YELLOW: {
    label: "Interaction mineure — surveillance simple",
    badge: "border-yellow-400 bg-yellow-400 text-white",
    alertClass: "border-yellow-300 bg-yellow-50",
    iconClass: "text-yellow-600",
  },
};

/* ------------------------------------------------------------------ */
/* Combobox DCI (Popover + Command, filtrage maîtrisé côté client)     */
/* ------------------------------------------------------------------ */

function DciCombobox({
  id,
  label,
  value,
  onChange,
  dcis,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  dcis: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = normalizeDrugName(query);
    const base = normalized
      ? dcis.filter((dci) => normalizeDrugName(dci).includes(normalized))
      : dcis;
    return base.slice(0, 120);
  }, [dcis, query]);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-slate-600">
        {label}
      </Label>
      <div className="relative">
        <Popover
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (!nextOpen) setQuery("");
          }}
        >
          <PopoverTrigger asChild>
            <Button
              id={id}
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={`h-12 w-full justify-between gap-2 pr-10 text-left text-sm font-semibold ${
                value ? "text-slate-900" : "text-slate-400"
              }`}
            >
              <span className="truncate">{value || "Rechercher une DCI…"}</span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0 sm:rounded-xl"
          >
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Taper une DCI (ex : PARACETAMOL)…"
                value={query}
                onValueChange={setQuery}
                className="h-11"
              />
              <CommandList className="max-h-60">
                {filtered.length === 0 ? (
                  <CommandEmpty>Aucune DCI trouvée dans la base.</CommandEmpty>
                ) : (
                  <CommandGroup>
                    {filtered.map((dci) => (
                      <CommandItem
                        key={dci}
                        value={dci}
                        onSelect={() => {
                          onChange(dci === value ? "" : dci);
                          setOpen(false);
                          setQuery("");
                        }}
                        className="text-sm"
                      >
                        {dci}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={`Effacer ${label}`}
            className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Composant principal                                                 */
/* ------------------------------------------------------------------ */

export function InteractionChecker({ isPremium, onUpgrade }: InteractionCheckerProps) {
  const [dcis, setDcis] = useState<string[] | null>(null);
  const [listError, setListError] = useState(false);
  const [drug1, setDrug1] = useState("");
  const [drug2, setDrug2] = useState("");

  /* Chargement de la liste des DCI uniques (async — pas de setState synchrone). */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/dci/list")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ dcis: string[] }>;
      })
      .then((data) => {
        if (!cancelled) setDcis(data.dcis);
      })
      .catch(() => {
        if (!cancelled) setListError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const interaction: DrugInteraction | null = useMemo(
    () => (drug1 && drug2 ? findInteraction(drug1, drug2) : null),
    [drug1, drug2]
  );

  const swap = () => {
    setDrug1(drug2);
    setDrug2(drug1);
  };

  return (
    <Card className="gap-5 p-4 shadow-sm sm:p-6">
      {/* En-tête */}
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
          <ShieldAlert className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-extrabold leading-tight text-slate-900">
            Vérificateur d&apos;interactions
          </h2>
          <p className="text-xs leading-snug text-slate-500">
            {DRUG_INTERACTIONS.length} associations critiques — génériques les plus
            prescrits en Algérie.
          </p>
        </div>
      </div>

      {/* Deux champs autonomes + swap */}
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
        {dcis ? (
          <DciCombobox
            id="interaction-drug-1"
            label="Médicament 1 (DCI)"
            value={drug1}
            onChange={setDrug1}
            dcis={dcis}
          />
        ) : listError ? (
          <p className="text-sm font-medium text-red-600">
            Liste des DCI indisponible — rechargez la page.
          </p>
        ) : (
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={swap}
          disabled={!drug1 && !drug2}
          aria-label="Inverser les deux médicaments"
          className="h-11 w-11 shrink-0 justify-self-start sm:justify-self-center"
        >
          <ArrowLeftRight className="h-4 w-4" aria-hidden />
        </Button>

        {dcis ? (
          <DciCombobox
            id="interaction-drug-2"
            label="Médicament 2 (DCI)"
            value={drug2}
            onChange={setDrug2}
            dcis={dcis}
          />
        ) : listError ? null : (
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        )}
      </div>

      {/* Résultats */}
      {!drug1 || !drug2 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white/70 p-3 text-center text-xs text-slate-400">
          Sélectionnez deux médicaments pour vérifier leur association.
        </p>
      ) : interaction ? (
        <div className="space-y-3">
          <Alert className={`border-2 ${SEVERITY_META[interaction.severity].alertClass}`}>
            <ShieldAlert className={`h-4 w-4 ${SEVERITY_META[interaction.severity].iconClass}`} aria-hidden />
            <AlertTitle className="flex flex-wrap items-center gap-2 pr-1">
              <span className="text-slate-900">{interaction.severity === "RED" ? "Association déconseillée" : interaction.severity === "ORANGE" ? "Précautions d'emploi" : "Surveillance simple"}</span>
              <Badge variant="outline" className={SEVERITY_META[interaction.severity].badge}>
                {SEVERITY_META[interaction.severity].label}
              </Badge>
            </AlertTitle>
            <AlertDescription>
              <div className="space-y-3">
                <p>
                  <span className="font-bold text-slate-900">
                    {drug1} × {drug2}
                  </span>{" "}
                  — interaction répertoriée.
                </p>

                {/* Mécanisme : gratuit (vocation pédagogique) */}
                <p className="text-sm leading-relaxed text-slate-700">
                  <span className="font-bold text-slate-900">Mécanisme : </span>
                  {interaction.mechanism}
                </p>

                {/* Conduite à tenir + alternatives : CONTENU PREMIUM */}
                <div className="relative">
                  <div
                    aria-hidden={!isPremium}
                    className={`space-y-2.5 ${
                      isPremium ? "" : "pointer-events-none select-none blur-md"
                    }`}
                  >
                    <p className="text-sm leading-relaxed text-slate-700">
                      <span className="font-bold text-slate-900">Conduite à tenir : </span>
                      {interaction.recommendation}
                    </p>
                    {interaction.alternatives && interaction.alternatives.length > 0 && (
                      <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3">
                        <p className="text-xs font-bold text-sky-800">
                          Alternatives thérapeutiques locales :
                        </p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs leading-relaxed text-slate-700">
                          {interaction.alternatives.map((alternative) => (
                            <li key={alternative}>{alternative}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {!isPremium && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                        <Lock className="h-3.5 w-3.5 text-amber-700" aria-hidden />
                      </span>
                      <p className="text-[11px] leading-snug text-slate-600">
                        Recommandation détaillée &amp; alternatives — réservées aux membres
                        Premium.
                      </p>
                      <Button size="sm" className="h-9 gap-1.5 font-semibold" onClick={onUpgrade}>
                        <Lock className="h-3.5 w-3.5" aria-hidden />
                        Débloquer avec Premium
                      </Button>
                    </div>
                  )}
                </div>

                {interaction.source && (
                  <p className="text-[10px] italic text-slate-400">
                    Source : {interaction.source}
                  </p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <Alert className="border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
          <AlertTitle className="text-slate-900">Aucune interaction répertoriée</AlertTitle>
          <AlertDescription>
            <div className="space-y-1.5">
              <p className="text-sm text-slate-700">
                Aucune interaction connue dans notre base pour{" "}
                <span className="font-semibold">
                  {drug1} × {drug2}
                </span>
                . L&apos;association apparaît acceptable à ce stade.
              </p>
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
                <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                Base volontairement limitée aux associations critiques — non exhaustive.
                En cas de doute, consultez le thésaurus ANSM ou votre pharmacien.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Pied */}
      <p className="flex items-start justify-center gap-1.5 text-center text-[10px] leading-relaxed text-slate-400">
        <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        Base d&apos;interactions DzPharma — sources : Thésaurus ANSM, ROTH-BPC. Outil
        d&apos;aide à la décision, ne remplace pas le jugement clinique.
      </p>
    </Card>
  );
}
