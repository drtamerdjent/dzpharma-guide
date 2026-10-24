/**
 * Webhook Telegram pour le bot « DzPharma Express ».
 *
 * Telegram pousse chaque update ici (mode webhook). L'URL est enregistrée
 * une seule fois via GET /api/telegram/setup?secret=... qui appelle
 * setWebhook + setMyCommands.
 *
 * Contrat :
 *  - Token absent            → 200 { ok: true, skipped: "..." } (pas d'erreur).
 *  - Secret configuré + mauvais header → 401 { ok: false }.
 *  - Update traité           → 200 { ok: true }.
 *  - Erreur de traitement    → 200 { ok: true, error: "..." } : on reste en 200
 *    pour éviter les retry storms de Telegram, l'erreur est logguée côté serveur.
 */
import { NextRequest, NextResponse } from "next/server";
import { getBot, isBotConfigured } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isBotConfigured()) {
    return NextResponse.json({
      ok: true,
      skipped: "TELEGRAM_BOT_TOKEN non configuré",
    });
  }

  // Vérification du secret Telegram (optionnel mais recommandé en production).
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (expectedSecret) {
    const received = req.headers.get(TELEGRAM_SECRET_HEADER);
    if (received !== expectedSecret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  try {
    const update = await req.json();
    await getBot().handleUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Log serveur + réponse 200 pour éviter que Telegram rejoue l'update en boucle.
    console.error("[telegram-webhook] update handling failed:", error);
    return NextResponse.json({
      ok: true,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    });
  }
}
