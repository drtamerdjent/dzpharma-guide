/**
 * HAS-BLED — risque hémorragique sous anticoagulant oral.
 * Indispensable chez les patients sous Coumadine® / Previscan® (AVK),
 * très prescrits en Algérie. Référence : Pisters R et al., Chest 2010.
 */
import type { CalculatorAnswers, CalculatorDefinition } from "@/lib/dzpharma/types";

function bool(answers: CalculatorAnswers, id: string): boolean {
  return answers[id] === true;
}

export const HASBLED: CalculatorDefinition = {
  id: "hasbled",
  name: "HAS-BLED",
  category: "Hémostase",
  description:
    "Quantifie le risque hémorragique majeur sous AVK (Coumadine®/Previscan®) ou AOD.",
  indication:
    "Patient sous anticoagulant oral (fibrillation auriculaire, MVP…) — à recouper avec le CHA₂DS₂-VASc.",
  questions: [
    {
      id: "hta",
      label: "Hypertension non contrôlée",
      help: "PA systolique > 160 mmHg sous traitement.",
      type: "boolean",
    },
    {
      id: "renal",
      label: "Fonction rénale anormale",
      help: "Dialyse, transplantation rénale ou créatinine ≥ 200 µmol/L.",
      type: "boolean",
    },
    {
      id: "hepatic",
      label: "Fonction hépatique anormale",
      help: "Cirrhose ou bilirubine > 2× la normale avec transaminases > 3× la normale.",
      type: "boolean",
    },
    {
      id: "avc",
      label: "AVC antérieur",
      type: "boolean",
    },
    {
      id: "saignement",
      label: "Saignement antérieur ou prédisposition",
      help: "Antécédent hémorragique, anémie ou diathèse hémorragique.",
      type: "boolean",
    },
    {
      id: "inr",
      label: "INR labile",
      help: "INR instable / temps dans la cible (TTR) < 60 % sous AVK.",
      type: "boolean",
    },
    {
      id: "age65",
      label: "Âge > 65 ans",
      type: "boolean",
    },
    {
      id: "medicaments",
      label: "Traitements prédisposants",
      help: "Antiagrégant (aspirine, clopidogrel) ou AINS en cours.",
      type: "boolean",
    },
    {
      id: "alcool",
      label: "Consommation d'alcool",
      help: "≥ 8 unités d'alcool par semaine.",
      type: "boolean",
    },
  ],
  compute: (answers) => {
    const ids = ["hta", "renal", "hepatic", "avc", "saignement", "inr", "age65", "medicaments", "alcool"];
    return ids.reduce((score, id) => score + (bool(answers, id) ? 1 : 0), 0);
  },
  scoreSuffix: " / 9",
  interpretations: [
    {
      min: 0,
      max: 1,
      level: "green",
      title: "Risque hémorragique faible",
      message:
        "Risque faible (saignement majeur ≈ 1,1 / 100 patients-an) — l'anticoagulation peut être conduite normalement.",
      recommendation:
        "Surveillance annuelle des facteurs de risque hémorragique et contrôle régulier de l'INR (cible 2-3).",
    },
    {
      min: 2,
      max: 2,
      level: "orange",
      title: "Risque hémorragique modéré",
      message:
        "L'anticoagulation reste indiquée si le risque thrombotique prédomine (voir CHA₂DS₂-VASc), mais sous surveillance rapprochée.",
      recommendation:
        "Corriger les facteurs réversibles (HTA, AINS, alcool), contrôle mensuel de l'INR, éducation du patient aux signes de saignement.",
    },
    {
      min: 3,
      max: 9,
      level: "red",
      title: "Risque hémorragique élevé",
      message:
        "≥ 3 points : saignement majeur ≈ 5 / 100 patients-an. Prudence majeure — corriger chaque facteur réversible plutôt que renoncer à l'anticoagulation.",
      recommendation:
        "Réévaluer le bénéfice/risque, corriger HTA/AINS/alcool/INR labile, surveillance rapprochée (INR mensuel, NFS, créatinine) et contrôle à 1 mois.",
    },
  ],
  reference: "Pisters R, et al. A clinical scoring system to identify patients with atrial fibrillation at high risk of major bleeding. Chest 2010;138:1093-100.",
};
