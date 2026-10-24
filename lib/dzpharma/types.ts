/**
 * DzPharma Guide — types partagés des fonctionnalités « outils cliniques »
 * (les 4 briques Premium différenciantes) :
 *
 *   1. Bot Telegram « DzPharma Express » → types dédiés dans src/lib/telegram-bot.ts
 *   2. Calculateurs de scores cliniques adaptés à la pratique algérienne
 *   3. Calculatrice posologique pédiatrique (sirops disponibles localement)
 *   4. Vérificateur d'interactions médicamenteuses (génériques locaux)
 *
 * Chaque score clinique est décrit de manière déclarative (CalculatorDefinition)
 * : le moteur générique de rendu (components/calculators/calculator-runner.tsx)
 * n'a alors AUCUNE connaissance médicale codée en dur.
 */

/* ------------------------------------------------------------------ */
/* 2. Scores cliniques                                                 */
/* ------------------------------------------------------------------ */

/** Niveau d'alerte → vert / orange / rouge (cohérent avec les badges CNAS). */
export type SeverityLevel = "green" | "orange" | "red";

export type CalculatorCategory =
  | "Pneumologie"
  | "Cardiologie"
  | "Hémostase"
  | "Angiologie"
  | "Neurologie"
  | "Pédiatrie"
  | "Infectiologie"
  | "Douleur";

/** Une option de réponse pondérée (ex : « 65-74 ans » → 1 point). */
export interface CalculatorOption {
  value: string;
  label: string;
  points: number;
}

/** Question d'un score clinique — rendue par le moteur générique. */
export interface CalculatorQuestion {
  id: string;
  label: string;
  /** Précision clinique affichée en sous-texte (ex : « urée > 7 mmol/L »). */
  help?: string;
  type: "boolean" | "choice" | "number";
  /** Obligatoire pour type="choice". */
  options?: CalculatorOption[];
  /** Pour type="number". */
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
  /** true → rendu Slider (mobile-first) au lieu d'une saisie clavier. */
  slider?: boolean;
  /** Libellés d'extrémités d'échelle (ex : EVA « Aucune douleur » → « Max »). */
  sliderLabels?: [string, string];
}

export type CalculatorAnswer = boolean | string | number | null;
export type CalculatorAnswers = Record<string, CalculatorAnswer>;

/** Interprétation d'un intervalle de score. */
export interface ScoreInterpretation {
  /** Borne inférieure inclusive. */
  min: number;
  /** Borne supérieure inclusive (mettre une borne large, ex : 999). */
  max: number;
  level: SeverityLevel;
  title: string;
  message: string;
  /** Conduite à tenir pratique. */
  recommendation?: string;
  /** DCI pré-remplie pour le bouton « Trouver le traitement recommandé ». */
  suggestedDci?: string;
  /** Libellé lisible de la suggestion (ex : « Amoxicilline / Acide clavulanique »). */
  suggestedLabel?: string;
}

/** Définition déclarative complète d'un score clinique. */
export interface CalculatorDefinition {
  id: string;
  name: string;
  category: CalculatorCategory;
  /** Une ligne — affichée sur les cartes du hub. */
  description: string;
  /** Quand utiliser ce score (contexte clinique). */
  indication: string;
  questions: CalculatorQuestion[];
  /** Calcule le score à partir des réponses (toutes répondues → entier/décimal). */
  compute: (answers: CalculatorAnswers) => number;
  /** Suffixe d'affichage du score (ex : " / 15", " %"). */
  scoreSuffix?: string;
  interpretations: ScoreInterpretation[];
  /** Référence bibliographique affichée sous le résultat. */
  reference: string;
}

/** Retourne l'interprétation correspondant au score (dernier intervalle par défaut). */
export function interpretScore(
  definition: CalculatorDefinition,
  score: number
): ScoreInterpretation {
  const band = definition.interpretations.find(
    (range) => score >= range.min && score <= range.max
  );
  return band ?? definition.interpretations[definition.interpretations.length - 1];
}

