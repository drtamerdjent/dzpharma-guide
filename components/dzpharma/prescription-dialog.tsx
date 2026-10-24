"use client";

/**
 * PrescriptionDialog — Ordonnance pad (Premium) for DzPharma Guide.
 *
 * - Locked state (free plan): premium pitch + "Passer Premium" CTA.
 * - Premium state: editable prescription pad pre-filled from the selected
 *   medication (posologie templates derived from forme_galenique, FR + AR),
 *   quick-append chips, and a print-only A4 sheet rendered via window.print().
 *
 * Reset strategy: the pad is an inner component keyed by the medication
 * identity (nom_commercial + dosage). Changing the medication remounts the
 * pad, so every lazy useState initializer re-runs — no useEffect needed.
 */
import { useState } from "react";
import type { JSX } from "react";
import { Check, Crown, FileText, Printer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface PrescriptionMedication {
  nom_commercial: string;
  dci: string;
  forme_galenique: string;
  dosage: string;
  laboratoire: string;
}

export interface PrescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: PrescriptionMedication | null;
  /** When false, show a locked state with an upgrade CTA. */
  isPremium: boolean;
  /** Called when the user clicks "Passer Premium" in the locked state. */
  onUpgradeNeeded: () => void;
}

const DOCTOR_NAME_STORAGE_KEY = "dzpharma:doctor-name";
const DEFAULT_POSOLOGIE_AR = "مرتين يومياً لمدة 5 أيام";
const QUICK_POSOLOGIE_CHIPS = [
  "3 fois par jour",
  "au repas",
  "pendant 7 jours",
] as const;

const LOCKED_FEATURES = [
  "Pad pré-rempli : médicament, patient et posologie",
  "Instructions en français et en arabe (RTL)",
  "Impression A4 propre en un clic",
] as const;

function buildDefaultPosologieFr(formeGalenique: string): string {
  const forme = formeGalenique.toLowerCase();
  if (forme.includes("comprimé") || forme.includes("comprime")) {
    return "1 comprimé par voie orale, 2 fois par jour pendant 5 jours.";
  }
  if (forme.includes("gélule") || forme.includes("gelule")) {
    return "1 gélule par voie orale, 2 fois par jour pendant 5 jours.";
  }
  if (
    forme.includes("sirop") ||
    forme.includes("suspension") ||
    forme.includes("sachet")
  ) {
    return "1 cuillère à mesure (ou 1 sachet), 2 fois par jour pendant 5 jours.";
  }
  return "Selon la posologie habituelle du prescripteur, pendant 5 jours.";
}

function readStoredDoctorName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(DOCTOR_NAME_STORAGE_KEY) ?? "";
  } catch {
    // Storage unavailable (private mode, quota) — fall back to empty.
    return "";
  }
}

function persistDoctorName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    if (name.length > 0) {
      window.localStorage.setItem(DOCTOR_NAME_STORAGE_KEY, name);
    } else {
      window.localStorage.removeItem(DOCTOR_NAME_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable — the pad still works without persistence.
  }
}

function todayFormattedFr(): string {
  if (typeof window === "undefined") return "";
  return new Date().toLocaleDateString("fr-FR");
}

