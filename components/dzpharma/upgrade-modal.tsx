"use client";

/**
 * UpgradeModal — Premium subscription for DzPharma Guide.
 *
 * Two payment rails:
 *  - CIB / Edahabia : mock SATIM card form — "Simuler le paiement" unlocks
 *    the demo instantly in the current browser (localStorage, no account).
 *  - BaridiMob      : REAL flow per the business plan —
 *      1. logged-in doctor registers a payment request → unique reference
 *         "DZP-XXXXXX" (server-side, attached to the account);
 *      2. transfers 3 600 DZD to the RIP via BaridiMob;
 *      3. taps "Envoyer le reçu sur WhatsApp" → wa.me deep link with a
 *         pre-filled message (reference, name, phone, RIP, amount);
 *      4. operator validates (≤ 1 h) → account Premium. In this demo the
 *         validation is simulated by POST /activate-demo.
 *    Premium activated this way lives on the ACCOUNT (2 devices max),
 *    not on the browser.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Copy,
  CreditCard,
  Crown,
  ExternalLink,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserRoundPlus,
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  activateDemoPayment,
  createBaridiMobRequest,
  fetchLatestPayment,
  useAuth,
  type PaymentRequestPublic,
} from "@/lib/auth-store";
import {
  WHATSAPP_SUPPORT_DISPLAY,
  WHATSAPP_SUPPORT_WA,
  formatRip,
} from "@/lib/rip-format";

/**
 * Mode démo (paiements) : le bloc « Simuler la validation admin » n'est
 * affiché que si NEXT_PUBLIC_PAYMENTS_DEMO_MODE=true au moment du build.
 * En production, laissez cette variable désactivée — voir .env.example.
 */
const PAYMENTS_DEMO_MODE =
  process.env.NEXT_PUBLIC_PAYMENTS_DEMO_MODE === "true";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Instant demo unlock (localStorage) for the mocked CIB/Edahabia flow. */
  onUpgraded: () => void;
  /** Open the auth dialog when the BaridiMob flow requires an account. */
  onNeedAuth: () => void;
}

const PREMIUM_FEATURES = [
  "Prix exacts + reste à charge patient sur tout le répertoire",
  "Toutes les alternatives algériennes triées (prix / CNAS)",
  "Alertes ruptures en temps réel + Ordonnances imprimables",
  "Calculatrice pédiatrique : doses en mL des sirops algériens",
  "Interactions : conduite à tenir détaillée + alternatives",
  "Recherches illimitées, sur 2 appareils, rattachées à votre compte",
];

function copyText(text: string): void {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    void navigator.clipboard.writeText(text);
  }
}

/* ------------------------------------------------------------------ */
/* BaridiMob intention form (keyed remount → zero sync-setState effects) */
/* ------------------------------------------------------------------ */

interface BaridiMobFormProps {
  defaultName: string;
  defaultPhone: string;
  creating: boolean;
  error: string | null;
  onSubmit: (values: { senderName: string; senderPhone: string }) => void;
}

