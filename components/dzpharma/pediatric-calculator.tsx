"use client";

/**
 * PediatricCalculator — calculatrice pédiatrique dynamique « sirops locaux ».
 *
 * Objectif produit : donner la dose exacte en mL du sirop algérien, pas juste
 * en mg/kg théorique (ex : « Pour un enfant de 15 kg : 150 à 225 mg par prise,
 * soit 6,2 à 9,4 mL de Doliprane Sirop 24 mg/mL »).
 *
 * Freemium (logique isPremium existante) :
 *   - Gratuit : dose mg/kg + dose par prise (mg) + fréquence + dose journalière.
 *   - Premium : conversion en mL pour chaque spécialité locale avec arrondi
 *     « seringue graduée » (pas de 0,25 mL).
 *   - L'ALERTE ROUGE de dépassement de la dose maximale adulte reste toujours
 *     visible (sécurité du patient > gating commercial).
 *
 * Données : tableau PEDIATRIC_DRUGS codé en dur (lib/pediatric-data.ts).
 * Aucun useEffect — tout est dérivé au rendu (règles React Compiler).
 */
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Baby,
  Clock,
  Crown,
  Lock,
  Scale,
  Syringe,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { PEDIATRIC_DRUGS, computePediatricDose } from "@/lib/pediatric-data";

export interface PediatricCalculatorProps {
  isPremium: boolean;
  /** Ouvre le modal Premium (BaridiMob / CIB) depuis la page. */
  onUpgrade: () => void;
}

const MIN_WEIGHT = 2;
const MAX_WEIGHT_INPUT = 80;
const MIN_WEIGHT_SLIDER = 2;
const MAX_WEIGHT_SLIDER = 40;

