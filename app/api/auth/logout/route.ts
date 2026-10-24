import { type NextRequest } from "next/server";
import {
  deleteSessionByToken,
  withoutSessionCookie,
  SESSION_COOKIE,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout — delete the current device session and clear
 * the cookie (freeing a slot against the 2-device limit).
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (token) {
      await deleteSessionByToken(token);
    }
    return withoutSessionCookie({ ok: true });
  } catch (error) {
    console.error("[API] POST /auth/logout failed:", error);
    return withoutSessionCookie({ ok: true });
  }
}