export function PrescriptionDialog(
  props: PrescriptionDialogProps
): JSX.Element {
  const { open, onOpenChange, medication, isPremium, onUpgradeNeeded } = props;
  const padKey = medication
    ? `${medication.nom_commercial}::${medication.dosage}`
    : "no-medication";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md grid-cols-1 overflow-y-auto sm:rounded-2xl">
        {!isPremium ? (
          <PrescriptionLockedState onUpgradeNeeded={onUpgradeNeeded} />
        ) : medication ? (
          <PrescriptionPad key={padKey} medication={medication} />
        ) : (
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Ordonnance</DialogTitle>
            <DialogDescription className="text-center">
              Aucun médicament sélectionné.
            </DialogDescription>
          </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PrescriptionLockedState({
  onUpgradeNeeded,
}: {
  onUpgradeNeeded: () => void;
}): JSX.Element {
  return (
    <div className="space-y-4">
      <DialogHeader>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
          <Crown className="h-7 w-7 text-amber-600" aria-hidden />
        </div>
        <DialogTitle className="text-center text-xl">
          Fonctionnalité Premium
        </DialogTitle>
        <DialogDescription className="text-center">
          Générez des ordonnances imprimables pré-remplies (Premium).
        </DialogDescription>
      </DialogHeader>

      <ul className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-4">
        {LOCKED_FEATURES.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2 text-sm text-slate-700"
          >
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
            {feature}
          </li>
        ))}
      </ul>

      <Button
        type="button"
        size="lg"
        className="h-12 w-full gap-2 text-base font-semibold"
        onClick={onUpgradeNeeded}
      >
        <Sparkles className="h-5 w-5" aria-hidden />
        Passer Premium
      </Button>
      <p className="text-center text-[11px] text-slate-400">
        Réservé aux médecins — essentiel dans la pratique quotidienne.
      </p>
    </div>
  );
}

function PrescriptionPad({
  medication,
}: {
  medication: PrescriptionMedication;
}): JSX.Element {
  // Lazy initializers only — no setState inside effects (React Compiler rules).
  const [doctorName, setDoctorName] = useState<string>(readStoredDoctorName);
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [date, setDate] = useState<string>(todayFormattedFr);
  const [posologieFr, setPosologieFr] = useState<string>(() =>
    buildDefaultPosologieFr(medication.forme_galenique)
  );
  const [posologieAr, setPosologieAr] = useState<string>(DEFAULT_POSOLOGIE_AR);

  const handleDoctorNameChange = (value: string) => {
    setDoctorName(value);
    persistDoctorName(value);
  };

  const appendPosologieChip = (chip: string) => {
    setPosologieFr((current) => {
      const trimmed = current.trim();
      if (trimmed.includes(chip)) return current;
      return trimmed.length > 0 ? `${trimmed} ${chip}` : chip;
    });
  };

  const displayDoctorName = doctorName.trim().length > 0 ? doctorName : "Dr ______________";
  const displayPatientName =
    patientName.trim().length > 0 ? patientName : "—";
  const displayPatientAge = patientAge.trim().length > 0 ? patientAge : "—";

  return (
    <div className="space-y-4">
      <DialogHeader>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100">
          <FileText className="h-6 w-6 text-sky-600" aria-hidden />
        </div>
        <DialogTitle className="text-center text-xl">Ordonnance</DialogTitle>
        <DialogDescription className="text-center">
          Pad pré-rempli — complétez puis imprimez pour votre patient.
        </DialogDescription>
      </DialogHeader>

      {/* Medication summary (read-only) */}
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
        <p className="text-sm font-bold text-slate-900">
          {medication.nom_commercial}
          {medication.dosage ? ` — ${medication.dosage}` : ""}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
          DCI : {medication.dci || "—"} · Forme :{" "}
          {medication.forme_galenique || "—"} · Laboratoire :{" "}
          {medication.laboratoire || "—"}
        </p>
      </div>

      {/* Editable pad fields */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="ordonnance-medecin">Nom du médecin</Label>
          <Input
            id="ordonnance-medecin"
            value={doctorName}
            placeholder="Dr …"
            autoComplete="name"
            onChange={(event) => handleDoctorNameChange(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ordonnance-patient">Nom du patient</Label>
          <Input
            id="ordonnance-patient"
            value={patientName}
            placeholder="Nom et prénom"
            onChange={(event) => setPatientName(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ordonnance-age">Âge</Label>
            <Input
              id="ordonnance-age"
              value={patientAge}
              placeholder="ex. 8 ans"
              inputMode="numeric"
              onChange={(event) => setPatientAge(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ordonnance-date">Date</Label>
            <Input
              id="ordonnance-date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ordonnance-posologie-fr">Posologie (Français)</Label>
          <Textarea
            id="ordonnance-posologie-fr"
            rows={3}
            value={posologieFr}
            onChange={(event) => setPosologieFr(event.target.value)}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {QUICK_POSOLOGIE_CHIPS.map((chip) => (
              <Button
                key={chip}
                type="button"
                variant="outline"
                size="sm"
                className="h-11 rounded-full px-4 text-xs font-semibold text-sky-700"
                onClick={() => appendPosologieChip(chip)}
              >
                + {chip}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ordonnance-posologie-ar">Posologie (العربية)</Label>
          <Textarea
            id="ordonnance-posologie-ar"
            dir="rtl"
            rows={2}
            className="text-right"
            value={posologieAr}
            onChange={(event) => setPosologieAr(event.target.value)}
          />
        </div>
      </div>

      <Button
        type="button"
        size="lg"
        className="h-12 w-full gap-2 text-base font-semibold"
        onClick={() => window.print()}
      >
        <Printer className="h-5 w-5" aria-hidden />
        Imprimer l&apos;ordonnance
      </Button>
      <p className="text-center text-[11px] text-slate-400">
        Vérifiez la posologie avant impression — mise en page A4 du navigateur.
      </p>

      {/* Print-only sheet (global @media print CSS shows only .print-sheet) */}
      <div className="print-sheet hidden print:block bg-white text-black">
        <div className="p-4">
          <div className="flex items-start justify-between border-b-2 border-black pb-3">
            <div>
              <p className="text-2xl font-extrabold tracking-widest">
                ORDONNANCE
              </p>
              <p className="mt-1 text-sm font-semibold">{displayDoctorName}</p>
            </div>
            <p className="text-sm font-medium">{date}</p>
          </div>

          <div className="mt-4 space-y-1 text-sm">
            <p>
              <span className="font-semibold">Patient :</span>{" "}
              {displayPatientName}
            </p>
            <p>
              <span className="font-semibold">Âge :</span> {displayPatientAge}
            </p>
          </div>

          <div className="mt-4 border border-black p-3 text-sm leading-relaxed">
            <p className="font-bold">
              {medication.nom_commercial}
              {medication.dosage ? ` ${medication.dosage}` : ""}
            </p>
            <p>DCI : {medication.dci || "—"}</p>
            <p>Forme : {medication.forme_galenique || "—"}</p>
            <p>Laboratoire : {medication.laboratoire || "—"}</p>
          </div>

          <div className="mt-5 min-h-28">
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {posologieFr}
            </p>
            <p
              dir="rtl"
              className="mt-4 whitespace-pre-line text-right text-sm leading-relaxed"
            >
              {posologieAr}
            </p>
          </div>

          <div className="mt-10 flex justify-end">
            <div className="w-52 border-t border-black pt-1 text-center text-xs">
              Signature &amp; cachet
            </div>
          </div>

          <p className="mt-8 border-t border-gray-300 pt-2 text-center text-[9px] leading-snug text-gray-500">
            Document généré par DzPharma Guide — outil d&apos;aide à la
            prescription. Le prescripteur conserve l&apos;entière
            responsabilité clinique.
          </p>
        </div>
      </div>
    </div>
  );
}
