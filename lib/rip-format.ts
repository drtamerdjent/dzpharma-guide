/**
 * DzPharma Guide — coordonnées de paiement Premium (client-safe).
 *
 * Le RIP BaridiMob (Algérie Poste) est une donnée publique : partagé entre
 * le serveur (message WhatsApp pré-rempli) et l'UI (copie dans BaridiMob).
 * Aucune dépendance serveur ici — importable depuis un composant client.
 */

/** Compte bénéficiaire (RIP, 20 chiffres) — virements BaridiMob Premium. */
export const BENEFICIARY_RIP = "00799999002086689232";

/** Intitulé du compte bénéficiaire. */
export const BENEFICIARY_NAME = "DzPharma SARL";

/**
 * Formate un RIP de 20 chiffres en blocs lisibles « 007 99999 0020866892 32 »
 * (structure RIB algérien : banque 3 + agence 5 + compte 10 + clé 2),
 * exactement comme l'affiche l'application BaridiMob.
 */
export function formatRip(rip: string): string {
  const digits = rip.replace(/\D/g, "");
  if (digits.length !== 20) return rip;
  return `${digits.slice(0, 3)} ${digits.slice(3, 8)} ${digits.slice(8, 18)} ${digits.slice(18)}`;
}

/**
 * Numéro WhatsApp de l'équipe (réception des reçus + support), au format
 * local affiché aux utilisateurs algériens.
 */
export const WHATSAPP_SUPPORT_DISPLAY = "0672 22 66 98";

/**
 * Le même numéro au format international pour les liens wa.me
 * (0672226698 → 213672226698, sans le 0 initial).
 */
export const WHATSAPP_SUPPORT_WA = "213672226698";

/**
 * Formate un numéro local algérien « 0672226698 » en « 0672 22 66 98 »
 * pour l'affichage (10 chiffres attendus, sinon renvoie l'entrée telle quelle).
 */
export function formatLocalPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) return phone;
  return `${digits.slice(0, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
}
