/**
 * DzPharma Guide — registre des 10 calculateurs de scores cliniques
 * « Dz-Adaptés ». Le hub (components/calculators/calculator-hub.tsx)
 * rend ces définitions déclaratives via le moteur générique.
 */
import type { CalculatorCategory, CalculatorDefinition } from "@/lib/dzpharma/types";
import { CURB65 } from "./curb65";
import { CRB65 } from "./crb65";
import { HASBLED } from "./hasbled";
import { WELLS } from "./wells";
import { CHA2DS2_VASC } from "./cha2ds2vasc";
import { CENTOR } from "./centor";
import { GLASGOW } from "./glasgow";
import { FRAMINGHAM } from "./framingham";
import { APGAR } from "./apgar";
import { EVA } from "./eva";

/** Ordre d'affichage = ordre de pertinence en cabinet (spec produit). */
export const CALCULATORS: CalculatorDefinition[] = [
  CURB65,
  HASBLED,
  WELLS,
  CHA2DS2_VASC,
  CRB65,
  CENTOR,
  GLASGOW,
  FRAMINGHAM,
  APGAR,
  EVA,
];

export function getCalculatorById(id: string): CalculatorDefinition | undefined {
  return CALCULATORS.find((calculator) => calculator.id === id);
}

/** Catégories présentes dans le registre (ordre de première occurrence). */
export const CALCULATOR_CATEGORIES: CalculatorCategory[] = Array.from(
  new Set(CALCULATORS.map((calculator) => calculator.category))
);
