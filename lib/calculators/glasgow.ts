/**
 * Score de Glasgow (GCS) — évaluation rapide de la profondeur d'un coma.
 * Référence : Teasdale G, Jennett B., Lancet 1974.
 */
import type { CalculatorAnswers, CalculatorDefinition, CalculatorOption } from "@/lib/dzpharma/types";

const YEUX: CalculatorOption[] = [
  { value: "spontane", label: "Ouverture spontanée", points: 4 },
  { value: "parole", label: "À la parole", points: 3 },
  { value: "douleur", label: "À la douleur", points: 2 },
  { value: "aucune", label: "Aucune ouverture", points: 1 },
];

const VERBAL: CalculatorOption[] = [
  { value: "orientee", label: "Orientée, conversationnelle", points: 5 },
  { value: "confuse", label: "Confuse", points: 4 },
  { value: "inappropriee", label: "Mots inappropriés", points: 3 },
  { value: "incomprehensible", label: "Sons incompréhensibles", points: 2 },
  { value: "aucune", label: "Aucune réponse", points: 1 },
];

const MOTRICE: CalculatorOption[] = [
  { value: "obey", label: "Obéit aux ordres simples", points: 6 },
  { value: "localise", label: "Localise la douleur", points: 5 },
  { value: "evite", label: "Évite la douleur (retrait)", points: 4 },
  { value: "decortication", label: "Flexion anormale (décortication)", points: 3 },
  { value: "decerebration", label: "Extension anormale (décérébration)", points: 2 },
  { value: "aucune", label: "Aucune réponse", points: 1 },
];

export const GLASGOW: CalculatorDefinition = {
  id: "glasgow",
  name: "Score de Glasgow",
  category: "Neurologie",
  description:
    "Évalue la profondeur d'une altération de conscience (traumatisme, coma, AVC).",
  indication:
    "Tout patient avec trouble de conscience — 3 items : ouverture des yeux, réponse verbale, réponse motrice.",
  questions: [
    { id: "yeux", label: "Ouverture des yeux", type: "choice", options: YEUX },
    { id: "verbal", label: "Réponse verbale", type: "choice", options: VERBAL },
    { id: "motrice", label: "Réponse motrice", type: "choice", options: MOTRICE },
  ],
  compute: (answers) => {
    const points = (options: CalculatorOption[], value: unknown) =>
      options.find((o) => o.value === value)?.points ?? 0;
    return (
      points(YEUX, answers.yeux) + points(VERBAL, answers.verbal) + points(MOTRICE, answers.motrice)
    );
  },
  scoreSuffix: " / 15",
  interpretations: [
    {
      min: 13,
      max: 15,
      level: "green",
      title: "Conscience normale ou altération légère",
      message:
        "Traumatisme crânien léger (13-15) — surveillance simple avec consignes de retour.",
      recommendation:
        "Surveillance de la vigilance toutes les 2-4 h ; scanner cérébral si signes de focalisation, vomissements répétés ou traitement anticoagulant.",
    },
    {
      min: 9,
      max: 12,
      level: "orange",
      title: "Coma modéré",
      message:
        "Altération significative de la conscience (traumatisme modéré) — hospitalisation nécessaire.",
      recommendation:
        "Hospitalisation, imagerie cérébrale, surveillance rapprochée du score toutes les heures.",
    },
    {
      min: 3,
      max: 8,
      level: "red",
      title: "Coma sévère (GCS ≤ 8)",
      message:
        "Coma profond — risque d'inhalation : protection des voies aériennes indispensable.",
      recommendation:
        "Libérer les voies aériennes, oxygène, appel immédiat (SAMU/112), intubation-ventilation si GCS ≤ 8, transfert en réanimation.",
    },
  ],
  reference: "Teasdale G, Jennett B. Assessment of coma and impaired consciousness. Lancet 1974;2:81-4.",
};
