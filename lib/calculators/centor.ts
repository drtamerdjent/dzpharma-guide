/**
 * Score de Centor modifié (McIsaac) — angine à streptocoque A vs virale.
 * Objectif : limiter la prescription d'antibiotiques (résistance).
 * Référence : McIsaac WJ et al., CMAJ 1998 ; recommandations HAS.
 */
import type { CalculatorAnswers, CalculatorDefinition, CalculatorOption } from "@/lib/dzpharma/types";

const AGE_OPTIONS: CalculatorOption[] = [
  { value: "3-14", label: "3 à 14 ans", points: 1 },
  { value: "15-44", label: "15 à 44 ans", points: 0 },
  { value: "45plus", label: "45 ans ou plus", points: -1 },
];

function bool(answers: CalculatorAnswers, id: string): boolean {
  return answers[id] === true;
}

export const CENTOR: CalculatorDefinition = {
  id: "centor",
  name: "Centor modifié",
  category: "Infectiologie",
  description:
    "Probabilité d'angine à streptocoque bêta-hémolytique du groupe A — antibiotique seulement si nécessaire.",
  indication:
    "Angine aiguë : fièvre + douleur pharyngée, sans signe de gravité.",
  questions: [
    {
      id: "fievre",
      label: "Température > 38 °C",
      type: "boolean",
    },
    {
      id: "absenceToux",
      label: "Absence de toux",
      help: "L'absence de toux oriente vers l'origine bactérienne.",
      type: "boolean",
    },
    {
      id: "adp",
      label: "Adénopathies cervicales antérieures sensibles",
      type: "boolean",
    },
    {
      id: "exsudat",
      label: "Exsudat ou hypertrophie amygdalienne",
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
    if (bool(answers, "fievre")) score += 1;
    if (bool(answers, "absenceToux")) score += 1;
    if (bool(answers, "adp")) score += 1;
    if (bool(answers, "exsudat")) score += 1;
    score += AGE_OPTIONS.find((o) => o.value === answers.age)?.points ?? 0;
    return score;
  },
  scoreSuffix: " / 4",
  interpretations: [
    {
      min: -1,
      max: 1,
      level: "green",
      title: "Angine virale probable",
      message:
        "Aucun antibiotique ni test rapide : traitement symptomatique simple (paracétamol, gargarismes, hydratation).",
      recommendation:
        "Antalgique-antipyrétique seul. Consignes de réconsultation si persistance au-delà de 3-4 jours.",
      suggestedDci: "PARACETAMOL",
      suggestedLabel: "Paracétamol (traitement symptomatique)",
    },
    {
      min: 2,
      max: 3,
      level: "orange",
      title: "TDR recommandé",
      message:
        "Test de diagnostic rapide (TDR) streptocoque A recommandé : l'antibiotique n'est prescrit que si le test est positif.",
      recommendation:
        "Pratiquer le TDR. Si positif : amoxicilline 6 jours (1re intention). Si négatif : traitement symptomatique.",
      suggestedDci: "AMOXICILLINE",
      suggestedLabel: "Amoxicilline (si TDR positif)",
    },
    {
      min: 4,
      max: 5,
      level: "red",
      title: "Streptocoque très probable",
      message:
        "Score maximal : TDR ou traitement empirique par amoxicilline — streptocoque A fortement probable.",
      recommendation:
        "TDR si disponible ; sinon amoxicilline orale 6 jours (100 mg/kg/j chez l'enfant, 2 g/j en 2 prises chez l'adulte).",
      suggestedDci: "AMOXICILLINE",
      suggestedLabel: "Amoxicilline (1re intention)",
    },
  ],
  reference: "McIsaac WJ, et al. Empirical validation of guidelines for the management of pharyngitis in children and adults. JAMA 2004;291:1587-95.",
};
