"use client";

/**
 * CalculatorHub — onglet « Scores » : les 10 calculateurs cliniques
 * « Dz-Adaptés », rendus par le moteur générique (CalculatorRunner).
 *
 * Réorganisation master–détail (l'ancienne version empilait 10 grandes
 * cartes + des filtres, le calculateur se retrouvait hors de vue) :
 *  - Mobile  : grille compacte 2 colonnes (icône + nom + spécialité) ;
 *              au tap, le panneau du score s'affiche juste en dessous et
 *              la vue défile automatiquement vers lui (scroll-mt pour le
 *              header sticky). Changer de score = 1 tap, zéro scroll retour.
 *  - Desktop : liste latérale sticky groupée par spécialité + panneau du
 *              score à droite (sticky) — changement instantané.
 *
 * Le bouton « Trouver le traitement recommandé » ouvre l'AlternativesDialog
 * de la page avec la DCI pré-remplie (freemium existant : 2 alternatives
 * gratuites, le reste Premium).
 */
import { useMemo, useRef, useState } from "react";
import {
  Activity,
  Baby,
  Brain,
  ChevronRight,
  Droplets,
  Gauge,
  Heart,
  HeartPulse,
  Stethoscope,
  Thermometer,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CALCULATORS } from "@/lib/calculators";
import type {
  CalculatorCategory,
  CalculatorDefinition,
} from "@/lib/dzpharma/types";
import { CalculatorRunner } from "./calculator-runner";

interface CalculatorHubProps {
  onFindAlternatives: (dci: string, label?: string) => void;
}

/** Icône reconnaissable par score (repérage visuel rapide en cabinet). */
const SCORE_ICONS: Record<string, LucideIcon> = {
  curb65: Wind,
  crb65: Stethoscope,
  hasbled: Droplets,
  wells: Activity,
  cha2ds2vasc: HeartPulse,
  centor: Thermometer,
  glasgow: Brain,
  framingham: Heart,
  apgar: Baby,
  eva: Gauge,
};

function ScoreIcon({ id }: { id: string }) {
  const Icon = SCORE_ICONS[id] ?? Stethoscope;
  return <Icon className="h-4 w-4" aria-hidden />;
}

export function CalculatorHub({ onFindAlternatives }: CalculatorHubProps) {
  const [selectedId, setSelectedId] = useState<string>(CALCULATORS[0].id);
  const runnerRef = useRef<HTMLDivElement | null>(null);

  /** Scores groupés par spécialité (ordre du registre = pertinence cabinet). */
  const grouped = useMemo(() => {
    const map = new Map<CalculatorCategory, CalculatorDefinition[]>();
    for (const calculator of CALCULATORS) {
      const list = map.get(calculator.category) ?? [];
      list.push(calculator);
      map.set(calculator.category, list);
    }
    return Array.from(map.entries());
  }, []);

  const selected: CalculatorDefinition =
    CALCULATORS.find((calculator) => calculator.id === selectedId) ?? CALCULATORS[0];

  /** Sélection + défilement doux vers le panneau (mobile uniquement). */
  const selectScore = (id: string) => {
    setSelectedId(id);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      window.requestAnimationFrame(() => {
        runnerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Avertissement médical — obligatoire pour tout outil de décision */}
      <Alert className="border-amber-200 bg-amber-50/80">
        <Stethoscope className="h-4 w-4 text-amber-600" aria-hidden />
        <AlertDescription className="text-xs leading-relaxed text-amber-900">
          <span className="font-bold">Outils d&apos;aide à la décision clinique.</span>{" "}
          Ces scores orientent la stratégie thérapeutique mais ne remplacent ni
          votre jugement clinique ni les recommandations officielles (SNPV, OMS).
          Aucune donnée patient n&apos;est enregistrée.
        </AlertDescription>
      </Alert>

      <div className="lg:grid lg:grid-cols-[270px_minmax(0,1fr)] lg:items-start lg:gap-5">
        {/* ---------------- Sélecteur — mobile : grille compacte ---------------- */}
        <div className="lg:hidden">
          <ul className="grid list-none grid-cols-2 gap-2">
            {CALCULATORS.map((calculator) => {
              const isSelected = calculator.id === selected.id;
              return (
                <li key={calculator.id}>
                  <button
                    type="button"
                    onClick={() => selectScore(calculator.id)}
                    aria-pressed={isSelected}
                    className={`flex h-full w-full flex-col items-start gap-1 rounded-xl border-2 p-2.5 text-left transition-all duration-200 ${
                      isSelected
                        ? "border-sky-500 bg-sky-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-sky-200 active:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                        isSelected ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <ScoreIcon id={calculator.id} />
                    </span>
                    <span className="text-[13px] font-bold leading-tight text-slate-900">
                      {calculator.name}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {calculator.category}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ------------- Sélecteur — desktop : liste groupée sticky ------------- */}
        <aside
          className="hidden lg:sticky lg:top-20 lg:block lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1"
          aria-label="Choisir un score clinique"
        >
          <div className="space-y-3">
            {grouped.map(([category, calculators]) => (
              <div key={category}>
                <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {category}
                </p>
                <ul className="list-none space-y-0.5">
                  {calculators.map((calculator) => {
                    const isSelected = calculator.id === selected.id;
                    return (
                      <li key={calculator.id}>
                        <button
                          type="button"
                          onClick={() => selectScore(calculator.id)}
                          aria-pressed={isSelected}
                          aria-current={isSelected ? "true" : undefined}
                          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                            isSelected
                              ? "bg-sky-50 font-bold text-sky-800"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                              isSelected
                                ? "bg-sky-100 text-sky-700"
                                : "bg-slate-100 text-slate-400"
                            }`}
                          >
                            <ScoreIcon id={calculator.id} />
                          </span>
                          <span className="min-w-0 flex-1 truncate">{calculator.name}</span>
                          {isSelected && (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sky-500" aria-hidden />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* ---------------- Panneau du score sélectionné ---------------- */}
        <div ref={runnerRef} className="scroll-mt-20 lg:sticky lg:top-20">
          <Card className="gap-4 p-4 shadow-sm sm:p-6">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                  <ScoreIcon id={selected.id} />
                </span>
                <h2 className="text-lg font-extrabold text-slate-900">{selected.name}</h2>
                <Badge
                  variant="outline"
                  className="border-sky-200 bg-sky-50 text-[10px] font-semibold text-sky-700"
                >
                  {selected.category}
                </Badge>
              </div>
              <p className="pt-1 text-xs leading-relaxed text-slate-500">
                <span className="font-semibold text-slate-600">Quand l&apos;utiliser : </span>
                {selected.indication}
              </p>
            </div>

            <CalculatorRunner definition={selected} onFindAlternatives={onFindAlternatives} />
          </Card>
        </div>
      </div>
    </div>
  );
}
