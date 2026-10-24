/**
 * Framingham — risque cardio-vasculaire à 10 ans (tables de points de
 * Wilson/ATP III). Particulièrement pertinent chez le patient algérien
 * diabétique et/ou hypertendu. Le résultat s'exprime en % de risque.
 *
 * Référence : Wilson PWF et al., Circulation 1998 ; NHLBI ATP III (2001).
 * Estimation indicative — à faire valider par un cardiologue avant prod.
 */
import type { CalculatorAnswers, CalculatorDefinition, CalculatorOption } from "@/lib/dzpharma/types";

const SEXE_OPTIONS: CalculatorOption[] = [
  { value: "homme", label: "Masculin", points: 0 },
  { value: "femme", label: "Féminin", points: 0 },
];

/* ---------------- Tables de points (Wilson 1998 / ATP III) ---------------- */

/** Âge → points (hommes puis femmes). */
const AGE_MEN: Array<[number, number]> = [
  [34, -9], [39, -4], [44, 0], [49, 3], [54, 6], [59, 8], [64, 10], [69, 11], [74, 12], [79, 13],
];
const AGE_WOMEN: Array<[number, number]> = [
  [34, -7], [39, -3], [44, 0], [49, 3], [54, 6], [59, 8], [64, 10], [69, 12], [74, 14], [79, 16],
];

/** Cholestérol total (mg/dL) → points par tranche d'âge, [ <160, 160-199, 200-239, 240-279, ≥280 ]. */
const TC_MEN: Record<string, number[]> = {
  "20-39": [0, 4, 7, 9, 11],
  "40-49": [0, 3, 5, 6, 8],
  "50-59": [0, 2, 3, 4, 5],
  "60-69": [0, 1, 1, 2, 3],
  "70-79": [0, 1, 1, 1, 2],
};
const TC_WOMEN: Record<string, number[]> = {
  "20-39": [0, 3, 6, 8, 10],
  "40-49": [0, 3, 5, 6, 8],
  "50-59": [0, 2, 4, 5, 7],
  "60-69": [0, 1, 2, 3, 4],
  "70-79": [0, 1, 1, 2, 3],
};

/** Tabagisme actif → points par tranche d'âge. */
const SMOKE_MEN: Record<string, number> = { "20-39": 8, "40-49": 5, "50-59": 3, "60-69": 1, "70-79": 1 };
const SMOKE_WOMEN: Record<string, number> = { "20-39": 9, "40-49": 7, "50-59": 4, "60-69": 2, "70-79": 1 };

/** HDL (mg/dL) → points (identique quel que soit le sexe). */
function hdlPoints(hdlMgDl: number): number {
  if (hdlMgDl >= 60) return -1;
  if (hdlMgDl >= 50) return 0;
  if (hdlMgDl >= 40) return 1;
  return 2;
}

/** PA systolique → points, [ <120, 120-129, 130-139, 140-159, ≥160 ]. */
const SBP_MEN_UNTREATED = [0, 0, 1, 1, 2];
const SBP_MEN_TREATED = [0, 1, 2, 2, 3];
const SBP_WOMEN_UNTREATED = [0, 1, 2, 3, 4];
const SBP_WOMEN_TREATED = [0, 3, 4, 5, 6];

/** Points totaux → risque % à 10 ans (tables ATP III). */
const RISK_MEN: Array<[number, number]> = [
  [-2, 2], [-1, 2], [0, 3], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7], [6, 8], [7, 10],
  [8, 11], [9, 13], [10, 15], [11, 17], [12, 20], [13, 24], [14, 27], [15, 30], [16, 34], [17, 38], [18, 45],
];
const RISK_WOMEN: Array<[number, number]> = [
  [2, 1], [3, 2], [4, 2], [5, 3], [6, 3], [7, 4], [8, 4], [9, 5], [10, 6], [11, 8],
  [12, 11], [13, 13], [14, 16], [15, 20], [16, 25], [17, 30], [18, 35], [19, 40], [20, 45],
];

function bucketPoints(table: Array<[number, number]>, value: number): number {
  for (const [max, points] of table) {
    if (value <= max) return points;
  }
  return table[table.length - 1][1];
}

function ageBand(age: number): string {
  if (age < 40) return "20-39";
  if (age < 50) return "40-49";
  if (age < 60) return "50-59";
  if (age < 70) return "60-69";
  return "70-79";
}

function tcIndex(tcMgDl: number): number {
  if (tcMgDl < 160) return 0;
  if (tcMgDl < 200) return 1;
  if (tcMgDl < 240) return 2;
  if (tcMgDl < 280) return 3;
  return 4;
}

function sbpIndex(sbp: number): number {
  if (sbp < 120) return 0;
  if (sbp < 130) return 1;
  if (sbp < 140) return 2;
  if (sbp < 160) return 3;
  return 4;
}

