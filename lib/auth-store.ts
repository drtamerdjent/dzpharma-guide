"use client";

/**
 * Auth store — DzPharma Guide doctor accounts (CLIENT-ONLY).
 *
 * Module-level external store read through `useSyncExternalStore`:
 *  - SSR/hydration safe (server snapshot = "loading", never flashes).
 *  - Every component (header, dialogs, upgrade modal) shares one source.
 *  - All mutations are plain async module functions (no setState in
 *    effects — satisfies the react-hooks lint rules).
 */
import { useSyncExternalStore } from "react";
import { getDeviceFingerprint, getDeviceLabel } from "@/lib/device";

export interface DoctorPublic {
  id: string;
  email: string;
  fullName: string;
  specialty: string | null;
  phone: string | null;
  isPremium: boolean;
  premiumUntil: string | null;
  premiumSource: string | null;
}

export interface DevicePublic {
  id: string;
  deviceLabel: string;
  lastSeenAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface PaymentRequestPublic {
  id: string;
  reference: string;
  method: string;
  amountDzd: number;
  senderName: string;
  senderPhone: string;
  status: "PENDING" | "ACTIVATED" | "REJECTED";
  createdAt: string;
  activatedAt: string | null;
  whatsappUrl: string | null;
  beneficiaryRip: string;
  beneficiaryName: string;
}

export interface AuthState {
  /** "loading" until the first /api/auth/me resolves. */
  status: "loading" | "anon" | "authed";
  doctor: DoctorPublic | null;
  devices: DevicePublic[];
}

/* ------------------------------------------------------------------ */
/* External store                                                      */
/* ------------------------------------------------------------------ */

const LOADING_STATE: AuthState = { status: "loading", doctor: null, devices: [] };
const ANON_STATE: AuthState = { status: "anon", doctor: null, devices: [] };

let state: AuthState = LOADING_STATE;
const listeners = new Set<() => void>();

function setState(next: AuthState): void {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): AuthState {
  return state;
}

function getServerSnapshot(): AuthState {
  return LOADING_STATE;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

let refreshInFlight: Promise<void> | null = null;

export async function refreshAuth(): Promise<void> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        doctor: DoctorPublic | null;
        devices: DevicePublic[];
      };
      setState(
        data.doctor
          ? { status: "authed", doctor: data.doctor, devices: data.devices ?? [] }
          : ANON_STATE
      );
    } catch {
      setState(ANON_STATE);
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export interface AuthError {
  error: string;
  code?: string;
  devices?: DevicePublic[];
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthError | null> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        deviceFingerprint: getDeviceFingerprint(),
        deviceLabel: getDeviceLabel(),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      doctor?: DoctorPublic;
      error?: string;
      code?: string;
      devices?: DevicePublic[];
    };
    if (!res.ok) {
      return {
        error: data.error ?? "Connexion impossible.",
        code: data.code,
        devices: data.devices,
      };
    }
    await refreshAuth();
    return null;
  } catch {
    return { error: "Connexion impossible. Vérifiez votre réseau." };
  }
}

export async function register(input: {
  fullName: string;
  email: string;
  password: string;
  specialty?: string;
  phone?: string;
}): Promise<AuthError | null> {
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...input,
        deviceFingerprint: getDeviceFingerprint(),
        deviceLabel: getDeviceLabel(),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      doctor?: DoctorPublic;
      error?: string;
    };
    if (!res.ok) {
      return { error: data.error ?? "Inscription impossible." };
    }
    await refreshAuth();
    return null;
  } catch {
    return { error: "Inscription impossible. Vérifiez votre réseau." };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* clearing local state is enough offline */
  }
  setState(ANON_STATE);
}

export async function revokeDevice(
  deviceId: string
): Promise<{ ok: boolean; selfRevoked: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/auth/devices?id=${encodeURIComponent(deviceId)}`, {
      method: "DELETE",
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      selfRevoked?: boolean;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, selfRevoked: false, error: data.error ?? "Échec." };
    }
    if (data.selfRevoked) {
      setState(ANON_STATE);
      return { ok: true, selfRevoked: true };
    }
    await refreshAuth();
    return { ok: true, selfRevoked: false };
  } catch {
    return { ok: false, selfRevoked: false, error: "Réseau indisponible." };
  }
}

/** Sign out every other device (password-confirmed). */
export async function revokeOthers(input: {
  email?: string;
  password: string;
}): Promise<{ ok: boolean; revoked: number; error?: string }> {
  try {
    const res = await fetch("/api/auth/devices/revoke-others", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      revoked?: number;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, revoked: 0, error: data.error ?? "Échec." };
    }
    if (!input.email) await refreshAuth();
    return { ok: true, revoked: data.revoked ?? 0 };
  } catch {
    return { ok: false, revoked: 0, error: "Réseau indisponible." };
  }
}

/* ------------------------------------------------------------------ */
/* BaridiMob payment requests (client side of the flow)                */
/* ------------------------------------------------------------------ */

export async function createBaridiMobRequest(input: {
  senderName: string;
  senderPhone: string;
}): Promise<
  { ok: true; request: PaymentRequestPublic; reused: boolean } | { ok: false; error: string }
> {
  try {
    const res = await fetch("/api/payments/baridimob", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json().catch(() => ({}))) as {
      request?: PaymentRequestPublic;
      reused?: boolean;
      error?: string;
    };
    if (!res.ok || !data.request) {
      return { ok: false, error: data.error ?? "Demande impossible." };
    }
    return { ok: true, request: data.request, reused: data.reused ?? false };
  } catch {
    return { ok: false, error: "Réseau indisponible." };
  }
}

export async function fetchLatestPayment(): Promise<
  { ok: true; request: PaymentRequestPublic | null } | { ok: false; error: string }
> {
  try {
    const res = await fetch("/api/payments/baridimob", { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as {
      request?: PaymentRequestPublic | null;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error ?? "Lecture impossible." };
    }
    return { ok: true, request: data.request ?? null };
  } catch {
    return { ok: false, error: "Réseau indisponible." };
  }
}

export async function activateDemoPayment(): Promise<
  { ok: true; doctor: DoctorPublic } | { ok: false; error: string }
> {
  try {
    const res = await fetch("/api/payments/baridimob/activate-demo", {
      method: "POST",
    });
    const data = (await res.json().catch(() => ({}))) as {
      doctor?: DoctorPublic;
      error?: string;
    };
    if (!res.ok || !data.doctor) {
      return { ok: false, error: data.error ?? "Activation impossible." };
    }
    await refreshAuth();
    return { ok: true, doctor: data.doctor };
  } catch {
    return { ok: false, error: "Réseau indisponible." };
  }
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
