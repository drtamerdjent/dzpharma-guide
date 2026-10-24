import { type NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  getSessionByToken,
  toDevicePublic,
  toDoctorPublic,
} from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me — current doctor + all registered devices.
 * Returns `{ doctor: null }` when not authenticated (never an error, so
 * the client boot sequence stays trivial).
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = await getSessionByToken(token);
    if (!session) {
      return NextResponse.json(
        { doctor: null, devices: [] },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Keep the device presence fresh (used for the devices list ordering).
    await db.doctorSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    const sessions = await db.doctorSession.findMany({
      where: { doctorId: session.doctorId },
      orderBy: { lastSeenAt: "desc" },
    });

    return NextResponse.json(
      {
        doctor: toDoctorPublic(session.doctor),
        devices: sessions.map((s) => toDevicePublic(s, token ?? null)),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[API] GET /auth/me failed:", error);
    return NextResponse.json(
      { doctor: null, devices: [], error: "Session illisible." },
      { status: 500 }
    );
  }
}
