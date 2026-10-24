"use client";

/**
 * DzPharma Guide — main page.
 * Mobile-first search experience over the Algerian medications database:
 *  - Debounced search on DCI + nom commercial (server API route).
 *  - Availability filter (is_available = true by default).
 *  - Freemium: 3 free searches/day, then price + CNAS are blurred.
 *  - Alternatives thérapeutiques (same molecule, ranked) — 2 free, all Premium.
 *  - Crowd-sourced rupture reports + alerts feed ("Top Contributeur du Mois").
 *  - Premium tools: printable prescription pad + pediatric dosage calculator.
 *  - Doctor accounts (2 devices max) — Premium can live on the account and
 *    be activated through the BaridiMob → WhatsApp flow.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Baby,
  Bell,
  Calculator,
  Crown,
  Database,
  FlaskConical,
  Loader2,
  Lock,
  Map,
  RotateCcw,
  Search,
  SearchX,
  ShieldAlert,
  ShieldPlus,
  Stethoscope,
  UserRound,
  UserRoundPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CalculatorHub } from "@/components/calculators/calculator-hub";
import { InteractionChecker } from "@/components/dzpharma/interaction-checker";
import {
  MedicationCard,
  MedicationCardSkeleton,
} from "@/components/dzpharma/medication-card";
import { SearchBar } from "@/components/dzpharma/search-bar";
import { AlternativesDialog } from "@/components/dzpharma/alternatives-dialog";
import { RuptureDialog } from "@/components/dzpharma/rupture-dialog";
import { PrescriptionDialog } from "@/components/dzpharma/prescription-dialog";
import { PediatricCalculator } from "@/components/dzpharma/pediatric-calculator";
import { UpgradeModal } from "@/components/dzpharma/upgrade-modal";
import { AuthDialog } from "@/components/dzpharma/auth-dialog";
import { AccountDialog } from "@/components/dzpharma/account-dialog";
import { RoadmapDialog } from "@/components/dzpharma/roadmap-dialog";
import { refreshAuth, useAuth } from "@/lib/auth-store";
import { useSearchLimit } from "@/hooks/useSearchLimit";
import type {
  DatabaseStats,
  Medication,
  MedicationMeta,
  SearchResponse,
} from "@/lib/types";

const PAGE_SIZE = 30;

const SUGGESTIONS = [
  "PARACETAMOL",
  "AMOXICILLINE",
  "OMEPRAZOLE",
  "METFORMINE",
  "INSULINE",
  "SALBUTAMOL",
];

const HANDLE_KEY = "dzpharma:handle";

function getContributorHandle(): string {
  if (typeof window === "undefined") return "Contributeur anonyme";
  try {
    let handle = window.localStorage.getItem(HANDLE_KEY);
    if (!handle) {
      handle = `Contributeur #${Math.floor(1000 + Math.random() * 9000)}`;
      window.localStorage.setItem(HANDLE_KEY, handle);
    }
    return handle;
  } catch {
    return "Contributeur anonyme";
  }
}

type Status = "idle" | "loading" | "ready" | "error";

export default function HomePage() {
  const { toast } = useToast();
  const {
    hydrated,
    isPremium,
    searchesUsed,
    remaining,
    freeLimit,
    registerSearch,
    upgradeToPremium,
    resetForDemo,
  } = useSearchLimit();
  const auth = useAuth();

  /* Merged Premium: account Premium (BaridiMob activated) OR local demo. */
  const serverPremium = auth.status === "authed" && !!auth.doctor?.isPremium;
  const premium = isPremium || serverPremium;
  const locked = hydrated && !premium && searchesUsed >= freeLimit;

  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [loadingMore, setLoadingMore] = useState(false);
  const [items, setItems] = useState<Medication[]>([]);
  const [meta, setMeta] = useState<Record<string, MedicationMeta>>({});
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Feature dialogs
  const [alternativesMed, setAlternativesMed] = useState<Medication | null>(null);
  const [prescriptionMed, setPrescriptionMed] = useState<Medication | null>(null);
  const [ruptureOpen, setRuptureOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("recherche");

  // Account dialogs
  const [authOpen, setAuthOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);

  /* Boot the doctor session once (auth store is module-level). */
  useEffect(() => {
    void refreshAuth();
  }, []);

  // Community stats (header badge)
  const [ruptureWeek, setRuptureWeek] = useState<number | null>(null);

  /* --- Debounce the raw input into the committed query (300 ms) --- */
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(rawQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [rawQuery]);

  /* --- Dataset stats + community rupture badge --- */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/medications/stats")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: DatabaseStats) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        /* stats are decorative — silently ignore */
      });
    fetch("/api/reports/summary")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { last7Days: number }) => {
        if (!cancelled) setRuptureWeek(data.last7Days);
      })
      .catch(() => {
        /* decorative */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* --- Main search effect --- */
  useEffect(() => {
    abortRef.current?.abort();

    if (!query) {
      setStatus("idle");
      setItems([]);
      setMeta({});
      setTotal(0);
      setHasMore(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");

    const params = new URLSearchParams({
      q: query,
      availableOnly: String(availableOnly),
      limit: String(PAGE_SIZE),
      offset: "0",
    });

    fetch(`/api/medications/search?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as SearchResponse;
      })
      .then((data) => {
        registerSearch(query);
        setItems(data.items);
        setMeta(data.meta ?? {});
        setTotal(data.total);
        setHasMore(data.hasMore);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });

    return () => controller.abort();
  }, [query, availableOnly, retryTick, registerSearch]);

  /* --- Load more (append next page) --- */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        q: query,
        availableOnly: String(availableOnly),
        limit: String(PAGE_SIZE),
        offset: String(items.length),
      });
      const res = await fetch(`/api/medications/search?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SearchResponse;
      setItems((prev) => [...prev, ...data.items]);
      setMeta((prev) => ({ ...prev, ...(data.meta ?? {}) }));
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch {
      toast({
        title: "Erreur de chargement",
        description: "Impossible de charger la suite des résultats.",
        variant: "destructive",
      });
    } finally {
      setLoadingMore(false);
    }
  }, [availableOnly, hasMore, items.length, loadingMore, query, toast]);

  const openUpgrade = useCallback(() => setUpgradeOpen(true), []);

  const handleUpgraded = useCallback(() => {
    upgradeToPremium();
  }, [upgradeToPremium]);

  /**
   * Ouvre le AlternativesDialog avec la DCI recommandée par un score clinique.
   * La surface freemium reste celle du AlternativesDialog existant
   * (2 alternatives gratuites, le reste Premium) — le quota de recherche
   * principal n'est pas consommé par les outils cliniques.
   */
  const handleFindAlternativesFromTool = useCallback(
    async (dci: string) => {
      const openFirst = (found: Medication[]) => {
        const target = found[0];
        if (!target) {
          toast({
            title: "Molécule introuvable",
            description: `Aucune spécialité « ${dci} » dans la base actuelle.`,
          });
          return;
        }
        setAlternativesMed(target);
      };
      try {
        const url = (availableOnly: string) =>
          `/api/medications/search?q=${encodeURIComponent(dci)}&availableOnly=${availableOnly}&limit=5&offset=0`;
        const res = await fetch(url("true"));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let found = ((await res.json()) as SearchResponse).items;
        if (found.length === 0) {
          const fallback = await fetch(url("false"));
          if (fallback.ok) found = ((await fallback.json()) as SearchResponse).items;
        }
        openFirst(found);
      } catch {
        toast({
          title: "Erreur réseau",
          description: "Impossible d'ouvrir les alternatives pour le moment.",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  const handleResetDemo = useCallback(() => {
    resetForDemo();
    toast({
      title: "Démo réinitialisée",
      description: "Quota de recherches et statut Premium remis à zéro.",
    });
  }, [resetForDemo, toast]);

  /* --- Crowd-sourced rupture reporting (free) --- */
  const handleReportRupture = useCallback(
    async (medication: Medication) => {
      // Doctors get credited by name once logged in (leaderboard).
      const handle = auth.doctor?.fullName ?? getContributorHandle();
      try {
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ medicationId: medication.id, reporter: handle }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setMeta((prev) => ({
          ...prev,
          [medication.id]: {
            altCount: prev[medication.id]?.altCount ?? 0,
            ruptureCount: (prev[medication.id]?.ruptureCount ?? 0) + 1,
          },
        }));
        setRuptureWeek((prev) => (prev == null ? 1 : prev + 1));
        toast({
          title: "Merci pour votre contribution !",
          description: auth.doctor?.fullName
            ? "Rupture signalée au nom de votre compte médecin. Merci !"
            : `Rupture signalée sous « ${handle} ». La communauté vous remercie.`,
        });
      } catch {
        toast({
          title: "Signalement impossible",
          description: "Une erreur est survenue. Réessayez dans un instant.",
          variant: "destructive",
        });
      }
    },
    [auth.doctor, toast]
  );

  const formattedTotal = useMemo(
    () => new Intl.NumberFormat("fr-FR").format(total),
    [total]
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* ---------------- Header ---------------- */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
              <Stethoscope className="h-5 w-5" aria-hidden />
            </span>
            <div className="leading-tight">
              <p className="text-base font-extrabold tracking-tight text-slate-900">
                DzPharma <span className="text-primary">Guide</span>
              </p>
              <p className="hidden text-[11px] text-slate-500 sm:block">
                Répertoire des médicaments — Algérie
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Alerts ruptures */}
            <button
              type="button"
              onClick={() => setRuptureOpen(true)}
              aria-label="Alertes ruptures de la communauté"
              title="Alertes ruptures"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-amber-50 hover:text-amber-700"
            >
              <Bell className="h-5 w-5" aria-hidden />
              {ruptureWeek != null && ruptureWeek > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {ruptureWeek > 9 ? "9+" : ruptureWeek}
                </span>
              )}
            </button>
            {/* Calculatrice pédiatrique */}
            <button
              type="button"
              onClick={() => setActiveTab("pediatrie")}
              aria-label="Calculatrice posologique pédiatrique"
              title="Calculatrice pédiatrique"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-sky-50 hover:text-sky-700"
            >
              <Baby className="h-5 w-5" aria-hidden />
            </button>
            {/* Compte médecin / Espace médecin */}
            {auth.status === "loading" ? (
              <Skeleton className="h-10 w-10 rounded-xl" aria-hidden />
            ) : auth.status === "authed" && auth.doctor ? (
              <button
                type="button"
                onClick={() => setAccountOpen(true)}
                aria-label="Mon compte médecin"
                className="flex h-10 max-w-40 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-700">
                  {auth.doctor.fullName
                    .replace(/^Dr\.?\s*/i, "")
                    .split(" ")
                    .slice(0, 2)
                    .map((part) => part.charAt(0).toUpperCase())
                    .join("")}
                </span>
                <span className="truncate">
                  Dr {auth.doctor.fullName.replace(/^Dr\.?\s*/i, "").split(" ")[0]}
                </span>
                {serverPremium && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                aria-label="Espace médecin — connexion ou inscription"
                className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <UserRoundPlus className="h-4 w-4" aria-hidden />
                <span className="hidden xs:inline sm:inline">Espace médecin</span>
              </button>
            )}
            {hydrated &&
              (premium ? (
                <Badge className="gap-1 border-amber-300 bg-amber-100 text-amber-800">
                  <Crown className="h-3.5 w-3.5" aria-hidden />
                  PREMIUM
                </Badge>
              ) : (
                <button
                  type="button"
                  onClick={openUpgrade}
                  aria-label="Passer à Premium — 3 600 DZD par an"
                  className="flex h-10 items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-2.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100"
                >
                  <ShieldPlus className="h-4 w-4" aria-hidden />
                  <span className="hidden xs:inline sm:inline">Passer Premium</span>
                </button>
              ))}
          </div>
        </div>
      </header>

      {/* ---------------- Main ---------------- */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-10 pt-5 sm:pt-8">
        {/* Hero */}
        <section aria-labelledby="search-heading" className="space-y-1.5 text-center sm:text-left">
          <h1
            id="search-heading"
            className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl"
          >
            Trouvez la bonne alternative thérapeutique
          </h1>
          <div className="text-sm text-slate-500">
            {stats ? (
              <>
                <span className="font-semibold text-slate-700">
                  {new Intl.NumberFormat("fr-FR").format(stats.total)}
                </span>{" "}
                médicaments référencés en Algérie — recherchez par DCI ou nom
                commercial.
              </>
            ) : (
              <Skeleton className="h-4 w-72 max-w-full" />
            )}
          </div>
        </section>

        {/* Outils : recherche + 3 briques cliniques Premium */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-5">
          <TabsList className="grid h-auto w-full grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
            <TabsTrigger value="recherche" className="min-h-11 flex-col gap-0.5 rounded-lg px-1 py-1 text-[10px] font-semibold leading-none sm:flex-row sm:gap-1.5 sm:text-sm">
              <Search className="h-4 w-4 shrink-0" aria-hidden />
              Recherche
            </TabsTrigger>
            <TabsTrigger value="scores" className="min-h-11 flex-col gap-0.5 rounded-lg px-1 py-1 text-[10px] font-semibold leading-none sm:flex-row sm:gap-1.5 sm:text-sm">
              <Calculator className="h-4 w-4 shrink-0" aria-hidden />
              Scores
            </TabsTrigger>
            <TabsTrigger value="pediatrie" className="min-h-11 flex-col gap-0.5 rounded-lg px-1 py-1 text-[10px] font-semibold leading-none sm:flex-row sm:gap-1.5 sm:text-sm">
              <Baby className="h-4 w-4 shrink-0" aria-hidden />
              Pédiatrie
            </TabsTrigger>
            <TabsTrigger value="interactions" className="min-h-11 flex-col gap-0.5 rounded-lg px-1 py-1 text-[10px] font-semibold leading-none sm:flex-row sm:gap-1.5 sm:text-sm">
              <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
              Interactions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recherche" className="mt-4 space-y-4">
            <SearchBar
              value={rawQuery}
              onChange={setRawQuery}
              loading={status === "loading"}
            />

          {/* Availability filter */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3">
              <Switch
                id="available-only"
                checked={availableOnly}
                onCheckedChange={setAvailableOnly}
                aria-label="Afficher uniquement les médicaments disponibles"
              />
              <Label
                htmlFor="available-only"
                className="cursor-pointer text-sm font-medium text-slate-700"
              >
                Disponibles uniquement
              </Label>
            </div>

            {hydrated && !premium && (
              <span className="flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500">
                <FlaskConical className="h-4 w-4 text-sky-500" aria-hidden />
                {locked ? (
                  <span>Quota gratuit atteint ({freeLimit}/{freeLimit})</span>
                ) : (
                  <span>
                    Recherches gratuites :{" "}
                    <span className="font-bold text-sky-700">
                      {remaining}/{freeLimit}
                    </span>{" "}
                    restantes
                    {auth.status === "authed" ? " · compte" : ""}
                  </span>
                )}
              </span>
            )}
          </div>

        {/* Freemium banner */}
        {hydrated && locked && query && (
          <Card className="mt-4 border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                  <Lock className="h-4.5 w-4.5 text-amber-700" aria-hidden />
                </span>
                <p className="text-sm leading-snug text-slate-700">
                  <span className="font-bold text-slate-900">
                    Vous avez utilisé vos {freeLimit} recherches gratuites du
                    jour.
                  </span>{" "}
                  Passez à Premium (3 600 DZD/an) pour un accès illimité aux prix
                  et remboursements CNAS.
                </p>
              </div>
              <Button
                onClick={openUpgrade}
                className="h-11 w-full shrink-0 gap-2 font-semibold sm:w-auto"
              >
                <Crown className="h-4 w-4" aria-hidden />
                Passer à Premium
              </Button>
            </div>
          </Card>
        )}

        {/* Results / states */}
        <section aria-live="polite">
          {status === "idle" && (
            <div className="space-y-4 pt-2">
              <p className="text-sm font-medium text-slate-600">
                Recherches populaires :
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setRawQuery(suggestion)}
                    className="min-h-10 rounded-full border border-sky-200 bg-white px-4 text-sm font-medium text-sky-700 shadow-sm transition-colors hover:bg-sky-50 active:bg-sky-100"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-sm text-slate-400">
                <Database className="h-4 w-4" aria-hidden />
                {stats
                  ? `${new Intl.NumberFormat("fr-FR").format(stats.available)} médicaments disponibles — ${new Intl.NumberFormat("fr-FR").format(stats.withPrice)} avec prix renseigné`
                  : "Chargement de la base…"}
              </div>
            </div>
          )}

          {status === "loading" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <MedicationCardSkeleton key={index} />
              ))}
            </div>
          )}

          {status === "error" && (
            <Card className="mx-auto max-w-md border-red-200 bg-red-50/60 p-6 text-center">
              <AlertTriangle
                className="mx-auto h-8 w-8 text-red-500"
                aria-hidden
              />
              <p className="mt-2 font-semibold text-slate-900">
                Une erreur est survenue
              </p>
              <p className="mt-1 text-sm text-slate-500">
                La recherche n&apos;a pas abouti. Vérifiez votre connexion puis
                réessayez.
              </p>
              <Button
                onClick={() => setRetryTick((tick) => tick + 1)}
                className="mt-4 h-11"
                variant="destructive"
              >
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
                Réessayer
              </Button>
            </Card>
          )}

          {status === "ready" && items.length === 0 && (
            <Card className="mx-auto max-w-md p-8 text-center">
              <SearchX className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
              <p className="mt-3 font-semibold text-slate-900">
                Aucun médicament trouvé
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Aucun résultat pour «&nbsp;{query}&nbsp;».
                {availableOnly &&
                  " Certains médicaments sont masqués par le filtre « disponibles uniquement »."}
              </p>
              {availableOnly && (
                <Button
                  variant="outline"
                  className="mt-4 h-11"
                  onClick={() => setAvailableOnly(false)}
                >
                  Inclure les indisponibles
                </Button>
              )}
            </Card>
          )}

          {status === "ready" && items.length > 0 && (
            <>
              <p className="mb-3 text-sm text-slate-500">
                <span className="font-bold text-slate-900">{formattedTotal}</span>{" "}
                résultat{total > 1 ? "s" : ""} pour «&nbsp;{query}&nbsp;»
              </p>
              <ul className="grid list-none grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((medication) => (
                  <li
                    key={medication.id}
                    className="animate-in fade-in slide-in-from-bottom-1 duration-300"
                  >
                    <MedicationCard
                      medication={medication}
                      meta={meta[medication.id]}
                      locked={locked}
                      isPremium={premium}
                      onUpgrade={openUpgrade}
                      onShowAlternatives={setAlternativesMed}
                      onReportRupture={handleReportRupture}
                      onPrescription={setPrescriptionMed}
                    />
                  </li>
                ))}
              </ul>
              {hasMore && (
                <div className="mt-5 flex justify-center">
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 min-w-56 bg-white"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        Chargement…
                      </>
                    ) : (
                      "Charger plus de résultats"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
          </section>
          </TabsContent>

          <TabsContent value="scores" className="mt-4">
            <CalculatorHub onFindAlternatives={handleFindAlternativesFromTool} />
          </TabsContent>

          <TabsContent value="pediatrie" className="mt-4">
            <PediatricCalculator isPremium={premium} onUpgrade={openUpgrade} />
          </TabsContent>

          <TabsContent value="interactions" className="mt-4">
            <InteractionChecker isPremium={premium} onUpgrade={openUpgrade} />
          </TabsContent>
        </Tabs>
      </main>

      {/* ---------------- Footer (sticky bottom via flex layout) ---------------- */}
      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-slate-400 sm:flex-row">
            <p className="text-center sm:text-left">
              <span className="font-semibold text-slate-600">DzPharma Guide</span>{" "}
              — © {new Date().getFullYear()}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1 sm:justify-end">
              <button
                type="button"
                onClick={() => setRoadmapOpen(true)}
                className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 font-medium text-slate-400 underline-offset-2 transition-colors hover:text-slate-600 hover:underline"
              >
                <Map className="h-3.5 w-3.5" aria-hidden />
                Plan de lancement (14 jours)
              </button>
              {hydrated && (searchesUsed > 0 || isPremium) && (
                <button
                  type="button"
                  onClick={handleResetDemo}
                  className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 font-medium text-slate-400 underline-offset-2 transition-colors hover:text-slate-600 hover:underline"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Réinitialiser la démo
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] leading-relaxed text-slate-400 sm:text-left">
            Outil d&apos;aide à la décision — ne remplace pas le jugement
            clinique : le médecin prescripteur conserve l&apos;entière
            responsabilité. Les disponibilités sont basées sur les dernières
            données connues. Veuillez confirmer avec votre pharmacien.
          </p>
        </div>
      </footer>

      {/* ---------------- Feature dialogs ---------------- */}
      <AlternativesDialog
        medication={alternativesMed}
        open={alternativesMed != null}
        onOpenChange={(open) => {
          if (!open) setAlternativesMed(null);
        }}
        isPremium={premium}
        onUpgrade={openUpgrade}
        onPrescription={setPrescriptionMed}
      />

      <RuptureDialog
        open={ruptureOpen}
        onOpenChange={setRuptureOpen}
        isPremium={premium}
        onUpgrade={openUpgrade}
      />

      <PrescriptionDialog
        open={prescriptionMed != null}
        onOpenChange={(open) => {
          if (!open) setPrescriptionMed(null);
        }}
        medication={prescriptionMed}
        isPremium={premium}
        onUpgradeNeeded={openUpgrade}
      />

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        onUpgraded={handleUpgraded}
        onNeedAuth={() => setAuthOpen(true)}
      />

      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        onSuccess={() => {
          setAuthOpen(false);
          toast({
            title: "Bienvenue sur DzPharma Guide",
            description: "Votre compte médecin est actif (2 appareils maximum).",
          });
        }}
      />

      <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />

      <RoadmapDialog open={roadmapOpen} onOpenChange={setRoadmapOpen} />
    </div>
  );
}
