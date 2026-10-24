/**
 * Setup one-shot du bot Telegram « DzPharma Express ».
 *
 * À appeler UNE FOIS après déploiement :
 *   GET /api/telegram/setup?secret=<TELEGRAM_SETUP_SECRET>
 *
 * Effets :
 *  1. setWebhook sur <origine>/api/telegram/webhook (avec secret_token optionnel).
 *  2. Publication du menu de commandes (/start, /search, /premium, /help).
 *
 * Protection : renvoie 404 si TELEGRAM_SETUP_SECRET est absent ou si le
 * paramètre ?secret= ne correspond pas.
 */
import { NextRequest, NextResponse } from "next/server";
import { getBot, isBotConfigured, registerBotCommands } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const expectedSecret = process.env.TELEGRAM_SETUP_SECRET?.trim();
  const providedSecret = req.nextUrl.searchParams.get("secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return new NextResponse(null, { status: 404 });
  }

  if (!isBotConfigured()) {
    return NextResponse.json({
      ok: false,
      error: "TELEGRAM_BOT_TOKEN manquant",
    });
  }

  const origin = req.nextUrl.origin;
  const webhookUrl = `${origin}/api/telegram/webhook`;
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || undefined;

  try {
    const setWebhookResult = await getBot().telegram.setWebhook(webhookUrl, {
      secret_token: secretToken,
    });
    const commandsRegistered = await registerBotCommands();
    return NextResponse.json({
      ok: true,
      webhookUrl,
      webhookSecretConfigured: Boolean(secretToken),
      setWebhookResult,
      commandsRegistered,
    });
  } catch (error) {
    console.error("[telegram-setup] setWebhook failed:", error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    });
  }
}
