/**
 * CHA₂DS₂-VASc — risque embolique de la fibrillation auriculaire
 * et indication d'une anticoagulation. Référence : Lip GYH et al.,
 * CHEST 2010 ; recommandations ESC 2024.
 */
import type { CalculatorAnswers, CalculatorDefinition, CalculatorOption } from "@/lib/dzpharma/types";

const AGE_OPTIONS: CalculatorOption[] = [
  { value: "under65", label: "Moins de 65 ans", points: 0 },
  { value: "65-74", label: "65 à 74 ans", points: 1 },
  { value: "over75", label: "75 ans ou plus", points: 2 },
];

const SEX_OPTIONS: CalculatorOption[] = [
  { value: "homme", label: "Masculin", points: 0 },
  { value: "femme", label: "Féminin", points: 1 },
];

function bool(answers: CalculatorAnswers, id: string): boolean {
  return answers[id] === true;
}

export const CHA2DS2_VASC: CalculatorDefinition = {
  id: "cha2ds2vasc",
  name: "CHA₂DS₂-VASc",
  category: "Cardiologie",
  description:
    "Risque d'AVC dans la fibrillation auriculaire non valvulaire et indication de l'anticoagulation.",
  indication:
    "Fibrillation auriculaire (documentée à l'ECG) — décider d'instaurer ou non un anticoagulant oral.",
  questions: [
    {
      id: "icc",
      label: "Insuffisance cardiaque / dysfonction ventriculaire gauche",
      help: "ICC documentée ou FEVG ≤ 40 %.",
      type: "boolean",
    },
    {
      id: "hta",
      label: "Hypertension artérielle",
      help: "Traitée ou non (PA ≥ 140/90 mmHg).",
      type: "boolean",
    },
    {
      id: "age",
      label: "Âge",
      type: "choice",
      options: AGE_OPTIONS,
    },
    {
      id: "diabete",
      label: "Diabète",
      type: "boolean",
    },
    {
      id: "avc",
      label: "AVC, AIT ou embolie systémique antérieure",
      type: "boolean",
    },
    {
      id: "vasculaire",
      label: "Maladie vasculaire",
      help: "IDM ancien, AOMI, plaque aortique complexe.",
      type: "boolean",
    },
    {
      id: "sexe",
      label: "Sexe",
      type: "choice",
      options: SEX_OPTIONS,
    },
  ],
  compute: (answers) => {
    let score = 0;
    if (bool(answers, "icc")) score += 1;
    if (bool(answers, "hta")) score += 1;
    score += AGE_OPTIONS.find((o) => o.value === answers.age)?.points ?? 0;
    if (bool(answers, "diabete")) score += 1;
    if (bool(answers, "avc")) score += 2;
    if (bool(answers, "vasculaire")) score += 1;
    score += SEX_OPTIONS.find((o) => o.value === answers.sexe)?.points ?? 0;
    return score;
  },
  scoreSuffix: " / 9",
  interpretations: [
    {
      min: 0,
      max: 1,
      level: "green",
      title: "Faible risque embolique",
      message:
        "Anticoagulation généralement non recommandée. Chez la femme, le sexe seul (1 point) ne justifie jamais l'anticoagulation.",
      recommendation:
        "Contrôle de la fréquence cardiaque, recherche de facteurs déclenchants (alcool, hyperthyroïdie), réévaluation annuelle.",
    },
    {
      min: 2,
      max: 2,
      level: "orange",
      title: "Risque intermédiaire",
      message:
        "Anticoagulation à considérer : recommandée chez l'homme (≥ 2 points), à discuter chez la femme (le sexe seul ne suffit pas).",
      recommendation:
        "Peser le risque hémorragique (HAS-BLED) avant d'instaurer l'anticoagulant oral (AVK ou AOD).",
    },
    {
      min: 3,
      max: 9,
      level: "red",
      title: "Risque embolique élevé",
      message:
        "Anticoagulation orale recommandée (homme ≥ 2, femme ≥ 3) : AVK (Coumadine®) ou AOD selon le profil et le budget du patient.",
      recommendation:
        "Vérifier le HAS-BLED avant l'instauration, corriger les facteurs réversibles et surveiller l'INR (AVK) ou la fonction rénale (AOD).",
      suggestedDci: "WARFARINE",
      suggestedLabel: "AVK — vérifier les interactions médicamenteuses",
    },
  ],
  reference: "Lip GYH, et al. Refining clinical risk stratification for stroke in atrial fibrillation using a novel risk factor-based approach. CHEST 2010;137:263-72.",
};