function BaridiMobForm({
  defaultName,
  defaultPhone,
  creating,
  error,
  onSubmit,
}: BaridiMobFormProps) {
  // Lazy initializers: defaults arrive via props each mount (the Radix
  // dialog unmounts its content when closed, so this stays in sync).
  const [senderName, setSenderName] = useState(() => defaultName);
  const [senderPhone, setSenderPhone] = useState(() => defaultPhone);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ senderName, senderPhone });
      }}
      className="space-y-3"
      noValidate
    >
      <p className="text-sm text-slate-700">
        Réglez par virement BaridiMob (Algérie Poste). Nous générons une
        référence unique, puis vous envoyez le reçu sur WhatsApp — activation
        sous 1 heure.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="baridi-name">Nom du titulaire du virement</Label>
        <Input
          id="baridi-name"
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
          placeholder="Dr Amine Benali"
          required
          minLength={3}
          className="h-11"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="baridi-phone">Téléphone (BaridiMob)</Label>
        <Input
          id="baridi-phone"
          type="tel"
          inputMode="tel"
          value={senderPhone}
          onChange={(e) => setSenderPhone(e.target.value)}
          placeholder="0550 00 00 00"
          required
          className="h-11"
        />
      </div>
      <Button
        type="submit"
        className="h-12 w-full gap-2 text-base font-semibold"
        disabled={creating}
      >
        {creating ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <MessageCircle className="h-5 w-5" aria-hidden />
        )}
        Obtenir ma référence de paiement
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export function UpgradeModal({
  open,
  onOpenChange,
  onUpgraded,
  onNeedAuth,
}: UpgradeModalProps) {
  const { toast } = useToast();
  const auth = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [request, setRequest] = useState<PaymentRequestPublic | null>(null);
  const [creating, setCreating] = useState(false);
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedRip, setCopiedRip] = useState(false);
  const pollRef = useRef<number | null>(null);

  /* --- Load an existing open request when the modal opens (async only) --- */
  useEffect(() => {
    if (!open || auth.status !== "authed") return;
    let cancelled = false;
    void (async () => {
      const result = await fetchLatestPayment();
      if (!cancelled && result.ok && result.request?.status === "PENDING") {
        setRequest(result.request);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, auth.status]);

  /* --- Poll request status while a pending request is displayed --- */
  useEffect(() => {
    if (!open || !request || request.status !== "PENDING") {
      return undefined;
    }
    pollRef.current = window.setInterval(() => {
      void (async () => {
        const result = await fetchLatestPayment();
        if (result.ok && result.request?.status === "ACTIVATED") {
          setRequest(result.request);
        }
      })();
    }, 10_000);
    return () => {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [open, request]);

  /** Reset transient UI state when the dialog closes (event handler, not effect). */
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setFormError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSimulateCardPayment = () => {
    setSubmitting(true);
    // Mock SATIM latency for realism.
    window.setTimeout(() => {
      onUpgraded();
      setSubmitting(false);
      onOpenChange(false);
      toast({
        title: "Bienvenue dans Premium ! 👑",
        description:
          "Paiement carte simulé — accès démo déverrouillé sur cet appareil.",
      });
    }, 700);
  };

  const handleCreateRequest = useCallback(
    async (values: { senderName: string; senderPhone: string }) => {
      setFormError(null);
      setCreating(true);
      const result = await createBaridiMobRequest(values);
      setCreating(false);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setRequest(result.request);
      if (result.reused) {
        toast({
          title: "Demande existante retrouvée",
          description: "Vous avez déjà une demande en attente de validation.",
        });
      } else {
        toast({
          title: "Demande enregistrée",
          description: `Référence ${result.request.reference} — envoyez le reçu via WhatsApp.`,
        });
      }
    },
    [toast]
  );

  const handleDemoActivation = useCallback(async () => {
    setActivating(true);
    const result = await activateDemoPayment();
    setActivating(false);
    if (!result.ok) {
      toast({
        title: "Activation impossible",
        description: result.error,
        variant: "destructive",
      });
      return;
    }
    setRequest(null);
    onOpenChange(false);
    toast({
      title: "Compte Premium activé !",
      description:
        "Paiement BaridiMob validé — Premium actif sur votre compte pendant 1 an.",
    });
  }, [onOpenChange, toast]);

  const alreadyPremium = auth.status === "authed" && auth.doctor?.isPremium;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md grid-cols-1 gap-4 overflow-y-auto sm:rounded-2xl">
        <DialogHeader>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
            <Crown className="h-7 w-7 text-amber-600" aria-hidden />
          </div>
          <DialogTitle className="text-center text-xl">
            DzPharma <span className="text-amber-600">Premium</span>
          </DialogTitle>
          <DialogDescription className="text-center">
            Débloquez l&apos;accès illimité aux prix et remboursements CNAS.
          </DialogDescription>
        </DialogHeader>

        {alreadyPremium ? (
          /* -------- Already premium (account) -------- */
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden />
            </div>
            <p className="text-base font-bold text-slate-900">
              Votre compte est déjà Premium
            </p>
            {auth.doctor?.premiumUntil && (
              <p className="text-sm text-slate-500">
                Actif jusqu&apos;au{" "}
                {new Date(auth.doctor.premiumUntil).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                .
              </p>
            )}
            <Button className="h-11 w-full" onClick={() => onOpenChange(false)}>
              Parfait, merci !
            </Button>
          </div>
        ) : (
          <>
            {/* Price */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-3xl font-extrabold text-slate-900">
                3 600 <span className="text-lg font-bold">DZD</span>
                <span className="text-sm font-medium text-slate-500"> / an</span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                soit 300 DZD / mois — sans engagement
              </p>
            </div>

            {/* Features */}
            <ul className="space-y-2">
              {PREMIUM_FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-sm text-slate-700"
                >
                  <BadgeCheck
                    className="mt-0.5 h-4 w-4 shrink-0 text-sky-600"
                    aria-hidden
                  />
                  {feature}
                </li>
              ))}
            </ul>

            {/* Payment methods */}
            <Tabs defaultValue="baridimob" className="mt-1">
              <TabsList
                className={
                  PAYMENTS_DEMO_MODE ? "grid w-full grid-cols-2" : "grid w-full"
                }
              >
                <TabsTrigger value="baridimob" className="gap-1.5">
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  BaridiMob
                </TabsTrigger>
                {PAYMENTS_DEMO_MODE && (
                  <TabsTrigger value="cib" className="gap-1.5">
                    <CreditCard className="h-4 w-4" aria-hidden />
                    CIB / Edahabia
                  </TabsTrigger>
                )}
              </TabsList>

              {/* -------- BaridiMob → WhatsApp (real flow) -------- */}
              <TabsContent value="baridimob" className="mt-3">
                {auth.status === "authed" && request ? (
                  /* --- Request created: reference + WhatsApp deep link --- */
                  <div className="space-y-3">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                        Votre référence de paiement
                      </p>
                      <p className="mt-0.5 font-mono text-2xl font-extrabold tracking-wider text-slate-900">
                        {request.reference}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-0.5 h-7 gap-1 text-[11px] text-emerald-700"
                        onClick={() => {
                          copyText(request.reference);
                          setCopied(true);
                          window.setTimeout(() => setCopied(false), 1500);
                        }}
                      >
                        <Copy className="h-3 w-3" aria-hidden />
                        {copied ? "Copié !" : "Copier la référence"}
                      </Button>
                    </div>

                    <p className="flex items-start gap-2.5 text-sm text-slate-700">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                        1
                      </span>
                      <span>
                        Ouvrez l&apos;application <span className="font-bold">BaridiMob</span> et
                        faites un virement de{" "}
                        <span className="font-bold">3 600 DZD</span> vers ce compte :
                      </span>
                    </p>

                    {/* RIP copiable — le médecin le colle dans BaridiMob */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            RIP bénéficiaire — {request.beneficiaryName}
                          </p>
                          <p className="mt-0.5 font-mono text-base font-extrabold tracking-wide text-slate-900">
                            {formatRip(request.beneficiaryRip)}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 shrink-0 gap-1.5 border-slate-300 bg-white text-xs font-semibold"
                          onClick={() => {
                            copyText(request.beneficiaryRip);
                            setCopiedRip(true);
                            window.setTimeout(() => setCopiedRip(false), 1500);
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden />
                          {copiedRip ? "Copié !" : "Copier le RIP"}
                        </Button>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                        Dans BaridiMob : « Virement » → collez le RIP (20 chiffres) →
                        vérifiez le nom du bénéficiaire avant de confirmer.
                      </p>
                    </div>

                    <p className="flex items-start gap-2.5 text-sm text-slate-700">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                        2
                      </span>
                      <span>
                        Envoyez la capture du reçu sur WhatsApp avec votre référence
                        (message pré-rempli) :
                      </span>
                    </p>

                    <Button
                      asChild
                      className="h-12 w-full gap-2 bg-[#25D366] text-base font-semibold text-white hover:bg-[#1fb959]"
                    >
                      <a
                        href={request.whatsappUrl ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="h-5 w-5" aria-hidden />
                        Envoyer le reçu sur WhatsApp
                        <ExternalLink
                          className="h-3.5 w-3.5 opacity-70"
                          aria-hidden
                        />
                      </a>
                    </Button>

                    <p className="text-center text-[11px] leading-snug text-slate-500">
                      Le lien ne s&apos;ouvre pas (ordinateur) ? Écrivez-nous
                      directement sur WhatsApp au{" "}
                      <a
                        href={`https://wa.me/${WHATSAPP_SUPPORT_WA}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-[#128C7E] hover:underline"
                      >
                        {WHATSAPP_SUPPORT_DISPLAY}
                      </a>{" "}
                      avec votre référence.
                    </p>

                    <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      En attente de vérification — activation sous 1 heure.
                    </p>

                    {PAYMENTS_DEMO_MODE && (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2.5 text-center">
                        <p className="text-[11px] text-slate-500">
                          Mode démo : validez vous-même la demande (rôle de
                          l&apos;opérateur).
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-1.5 h-9 gap-1.5 border-slate-300 bg-white text-xs font-semibold"
                          onClick={() => void handleDemoActivation()}
                          disabled={activating}
                        >
                          {activating ? (
                            <Loader2
                              className="h-3.5 w-3.5 animate-spin"
                              aria-hidden
                            />
                          ) : (
                            <Sparkles
                              className="h-3.5 w-3.5 text-amber-500"
                              aria-hidden
                            />
                          )}
                          Simuler la validation admin (démo)
                        </Button>
                      </div>
                    )}
                  </div>
                ) : auth.status === "authed" ? (
                  /* --- Logged in: transfer intention form --- */
                  <BaridiMobForm
                    key={auth.doctor?.id ?? "doctor"}
                    defaultName={auth.doctor?.fullName ?? ""}
                    defaultPhone={auth.doctor?.phone ?? ""}
                    creating={creating}
                    error={formError}
                    onSubmit={handleCreateRequest}
                  />
                ) : auth.status === "loading" ? (
                  <div className="flex justify-center py-6">
                    <Loader2
                      className="h-6 w-6 animate-spin text-slate-400"
                      aria-hidden
                    />
                  </div>
                ) : (
                  /* --- Anonymous: account required --- */
                  <div className="space-y-3 text-center">
                    <p className="text-sm text-slate-700">
                      Le paiement BaridiMob est rattaché à un{" "}
                      <span className="font-semibold">compte médecin</span> :
                      votre Premium fonctionne ensuite sur 2 appareils, même
                      après réinstallation.
                    </p>
                    <Button
                      className="h-12 w-full gap-2 text-base font-semibold"
                      onClick={onNeedAuth}
                    >
                      <UserRoundPlus className="h-5 w-5" aria-hidden />
                      Créer un compte / Se connecter
                    </Button>
                    <p className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                      Gratuit, 30 secondes — limité à 2 appareils.
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* -------- CIB / Edahabia (mock, mode démo uniquement) -------- */}
              {PAYMENTS_DEMO_MODE && (
                <TabsContent value="cib" className="mt-3 space-y-3">
                  <p className="text-xs text-slate-500">
                    Paiement sécurisé par carte CIB ou Edahabia via la plateforme
                    SATIM.
                  </p>
                  <div className="space-y-2" aria-hidden>
                    <Input
                      placeholder="Numéro de carte (6280…)"
                      inputMode="numeric"
                      disabled
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="MM/AA" inputMode="numeric" disabled />
                      <Input placeholder="CVV" inputMode="numeric" disabled />
                    </div>
                  </div>
                  <Button
                    className="h-12 w-full gap-2 text-base font-semibold"
                    onClick={handleSimulateCardPayment}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    ) : (
                      <Sparkles className="h-5 w-5" aria-hidden />
                    )}
                    Simuler le paiement carte (démo)
                  </Button>
                  <p className="flex items-center justify-center gap-1 text-center text-[11px] text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                    Démo locale — déverrouillage instantané sur cet appareil.
                  </p>
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
