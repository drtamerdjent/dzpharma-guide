import { type NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { isPremiumActive, PREMIUM_DURATION_MS, toDoctorPublic } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * BUREAU DZPHARMA (back-office privé) — activation / retrait Premium.
 *
 * C'est ici que se joue le vrai flux métier : le médecin envoie son reçu
 * BaridiMob sur WhatsApp, l'opérateur le vérifie (réception des 3 600 DZD
 * sur le RIP), puis active Premium depuis le bureau. La demande de paiement
 * en attente du compte est clôturée automatiquement (statut ACTIVATED).
 *
 * Sécurité : identique à GET /api/admin/doctors — en-tête "x-admin-key"
 * comparé en temps constant au secret ADMIN_SECRET. Sans secret configuré,
 * tout accès est refusé (401).
 */

/** Garde du bureau : clé absente/invalide ou secret non configuré → false. */
function isAdminRequest(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET ?? "";
  if (secret.length < 12) return false; // secret absent ou trop court : refuser
  const key = request.headers.get("x-admin-key") ?? "";
  if (key.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(key), Buffer.from(secret));
  } catch {
    return false;
  }
}

/** Délai volontaire sur chaque clé incorrecte : rend l'épuisement de la clé
 * (brute force) pratiquement impossible sans gêner l'opérateur légitime. */
async function throttleFailure(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 700));
}

interface ToggleBody {
  doctorId?: string;
  action?: "activate" | "revoke";
}

/**
 * POST /api/admin/doctors/toggle — body: { doctorId, action }.
 *   activate → Premium 1 an (source ADMIN) + clôture des paiements PENDING.
 *   revoke   → retour au compte gratuit (l'historique est conservé).
 */
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    await throttleFailure();
    return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => null)) as ToggleBody | null;
    const doctorId = body?.doctorId?.trim() ?? "";
    const action = body?.action;

    if (!doctorId || (action !== "activate" && action !== "revoke")) {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }

    const doctor = await db.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) {
      return NextResponse.json(
        { error: "Compte introuvable." },
        { status: 404 }
      );
    }

    if (action === "activate") {
      const now = new Date();
      const [updated] = await Promise.all([
        db.doctor.update({
          where: { id: doctor.id },
          data: {
            isPremium: true,
            premiumSource: "ADMIN",
            premiumUntil: new Date(now.getTime() + PREMIUM_DURATION_MS),
          },
        }),
        // Le virement a été confirmé par l'opérateur : clôturer toute
        // demande de paiement encore en attente sur ce compte.
        db.paymentRequest.updateMany({
          where: { doctorId: doctor.id, status: "PENDING" },
          data: { status: "ACTIVATED", activatedAt: now },
        }),
      ]);
      return NextResponse.json({
        ok: true,
        doctor: toDoctorPublic(updated),
      });
    }

    // action === "revoke"
    const updated = await db.doctor.update({
      where: { id: doctor.id },
      data: { isPremium: false, premiumUntil: null },
    });
    return NextResponse.json({ ok: true, doctor: toDoctorPublic(updated) });
  } catch (error) {
    console.error("[ADMIN] POST /admin/doctors/toggle failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur. Réessayez." },
      { status: 500 }
    );
  }
}
