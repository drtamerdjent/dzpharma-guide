/**
 * CRB-65 — variante ambulatoire du CURB-65 (sans dosage d'urée),
 * utilisable au cabinet sans examen biologique.
 * Référence : BTS guidelines 2009.
 */
import type { CalculatorAnswers, CalculatorDefinition, CalculatorOption } from "@/lib/dzpharma/types";

const AGE_OPTIONS: CalculatorOption[] = [
  { value: "under65", label: "Moins de 65 ans", points: 0 },
  { value: "over65", label: "65 ans ou plus", points: 1 },
];

function bool(answers: CalculatorAnswers, id: string): boolean {
  return answers[id] === true;
}

export const CRB65: CalculatorDefinition = {
  id: "crb65",
  name: "CRB-65",
  category: "Pneumologie",
  description:
    "Version ambulatoire du CURB-65 sans biologie — décision rapide au cabinet.",
  indication:
    "Pneumonie communautaire vue au cabinet, avant d'engager une orientation.",
  questions: [
    {
      id: "confusion",
      label: "Confusion récente",
      help: "Désorientation temporo-spatiale d'apparition récente.",
      type: "boolean",
    },
    {
      id: "fr",
      label: "Fréquence respiratoire ≥ 30 / min",
      type: "boolean",
    },
    {
      id: "pa",
      label: "Hypotension",
      help: "PA systolique < 90 mmHg OU PA diastolique ≤ 60 mmHg.",
      type: "boolean",
    },
    {
      id: "age",
      label: "Âge",
      type: "choice",
      options: AGE_OPTIONS,
    },
  ],
  compute: (answers) => {
    let score = 0;
    if (bool(answers, "confusion")) score += 1;
    if (bool(answers, "fr")) score += 1;
    if (bool(answers, "pa")) score += 1;
    score += AGE_OPTIONS.find((o) => o.value === answers.age)?.points ?? 0;
    return score;
  },
  scoreSuffix: " / 4",
  interpretations: [
    {
      min: 0,
      max: 0,
      level: "green",
      title: "Faible risque",
      message:
        "Faible gravité — traitement à domicile possible si le contexte familial le permet.",
      recommendation:
        "Antibiothérapie orale (amoxicilline), conseils d'hydratation et consignes de retour immédiat en cas d'aggravation.",
      suggestedDci: "AMOXICILLINE",
      suggestedLabel: "Amoxicilline (1re intention ambulatoire)",
    },
    {
      min: 1,
      max: 2,
      level: "orange",
      title: "Risque intermédiaire",
      message:
        "Évaluation hospitalière recommandée (radiographie, SpO₂, biologie) avant de maintenir un traitement à domicile.",
      recommendation:
        "Orientation rapide vers une structure de soins pour évaluation complémentaire.",
      suggestedDci: "AMOXICILLINE",
      suggestedLabel: "Amoxicilline / Acide clavulanique",
    },
    {
      min: 3,
      max: 4,
      level: "red",
      title: "Risque élevé",
      message: "Hospitalisation urgente — pneumonie potentiellement sévère.",
      recommendation:
        "Transfert hospitalier immédiat, oxygénothérapie en route si SpO₂ basse.",
    },
  ],
  reference: "Lim WS, et al. BTS Guidelines for the Management of Community Acquired Pneumonia. Thorax 2009.",
};
