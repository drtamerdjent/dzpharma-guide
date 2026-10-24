/**
 * DzPharma Guide — doctor accounts & sessions (SERVER-ONLY).
 *
 * Password hashing uses Node's scrypt (no external dependency):
 *   stored format = "<salt hex>:<hash hex>".
 *
 * Sessions are opaque random tokens stored in an httpOnly cookie and
 * persisted in the `doctor_sessions` table — one session per device.
 * Business rule (anti credential-sharing): a doctor may keep at most
 * MAX_DEVICES (=2) devices logged in simultaneously.
 */
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Doctor, DoctorSession } from "@prisma/client";

export const SESSION_COOKIE = "dzp_session";
/** Cookie lifetime: 30 days. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
/** Simultaneous logged-in devices per account (business plan rule). */
export const MAX_DEVICES = 2;
/** Premium subscription duration once a payment is validated. */
export const PREMIUM_DURATION_MS = 365 * 24 * 3_600_000;

/* ------------------------------------------------------------------ */
/* Passwords                                                           */
/* ------------------------------------------------------------------ */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/* ------------------------------------------------------------------ */
/* Tokens & references                                                 */
/* ------------------------------------------------------------------ */

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/** Payment reference shown to the doctor, e.g. "DZP-8F3K2Q". */
export function generatePaymentReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `DZP-${code}`;
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export type DoctorSessionWithDoctor = DoctorSession & { doctor: Doctor };

export async function getSessionByToken(
  token: string | undefined | null
): Promise<DoctorSessionWithDoctor | null> {
  if (!token) return null;
  const session = await db.doctorSession.findUnique({
    where: { token },
    include: { doctor: true },
  });
  return session;
}

export async function createSession(input: {
  doctorId: string;
  deviceFingerprint: string;
  deviceLabel: string;
}): Promise<DoctorSession> {
  const token = generateSessionToken();
  // The (doctorId, deviceFingerprint) pair is unique: this device may only
  // hold one session — replace any stale one (e.g. re-login after logout
  // raced).upsert is not possible on a non-unique token combination, so do
  // it manually.
  const existing = await db.doctorSession.findFirst({
    where: {
      doctorId: input.doctorId,
      deviceFingerprint: input.deviceFingerprint,
    },
  });
  if (existing) {
    return db.doctorSession.update({
      where: { id: existing.id },
      data: { token, deviceLabel: input.deviceLabel, lastSeenAt: new Date() },
    });
  }
  return db.doctorSession.create({
    data: {
      token,
      doctorId: input.doctorId,
      deviceFingerprint: input.deviceFingerprint,
      deviceLabel: input.deviceLabel,
    },
  });
}

export async function deleteSessionByToken(token: string): Promise<void> {
  await db.doctorSession.deleteMany({ where: { token } });
}

/* ------------------------------------------------------------------ */
/* Premium                                                             */
/* ------------------------------------------------------------------ */

export function isPremiumActive(doctor: Doctor): boolean {
  if (!doctor.isPremium) return false;
  if (!doctor.premiumUntil) return true; // lifetime (e.g. staff/grants)
  return doctor.premiumUntil.getTime() > Date.now();
}

/* ------------------------------------------------------------------ */
/* DTOs                                                                */
/* ------------------------------------------------------------------ */

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

export function toDoctorPublic(doctor: Doctor): DoctorPublic {
  const premium = isPremiumActive(doctor);
  return {
    id: doctor.id,
    email: doctor.email,
    fullName: doctor.fullName,
    specialty: doctor.specialty,
    phone: doctor.phone,
    isPremium: premium,
    premiumUntil: premium && doctor.premiumUntil
      ? doctor.premiumUntil.toISOString()
      : null,
    premiumSource: premium ? doctor.premiumSource : null,
  };
}

export interface DevicePublic {
  id: string;
  deviceLabel: string;
  lastSeenAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export function toDevicePublic(
  session: DoctorSession,
  currentToken: string | null
): DevicePublic {
  return {
    id: session.id,
    deviceLabel: session.deviceLabel,
    lastSeenAt: session.lastSeenAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
    isCurrent: currentToken != null && session.token === currentToken,
  };
}

/* ------------------------------------------------------------------ */
/* Validation helpers                                                  */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

/** Derive a readable device label from the User-Agent (server fallback). */
export function labelFromUserAgent(ua: string | null): string {
  if (!ua) return "Appareil inconnu";
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

/** Stable per-request id used for error correlation in logs. */
export function requestId(): string {
  return randomUUID().slice(0, 8);
}

/* ------------------------------------------------------------------ */
/* Cookie helpers (Route Handlers)                                     */
/* ------------------------------------------------------------------ */

export function withSessionCookie<T>(
  body: T,
  token: string,
  status = 200
): NextResponse {
  const response = NextResponse.json(body, { status });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

export function withoutSessionCookie<T>(body: T, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