/** Vrai lorsque toutes les questions du score ont une réponse. */
export function areAllQuestionsAnswered(
  questions: CalculatorQuestion[],
  answers: CalculatorAnswers
): boolean {
  return questions.every((question) => {
    const value = answers[question.id];
    if (question.type === "boolean") return typeof value === "boolean";
    if (question.type === "choice")
      return typeof value === "string" && value.length > 0;
    return typeof value === "number" && Number.isFinite(value);
  });
}

/* ------------------------------------------------------------------ */
/* 3. Calculatrice pédiatrique                                         */
/* ------------------------------------------------------------------ */

/** Une spécialité pédiatrique locale (sirop/suspension) et sa concentration. */
export interface PediatricLocalForm {
  /** Nom de marque tel que trouvé en officine algérienne (ex : DOLIPRANE SIROP). */
  brand: string;
  /** Concentration en mg/mL (ex : 24 pour un sirop à 2,4 % = 2,4 g/100 mL). */
  concentration_mg_ml: number;
  /** Précision facultative (ex : « 250 mg / 5 mL »). */
  note?: string;
}

/**
 * Config posologique d'une molécule pédiatrique (MVP : tableau codé en dur,
 * à valider contre le ROTH/vidal local avant toute utilisation réelle).
 */
export interface PediatricDrug {
  dci: string;
  doseMin_mg_kg: number;
  doseMax_mg_kg: number;
  /**
   * "per_intake" : doses exprimées PAR PRISE (paracétamol 10-15 mg/kg/prise).
   * "per_day"    : doses exprimées PAR JOUR, à répartir (amoxicilline 50-80 mg/kg/j).
   */
  doseBasis: "per_intake" | "per_day";
  /** Libellé de fréquence affiché (ex : « Toutes les 6 heures »). */
  freq: string;
  intakesPerDay: number;
  localForms: PediatricLocalForm[];
  /** Garde-fou : dose maximale ADULTE par prise (mg) → alerte rouge si dépassée. */
  adultMaxSingleDose_mg: number;
  /** Garde-fou : dose maximale ADULTE journalière (mg). */
  adultMaxDailyDose_mg: number;
  /** Mise en garde clinique spécifique affichée en ambre. */
  caution?: string;
}

/** Volume par prise calculé pour une spécialité locale donnée. */
export interface PediatricFormDose {
  form: PediatricLocalForm;
  /** Volume exact en mL (borne basse / haute de la plage de dose). */
  mlMin: number;
  mlMax: number;
  /** Volume « pratique » arrondi au 0,25 mL (seringue graduée). */
  mlMinPractical: number;
  mlMaxPractical: number;
}

export interface PediatricDoseResult {
  weightKg: number;
  /** Dose par prise (mg) — pour doseBasis="per_day", dose journalière ÷ prises. */
  mgPerIntakeMin: number;
  mgPerIntakeMax: number;
  mgPerDayMin: number;
  mgPerDayMax: number;
  /** true → la plage calculée dépasse la dose maximale adulte (alerte rouge). */
  exceedsAdultMax: boolean;
  /** « par prise » ou « journalière » — partie de la posologie en cause. */
  exceedsAdultMaxBasis?: "par prise" | "journalière";
  formDoses: PediatricFormDose[];
}

/* ------------------------------------------------------------------ */
/* 4. Interactions médicamenteuses                                     */
/* ------------------------------------------------------------------ */

/** Sévérité d'une interaction (GREEN est généré quand aucune n'est trouvée). */
export type InteractionSeverity = "RED" | "ORANGE" | "YELLOW";

/**
 * Une interaction critique entre deux DCI. Les tableaux d'alias couvrent les
 * marques algériennes (COUMADINE, DAKTARINE, KLACID…) et les classes
 * thérapeutiques (AINS, IEC, AVK…) pour un matching pragmatique au cabinet.
 */
export interface DrugInteraction {
  id: string;
  drug1: string;
  aliases1: string[];
  drug2: string;
  aliases2: string[];
  severity: InteractionSeverity;
  /** Mécanisme pharmacologique (visible gratuitement — vocation pédagogique). */
  mechanism: string;
  /** Conduite à tenir (CONTENU PREMIUM). */
  recommendation: string;
  /** Alternatives thérapeutiques locales (CONTENU PREMIUM). */
  alternatives?: string[];
  source?: string;
}
