"use client";

/**
 * BUREAU DZPHARMA — interface opérateur (client).
 *
 * Flux quotidien :
 *   1. Un médecin envoie son reçu BaridiMob sur WhatsApp (avec référence).
 *   2. L'opérateur vérifie la réception des 3 600 DZD sur le RIP.
 *   3. Il ouvre cette page secrète, cherche le compte du médecin et clique
 *      « Activer » — Premium 1 an, demandes PENDING clôturées automatiquement.
 *
 * La clé n'est jamais stockée sur le serveur ni dans l'URL : elle reste en
 * mémoire de l'onglet (sessionStorage) et part à la fermeture du navigateur.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Clock3,
  Crown,
  HeartPulse,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const KEY_STORE = "dzp_bureau_key";

interface AdminDoctor {
  id: string;
  email: string;
  fullName: string;
  specialty: string | null;
  phone: string | null;
  isPremium: boolean;
  premiumUntil: string | null;
  premiumSource: string | null;
  createdAt: string;
  deviceCount: number;
  paymentCount: number;
}

interface AdminPayment {
  id: string;
  reference: string;
  status: string;
  senderName: string;
  senderPhone: string;
  amountDzd: number;
  createdAt: string;
  doctorId: string;
  doctorEmail: string;
  doctorName: string;
}

interface AdminData {
  doctors: AdminDoctor[];
  payments: AdminPayment[];
  stats: {
    totalDoctors: number;
    premiumDoctors: number;
    pendingPayments: number;
  };
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function BureauClient() {
  const { toast } = useToast();
  const [key, setKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AdminData | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Reprendre la clé de l'onglet en cours (sessionStorage), si présente.
  useEffect(() => {
    const saved = sessionStorage.getItem(KEY_STORE);
    if (saved) setKey(saved);
  }, []);

  const load = useCallback(
    async (k: string) => {
      setLoading(true);
      setAuthError(null);
      try {
        const res = await fetch("/api/admin/doctors", {
          headers: { "x-admin-key": k },
          cache: "no-store",
        });
        if (res.status === 401 || res.status === 403) {
          sessionStorage.removeItem(KEY_STORE);
          setKey(null);
          setAuthError("Clé incorrecte. Réessayez.");
          return;
        }
        if (!res.ok) throw new Error("server");
        setData((await res.json()) as AdminData);
      } catch {
        setAuthError(
          "Connexion impossible. Vérifiez internet puis réessayez."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (key) void load(key);
  }, [key, load]);

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setAuthError("Saisissez la clé d'accès.");
      return;
    }
    setSubmitting(true);
    sessionStorage.setItem(KEY_STORE, trimmed);
    setKey(trimmed); // déclenche le chargement via useEffect
    setSubmitting(false);
  }

  function handleLock() {
    sessionStorage.removeItem(KEY_STORE);
    setKey(null);
    setData(null);
    setKeyInput("");
    setAuthError(null);
  }

  async function toggle(doctorId: string, action: "activate" | "revoke") {
    if (!key) return;
    setBusyId(doctorId);
    try {
      const res = await fetch("/api/admin/doctors/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": key,
        },
        body: JSON.stringify({ doctorId, action }),
      });
      if (!res.ok) {
        toast({
          title: "Action impossible",
          description: "Réessayez dans un instant.",
          variant: "destructive",
        });
        return;
      }
      const json = (await res.json()) as { doctor: AdminDoctor };
      toast({
        title:
          action === "activate"
            ? "Premium activé ✓"
            : "Premium retiré",
        description: `${json.doctor.fullName} — ${json.doctor.email}`,
      });
      await load(key); // resynchroniser compteurs + paiements
    } catch {
      toast({
        title: "Connexion interrompue",
        description: "Vérifiez internet puis réessayez.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  }

  function askActivate(d: AdminDoctor) {
    if (
      window.confirm(
        `Activer Premium pour ${d.fullName} (${d.email}) pendant 1 an ?\n\nAssurez-vous d'avoir reçu les 3 600 DZD via BaridiMob.`
      )
    ) {
      void toggle(d.id, "activate");
    }
  }

  function askRevoke(d: AdminDoctor) {
    if (
      window.confirm(
        `Retirer Premium de ${d.fullName} (${d.email}) ?\n\nLe compte repassera en gratuit immédiatement.`
      )
    ) {
      void toggle(d.id, "revoke");
    }
  }

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!data) return [];
    if (!q) return data.doctors;
    return data.doctors.filter((d) =>
      [d.fullName, d.email, d.phone ?? "", d.specialty ?? ""].some((v) =>
        v.toLowerCase().includes(q)
      )
    );
  }, [data, q]);

  const pending = useMemo(
    () =>
      (data?.payments ?? [])
        .filter((p) => p.status === "PENDING")
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
    [data]
  );

  /* ---------------------------------------------------------------- */
  /* Vue 1 — écran de déverrouillage                                   */
  /* ---------------------------------------------------------------- */
  if (!key) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-background">
        <Card className="w-full max-w-sm border shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 dark:bg-sky-950">
                <HeartPulse className="h-7 w-7 text-sky-600 dark:text-sky-400" />
              </div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-foreground">
                Bureau DzPharma
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-muted-foreground">
                Espace privé réservé à l&apos;exploitation.
              </p>
            </div>

            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="bureau-key"
                  className="text-sm font-medium text-slate-700 dark:text-foreground"
                >
                  Clé d&apos;accès
                </label>
                <Input
                  id="bureau-key"
                  type="password"
                  inputMode="text"
                  autoComplete="off"
                  placeholder="••••••••••••"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  className="h-11"
                />
              </div>

              {authError ? (
                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                  {authError}
                </p>
              ) : null}

              <Button
                type="submit"
                className="h-11 w-full bg-sky-600 text-white hover:bg-sky-700"
                disabled={submitting}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Ouvrir le bureau
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Vue 2 — tableau de bord                                           */
  /* ---------------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background">
      <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-6">
        {/* En-tête */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-950">
              <HeartPulse className="h-6 w-6 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-foreground">
                Bureau DzPharma
              </h1>
              <p className="text-xs text-slate-500 dark:text-muted-foreground">
                Gestion des comptes & activations Premium
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10"
              onClick={() => key && void load(key)}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Actualiser
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 text-slate-600 dark:text-muted-foreground"
              onClick={handleLock}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Quitter
            </Button>
          </div>
        </header>

        {loading && !data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : !data ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500 dark:text-muted-foreground">
              {authError ?? "Aucune donnée."}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Statistiques */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="border shadow-sm">
                <CardContent className="flex items-center gap-3 p-3 sm:p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-950">
                    <Users className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xl font-bold text-slate-900 dark:text-foreground sm:text-2xl">
                      {data.stats.totalDoctors}
                    </p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-muted-foreground sm:text-xs">
                      Comptes inscrits
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border shadow-sm">
                <CardContent className="flex items-center gap-3 p-3 sm:p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950">
                    <Crown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xl font-bold text-slate-900 dark:text-foreground sm:text-2xl">
                      {data.stats.premiumDoctors}
                    </p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-muted-foreground sm:text-xs">
                      Premium
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border shadow-sm">
                <CardContent className="flex items-center gap-3 p-3 sm:p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950">
                    <Clock3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xl font-bold text-slate-900 dark:text-foreground sm:text-2xl">
                      {data.stats.pendingPayments}
                    </p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-muted-foreground sm:text-xs">
                      En attente
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Paiements en attente (reçus WhatsApp à valider) */}
            {pending.length > 0 ? (
              <section>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-foreground">
                  <Clock3 className="h-4 w-4 text-amber-500" />
                  Paiements en attente ({pending.length})
                </h2>
                <div className="space-y-2">
                  {pending.map((p) => (
                    <Card
                      key={p.id}
                      className="border-amber-200 bg-amber-50/60 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20"
                    >
                      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-mono text-sm font-bold tracking-wide text-amber-700 dark:text-amber-400">
                            {p.reference}
                          </p>
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-foreground">
                            {p.doctorName} · {p.doctorEmail}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-muted-foreground">
                            {p.senderName} · {p.senderPhone} ·{" "}
                            {p.amountDzd.toLocaleString("fr-FR")} DZD ·{" "}
                            {fmtDate(p.createdAt)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="h-10 shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() => void toggle(p.doctorId, "activate")}
                          disabled={busyId === p.doctorId}
                        >
                          {busyId === p.doctorId ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <BadgeCheck className="mr-2 h-4 w-4" />
                          )}
                          Activer Premium
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Annuaire des médecins */}
            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-foreground">
                  Comptes médecins ({filtered.length})
                </h2>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nom, email, téléphone…"
                    className="h-10 pl-9"
                    aria-label="Rechercher un médecin"
                  />
                </div>
              </div>

              <Card className="border shadow-sm">
                <CardContent className="p-0">
                  {filtered.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500 dark:text-muted-foreground">
                      {data.doctors.length === 0
                        ? "Aucun compte enregistré pour l'instant."
                        : "Aucun résultat pour cette recherche."}
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-border">
                      {filtered.map((d) => (
                        <li
                          key={d.id}
                          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-400">
                              {initials(d.fullName) || "?"}
                            </div>
                            <div className="min-w-0">
                              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-foreground">
                                <span className="truncate">{d.fullName}</span>
                                {d.isPremium ? (
                                  <Badge className="border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400">
                                    <Crown className="mr-1 h-3 w-3" />
                                    Premium
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-slate-500 dark:text-muted-foreground"
                                  >
                                    Gratuit
                                  </Badge>
                                )}
                              </p>
                              <p className="truncate text-xs text-slate-600 dark:text-muted-foreground">
                                {d.email}
                                {d.phone ? ` · ${d.phone}` : ""}
                              </p>
                              <p className="text-xs text-slate-400 dark:text-muted-foreground/70">
                                {d.specialty ? `${d.specialty} · ` : ""}
                                Inscrit le {fmtDate(d.createdAt)} ·{" "}
                                {d.deviceCount} appareil
                                {d.deviceCount > 1 ? "s" : ""}
                              </p>
                              {d.isPremium && d.premiumUntil ? (
                                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                  Valable jusqu&apos;au{" "}
                                  {fmtDateLong(d.premiumUntil)}
                                </p>
                              ) : null}
                            </div>
                          </div>

                          <div className="shrink-0 pl-12 sm:pl-0">
                            {d.isPremium ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                                onClick={() => askRevoke(d)}
                                disabled={busyId === d.id}
                              >
                                {busyId === d.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                Retirer
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className={cn(
                                  "h-10 bg-sky-600 text-white hover:bg-sky-700"
                                )}
                                onClick={() => askActivate(d)}
                                disabled={busyId === d.id}
                              >
                                {busyId === d.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Crown className="mr-2 h-4 w-4" />
                                )}
                                Activer Premium
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </section>

            <p className="text-center text-[11px] leading-relaxed text-slate-400 dark:text-muted-foreground/60">
              Session protégée — la clé reste uniquement dans cet onglet et
              disparaît à sa fermeture.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
