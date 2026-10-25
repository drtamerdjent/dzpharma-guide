import type { Metadata } from "next";
import BureauClient from "./bureau-client";

/**
 * BUREAU DZPHARMA — page privée de l'opérateur.
 *
 * Aucun bouton, aucun lien, aucune mention dans l'application n'y mène :
 * l'opérateur tape l'adresse directement dans son navigateur (URL secrète).
 * La page n'est pas indexée par les moteurs de recherche, et rien n'est
 * accessible sans la clé (vérifiée côté serveur à chaque appel API).
 */
export const metadata: Metadata = {
  title: "DzPharma",
  robots: { index: false, follow: false, nocache: true },
};

export default function BureauPage() {
  return <BureauClient />;
}
