import { type NextRequest, NextResponse } from "next/server";
import {
  PREMIUM_DURATION_MS,
  requireSession,
  toDoctorPublic,
  toPaymentDTO,
} from "@/lib/payments";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/payments/baridimob/activate-demo — DEMO ONLY.
 * Simulates the operator validating the WhatsApp receipt (real flow:
 * manual activation within 1 hour). Activates Premium on the account
 * for one year and closes the pending payment request.
 */
export async function POST(request: NextRequest) {
  // Sécurité production : ce endpoint n'existe QUE pour la démo. Sans
  // PAYMENTS_DEMO_MODE=true dans l'environnement, il répond 404 — personne
  // ne peut s'auto-activer Premium sans la validation d'un opérateur réel
  // (voir .env.example).
  if (process.env.PAYMENTS_DEMO_MODE !== "true") {
    return NextResponse.json(
      { error: "Indisponible en production." },
      { status: 404 }
    );
  }

  try {
    const session = await requireSession(request);
    if (!session) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const payment = await db.paymentRequest.findFirst({
      where: { doctorId: session.doctorId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    if (!payment) {
      return NextResponse.json(
        { error: "Aucune demande de paiement en attente." },
        { status: 400 }
      );
    }

    const now = new Date();
    const [updatedPayment, doctor] = await Promise.all([
      db.paymentRequest.update({
        where: { id: payment.id },
        data: { status: "ACTIVATED", activatedAt: now },
      }),
      db.doctor.update({
        where: { id: session.doctorId },
        data: {
          isPremium: true,
          premiumSource: "BARIDIMOB",
          premiumUntil: new Date(now.getTime() + PREMIUM_DURATION_MS),
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      request: toPaymentDTO(updatedPayment),
      doctor: toDoctorPublic(doctor),
    });
  } catch (error) {
    console.error("[API] POST /payments/baridimob/activate-demo failed:", error);
    return NextResponse.json(
      { error: "Activation impossible. Réessayez." },
      { status: 500 }
    );
  }
}
