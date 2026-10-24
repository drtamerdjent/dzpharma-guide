import { type NextRequest, NextResponse } from "next/server";
import {
  createSession,
  hashPassword,
  isValidEmail,
  labelFromUserAgent,
  toDoctorPublic,
  withSessionCookie,
} from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RegisterBody {
  fullName?: string;
  email?: string;
  password?: string;
  specialty?: string;
  phone?: string;
  deviceFingerprint?: string;
  deviceLabel?: string;
}

/**
 * POST /api/auth/register — create a doctor account and log in.
 * A device fingerprint is required so the new device is registered
 * immediately against the 2-device limit.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as RegisterBody | null;

    const fullName = body?.fullName?.trim() ?? "";
    const email = body?.email?.trim().toLowerCase() ?? "";
    const password = body?.password ?? "";
    const fingerprint = body?.deviceFingerprint?.trim().slice(0, 64) ?? "";

    if (fullName.length < 3) {
      return NextResponse.json(
        { error: "Nom complet requis (3 caractères minimum)." },
        { status: 400 }
      );
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 6 caractères." },
        { status: 400 }
      );
    }
    if (!fingerprint) {
      return NextResponse.json(
        { error: "Empreinte de l'appareil manquante." },
        { status: 400 }
      );
    }

    const existing = await db.doctor.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Un compte existe déjà avec cet email." },
        { status: 409 }
      );
    }

    const doctor = await db.doctor.create({
      data: {
        email,
        passwordHash: hashPassword(password),
        fullName: fullName.slice(0, 80),
        specialty: body?.specialty?.trim().slice(0, 60) || null,
        phone: body?.phone?.trim().slice(0, 20) || null,
      },
    });

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
      session.token,
      201
    );
  } catch (error) {
    console.error("[API] POST /auth/register failed:", error);
    return NextResponse.json(
      { error: "Impossible de créer le compte. Réessayez." },
      { status: 500 }
    );
  }
}
