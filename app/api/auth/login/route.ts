import { type NextRequest, NextResponse } from "next/server";
import {
  MAX_DEVICES,
  createSession,
  labelFromUserAgent,
  toDevicePublic,
  toDoctorPublic,
  verifyPassword,
  withSessionCookie,
} from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface LoginBody {
  email?: string;
  password?: string;
  deviceFingerprint?: string;
  deviceLabel?: string;
}

/**
 * POST /api/auth/login — email + password + device fingerprint.
 *
 * Device rule (business plan): at most 2 devices stay logged in at the
 * same time. Logging in from an already-known fingerprint simply refreshes
 * that device's session; a 3rd unknown device receives 403 DEVICE_LIMIT
 * with the list of active devices (the UI then offers to sign the others
 * out after password confirmation).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as LoginBody | null;

    const email = body?.email?.trim().toLowerCase() ?? "";
    const password = body?.password ?? "";
    const fingerprint = body?.deviceFingerprint?.trim().slice(0, 64) ?? "";

    if (!email || !password || !fingerprint) {
      return NextResponse.json(
        { error: "Email, mot de passe et appareil requis." },
        { status: 400 }
      );
    }

    const doctor = await db.doctor.findUnique({ where: { email } });
    if (!doctor || !verifyPassword(password, doctor.passwordHash)) {
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect." },
        { status: 401 }
      );
    }

    const sessions = await db.doctorSession.findMany({
      where: { doctorId: doctor.id },
      orderBy: { lastSeenAt: "desc" },
    });

    const known = sessions.find((s) => s.deviceFingerprint === fingerprint);
    if (!known && sessions.length >= MAX_DEVICES) {
      return NextResponse.json(
        {
          code: "DEVICE_LIMIT",
          maxDevices: MAX_DEVICES,
          devices: sessions.map((s) => toDevicePublic(s, null)),
          error: `Limite de ${MAX_DEVICES} appareils atteinte. Déconnectez un appareil pour continuer.`,
        },
        { status: 403 }
      );
    }

    const label =
      body?.deviceLabel?.trim().slice(0, 60) ||
      labelFromUserAgent(request.headers.get("user-agent"));
    const session = await createSession({
      doctorId: doctor.id,
      deviceFingerprint: fingerprint,
      deviceLabel: label,
    });

    return withSessionCookie(
      { doctor: toDoctorPublic(doctor) },
      session.token
    );
  } catch (error) {
    console.error("[API] POST /auth/login failed:", error);
    return NextResponse.json(
      { error: "Connexion impossible. Réessayez." },
      { status: 500 }
    );
  }
}
