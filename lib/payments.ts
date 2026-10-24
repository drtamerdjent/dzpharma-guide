/**
 * DzPharma Guide — BaridiMob payment requests (SERVER-ONLY).
 *
 * Flow (business plan):
 *   1. Doctor creates a payment request → unique reference "DZP-XXXXXX".
 *   2. Doctor transfers 3 600 DZD to the RIP via BaridiMob.
 *   3. Doctor sends the receipt screenshot through WhatsApp with the
 *      reference pre-filled (deep link wa.me).
 *   4. Operator validates manually (≤ 1 h) → account Premium.
 *      In this demo, POST /activate-demo simulates the operator.
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  PREMIUM_DURATION_MS,
  SESSION_COOKIE,
  getSessionByToken,
  generatePaymentReference,
  toDoctorPublic,
} from "@/lib/auth";
import { db } from "@/lib/db";
import {
  BENEFICIARY_NAME,
  BENEFICIARY_RIP,
  WHATSAPP_SUPPORT_WA,
  formatRip,
} from "@/lib/rip-format";

export const dynamic = "force-dynamic";

export const PREMIUM_PRICE_DZD = 3600;
export { BENEFICIARY_NAME, BENEFICIARY_RIP, WHATSAPP_SUPPORT_WA };
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER ?? WHATSAPP_SUPPORT_WA;

export function buildWhatsAppMessage(input: {
  reference: string;
  senderName: string;
  senderPhone: string;
}): string {
  return [
    "Bonjour DzPharma Guide,",
    "",
    "Je viens d'effectuer un virement BaridiMob pour l'activation Premium (3 600 DZD / an) :",
    `- Référence : ${input.reference}`,
    `- Nom : ${input.senderName}`,
    `- Téléphone : ${input.senderPhone}`,
    `- Compte bénéficiaire (RIP) : ${formatRip(BENEFICIARY_RIP)} — ${BENEFICIARY_NAME}`,
    "",
    "Je joins la capture d'écran du reçu BaridiMob. Merci !",
  ].join("\n");
}

export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export interface PaymentRequestDTO {
  id: string;
  reference: string;
  method: string;
  amountDzd: number;
  senderName: string;
  senderPhone: string;
  status: "PENDING" | "ACTIVATED" | "REJECTED";
  createdAt: string;
  activatedAt: string | null;
  whatsappUrl: string | null;
  beneficiaryRip: string;
  beneficiaryName: string;
}

export function toPaymentDTO(payment: {
  id: string;
  reference: string;
  method: string;
  amountDzd: number;
  senderName: string;
  senderPhone: string;
  status: string;
  createdAt: Date;
  activatedAt: Date | null;
}): PaymentRequestDTO {
  const status =
    payment.status === "ACTIVATED"
      ? "ACTIVATED"
      : payment.status === "REJECTED"
        ? "REJECTED"
        : "PENDING";
  return {
    id: payment.id,
    reference: payment.reference,
    method: payment.method,
    amountDzd: payment.amountDzd,
    senderName: payment.senderName,
    senderPhone: payment.senderPhone,
    status,
    createdAt: payment.createdAt.toISOString(),
    activatedAt: payment.activatedAt?.toISOString() ?? null,
    whatsappUrl:
      status === "PENDING"
        ? buildWhatsAppUrl(
            buildWhatsAppMessage({
              reference: payment.reference,
              senderName: payment.senderName,
              senderPhone: payment.senderPhone,
            })
          )
        : null,
    beneficiaryRip: BENEFICIARY_RIP,
    beneficiaryName: BENEFICIARY_NAME,
  };
}

/** Shared guard: returns the session or null → caller answers 401. */
export async function requireSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await getSessionByToken(token);
  return session;
}

export { PREMIUM_DURATION_MS, generatePaymentReference, toDoctorPublic, db };
