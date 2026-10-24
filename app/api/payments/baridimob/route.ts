import { type NextRequest, NextResponse } from "next/server";
import type { PaymentRequest } from "@prisma/client";
import {
  PREMIUM_PRICE_DZD,
  requireSession,
  toPaymentDTO,
} from "@/lib/payments";
import { generatePaymentReference } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface BaridiMobBody {
  senderName?: string;
  senderPhone?: string;
  note?: string;
}

const PHONE_RE = /^[0-9+\s.-]{9,15}$/;

/** GET /api/payments/baridimob — latest payment request of the doctor. */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (!session) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }
    const payment = await db.paymentRequest.findFirst({
      where: { doctorId: session.doctorId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(
      { request: payment ? toPaymentDTO(payment) : null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[API] GET /payments/baridimob failed:", error);
    return NextResponse.json(
      { error: "Lecture de la demande impossible." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/payments/baridimob — register a BaridiMob transfer intention
 * and return the unique reference + pre-filled WhatsApp deep link.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (!session) {
      return NextResponse.json(
        { error: "Connectez-vous à votre compte médecin pour activer Premium." },
        { status: 401 }
      );
    }

    // Only one open request at a time per account.
    const open = await db.paymentRequest.findFirst({
      where: { doctorId: session.doctorId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    if (open) {
      return NextResponse.json(
        {
          request: toPaymentDTO(open),
          reused: true,
          error: null,
        },
        { status: 200 }
      );
    }

    const body = (await request.json().catch(() => null)) as BaridiMobBody | null;
    const senderName = body?.senderName?.trim() ?? "";
    const senderPhone = body?.senderPhone?.trim() ?? "";

    if (senderName.length < 3) {
      return NextResponse.json(
        { error: "Nom complet du titulaire requis." },
        { status: 400 }
      );
    }
    if (!PHONE_RE.test(senderPhone)) {
      return NextResponse.json(
        { error: "Numéro de téléphone algérien invalide (ex. 0550 00 00 00)." },
        { status: 400 }
      );
    }

    // Reference collision is unlikely; retry a few times just in case.
    let payment: PaymentRequest | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        payment = await db.paymentRequest.create({
          data: {
            reference: generatePaymentReference(),
            doctorId: session.doctorId,
            method: "BARIDIMOB",
            amountDzd: PREMIUM_PRICE_DZD,
            senderName: senderName.slice(0, 80),
            senderPhone: senderPhone.slice(0, 20),
            note: body?.note?.trim().slice(0, 240) || null,
          },
        });
        break;
      } catch (error) {
        const code =
          typeof error === "object" && error != null && "code" in error
            ? String((error as { code: unknown }).code)
            : "";
        if (code !== "P2002") throw error;
      }
    }
    if (!payment) {
      return NextResponse.json(
        { error: "Génération de la référence impossible. Réessayez." },
        { status: 500 }
      );
    }

    return NextResponse.json({ request: toPaymentDTO(payment) }, { status: 201 });
  } catch (error) {
    console.error("[API] POST /payments/baridimob failed:", error);
    return NextResponse.json(
      { error: "Enregistrement de la demande impossible." },
      { status: 500 }
    );
  }
}