function riskFromPoints(points: number, table: Array<[number, number]>, floor: number, cap: number): number {
  if (points <= table[0][0]) return floor;
  for (const [minPoints, risk] of table) {
    if (points <= minPoints) return risk;
  }
  return cap;
}

export const FRAMINGHAM: CalculatorDefinition = {
  id: "framingham",
  name: "Framingham",
  category: "Cardiologie",
  description:
    "Risque cardio-vasculaire global à 10 ans (%), adapté au patient diabétique/hypertendu.",
  indication:
    "Prévention primaire : homme ou femme de 20 à 79 ans, sans antécédent cardio-vasculaire.",
  questions: [
    { id: "sexe", label: "Sexe", type: "choice", options: SEXE_OPTIONS },
    { id: "age", label: "Âge", type: "number", min: 20, max: 79, step: 1, unit: "ans", slider: true },
    { id: "tabac", label: "Tabagisme actuel", type: "boolean" },
    { id: "diabete", label: "Diabète", type: "boolean" },
    {
      id: "pas",
      label: "PA systolique",
      type: "number",
      min: 90,
      max: 220,
      step: 5,
      unit: "mmHg",
      slider: true,
    },
    {
      id: "traitementHta",
      label: "Sous traitement antihypertenseur",
      type: "boolean",
    },
    {
      id: "tc",
      label: "Cholestérol total",
      type: "number",
      min: 1,
      max: 4,
      step: 0.1,
      unit: "g/L",
      slider: true,
      help: "1 g/L = 100 mg/dL.",
    },
    {
      id: "hdl",
      label: "HDL-cholestérol",
      type: "number",
      min: 0.2,
      max: 1.5,
      step: 0.05,
      unit: "g/L",
      slider: true,
    },
  ],
  compute: (answers) => {
    const isWoman = answers.sexe === "femme";
    const age = Number(answers.age);
    const band = ageBand(age);
    const tcMgDl = Math.round(Number(answers.tc) * 100);
    const hdlMgDl = Math.round(Number(answers.hdl) * 100);
    const sbp = Number(answers.pas);
    const treated = answers.traitementHta === true;

    let points = bucketPoints(isWoman ? AGE_WOMEN : AGE_MEN, age);
    const tcTable = isWoman ? TC_WOMEN : TC_MEN;
    points += (tcTable[band] ?? tcTable["40-49"])[tcIndex(tcMgDl)];
    if (answers.tabac === true) {
      points += (isWoman ? SMOKE_WOMEN : SMOKE_MEN)[band] ?? 0;
    }
    points += hdlPoints(hdlMgDl);
    const sbpTable = isWoman
      ? treated ? SBP_WOMEN_TREATED : SBP_WOMEN_UNTREATED
      : treated ? SBP_MEN_TREATED : SBP_MEN_UNTREATED;
    points += sbpTable[sbpIndex(sbp)];

    const risk = isWoman
      ? riskFromPoints(points, RISK_WOMEN, 1, 50)
      : riskFromPoints(points, RISK_MEN, 1, 50);
    return Math.min(risk, 50);
  },
  scoreSuffix: " % de risque à 10 ans",
  interpretations: [
    {
      min: 0,
      max: 9,
      level: "green",
      title: "Risque cardio-vasculaire faible (< 10 %)",
      message:
        "Risque à 10 ans inférieur à 10 % — prévention de base : hygiène de vie, activité physique, sevrage tabagique.",
      recommendation:
        "Contrôle annuel : PA, glycémie, bilan lipidique. Optimiser le contrôle du diabète et de la tension s'ils existent.",
    },
    {
      min: 10,
      max: 19,
      level: "orange",
      title: "Risque intermédiaire (10-19 %)",
      message:
        "Risque à 10 ans de 10 à 19 % — stratification utile et optimisation agressive des facteurs modifiables.",
      recommendation:
        "Contrôle strict de la PA (cible < 140/90), dépistage du diabète, sevrage tabagique actif, évaluer l'intérêt d'une statine selon le LDL.",
      suggestedDci: "ATORVASTATINE",
      suggestedLabel: "Statine — à discuter selon LDL",
    },
    {
      min: 20,
      max: 999,
      level: "red",
      title: "Risque élevé (≥ 20 %)",
      message:
        "Risque à 10 ans ≥ 20 % : prévention intensive nécessaire, équivalent risque secondaire.",
      recommendation:
        "Statine systématique, contrôle PA strict (< 140/90 voire < 130/80 si diabète), dépistage et traitement du diabète, sevrage tabagique aidé, bilan rénal.",
      suggestedDci: "ATORVASTATINE",
      suggestedLabel: "Statine (prévention intensive)",
    },
  ],
  reference: "Wilson PWF, et al. Prediction of coronary heart disease using risk factor categories. Circulation 1998;97:1837-47 (ATP III).",
};
