/**
 * Score d'Apgar — adaptation immédiate du nouveau-né (version simplifiée
 * pour le cabinet). Évaluer à la 1re minute puis refaire à la 5e minute.
 * Référence : Apgar V., Curr Res Anesth Analg 1952.
 */
import type { CalculatorAnswers, CalculatorDefinition, CalculatorOption } from "@/lib/dzpharma/types";

const COLORATION: CalculatorOption[] = [
  { value: "bleue", label: "Bleue ou pâle (corps entier)", points: 0 },
  { value: "acrocyanose", label: "Corps rose, extrémités bleues", points: 1 },
  { value: "rose", label: "Rose (corps entier)", points: 2 },
];

const RYTHME: CalculatorOption[] = [
  { value: "absent", label: "Absent", points: 0 },
  { value: "lent", label: "Lent (< 100 / min)", points: 1 },
  { value: "normal", label: "≥ 100 / min", points: 2 },
];

const GRIMACE: CalculatorOption[] = [
  { value: "aucune", label: "Aucune réponse", points: 0 },
  { value: "grimace", label: "Grimace seulement", points: 1 },
  { value: "vive", label: "Tousse, éternue, crie", points: 2 },
];

const TONUS: CalculatorOption[] = [
  { value: "mou", label: "Flasque (hypotonie complète)", points: 0 },
  { value: "flexion", label: "Flexion des extrémités", points: 1 },
  { value: "actif", label: "Mouvements actifs", points: 2 },
];

const RESPIRATION: CalculatorOption[] = [
  { value: "absente", label: "Absente", points: 0 },
  { value: "lente", label: "Lente, irrégulière", points: 1 },
  { value: "bonne", label: "Bonne, cri vigoureux", points: 2 },
];

export const APGAR: CalculatorDefinition = {
  id: "apgar",
  name: "Score d'Apgar",
  category: "Pédiatrie",
  description:
    "Adaptation extra-utérine du nouveau-né — 5 items notés 0, 1 ou 2 (à 1 et 5 minutes).",
  indication:
    "À la naissance, à la 1re minute puis à la 5e minute (et 10 min si < 7).",
  questions: [
    { id: "coloration", label: "Coloration", type: "choice", options: COLORATION },
    { id: "rythme", label: "Rythme cardiaque", type: "choice", options: RYTHME },
    { id: "grimace", label: "Réactivité aux stimuli (grimace)", type: "choice", options: GRIMACE },
    { id: "tonus", label: "Tonus musculaire", type: "choice", options: TONUS },
    { id: "respiration", label: "Respiration", type: "choice", options: RESPIRATION },
  ],
  compute: (answers) => {
    const points = (options: CalculatorOption[], value: unknown) =>
      options.find((o) => o.value === value)?.points ?? 0;
    return (
      points(COLORATION, answers.coloration) +
      points(RYTHME, answers.rythme) +
      points(GRIMACE, answers.grimace) +
      points(TONUS, answers.tonus) +
      points(RESPIRATION, answers.respiration)
    );
  },
  scoreSuffix: " / 10",
  interpretations: [
    {
      min: 7,
      max: 10,
      level: "green",
      title: "Nouveau-né vigoureux",
      message:
        "Adaptation normale — soins de routine : peau à peau, séchage, surveillance simple auprès de la mère.",
      recommendation:
        "Réévaluer à la 5e minute. Allaitement précoce si état stable.",
    },
    {
      min: 4,
      max: 6,
      level: "orange",
      title: "Asphyxie modérée",
      message:
        "Dépression néonatale modérée — l'enfant a besoin d'une aide immédiate.",
      recommendation:
        "Séchage + stimulation, désobstruction nasale, oxygène si SpO₂ basse, réévaluation toutes les 5 minutes.",
    },
    {
      min: 0,
      max: 3,
      level: "red",
      title: "Asphyxie sévère",
      message:
        "Détresse néonatale grave — réanimation néonatale immédiate, minute par minute.",
      recommendation:
        "Protocole de réanimation néonatale : voies aériennes, ventilation au masque (ambu), si besoin massage cardiaque ; transfert néonatal.",
    },
  ],
  reference: "Apgar V. A proposal for a new method of evaluation of the newborn infant. Curr Res Anesth Analg 1952;32:260-7.",
};
