/**
 * Échelle EVA / EN — intensité de la douleur (0-10) et palier antalgique OMS.
 * Référence : OMS — paliers analgésiques (1986, actualisés).
 */
import type { CalculatorAnswers, CalculatorDefinition } from "@/lib/dzpharma/types";

export const EVA: CalculatorDefinition = {
  id: "eva",
  name: "Échelle EVA / EN",
  category: "Douleur",
  description:
    "Intensité de la douleur 0-10 et orientation du palier antalgique OMS.",
  indication:
    "Évaluation systématique de toute douleur déclarée par le patient (4e signe vital).",
  questions: [
    {
      id: "douleur",
      label: "Intensité de la douleur",
      help: "0 = pas de douleur, 10 = douleur maximale imaginable.",
      type: "number",
      min: 0,
      max: 10,
      step: 1,
      unit: "/ 10",
      slider: true,
      sliderLabels: ["Aucune douleur", "Douleur maximale"],
    },
  ],
  compute: (answers) => {
    const value = Number(answers.douleur);
    return Number.isFinite(value) ? value : 0;
  },
  scoreSuffix: " / 10",
  interpretations: [
    {
      min: 0,
      max: 3,
      level: "green",
      title: "Douleur légère",
      message:
        "Douleur légère (EVA ≤ 3) — antalgie de palier I de l'OMS.",
      recommendation:
        "Paracétamol en première intention (± AINS selon le terrain). Réévaluer après 24-48 h.",
      suggestedDci: "PARACETAMOL",
      suggestedLabel: "Paracétamol (palier I)",
    },
    {
      min: 4,
      max: 6,
      level: "orange",
      title: "Douleur modérée",
      message:
        "Douleur modérée (EVA 4-6) — palier II : association paracétamol-opioïde faible.",
      recommendation:
        "Paracétamol-codéine ou tramadol, en poursuivant le palier I. Réévaluer l'efficacité à 24 h et rechercher la cause.",
      suggestedDci: "TRAMADOL",
      suggestedLabel: "Tramadol (palier II)",
    },
    {
      min: 7,
      max: 10,
      level: "red",
      title: "Douleur sévère",
      message:
        "Douleur sévère (EVA ≥ 7) — palier III : morphinique fort, ne pas attendre pour traiter.",
      recommendation:
        "Morphine orale/SC (titration), avis médical, recherche étiologique systématique. Réévaluer l'antalgie toutes les 4 h.",
      suggestedDci: "MORPHINE",
      suggestedLabel: "Morphine (palier III)",
    },
  ],
  reference: "OMS — Cancer pain relief, 1986 ; SFAR/SFETD — recommandations antalgie.",
};