const fmtMl = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const fmtMlPractical = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const fmtMg = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export function PediatricCalculator({ isPremium, onUpgrade }: PediatricCalculatorProps) {
  const [dci, setDci] = useState<string>(PEDIATRIC_DRUGS[0].dci);
  const [weightKg, setWeightKg] = useState<number>(15);

  const drug = PEDIATRIC_DRUGS.find((item) => item.dci === dci) ?? PEDIATRIC_DRUGS[0];
  const weightValid = weightKg >= MIN_WEIGHT && weightKg <= MAX_WEIGHT_INPUT;
  const result = useMemo(
    () => (weightValid ? computePediatricDose(drug, weightKg) : null),
    [drug, weightKg, weightValid]
  );

  const doseBasisLabel =
    drug.doseBasis === "per_intake"
      ? `${drug.doseMin_mg_kg} à ${drug.doseMax_mg_kg} mg/kg par prise`
      : `${drug.doseMin_mg_kg} à ${drug.doseMax_mg_kg} mg/kg/jour, répartis en ${drug.intakesPerDay} prise${drug.intakesPerDay > 1 ? "s" : ""}`;

  return (
    <Card className="gap-5 p-4 shadow-sm sm:p-6">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <Baby className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-extrabold leading-tight text-slate-900">
              Calculatrice pédiatrique
            </h2>
            <p className="text-xs leading-snug text-slate-500">
              La dose exacte en mL du sirop algérien, pas seulement en mg.
            </p>
          </div>
        </div>
        {!isPremium && (
          <Badge variant="outline" className="shrink-0 border-amber-300 bg-amber-50 text-amber-700">
            <Crown className="mr-1 h-3 w-3" aria-hidden />
            Premium
          </Badge>
        )}
      </div>

      {/* Poids */}
      <div className="space-y-3">
        <Label htmlFor="pediatric-weight" className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Scale className="h-4 w-4 text-sky-600" aria-hidden />
          Poids de l&apos;enfant
        </Label>
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <Input
              id="pediatric-weight"
              type="number"
              inputMode="decimal"
              min={MIN_WEIGHT}
              max={MAX_WEIGHT_INPUT}
              step={0.5}
              value={weightKg}
              onChange={(event) => {
                const value = Number(event.target.value);
                setWeightKg(Number.isFinite(value) ? value : 0);
              }}
              className="h-12 w-24 pr-7 text-center text-lg font-extrabold"
              aria-describedby="pediatric-weight-hint"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
              kg
            </span>
          </div>
          <Slider
            min={MIN_WEIGHT_SLIDER}
            max={MAX_WEIGHT_SLIDER}
            step={0.5}
            value={[Math.min(Math.max(weightKg, MIN_WEIGHT_SLIDER), MAX_WEIGHT_SLIDER)]}
            onValueChange={(values) => setWeightKg(values[0] ?? MIN_WEIGHT_SLIDER)}
            className="flex-1"
            aria-label="Poids de l'enfant en kilogrammes"
          />
        </div>
        <p id="pediatric-weight-hint" className="text-[11px] text-slate-400">
          Saisissez de {MIN_WEIGHT} à {MAX_WEIGHT_INPUT} kg (curseur pratique jusqu&apos;à{" "}
          {MAX_WEIGHT_SLIDER} kg).
        </p>
      </div>

      {/* Molécule */}
      <div className="space-y-2">
        <Label htmlFor="pediatric-drug" className="text-sm font-semibold text-slate-700">
          Molécule
        </Label>
        <Select value={dci} onValueChange={setDci}>
          <SelectTrigger id="pediatric-drug" className="h-12 w-full text-base font-semibold">
            <SelectValue placeholder="Choisir une molécule" />
          </SelectTrigger>
          <SelectContent>
            {PEDIATRIC_DRUGS.map((item) => (
              <SelectItem key={item.dci} value={item.dci}>
                {item.dci}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Erreur de poids */}
      {!weightValid && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          Poids invalide — entrez une valeur entre {MIN_WEIGHT} et {MAX_WEIGHT_INPUT} kg.
        </p>
      )}

      {/* Résultat */}
      {result && (
        <div className="space-y-4">
          {/* --- Gratuit : dose en mg --- */}
          <div className="space-y-3 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                  Dose par prise
                </p>
                <p className="text-2xl font-extrabold text-slate-900">
                  {fmtMg.format(result.mgPerIntakeMin)} <span className="text-lg">à</span>{" "}
                  {fmtMg.format(result.mgPerIntakeMax)} <span className="text-lg font-bold">mg</span>
                </p>
              </div>
              <Badge variant="outline" className="border-sky-200 bg-white text-xs font-semibold text-sky-700">
                {drug.dci}
              </Badge>
            </div>
            <p className="text-xs text-slate-500">{doseBasisLabel}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-sky-100 pt-2.5 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-sky-600" aria-hidden />
                {drug.freq}
              </span>
              <span>
                Dose journalière :{" "}
                <span className="font-bold text-slate-800">
                  {fmtMg.format(result.mgPerDayMin)} – {fmtMg.format(result.mgPerDayMax)} mg
                </span>
              </span>
            </div>
          </div>

          {/* --- Premium : conversion mL sirops locaux --- */}
          <div className="relative">
            <div
              aria-hidden={!isPremium}
              className={`space-y-2.5 rounded-2xl border border-slate-200 bg-white p-4 ${
                isPremium ? "" : "pointer-events-none select-none blur-md"
              }`}
            >
              <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                <Syringe className="h-4 w-4 text-sky-600" aria-hidden />
                Conversion en sirops disponibles en Algérie
              </p>
              {result.formDoses.map((formDose) => (
                <div
                  key={formDose.form.brand}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {formDose.form.brand}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formDose.form.concentration_mg_ml} mg/mL
                      {formDose.form.note ? ` · ${formDose.form.note}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-extrabold leading-tight text-sky-700">
                      {fmtMl.format(formDose.mlMin)} à {fmtMl.format(formDose.mlMax)} mL
                    </p>
                    <p className="text-[10px] text-slate-400">
                      ≈ {fmtMlPractical.format(formDose.mlMinPractical)} –{" "}
                      {fmtMlPractical.format(formDose.mlMaxPractical)} mL (seringue 0,25 mL)
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {!isPremium && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/55 p-3 text-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
                  <Lock className="h-4 w-4 text-amber-700" aria-hidden />
                </span>
                <p className="text-sm font-bold text-slate-900">Contenu Premium</p>
                <p className="max-w-64 text-[11px] leading-snug text-slate-600">
                  Passez à Premium (3 600 DZD/an) pour la dose exacte en mL de chaque sirop
                  local, avec l&apos;arrondi seringue graduée.
                </p>
                <Button size="sm" className="mt-0.5 h-10 gap-1.5 font-semibold" onClick={onUpgrade}>
                  <Crown className="h-4 w-4" aria-hidden />
                  Débloquer avec Premium
                </Button>
              </div>
            )}
          </div>

          {/* --- Alerte rouge sécurité : TOUJOURS visible (jamais floutée) --- */}
          {result.exceedsAdultMax && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              <AlertTitle>Dose maximale adulte dépassée</AlertTitle>
              <AlertDescription className="text-xs leading-relaxed">
                La dose calculée ({result.exceedsAdultMaxBasis}) dépasse la dose maximale adulte
                ({fmtMg.format(drug.adultMaxSingleDose_mg)} mg/prise ·{" "}
                {fmtMg.format(drug.adultMaxDailyDose_mg)} mg/jour). Vérifiez le poids saisi —
                ne pas prescrire au-delà des maxima.
              </AlertDescription>
            </Alert>
          )}

          {drug.caution && (
            <Alert className="border-amber-200 bg-amber-50/80">
              <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
              <AlertDescription className="text-xs leading-relaxed text-amber-900">
                {drug.caution}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Avertissement médical */}
      <Alert className="border-slate-200 bg-slate-50">
        <AlertTriangle className="h-4 w-4 text-slate-400" aria-hidden />
        <AlertDescription className="text-[11px] leading-relaxed text-slate-500">
          Vérifiez toujours la concentration réelle inscrite sur le flacon et la seringue
          fournie. Cet outil est une aide au calcul : la prescription reste sous la seule
          responsabilité du médecin.
        </AlertDescription>
      </Alert>
    </Card>
  );
}
