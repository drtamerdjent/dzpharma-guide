/**
 * Score de Wells — probabilité clinique d'embolie pulmonaire.
 * Référence : Wells PS et al., Ann Intern Med 2001 (three-tier).
 */
import type { CalculatorAnswers, CalculatorDefinition } from "@/lib/dzpharma/types";

function bool(answers: CalculatorAnswers, id: string): boolean {
  return answers[id] === true;
}

export const WELLS: CalculatorDefinition = {
  id: "wells",
  name: "Score de Wells",
  category: "Angiologie",
  description:
    "Probabilité clinique d'embolie pulmonaire et stratégie diagnostique (D-dimères vs angio-TDM).",
  indication:
    "Suspicion clinique d'embolie pulmonaire (dyspnée brutale, douleur thoracique, tachycardie).",
  questions: [
    {
      id: "tvp",
      label: "Signes cliniques de thrombose veineuse profonde",
      help: "Douleur et œdème unilatéral d'un membre inférieur.",
      type: "boolean",
    },
    {
      id: "epProbable",
      label: "L'EP est le diagnostic le plus probable",
      help: "Jugement clinique global du médecin.",
      type: "boolean",
    },
    {
      id: "fc",
      label: "Fréquence cardiaque > 100 / min",
      type: "boolean",
    },
    {
      id: "immobilisation",
      label: "Immobilisation ≥ 3 jours ou chirurgie < 4 semaines",
      type: "boolean",
    },
    {
      id: "atcd",
      label: "TVP ou EP antérieure documentée",
      type: "boolean",
    },
    {
      id: "hemoptysie",
      label: "Hémoptysie",
      type: "boolean",
    },
    {
      id: "malignite",
      label: "Cancer actif",
      help: "Traitement en cours (< 6 mois) ou soins palliatifs.",
      type: "boolean",
    },
  ],
  compute: (answers) => {
    let score = 0;
    if (bool(answers, "tvp")) score += 3;
    if (bool(answers, "epProbable")) score += 3;
    if (bool(answers, "fc")) score += 1.5;
    if (bool(answers, "immobilisation")) score += 1.5;
    if (bool(answers, "atcd")) score += 1.5;
    if (bool(answers, "hemoptysie")) score += 1;
    if (bool(answers, "malignite")) score += 1;
    return score;
  },
  interpretations: [
    {
      min: 0,
      max: 1,
      level: "green",
      title: "Probabilité faible (< 3 %)",
      message:
        "Probabilité clinique faible — doser les D-dimères ; s'ils sont négatifs, l'embolie pulmonaire est exclue.",
      recommendation:
        "D-dimères en première intention. Angio-TDM seulement si les D-dimères sont positifs.",
    },
    {
      min: 1.5,
      max: 6,
      level: "orange",
      title: "Probabilité intermédiaire",
      message:
        "Probabilité intermédiaire — D-dimères puis angio-TDM thoracique si positifs. Anticoagulation en attente si la suspicion reste forte.",
      recommendation:
        "Doser les D-dimères. En cas de positivité (ou de suspicion persistante), angio-TDM. Instaurer une HBPM en attente si le terrain est évocateur.",
      suggestedDci: "ENOXAPARINE",
      suggestedLabel: "HBPM (énoxaparine) — traitement d'attente",
    },
    {
      min: 6.5,
      max: 99,
      level: "red",
      title: "Probabilité forte (> 40 %)",
      message:
        "Probabilité forte — angio-TDM thoracique d'emblée, sans attendre les D-dimères. Commencer l'anticoagulation curative en attente.",
      recommendation:
        "Anticoagulation curative immédiate (HBPM à dose curative), angio-TDM thoracique en urgence, hospitalisation.",
      suggestedDci: "ENOXAPARINE",
      suggestedLabel: "HBPM (énoxaparine) — dose curative",
    },
  ],
  reference: "Wells PS, et al. Derivation of a simple clinical model to categorize patients probability of pulmonary embolism. Ann Intern Med 2001;135:984-93.",
};
