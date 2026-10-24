"use client";

/**
 * AccountDialog — doctor account management.
 *
 *  - Profile: name, email, specialty, Premium status (+ expiry).
 *  - Devices: list of the ≤ 2 devices logged into the account, with the
 *    current one flagged; any other device can be revoked (frees a slot).
 *  - "Se déconnecter des autres appareils" → password-confirmed revoke-all.
 *  - Logout of the current device.
 */
import { useState } from "react";
import {
  BadgeCheck,
  Crown,
  Laptop,
  Loader2,
  LogOut,
  MonitorSmartphone,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import {
  logout,
  revokeDevice,
  revokeOthers,
  useAuth,
} from "@/lib/auth-store";
import { formatRelative } from "@/components/dzpharma/auth-dialog";

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountDialog({ open, onOpenChange }: AccountDialogProps) {
  const { doctor, devices, status } = useAuth();
  const [busyDevice, setBusyDevice] = useState<string | null>(null);
  const [showRevokeAll, setShowRevokeAll] = useState(false);
  const [revokePassword, setRevokePassword] = useState("");
  const [busyRevokeAll, setBusyRevokeAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyLogout, setBusyLogout] = useState(false);

  if (!doctor && status === "authed") {
    return null; // transient state while store rehydrates
  }

  const handleRevokeDevice = async (deviceId: string) => {
    setError(null);
    setBusyDevice(deviceId);
    const result = await revokeDevice(deviceId);
    setBusyDevice(null);
    if (!result.ok) {
      setError(result.error ?? "Suppression impossible.");
      return;
    }
    if (result.selfRevoked) {
      onOpenChange(false);
    }
  };

  const handleRevokeAll = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusyRevokeAll(true);
    const result = await revokeOthers({ password: revokePassword });
    setBusyRevokeAll(false);
    if (!result.ok) {
      setError(result.error ?? "Déconnexion impossible.");
      return;
    }
    setShowRevokeAll(false);
    setRevokePassword("");
  };

  const handleLogout = async () => {
    setBusyLogout(true);
    await logout();
    setBusyLogout(false);
    onOpenChange(false);
  };

  const otherDevices = devices.filter((device) => !device.isCurrent);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md grid-cols-1 gap-4 overflow-y-auto sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Mon compte</DialogTitle>
          <DialogDescription className="text-center">
            Profil, statut Premium et appareils connectés.
          </DialogDescription>
        </DialogHeader>

        {doctor && (
          <>
            {/* Profile */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-base font-bold text-sky-700">
                  {doctor.fullName
                    .replace(/^Dr\.?\s*/i, "")
                    .split(" ")
                    .slice(0, 2)
                    .map((part) => part.charAt(0).toUpperCase())
                    .join("")}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {doctor.fullName}
                  </p>
                  <p className="truncate text-xs text-slate-500">{doctor.email}</p>
                  {doctor.specialty && (
                    <p className="mt-0.5 text-xs font-medium text-sky-600">
                      {doctor.specialty}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-2.5 border-t border-slate-200 pt-2.5">
                {doctor.isPremium ? (
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                    <BadgeCheck className="h-4 w-4" aria-hidden />
                    Premium actif
                    {doctor.premiumUntil && (
                      <span className="font-normal text-slate-500">
                        — jusqu&apos;au {formatExpiry(doctor.premiumUntil)}
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Version gratuite — 3 recherches / jour.
                  </p>
                )}
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
              >
                {error}
              </p>
            )}

            {/* Devices */}
            <section aria-label="Appareils connectés" className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <MonitorSmartphone className="h-4 w-4 text-slate-500" aria-hidden />
                  Appareils connectés
                  <Badge variant="outline" className="border-slate-200 bg-white text-slate-500">
                    {devices.length}/2
                  </Badge>
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Pour éviter le partage de compte, 2 appareils maximum peuvent
                rester connectés simultanément.
              </p>
              <ul className="space-y-1.5">
                {devices.map((device) => (
                  <li
                    key={device.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Laptop
                        className="h-4 w-4 shrink-0 text-slate-400"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-700">
                          {device.deviceLabel}
                          {device.isCurrent && (
                            <span className="ml-1.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                              Cet appareil
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          vu {formatRelative(device.lastSeenAt)}
                        </p>
                      </div>
                    </div>
                    {!device.isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 shrink-0 px-2 text-[11px] font-semibold text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleRevokeDevice(device.id)}
                        disabled={busyDevice === device.id}
                      >
                        {busyDevice === device.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          "Déconnecter"
                        )}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>

              {otherDevices.length > 0 && !showRevokeAll && (
                <button
                  type="button"
                  onClick={() => setShowRevokeAll(true)}
                  className="min-h-9 text-xs font-medium text-sky-600 underline-offset-2 hover:underline"
                >
                  Déconnecter tous les autres appareils
                </button>
              )}

              {showRevokeAll && (
                <form
                  onSubmit={handleRevokeAll}
                  className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
                  noValidate
                >
                  <Label htmlFor="revoke-all-password" className="text-xs">
                    Confirmez votre mot de passe
                  </Label>
                  <Input
                    id="revoke-all-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={revokePassword}
                    onChange={(e) => setRevokePassword(e.target.value)}
                    required
                    className="h-10"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10"
                      onClick={() => {
                        setShowRevokeAll(false);
                        setRevokePassword("");
                      }}
                    >
                      Annuler
                    </Button>
                    <Button type="submit" className="h-10" disabled={busyRevokeAll}>
                      {busyRevokeAll ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        "Confirmer"
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </section>

            {/* Actions */}
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <Button
                variant="outline"
                className="h-11 w-full gap-2"
                onClick={handleLogout}
                disabled={busyLogout}
              >
                {busyLogout ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <LogOut className="h-4 w-4" aria-hidden />
                )}
                Se déconnecter de cet appareil
              </Button>
              <p className="flex items-center justify-center gap-1 text-center text-[11px] text-slate-400">
                <Crown className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                Premium est rattaché à votre compte, pas à cet appareil.
                <ShieldCheck className="ml-1 h-3.5 w-3.5 text-emerald-500" aria-hidden />
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
