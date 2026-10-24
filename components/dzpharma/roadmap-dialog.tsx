"use client";

/**
 * RoadmapDialog — "Plan de lancement : 14 jours".
 *
 * Tracks the 14-day go-to-market plan from the business plan against what
 * is already shipped in this app. Live items stay in "à venir" so the
 * doctor-facing UI doubles as a transparent product roadmap.
 */
import { CheckCircle2, Circle, Clock, Map } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RoadmapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RoadmapStep {
  days: string;
  title: string;
  detail: string;
  done: boolean;
}

const STEPS: RoadmapStep[] = [
  {
    days: "Jours 1–3",
    title: "Données & validation",
    detail:
      "Répertoire de 5 380 médicaments algériens importé : DCI, marque, laboratoire, prix, taux CNAS, disponibilité.",
    done: true,
  },
  {
    days: "Jours 4–7",
    title: "MVP recherche",
    detail:
      "Recherche instantanée DCI + nom commercial, fiches avec prix et badges CNAS, freemium 3 recherches/jour.",
    done: true,
  },
  {
    days: "Jours 8–9",
    title: "Outils Premium",
    detail:
      "Alternatives triées (prix / CNAS), reste à charge patient, ordonnances imprimables FR/AR, calculatrice pédiatrique.",
    done: true,
  },
  {
    days: "Jour 10",
    title: "Communauté",
    detail:
      "« Signaler une rupture » en un clic, fil d'alertes et Top Contributeur du Mois (gamification).",
    done: true,
  },
  {
    days: "Jour 11",
    title: "Comptes médecins + 2 appareils",
    detail:
      "Inscription / connexion, Premium rattaché au compte, limite stricte de 2 appareils connectés (anti-partage).",
    done: true,
  },
  {
    days: "Jour 12",
    title: "Paiement BaridiMob → WhatsApp",
    detail:
      "Référence unique DZP-XXXXXX, virement au RIP, reçu envoyé sur WhatsApp (message pré-rempli), activation sous 1 h.",
    done: true,
  },
  {
    days: "Jour 13",
    title: "Beta test terrain",
    detail:
      "10 médecins généralistes + 5 pharmaciens : 6 mois de Premium offerts contre feedback structuré hebdomadaire.",
    done: false,
  },
  {
    days: "Jour 14",
    title: "Lancement",
    detail:
      "Value-posts dans les groupes Facebook de médecins algériens, QR codes sur les bureaux, programme représentants pharma (500 DZD/abonnement).",
    done: false,
  },
];

export function RoadmapDialog({ open, onOpenChange }: RoadmapDialogProps) {
  const doneCount = STEPS.filter((step) => step.done).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg grid-cols-1 gap-4 overflow-y-auto sm:rounded-2xl">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100">
            <Map className="h-6 w-6 text-sky-600" aria-hidden />
          </div>
          <DialogTitle className="text-center text-xl">
            Plan de lancement — 14 jours
          </DialogTitle>
          <DialogDescription className="text-center">
            Où en est DzPharma Guide : {doneCount} sur {STEPS.length} jalons
            franchis.
          </DialogDescription>
        </DialogHeader>

        <ol className="relative space-y-3 border-l-2 border-slate-100 pl-5">
          {STEPS.map((step) => (
            <li key={step.days} className="relative">
              <span
                className={`absolute -left-[30px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-white ${
                  step.done ? "border-emerald-400" : "border-slate-300"
                }`}
              >
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                ) : (
                  <Circle className="h-2.5 w-2.5 text-slate-300" aria-hidden />
                )}
              </span>
              <div
                className={`rounded-xl border p-3 ${
                  step.done
                    ? "border-emerald-100 bg-emerald-50/50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <p className="text-sm font-bold text-slate-900">{step.title}</p>
                  {step.done ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-200 bg-white text-emerald-700"
                    >
                      Fait
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-amber-200 bg-white text-amber-700"
                    >
                      <Clock className="mr-1 h-3 w-3" aria-hidden />
                      À venir
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {step.days}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {step.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <p className="text-center text-[11px] leading-relaxed text-slate-400">
          Prochaine étape : beta test avec 10 médecins + 5 pharmaciens (6 mois
          Premium offerts contre feedback), puis lancement dans les groupes
          Facebook médicaux algériens.
        </p>
      </DialogContent>
    </Dialog>
  );
}
