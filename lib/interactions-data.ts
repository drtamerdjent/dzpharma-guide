/**
 * DzPharma Guide — base des interactions médicamenteuses critiques (MVP).
 *
 * 18 associations ciblant les génériques les plus prescrits en Algérie :
 * AVK (Coumadine®/Previscan®), AINS, IEC, statines, metformine, digoxine…
 * Les alias couvrent les marques locales ET les classes thérapeutiques.
 *
 * Sources : Thésaurus des interactions médicamenteuses (ANSM), ROTH-BPC.
 * ⚠️ Base non exhaustive — à faire valider par un pharmacologue avant prod.
 */
import type { DrugInteraction } from "@/lib/dzpharma/types";

export const DRUG_INTERACTIONS: DrugInteraction[] = [
  {
    id: "avk-miconazole",
    drug1: "WARFARINE",
    aliases1: ["COUMADINE", "PREVISCAN", "FLUINDIONE", "AVK", "ACENOCOUMAROL", "WARFARINE"],
    drug2: "MICONAZOLE",
    aliases2: ["DAKTARIN", "DAKTARINE", "LORAMYC", "MICONAZOLE", "GEL BUCCAL MICONAZOLE"],
    severity: "RED",
    mechanism:
      "Inhibition du CYP2C9 par le miconazole, y compris en gel buccal : majoration marquée de l'effet anticoagulant, risque hémorragique majeur.",
    recommendation:
      "Éviter l'association. Si elle est indispensable, contrôler l'INR très étroitement (48-72 h après l'instauration) et réduire la dose d'AVK. Privilégier le paracétamol pour la douleur.",
    alternatives: [
      "Nystatine en suspension locale (résorption quasi nulle)",
      "Amphotéricine B locale selon l'indication",
    ],
    source: "Thésaurus ANSM — AVK × antimycotiques azolés",
  },
  {
    id: "clarithro-simva",
    drug1: "CLARITHROMYCINE",
    aliases1: ["KLACID", "CLARITHROMYCINE", "MACROLIDE"],
    drug2: "SIMVASTATINE",
    aliases2: ["ZOSTINE", "SIMVASTATINE", "SIMVA"],
    severity: "RED",
    mechanism:
      "Inhibition du CYP3A4 par la clarithromycine : élévation brutale des concentrations de simvastatine, risque accru de myopathie et de rhabdomyolyse.",
    recommendation:
      "Contre-indiqué. Suspendre la statine pendant le traitement par macrolide, ou choisir un antibiotique sans interaction. Prévenir le patient de toute douleur musculaire inexpliquée.",
    alternatives: [
      "Azithromycine (pas d'inhibition significative du CYP3A4)",
      "Amoxicilline / amoxicilline-acide clavulanique selon l'indication",
    ],
    source: "Thésaurus ANSM — statines × macrolides",
  },
  {
    id: "metformine-contraste",
    drug1: "METFORMINE",
    aliases1: ["GLUCOPHAGE", "STAGMET", "METFORMINE", "GLUCOVANCE"],
    drug2: "PRODUIT DE CONTRASTE IODE",
    aliases2: ["CONTRASTE IODE", "PRODUIT DE CONTRASTE", "IOHEXOL", "IOBITRIDOL", "IOMERON", "IOPAMIDOL"],
    severity: "ORANGE",
    mechanism:
      "Produit de contraste iodé : risque d'insuffisance rénale aiguë pouvant entraîner une accumulation de metformine et une acidose lactique.",
    recommendation:
      "Suspendre la metformine le jour de l'examen et pendant les 48 h suivantes ; ne reprendre qu'après contrôle de la fonction rénale. Assurer une bonne hydratation avant et après l'examen.",
    source: "Thésaurus ANSM — biguanides × produits de contraste iodés",
  },
  {
    id: "ains-iec",
    drug1: "IBUPROFENE",
    aliases1: ["AINS", "IBUPROFENE", "BRUFEN", "ADVIL", "ANTARENE", "KETOPROFENE", "PROFENID", "DICLOFENAC", "VOLTARENE", "NAPROXENE", "ASPIRINE"],
    drug2: "LISINOPRIL",
    aliases2: ["IEC", "LISINOPRIL", "ZESTRIL", "ENALAPRIL", "RENITEC", "CAPTOPRIL", "TRIATEC", "RAMIPRIL", "CARDACE", "PERINDOPRIL", "COVERSYL"],
    severity: "ORANGE",
    mechanism:
      "L'AINS bloque l'effet vasodilatateur des prostaglandines rénales : diminution de l'effet antihypertenseur de l'IEC et risque d'insuffisance rénale aiguë (aggravé si diurétique associé — « triple whammy »).",
    recommendation:
      "Limiter l'AINS à quelques jours au maximum, surveiller créatinine, kaliémie et tension. Préférer le paracétamol comme antalgique chez l'hypertendu traité.",
    alternatives: ["Paracétamol (antalgique de choix chez l'hypertendu)"],
    source: "Thésaurus ANSM — AINS × IEC",
  },
  {
    id: "paracetamol-avk",
    drug1: "PARACETAMOL",
    aliases1: ["PARACETAMOL", "DOLIPRANE", "DOLI-BIEN", "EFFERALGAN", "PANADOL", "DAFALGAN"],
    drug2: "WARFARINE",
    aliases2: ["COUMADINE", "PREVISCAN", "FLUINDIONE", "AVK", "ACENOCOUMAROL", "WARFARINE"],
    severity: "YELLOW",
    mechanism:
      "Le paracétamol à forte dose (≥ 2 g/jour) et de façon prolongée peut majorer l'INR sous AVK (mécanisme mal élucidé, implication du métabolisme de la vitamine K).",
    recommendation:
      "Le paracétamol reste l'antalgique de choix chez le patient sous AVK, mais limiter à 2 g/jour si cure prolongée et contrôler l'INR après quelques jours de traitement.",
    source: "Thésaurus ANSM — AVK × paracétamol",
  },
  {
    id: "cipro-theophylline",
    drug1: "CIPROFLOXACINE",
    aliases1: ["CIPROFLOXACINE", "CIFLOX", "CIPROXIN", "FLUOROQUINOLONE"],
    drug2: "THEOPHYLLINE",
    aliases2: ["THEOPHYLLINE", "THEOSTAT", "DILATRANCE AP", "THEOPHYLLINE LP"],
    severity: "ORANGE",
    mechanism:
      "Inhibition du CYP1A2 par la ciprofloxacine : accumulation de théophylline (nausées, tachycardie, tremblements, risque de convulsions).",
    recommendation:
      "Réduire la dose de théophylline d'environ 50 % pendant le traitement, surveiller cliniquement (nausées, tachycardie) et contrôler la théophyllinémie si possible. Sinon, changer d'antibiotique.",
    alternatives: ["Amoxicilline-acide clavulanique selon l'indication"],
    source: "Thésaurus ANSM — théophylline × fluoroquinolones",
  },
  {
    id: "spiro-iec",
    drug1: "SPIRONOLACTONE",
    aliases1: ["SPIRONOLACTONE", "ALDACTONE"],
    drug2: "ENALAPRIL",
    aliases2: ["IEC", "ENALAPRIL", "RENITEC", "LISINOPRIL", "ZESTRIL", "CAPTOPRIL", "RAMIPRIL", "CARDACE", "PERINDOPRIL", "COVERSYL"],
    severity: "ORANGE",
    mechanism:
      "Association hyperkaliémante : l'IEC diminue l'aldostérone et la spironolactone épargne le potassium — risque d'hyperkaliémie, surtout si insuffisance rénale ou diabète.",
    recommendation:
      "Contrôler la kaliémie et la créatinine à 1 semaine puis régulièrement. Ne pas associer de suppléments de potassium. Contre-indiquée si clairance < 30 mL/min.",
    source: "Thésaurus ANSM — IEC × antialdostérone",
  },
  {
    id: "fluox-tramadol",
    drug1: "FLUOXETINE",
    aliases1: ["FLUOXETINE", "PROZAC"],
    drug2: "TRAMADOL",
    aliases2: ["TRAMADOL", "CONTRAMAL", "TOPLAGIC"],
    severity: "RED",
    mechanism:
      "Synergie sérotoninergique : risque de syndrome sérotoninergique (agitation, myoclonies, hyperthermie, tremblements, diarrhée).",
    recommendation:
      "Éviter l'association. Si elle est inévitable : dose minimale de tramadol et surveillance rapprochée. Préférer un autre antalgique chez le patient traité par ISRS.",
    alternatives: ["Paracétamol ± codéine selon le niveau de douleur"],
    source: "Thésaurus ANSM — ISRS × tramadol",
  },
  {
    id: "omeprazole-clopidogrel",
    drug1: "OMEPRAZOLE",
    aliases1: ["OMEPRAZOLE", "MOPRAL", "ZOLTUM", "OMEPRAL", "IPP"],
    drug2: "CLOPIDOGREL",
    aliases2: ["CLOPIDOGREL", "PLAVIX"],
    severity: "ORANGE",
    mechanism:
      "L'oméprazole inhibe le CYP2C19 et réduit l'activation du clopidogrel : perte partielle de l'effet antiagrégant, risque thrombotique majoré.",
    recommendation:
      "Préférer un IPP peu inhibiteur du CYP2C19. Ne jamais interrompre le clopidogrel sans avis cardiologique, surtout en post-infarctus ou après stent.",
    alternatives: ["Pantoprazole", "Famotidine selon l'indication"],
    source: "Thésaurus ANSM — clopidogrel × oméprazole",
  },
  {
    id: "sulfonylurea-fluconazole",
    drug1: "GLIBENCLAMIDE",
    aliases1: ["GLIBENCLAMIDE", "DAONIL", "MICRONASE", "SULFAMIDE HYPOGLYCEMIANT", "GLIMEPIRIDE", "AMARYL", "GLICLAZIDE"],
    drug2: "FLUCONAZOLE",
    aliases2: ["FLUCONAZOLE", "TRIFLUCAN"],
    severity: "ORANGE",
    mechanism:
      "Inhibition du CYP2C9 par le fluconazole : majoration de l'effet hypoglycémiant des sulfamides, avec risque d'hypoglycémies sévères, parfois prolongées.",
    recommendation:
      "Renforcer l'autosurveillance glycémique pendant tout le traitement antifongique, adapter la dose du sulfamide si besoin et informer le patient des signes d'hypoglycémie.",
    alternatives: ["Terbinafine (Lamisil) selon l'indication"],
    source: "Thésaurus ANSM — sulfamides × azolés",
  },
  {
    id: "digoxine-furosemide",
    drug1: "DIGOXINE",
    aliases1: ["DIGOXINE", "HEMIGOXINE", "NATIVELLE"],
    drug2: "FUROSEMIDE",
    aliases2: ["FUROSEMIDE", "LASILIX", "DIURETIQUE DE L'ANSE"],
    severity: "YELLOW",
    mechanism:
      "L'hypokaliémie induite par le diurétique de l'anse potentialise la toxicité digitalique (nausées, troubles visuels, troubles du rythme graves).",
    recommendation:
      "Surveiller kaliémie (cible > 4 mmol/L), magnésémie et créatinine ; ECG si signes d'appel. Supplémenter en potassium si besoin et éduquer le patient à la surveillance du pouls.",
    source: "ROTH-BPC — digitaliques × diurétiques hypokaliémiants",
  },
  {
    id: "verapamil-betabloquant",
    drug1: "VERAPAMIL",
    aliases1: ["VERAPAMIL", "ISOPTINE", "OPTIPRESS", "INHIBITEUR CALCIQUE BRADYCARDISANT"],
    drug2: "BISOPROLOL",
    aliases2: ["BETA-BLOQUANT", "BISOPROLOL", "CARDENSIEL", "DETENSIEL", "ATENOLOL", "TENORMINE", "METOPROLOL", "LOPRESOR", "PROPRANOLOL", "AVLOCARDYL"],
    severity: "ORANGE",
    mechanism:
      "Dépression nodale additive (inhibiteur calcique bradycardisant + bêta-bloquant) : bradycardie, bloc auriculo-ventriculaire, décompensation cardiaque.",
    recommendation:
      "Éviter l'association, surtout par voie IV. Si elle est nécessaire : contrôle de la fréquence cardiaque, ECG et vigilance en cas de fatigue inhabituelle ou de syncopes.",
    alternatives: ["Amlodipine pour l'angor ou l'HTA (sans effet nodal)"],
    source: "Thésaurus ANSM — bêta-bloquants × verapamil/diltiazem",
  },
  {
    id: "sildenafil-nitrates",
    drug1: "SILDENAFIL",
    aliases1: ["SILDENAFIL", "VIAGRA", "INHIBITEUR PDE5", "TADALAFIL"],
    drug2: "TRINITRINE",
    aliases2: ["TRINITRINE", "RISORDAN", "NITROGLYCERINE", "NITRATES", "ISOSORBIDE DINITRATE", "ISOSORBIDE MONONITRATE"],
    severity: "RED",
    mechanism:
      "Synergie sur la voie NO-GMPc : hypotension sévère, potentiellement fatale (choc cardiovasculaire).",
    recommendation:
      "Contre-indication absolue. Respecter un délai d'au moins 24 h après la prise d'inhibiteur de PDE5 avant tout dérivé nitré. Éduquer systématiquement le patient coronarien.",
    source: "Thésaurus ANSM — nitrés × inhibiteurs de la PDE5",
  },
  {
    id: "rifampicine-sulfamide",
    drug1: "RIFAMPICINE",
    aliases1: ["RIFAMPICINE", "RIFADINE", "RIFAMYCINE"],
    drug2: "GLIBENCLAMIDE",
    aliases2: ["GLIBENCLAMIDE", "DAONIL", "GLIMEPIRIDE", "AMARYL", "SULFAMIDE HYPOGLYCEMIANT", "GLICLAZIDE", "DIAMICRON"],
    severity: "ORANGE",
    mechanism:
      "Puissant inducteur enzymatique (CYP2C9/3A4) : la rifampicine diminue l'effet des sulfamides hypoglycémiants → déséquilibre du diabète, hyperglycémie.",
    recommendation:
      "Renforcer la surveillance glycémique pendant tout le traitement antituberculeux et adapter le traitement (metformine ou insuline si nécessaire).",
    alternatives: ["Metformine", "Insuline selon le contexte"],
    source: "Thésaurus ANSM — rifampicine × sulfamides",
  },
  {
    id: "metronidazole-alcool",
    drug1: "METRONIDAZOLE",
    aliases1: ["METRONIDAZOLE", "FLAGYL", "FLAGYL 250", "FLAGYL 500"],
    drug2: "ALCOOL",
    aliases2: ["ALCOOL", "ETHANOL", "BOISSONS ALCOOLISEES"],
    severity: "RED",
    mechanism:
      "Effet antabuse : inhibition de l'acétaldéhyde-déshydrogénase → flush facial, vomissements, tachycardie, hypotension en cas de prise d'alcool.",
    recommendation:
      "Interdiction totale de l'alcool (et des médicaments/aliments en contenant) pendant tout le traitement et pendant 48-72 h après l'arrêt. Avertir systématiquement le patient.",
    source: "Thésaurus ANSM — métronidazole × alcool",
  },
  {
    id: "isoniazide-paracetamol",
    drug1: "ISONIAZIDE",
    aliases1: ["ISONIAZIDE", "RIMIFON", "INH"],
    drug2: "PARACETAMOL",
    aliases2: ["PARACETAMOL", "DOLIPRANE", "DOLI-BIEN", "EFFERALGAN", "PANADOL", "DAFALGAN"],
    severity: "ORANGE",
    mechanism:
      "L'isoniazide induit le CYP2E1 et augmente la formation du métabolite hépatotoxique du paracétamol : risque majoré d'hépatotoxicité, même à doses habituelles.",
    recommendation:
      "Chez le patient tuberculeux sous isoniazide : limiter le paracétamol (≤ 2 g/jour, cures courtes), éviter l'alcool et surveiller les transaminases si cure prolongée.",
    source: "ROTH-BPC — isoniazide × paracétamol",
  },
  {
    id: "quinolone-antacide",
    drug1: "CIPROFLOXACINE",
    aliases1: ["CIPROFLOXACINE", "CIFLOX", "CIPROXIN", "OFLOXACINE", "OFLOCET", "FLUOROQUINOLONE"],
    drug2: "ANTACIDE",
    aliases2: ["ANTACIDE", "MAALOX", "PHOSPHALUGEL", "HYDROXYDE D'ALUMINIUM", "MAGNESIUM", "HYDROXYDE DE MAGNESIUM", "TOPAL"],
    severity: "YELLOW",
    mechanism:
      "Chélation par les sels d'aluminium et de magnésium : absorption digestive de la fluoroquinolone effondrée → échec thérapeutique possible.",
    recommendation:
      "Espacer les prises : prendre l'antibiotique au moins 2 h avant ou 4-6 h après l'antiacide. Préférer un IPP ou un antiacide sans alu-magnésium si l'indication persiste.",
    alternatives: ["Oméprazole ou pantoprazole (pas de chélation)"],
    source: "ROTH-BPC — quinolones × sels alu-magnésium",
  },
  {
    id: "betabloquant-antidiabetique",
    drug1: "BISOPROLOL",
    aliases1: ["BETA-BLOQUANT", "BISOPROLOL", "CARDENSIEL", "DETENSIEL", "ATENOLOL", "TENORMINE", "PROPRANOLOL", "AVLOCARDYL"],
    drug2: "GLICLAZIDE",
    aliases2: ["GLICLAZIDE", "DIAMICRON", "SULFAMIDE HYPOGLYCEMIANT", "GLIBENCLAMIDE", "DAONIL", "INSULINE", "GLIMEPIRIDE", "AMARYL"],
    severity: "YELLOW",
    mechanism:
      "Le bêta-bloquant masque les signes adrénergiques d'hypoglycémie (tachycardie, tremblements) et peut majorer la baisse glycémique — le patient peut ne percevoir que les sueurs.",
    recommendation:
      "Informer explicitement le patient : surveillance glycémique renforcée, reconnaissance des sueurs et tremblements comme signes d'alerte. Préférer un bêta-bloquant cardiosélectif.",
    source: "ROTH-BPC — bêta-bloquants × antidiabétiques",
  },
];

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

/** Normalise un nom de médicament : majuscules, sans accents, alphanumérique. */
export function normalizeDrugName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function matches(names: string[], dci: string): boolean {
  const target = normalizeDrugName(dci);
  if (!target) return false;
  return names.some((name) => normalizeDrugName(name) === target);
}

/**
 * Recherche une interaction entre deux DCI (sens 1↔2 inclus).
 * Retourne null si aucune interaction connue ou si c'est la même molécule.
 */
export function findInteraction(dciA: string, dciB: string): DrugInteraction | null {
  const a = normalizeDrugName(dciA);
  const b = normalizeDrugName(dciB);
  if (!a || !b || a === b) return null;

  for (const interaction of DRUG_INTERACTIONS) {
    const direct =
      matches([interaction.drug1, ...interaction.aliases1], a) &&
      matches([interaction.drug2, ...interaction.aliases2], b);
    const swapped =
      matches([interaction.drug1, ...interaction.aliases1], b) &&
      matches([interaction.drug2, ...interaction.aliases2], a);
    if (direct || swapped) return interaction;
  }
  return null;
}
