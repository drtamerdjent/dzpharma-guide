import { type NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  getSessionByToken,
  verifyPassword,
} from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RevokeOthersBody {
  /** Required when there is no session yet (device-limit flow on login). */
  email?: string;
  /** Always required — destructive action needs password confirmation. */
  password?: string;
}

/**
 * POST /api/auth/devices/revoke-others — sign out every *other* device of
 * the doctor's account.
 *
 * Two call sites:
 *  1. Account dialog (session cookie present) → password confirmation.
 *  2. Device-limit panel during login (no session) → email + password.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as RevokeOthersBody | null;
    const password = body?.password ?? "";
    if (!password) {
      return NextResponse.json(
        { error: "Confirmation par mot de passe requise." },
        { status: 400 }
      );
    }

    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = await getSessionByToken(token);

    let doctorId: string;
    if (session) {
      doctorId = session.doctorId;
    } else {
      const email = body?.email?.trim().toLowerCase() ?? "";
      if (!email) {
        return NextResponse.json(
          { error: "Email requis pour identifier le compte." },
          { status: 400 }
        );
      }
      const found = await db.doctor.findUnique({ where: { email } });
      if (!found) {
        return NextResponse.json(
          { error: "Email ou mot de passe incorrect." },
          { status: 401 }
        );
      }
      doctorId = found.id;
    }

    const doctor = await db.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor || !verifyPassword(password, doctor.passwordHash)) {
      return NextResponse.json(
        { error: "Mot de passe incorrect." },
        { status: 401 }
      );
    }

    const deleted = await db.doctorSession.deleteMany({
      where: {
        doctorId,
        ...(session ? { token: { not: token } } : {}),
      },
    });

    return NextResponse.json({ ok: true, revoked: deleted.count });
  } catch (error) {
    console.error("[API] POST /auth/devices/revoke-others failed:", error);
    return NextResponse.json(
      { error: "Déconnexion des appareils impossible. Réessayez." },
      { status: 500 }
    );
  }
}
