/**
 * DzPharma Guide — configuration pédiatrique (MVP codée en dur).
 *
 * Posologies de référence pour l'enfant, avec les SIROPS réellement
 * disponibles en officine algérienne et leur concentration en mg/mL.
 * Objectif : donner au médecin la dose exacte en mL du sirop qu'il peut
 * effectivement prescrire, pas seulement une dose en mg/kg théorique.
 *
 * ⚠️ Données de référence (ROTH Algérie / RCP laboratoires) — à faire
 * valider par un pédiatre avant toute utilisation en production.
 */
import type {
  PediatricDoseResult,
  PediatricDrug,
} from "@/lib/dzpharma/types";

export const PEDIATRIC_DRUGS: PediatricDrug[] = [
  {
    dci: "PARACETAMOL",
    doseMin_mg_kg: 10,
    doseMax_mg_kg: 15,
    doseBasis: "per_intake",
    freq: "Toutes les 6 heures (4 prises par jour)",
    intakesPerDay: 4,
    localForms: [
      { brand: "DOLIPRANE SIROP", concentration_mg_ml: 24, note: "2,4 % — 2,4 g / 100 mL" },
      { brand: "DOLI-BIEN SIROP", concentration_mg_ml: 24 },
      { brand: "EFFERALGAN SIROP", concentration_mg_ml: 24 },
    ],
    adultMaxSingleDose_mg: 1000,
    adultMaxDailyDose_mg: 4000,
    caution:
      "Ne pas dépasser 4 prises par 24 h. Chez l'enfant de moins de 3 mois ou déshydraté : avis médical.",
  },
  {
    dci: "AMOXICILLINE",
    doseMin_mg_kg: 50,
    doseMax_mg_kg: 80,
    doseBasis: "per_day",
    freq: "2 à 3 prises par jour",
    intakesPerDay: 3,
    localForms: [
      { brand: "AMOXIL SIROP", concentration_mg_ml: 50, note: "250 mg / 5 mL" },
      { brand: "AMOCILAN SIROP", concentration_mg_ml: 50 },
      { brand: "CLAMOXYL SIROP", concentration_mg_ml: 50 },
    ],
    adultMaxSingleDose_mg: 1000,
    adultMaxDailyDose_mg: 3000,
  },
  {
    dci: "IBUPROFENE",
    doseMin_mg_kg: 20,
    doseMax_mg_kg: 30,
    doseBasis: "per_day",
    freq: "3 prises par jour, au plus court (si nécessaire)",
    intakesPerDay: 3,
    localForms: [
      { brand: "BRUFEN SIROP", concentration_mg_ml: 20, note: "100 mg / 5 mL" },
      { brand: "ADVILMED SIROP", concentration_mg_ml: 20 },
    ],
    adultMaxSingleDose_mg: 400,
    adultMaxDailyDose_mg: 1200,
    caution:
      "Jamais 2 AINS associés. À éviter si déshydratation, gastro-entérite ou varicelle.",
  },
  {
    dci: "AZITHROMYCINE",
    doseMin_mg_kg: 10,
    doseMax_mg_kg: 10,
    doseBasis: "per_day",
    freq: "1 prise par jour, pendant 3 jours",
    intakesPerDay: 1,
    localForms: [
      { brand: "ZITHROMAX SIROP", concentration_mg_ml: 40, note: "200 mg / 5 mL" },
    ],
    adultMaxSingleDose_mg: 500,
    adultMaxDailyDose_mg: 500,
  },
  {
    dci: "CEFIXIME",
    doseMin_mg_kg: 8,
    doseMax_mg_kg: 8,
    doseBasis: "per_day",
    freq: "2 prises par jour (12 heures d'intervalle)",
    intakesPerDay: 2,
    localForms: [
      { brand: "OKLAC SIROP", concentration_mg_ml: 20, note: "100 mg / 5 mL" },
    ],
    adultMaxSingleDose_mg: 200,
    adultMaxDailyDose_mg: 400,
  },
];

/** Arrondi pratique à la seringue graduée : pas de 0,25 mL. */
function roundToQuarterMl(value: number): number {
  return Math.round(value * 4) / 4;
}

/**
 * Calcule la posologie pédiatrique complète pour un enfant donné :
 *  - dose par prise et dose journalière (mg) selon doseBasis ;
 *  - conversion en mL pour chaque sirop local ;
 *  - garde-fou « dépassement de la dose maximale adulte ».
 */
export function computePediatricDose(
  drug: PediatricDrug,
  weightKg: number
): PediatricDoseResult | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;

  const roundMg = (value: number) => Math.round(value);

  let mgPerIntakeMin: number;
  let mgPerIntakeMax: number;
  let mgPerDayMin: number;
  let mgPerDayMax: number;

  if (drug.doseBasis === "per_intake") {
    mgPerIntakeMin = roundMg(weightKg * drug.doseMin_mg_kg);
    mgPerIntakeMax = roundMg(weightKg * drug.doseMax_mg_kg);
    mgPerDayMin = mgPerIntakeMin * drug.intakesPerDay;
    mgPerDayMax = mgPerIntakeMax * drug.intakesPerDay;
  } else {
    mgPerDayMin = roundMg(weightKg * drug.doseMin_mg_kg);
    mgPerDayMax = roundMg(weightKg * drug.doseMax_mg_kg);
    mgPerIntakeMin = Math.round(mgPerDayMin / drug.intakesPerDay);
    mgPerIntakeMax = Math.round(mgPerDayMax / drug.intakesPerDay);
  }

  const exceedsSingle = mgPerIntakeMax > drug.adultMaxSingleDose_mg;
  const exceedsDaily = mgPerDayMax > drug.adultMaxDailyDose_mg;

  const formDoses = drug.localForms.map((form) => {
    const mlMin = mgPerIntakeMin / form.concentration_mg_ml;
    const mlMax = mgPerIntakeMax / form.concentration_mg_ml;
    return {
      form,
      mlMin,
      mlMax,
      mlMinPractical: roundToQuarterMl(mlMin),
      mlMaxPractical: roundToQuarterMl(mlMax),
    };
  });

  return {
    weightKg,
    mgPerIntakeMin,
    mgPerIntakeMax,
    mgPerDayMin,
    mgPerDayMax,
    exceedsAdultMax: exceedsSingle || exceedsDaily,
    exceedsAdultMaxBasis: exceedsSingle ? "par prise" : exceedsDaily ? "journalière" : undefined,
    formDoses,
  };
}
