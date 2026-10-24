"use client";

/**
 * Device identity helpers (CLIENT-ONLY).
 *
 * The device fingerprint is a stable random UUID persisted in
 * localStorage — it lets the server count *devices* (not cookies) against
 * the 2-device limit. It is not a secret and carries no personal data.
 */

const FINGERPRINT_KEY = "dzpharma:device-id";

export function getDeviceFingerprint(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(FINGERPRINT_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(FINGERPRINT_KEY, id);
    }
    return id;
  } catch {
    // Private mode with storage disabled — fall back to a per-load id.
    return "ephemeral-device";
  }
}

export function getDeviceLabel(): string {
  if (typeof navigator === "undefined") return "Appareil inconnu";
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "iOS"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Mac OS X/i.test(ua)
          ? "macOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Inconnu";
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\//i.test(ua)
      ? "Opera"
      : /Chrome\//i.test(ua)
        ? "Chrome"
        : /Safari\//i.test(ua)
          ? "Safari"
          : /Firefox\//i.test(ua)
            ? "Firefox"
            : "Navigateur";
  return `${browser} · ${os}`;
}
