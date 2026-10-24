"use client";

/**
 * AuthDialog — "Espace médecin" (comptes médecins DzPharma Guide).
 *
 * Modes:
 *  - login  : email + password.
 *  - device-limit : the server answered 403 DEVICE_LIMIT (a 3rd device
 *    tried to log in). Shows the active devices and offers to sign them
 *    out after password confirmation (anti credential-sharing flow).
 *  - register : fullName, email, specialty, phone (optional), password.
 *
 * On success the auth store refreshes and `onSuccess` closes the dialog.
 */
import { useState } from "react";
import {
  Laptop,
  Loader2,
  Lock,
  LogIn,
  MonitorSmartphone,
  ShieldCheck,
  Stethoscope,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  login,
  register,
  revokeOthers,
  type DevicePublic,
} from "@/lib/auth-store";

type Mode = "login" | "register" | "device-limit";

const SPECIALTIES = [
  "Médecine générale",
  "Cardiologie",
  "Pédiatrie",
  "Gynécologie-obstétrique",
  "Chirurgie",
  "Médecine interne",
  "Pharmacie",
  "Autre",
];

export function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AuthDialog({ open, onOpenChange, onSuccess }: AuthDialogProps) {
  const [mode, setMode] = useState<Mode>("login");

  // Shared fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Device-limit state (from the 403 DEVICE_LIMIT response)
  const [limitedDevices, setLimitedDevices] = useState<DevicePublic[]>([]);
  const [maxDevices, setMaxDevices] = useState(2);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Register fields
  const [fullName, setFullName] = useState("");
  const [specialty, setSpecialty] = useState<string>("");
  const [phone, setPhone] = useState("");

  const resetErrors = () => setError(null);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    resetErrors();
    setBusy(true);
    const result = await login({ email, password });
    setBusy(false);
    if (!result) {
      onSuccess();
      return;
    }
    if (result.code === "DEVICE_LIMIT" && result.devices) {
      setLimitedDevices(result.devices);
      setMaxDevices(result.devices.length || 2);
      setMode("device-limit");
      return;
    }
    setError(result.error);
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    resetErrors();
    setBusy(true);
    const result = await register({
      fullName,
      email,
      password,
      specialty: specialty || undefined,
      phone: phone || undefined,
    });
    setBusy(false);
    if (!result) {
      onSuccess();
      return;
    }
    setError(result.error);
  };

  const handleRevokeAndLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    resetErrors();
    setBusy(true);
    const revoked = await revokeOthers({ email, password: confirmPassword });
    if (!revoked.ok) {
      setBusy(false);
      setError(revoked.error ?? "Déconnexion des appareils impossible.");
      return;
    }
    const result = await login({ email, password });
    setBusy(false);
    if (!result) {
      onSuccess();
      return;
    }
    if (result.code === "DEVICE_LIMIT") {
      setError("Réessayez dans un instant — les appareils se déconnectent.");
      return;
    }
    setError(result.error);
  };

  const switchTab = (value: string) => {
    resetErrors();
    setMode(value === "register" ? "register" : "login");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md grid-cols-1 gap-4 overflow-y-auto sm:rounded-2xl">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100">
            <Stethoscope className="h-6 w-6 text-sky-600" aria-hidden />
          </div>
          <DialogTitle className="text-center text-xl">
            Espace médecin
          </DialogTitle>
          <DialogDescription className="text-center">
            Créez votre compte pour activer Premium, conserver vos appareils
            (2 maximum) et vos outils de prescription.
          </DialogDescription>
        </DialogHeader>

        {mode !== "device-limit" && (
          <Tabs value={mode} onValueChange={switchTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" className="gap-1.5">
                <LogIn className="h-4 w-4" aria-hidden />
                Connexion
              </TabsTrigger>
              <TabsTrigger value="register" className="gap-1.5">
                <UserRoundPlus className="h-4 w-4" aria-hidden />
                Inscription
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
          >
            {error}
          </p>
        )}

        {/* -------- Login -------- */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-3" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="auth-email">Email professionnel</Label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                placeholder="dr.amine@exemple.dz"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auth-password">Mot de passe</Label>
              <Input
                id="auth-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11"
              />
            </div>
            <Button type="submit" className="h-12 w-full gap-2 text-base font-semibold" disabled={busy}>
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <LogIn className="h-5 w-5" aria-hidden />
              )}
              Se connecter
            </Button>
            <p className="flex items-center justify-center gap-1 text-center text-[11px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Compte limité à 2 appareils connectés simultanément.
            </p>
          </form>
        )}

        {/* -------- Device limit -------- */}
        {mode === "device-limit" && (
          <form onSubmit={handleRevokeAndLogin} className="space-y-3" noValidate>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-bold text-amber-800">
                <MonitorSmartphone className="h-4 w-4" aria-hidden />
                Limite de {maxDevices} appareils atteinte
              </p>
              <p className="mt-1 text-xs leading-snug text-amber-700">
                Votre compte est déjà actif sur ces appareils. Déconnectez-les
                pour utiliser ce nouvel appareil (anti-partage de compte).
              </p>
              <ul className="mt-2 space-y-1.5">
                {limitedDevices.map((device) => (
                  <li
                    key={device.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-xs"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 font-medium text-slate-700">
                      <Laptop className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                      <span className="truncate">{device.deviceLabel}</span>
                    </span>
                    <span className="shrink-0 text-slate-400">
                      vu {formatRelative(device.lastSeenAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auth-confirm-password">
                Confirmez votre mot de passe pour déconnecter ces appareils
              </Label>
              <Input
                id="auth-confirm-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12"
                onClick={() => {
                  resetErrors();
                  setMode("login");
                }}
              >
                Annuler
              </Button>
              <Button type="submit" className="h-12 gap-2" disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Lock className="h-4 w-4" aria-hidden />
                )}
                Continuer
              </Button>
            </div>
          </form>
        )}

        {/* -------- Register -------- */}
        {mode === "register" && (
          <form onSubmit={handleRegister} className="space-y-3" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="reg-name">Nom complet (Dr …)</Label>
              <Input
                id="reg-name"
                autoComplete="name"
                placeholder="Dr Amine Benali"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={3}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-email">Email professionnel</Label>
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                placeholder="dr.amine@exemple.dz"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-specialty">Spécialité</Label>
              <Select value={specialty} onValueChange={setSpecialty}>
                <SelectTrigger id="reg-specialty" className="h-11 w-full">
                  <SelectValue placeholder="Sélectionnez votre spécialité" />
                </SelectTrigger>
                <SelectContent>
                  {SPECIALTIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-phone">
                Téléphone <span className="font-normal text-slate-400">(optionnel)</span>
              </Label>
              <Input
                id="reg-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0550 00 00 00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-password">Mot de passe (6 caractères min.)</Label>
              <Input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11"
              />
            </div>
            <Button type="submit" className="h-12 w-full gap-2 text-base font-semibold" disabled={busy}>
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <UserRoundPlus className="h-5 w-5" aria-hidden />
              )}
              Créer mon compte médecin
            </Button>
            <p className="flex items-center justify-center gap-1 text-center text-[11px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Vos données restent confidentielles — jamais partagées avec les
              laboratoires.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
