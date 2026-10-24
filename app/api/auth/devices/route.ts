import { type NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  getSessionByToken,
  toDevicePublic,
  withoutSessionCookie,
} from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/auth/devices?id=… — revoke one device session of the
 * logged-in doctor. Revoking the *current* device also clears the cookie
 * (it doubles as a logout).
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = await getSessionByToken(token);
    if (!session) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "Paramètre id requis." }, { status: 400 });
    }

    const target = await db.doctorSession.findUnique({ where: { id } });
    if (!target || target.doctorId !== session.doctorId) {
      return NextResponse.json({ error: "Appareil introuvable." }, { status: 404 });
    }

    await db.doctorSession.delete({ where: { id } });

    if (target.token === token) {
      // Current device logged out.
      return withoutSessionCookie({ ok: true, selfRevoked: true, devices: [] });
    }

    const sessions = await db.doctorSession.findMany({
      where: { doctorId: session.doctorId },
      orderBy: { lastSeenAt: "desc" },
    });
    return NextResponse.json({
      ok: true,
      selfRevoked: false,
      devices: sessions.map((s) => toDevicePublic(s, token ?? null)),
    });
  } catch (error) {
    console.error("[API] DELETE /auth/devices failed:", error);
    return NextResponse.json(
      { error: "Suppression impossible. Réessayez." },
      { status: 500 }
    );
  }
}
