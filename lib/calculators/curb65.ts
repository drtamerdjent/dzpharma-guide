/**
 * CURB-65 — sévérité de la pneumonie aiguë communautaire.
 * Référence : Lim WS et al., Thorax 2003 (BTS).
 */
import type { CalculatorAnswers, CalculatorDefinition, CalculatorOption } from "@/lib/dzpharma/types";

const AGE_OPTIONS: CalculatorOption[] = [
  { value: "under65", label: "Moins de 65 ans", points: 0 },
  { value: "over65", label: "65 ans ou plus", points: 1 },
];

function bool(answers: CalculatorAnswers, id: string): boolean {
  return answers[id] === true;
}

export const CURB65: CalculatorDefinition = {
  id: "curb65",
  name: "CURB-65",
  category: "Pneumologie",
  description:
    "Évalue la sévérité d'une pneumonie communautaire et oriente le lieu de prise en charge.",
  indication:
    "Tout patient présentant une pneumonie aiguë communautaire confirmée.",
  questions: [
    {
      id: "confusion",
      label: "Confusion récente",
      help: "Désorientation dans le temps ou dans l'espace, d'apparition récente.",
      type: "boolean",
    },
    {
      id: "uree",
      label: "Urée > 7 mmol/L",
      help: "Urée sanguine (BUN > 20 mg/dL). Si non disponible, utilisez le CRB-65.",
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
    if (bool(answers, "uree")) score += 1;
    if (bool(answers, "fr")) score += 1;
    if (bool(answers, "pa")) score += 1;
    score += AGE_OPTIONS.find((o) => o.value === answers.age)?.points ?? 0;
    return score;
  },
  scoreSuffix: " / 5",
  interpretations: [
    {
      min: 0,
      max: 1,
      level: "green",
      title: "Faible sévérité",
      message:
        "Pneumonie de faible gravité — le traitement ambulatoire est habituellement approprié.",
      recommendation:
        "Antibiothérapie orale en première intention, hydratation, réévaluation clinique à 48-72 h.",
      suggestedDci: "AMOXICILLINE",
      suggestedLabel: "Amoxicilline (1re intention ambulatoire)",
    },
    {
      min: 2,
      max: 2,
      level: "orange",
      title: "Sévérité intermédiaire",
      message:
        "Risque intermédiaire — hospitalisation courte ou prise en charge encadrée à envisager.",
      recommendation:
        "Envisager Amoxicilline/Acide clavulanique, évaluer l'oxygénation (SpO₂) et le contexte socio-familial avant une prise en charge ambulatoire renforcée.",
      suggestedDci: "AMOXICILLINE",
      suggestedLabel: "Amoxicilline / Acide clavulanique",
    },
    {
      min: 3,
      max: 5,
      level: "red",
      title: "Pneumonie sévère",
      message:
        "Risque élevé de mortalité — hospitalisation urgente, évaluer un transfert en réanimation.",
      recommendation:
        "Antibiothérapie IV sans délai (amoxicilline/acide clavulanique ± macrolide), oxygénothérapie, bilan infectieux complet, surveillance continue.",
      suggestedDci: "AMOXICILLINE",
      suggestedLabel: "Amoxicilline / Acide clavulanique (IV)",
    },
  ],
  reference: "Lim WS, et al. Defining community acquired pneumonia severity on presentation to hospital. Thorax 2003;58:377-82.",
};
