"use client";

/**
 * useSearchLimit — DzPharma Guide freemium engine (mocked).
 *
 * Tracks searches per calendar day in `localStorage`:
 *   - Free users get 3 searches / day with full price + CNAS data.
 *   - After the 3rd search (>3), `isLocked` becomes true and the UI blurs
 *     `prix_approximatif_dzd` + `taux_cnas` behind a Premium overlay.
 *   - `upgradeToPremium()` simulates a successful payment and unlocks
 *     everything (stored until the demo is reset).
 *
 * Implemented as an external store read through `useSyncExternalStore`,
 * which keeps SSR/hydration safe and syncs across browser tabs.
 * Repeating the exact same query does not consume a new search.
 */
import { useCallback, useSyncExternalStore } from "react";

export const FREE_SEARCH_LIMIT = 3;

const USAGE_KEY = "dzpharma:usage";
const PREMIUM_KEY = "dzpharma:premium";

interface UsageRecord {
  /** Local calendar day, e.g. "2025-06-14". */
  date: string;
  count: number;
  lastQuery: string;
}

interface FreemiumSnapshot {
  isPremium: boolean;
  searchesUsed: number;
  lastQuery: string;
}

/* ------------------------------------------------------------------ */
/* External store over localStorage                                    */
/* ------------------------------------------------------------------ */

const SERVER_SNAPSHOT: FreemiumSnapshot = {
  isPremium: false,
  searchesUsed: 0,
  lastQuery: "",
};

let cache: FreemiumSnapshot | null = null;
const listeners = new Set<() => void>();

function localDayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function readUsage(): UsageRecord {
  try {
    const raw = window.localStorage.getItem(USAGE_KEY);
    if (!raw) return { date: localDayKey(), count: 0, lastQuery: "" };
    const parsed = JSON.parse(raw) as Partial<UsageRecord>;
    if (parsed.date !== localDayKey()) {
      // New day → quota resets.
      return { date: localDayKey(), count: 0, lastQuery: "" };
    }
    return {
      date: parsed.date ?? localDayKey(),
      count: typeof parsed.count === "number" ? parsed.count : 0,
      lastQuery: typeof parsed.lastQuery === "string" ? parsed.lastQuery : "",
    };
  } catch {
    return { date: localDayKey(), count: 0, lastQuery: "" };
  }
}

function readSnapshot(): FreemiumSnapshot {
  const usage = readUsage();
  return {
    isPremium: window.localStorage.getItem(PREMIUM_KEY) === "true",
    searchesUsed: usage.count,
    lastQuery: usage.lastQuery,
  };
}

function getSnapshot(): FreemiumSnapshot {
  if (!cache) cache = readSnapshot();
  return cache;
}

function getServerSnapshot(): FreemiumSnapshot {
  return SERVER_SNAPSHOT;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Cross-tab synchronization.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === USAGE_KEY || event.key === PREMIUM_KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function emitChange(): void {
  cache = null;
  for (const listener of listeners) listener();
}

/* ------------------------------------------------------------------ */
/* Public hook                                                         */
/* ------------------------------------------------------------------ */

export interface UseSearchLimitResult {
  /** False during SSR/hydration — true once real client state is shown. */
  hydrated: boolean;
  isPremium: boolean;
  searchesUsed: number;
  remaining: number;
  freeLimit: number;
  /** True when a free user has exceeded the daily quota. */
  limitReached: boolean;
  /** Gated version of limitReached — false during SSR/first render. */
  isLocked: boolean;
  registerSearch: (query: string) => void;
  upgradeToPremium: () => void;
  resetForDemo: () => void;
}

export function useSearchLimit(): UseSearchLimitResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // false on the server, true once hydrated on the client.
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  const registerSearch = useCallback((query: string) => {
    if (typeof window === "undefined") return;
    const normalized = query.trim().toLowerCase();
    if (!normalized) return;
    const current = readUsage();
    if (normalized === current.lastQuery) return; // same query → free retry
    const next: UsageRecord = {
      date: localDayKey(),
      count: current.count + 1,
      lastQuery: normalized,
    };
    try {
      window.localStorage.setItem(USAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage full/blocked — ignore */
    }
    emitChange();
  }, []);

  const upgradeToPremium = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(PREMIUM_KEY, "true");
    } catch {
      /* ignore */
    }
    emitChange();
  }, []);

  const resetForDemo = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(USAGE_KEY);
      window.localStorage.removeItem(PREMIUM_KEY);
    } catch {
      /* ignore */
    }
    emitChange();
  }, []);

  const limitReached = !snapshot.isPremium && snapshot.searchesUsed >= FREE_SEARCH_LIMIT;

  return {
    hydrated,
    isPremium: snapshot.isPremium,
    searchesUsed: snapshot.searchesUsed,
    remaining: Math.max(0, FREE_SEARCH_LIMIT - snapshot.searchesUsed),
    freeLimit: FREE_SEARCH_LIMIT,
    limitReached,
    isLocked: hydrated ? limitReached : false,
    registerSearch,
    upgradeToPremium,
    resetForDemo,
  };
}
