import { type NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { isPremiumActive } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * BUREAU DZPHARMA (back-office privé) — liste des comptes médecins et des
 * demandes de paiement BaridiMob.
 *
 * Sécurité (aucun lien vers cette API n'existe dans l'application) :
 *   1. L'URL de la page est secrète et connue du seul opérateur.
 *   2. Chaque appel exige l'en-tête "x-admin-key" = process.env.ADMIN_SECRET,
 *      comparé en temps constant (timingSafeEqual).
 *   3. Sans ADMIN_SECRET côté serveur, TOUT accès est refusé (401).
 * La clé ne circule jamais dans l'URL : uniquement dans un en-tête.
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

/**
 * GET /api/admin/doctors — annuaire des médecins + demandes de paiement.
 * Sert le bureau de l'opérateur : vérifier qui s'est inscrit, retrouver le
 * compte d'un médecin qui a envoyé un reçu WhatsApp, activer son Premium.
 */
export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    await throttleFailure();
    return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  }

  try {
    const [doctors, payments] = await Promise.all([
      db.doctor.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { sessions: true, payments: true } } },
      }),
      db.paymentRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { doctor: true },
      }),
    ]);

    const rows = doctors.map((d) => ({
      id: d.id,
      email: d.email,
      fullName: d.fullName,
      specialty: d.specialty,
      phone: d.phone,
      isPremium: isPremiumActive(d),
      premiumUntil: d.premiumUntil?.toISOString() ?? null,
      premiumSource: isPremiumActive(d) ? d.premiumSource : null,
      createdAt: d.createdAt.toISOString(),
      deviceCount: d._count.sessions,
      paymentCount: d._count.payments,
    }));

    const paymentRows = payments.map((p) => ({
      id: p.id,
      reference: p.reference,
      status: p.status,
      senderName: p.senderName,
      senderPhone: p.senderPhone,
      amountDzd: p.amountDzd,
      createdAt: p.createdAt.toISOString(),
      doctorId: p.doctorId,
      doctorEmail: p.doctor.email,
      doctorName: p.doctor.fullName,
    }));

    return NextResponse.json({
      doctors: rows,
      payments: paymentRows,
      stats: {
        totalDoctors: doctors.length,
        premiumDoctors: rows.filter((r) => r.isPremium).length,
        pendingPayments: paymentRows.filter((p) => p.status === "PENDING")
          .length,
      },
    });
  } catch (error) {
    console.error("[ADMIN] GET /admin/doctors failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur. Réessayez." },
      { status: 500 }
    );
  }
}
