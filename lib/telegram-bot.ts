/**
 * DzPharma Express — bot Telegram « DzPharma Guide » (SERVER-ONLY).
 *
 * Ce module n'est JAMAIS importé côté client : il manipule le token du bot
 * (TELEGRAM_BOT_TOKEN) et la base Prisma. Le bot fonctionne en mode webhook :
 * Telegram pousse les updates sur /api/telegram/webhook (voir route.ts) et
 * l'enregistrement du webhook + du menu de commandes se fait via
 * /api/telegram/setup?secret=...
 *
 * Responsabilités :
 *  - getBot() / isBotConfigured() : singleton lazy Telegraf — getBot() ne doit
 *    JAMAIS être appelé si le token est absent (la route vérifie d'abord
 *    isBotConfigured()).
 *  - Store utilisateurs Telegram (table `telegram_users`, Prisma uniquement) :
 *    upsertTelegramUser / findTelegramUser / consumeDailySearch.
 *  - Quotas journaliers : FREE = 3 recherches/jour, PREMIUM = illimité.
 *  - Handlers /start, /search, /premium, /help + fallback texte (français
 *    médical professionnel, Markdown legacy, escapeMd sur les valeurs
 *    interpolées).
 *  - registerBotCommands() : publie le menu de commandes via setMyCommands.
 *
 * Erreurs : loggées en console.error ici, jamais re-throw — la route webhook
 * répond toujours HTTP 200 pour éviter les retry storms de Telegram.
 */

import { message } from "telegraf/filters";
import { Telegraf, type Context } from "telegraf";
import { db } from "@/lib/db";
import { searchMedications } from "@/lib/medications";
import type { Medication } from "@/lib/types";
import type { TelegramUser } from "@prisma/client";

/** Nombre de recherches par jour pour le plan gratuit. */
export const FREE_DAILY_SEARCH_LIMIT = 3;

/** URL publique de l'app, utilisée dans les liens du bot. */
const APP_URL: string = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://dzpharma-guide.app";

/** Résultat d'une consommation de quota journalier. */
export interface DailyQuota {
  allowed: boolean;
  used: number;
  limit: number;
}

/* ------------------------------------------------------------------ */
/* Singleton Telegraf                                                  */
/* ------------------------------------------------------------------ */

let botInstance: Telegraf | null = null;

/** True si TELEGRAM_BOT_TOKEN est défini (token non vide). */
export function isBotConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
}

/**
 * Singleton lazy Telegraf. À appeler UNIQUEMENT après isBotConfigured() === true
 * (sinon throw — la route webhook ne doit pas planter pour autant).
 */
export function getBot(): Telegraf {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN manquant : impossible de créer le bot.");
  }
  if (!botInstance) {
    botInstance = new Telegraf(token, { handlerTimeout: 30_000 });
    registerHandlers(botInstance);
  }
  return botInstance;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Escape minimal pour Markdown legacy : retire *, _, ` et [ des valeurs interpolées. */
function escapeMd(value: string): string {
  return value.replace(/[*_`[\]]/g, "");
}

/** Jour local courant au format "YYYY-MM-DD". */
function todayLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Prix formaté à la française : 220 → "220", 22.22 → "22,22". */
function formatPrice(price: number): string {
  const rounded = Math.round(price * 100) / 100;
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rounded);
}

/** Répond en Markdown legacy sans jamais laisser une erreur remonter. */
async function safeReply(ctx: Context, text: string): Promise<void> {
  try {
    await ctx.reply(text, {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
    });
  } catch (error) {
    console.error("[telegram-bot] reply failed:", error);
    // Dernier recours : réponse sans parse_mode si le Markdown est invalide.
    try {
      await ctx.reply(text);
    } catch (retryError) {
      console.error("[telegram-bot] plain reply failed:", retryError);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Store utilisateurs (Prisma — code path unique)                      */
/* ------------------------------------------------------------------ */

/** Crée ou met à jour l'utilisateur Telegram (appelé par /start). */
export async function upsertTelegramUser(
  telegramId: string,
  firstName?: string | null,
  username?: string | null,
): Promise<TelegramUser | null> {
  try {
    return await db.telegramUser.upsert({
      where: { telegramId },
      update: {
        firstName: firstName ?? null,
        username: username ?? null,
      },
      create: {
        telegramId,
        firstName: firstName ?? null,
        username: username ?? null,
        plan: "FREE",
      },
    });
  } catch (error) {
    console.error("[telegram-bot] upsertTelegramUser failed:", error);
    return null;
  }
}

/** Retrouve un utilisateur Telegram par son identifiant numérique. */
export async function findTelegramUser(telegramId: string): Promise<TelegramUser | null> {
  try {
    return await db.telegramUser.findUnique({ where: { telegramId } });
  } catch (error) {
    console.error("[telegram-bot] findTelegramUser failed:", error);
    return null;
  }
}

/**
 * Consomme une recherche quotidienne :
 *  - PREMIUM : toujours autorisé, pas d'incrément (illimité).
 *  - FREE    : incrémente `searchesToday` si `lastSearchDate` == jour local
 *              courant, sinon reset à 1 avec la date du jour ("YYYY-MM-DD").
 * Retourne { allowed, used, limit }.
 */
export async function consumeDailySearch(user: TelegramUser): Promise<DailyQuota> {
  if (user.plan === "PREMIUM") {
    return { allowed: true, used: user.searchesToday, limit: Number.POSITIVE_INFINITY };
  }

  const today = todayLocal();

  // Nouveau jour local → remise à zéro du compteur (1re recherche du jour).
  if (user.lastSearchDate !== today) {
    try {
      await db.telegramUser.update({
        where: { telegramId: user.telegramId },
        data: { searchesToday: 1, lastSearchDate: today },
      });
    } catch (error) {
      console.error("[telegram-bot] quota reset failed:", error);
    }
    return { allowed: true, used: 1, limit: FREE_DAILY_SEARCH_LIMIT };
  }

  const used = user.searchesToday;
  if (used >= FREE_DAILY_SEARCH_LIMIT) {
    return { allowed: false, used, limit: FREE_DAILY_SEARCH_LIMIT };
  }

  try {
    await db.telegramUser.update({
      where: { telegramId: user.telegramId },
      data: { searchesToday: used + 1, lastSearchDate: today },
    });
  } catch (error) {
    console.error("[telegram-bot] quota increment failed:", error);
  }
  return { allowed: true, used: used + 1, limit: FREE_DAILY_SEARCH_LIMIT };
}

/* ------------------------------------------------------------------ */
/* Formatage des résultats                                             */
/* ------------------------------------------------------------------ */

/**
 * Format EXACT d'un résultat :
 *   💊 *PARACETAMOL* (DOLI-BIEN 1G)
 *   🏭 Laboratoire : BIOPHARM
 *   💰 Prix : ~220 DZD | CNAS : 70%
 */
function formatMedicationBlock(med: Medication): string {
  const dci = escapeMd(med.dci);
  const brandParts = [med.nom_commercial, med.dosage]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .map(escapeMd);
  const brand = brandParts.join(" ");
  const laboratoire = escapeMd(med.laboratoire ?? "");

  const cnas =
    med.taux_cnas > 0 ? `CNAS : ${med.taux_cnas}%` : "CNAS : 0% (non remboursé)";
  const prix =
    med.prix_approximatif_dzd == null
      ? "Prix non communiqué"
      : `Prix : ~${formatPrice(med.prix_approximatif_dzd)} DZD`;

  return [
    `💊 *${dci}* (${brand})`,
    `🏭 Laboratoire : ${laboratoire}`,
    `💰 ${prix} | ${cnas}`,
  ].join("\n");
}

/** Bloc final des résultats : médicaments séparés par une ligne vide + lien + total. */
function formatSearchResults(items: Medication[], total: number): string {
  const parts = items.map(formatMedicationBlock);

  // Lien "Toutes les alternatives" (recherche par DCI dans l'app web).
  const firstDci = items[0]?.dci ?? "";
  parts.push(
    `🔗 Toutes les alternatives : ${APP_URL}/?q=${encodeURIComponent(firstDci)}`,
  );

  if (items.length > 1) {
    parts.push(`— ${total} résultats au total —`);
  }

  return parts.join("\n\n");
}

/* ------------------------------------------------------------------ */
/* Handlers de commandes                                               */
/* ------------------------------------------------------------------ */

// Corps du message de bienvenue (la salutation personnalisée est ajoutée
// par le handler /start, avec le prénom Telegram si disponible).
const WELCOME_TEXT: string = [
  "Votre assistant médicaments au 🇩🇿 : 5 380 références algériennes avec prix et taux CNAS, directement dans votre poche.",
  "",
  "🔎 *Comment chercher :*",
  "Envoyez `/search PARACETAMOL` ou `/search AUGMENTIN`",
  "— par DCI ou par nom de marque.",
  "",
  "🎁 Offre gratuite : *3 recherches par jour*.",
  "👑 Premium : *3 600 DZD/an* — recherches illimitées, 2 appareils maximum.",
  "Abonnement depuis l'app web : " + APP_URL,
  "",
  "ℹ️ Envoyez /help pour la liste des commandes.",
].join("\n");

const PREMIUM_TEXT: string = [
  "👑 *Passer à DzPharma Premium*",
  "",
  "Pour *3 600 DZD/an* vous débloquez :",
  "✅ Recherches illimitées sur le bot et l'app web",
  "✅ Prix exacts et reste à charge CNAS",
  "✅ Alternatives thérapeutiques complètes",
  "✅ Jusqu'à 2 appareils simultanés",
  "",
  "💳 Paiement : *BaridiMob* (virement + reçu WhatsApp) ou *CIB / Edahabia*.",
  "👉 Tout se fait depuis l'app web : " + APP_URL,
  "📲 Reçu / questions WhatsApp : 0672 22 66 98",
  "",
  "⏱️ Activation sous 1 heure après réception du reçu.",
].join("\n");

const HELP_TEXT: string = [
  "🩺 *DzPharma Express* — commandes disponibles :",
  "",
  "▶️ /start — enregistrer votre compte et découvrir le bot",
  "🔎 /search <DCI ou nom de marque> — chercher un médicament (ex : /search VENTOLINE)",
  "👑 /premium — passer à Premium (recherches illimitées)",
  "❓ /help — afficher cette aide",
  "",
  "🎁 Gratuit : 3 recherches/jour · 👑 Premium : 3 600 DZD/an (2 appareils max).",
  "App web : " + APP_URL,
].join("\n");

/** Extrait le terme de recherche d'une commande "/search@Bot terme". */
function extractCommandPayload(text: string): string {
  return text.replace(/^\/\S+(@\S+)?/, "").trim();
}

function registerHandlers(bot: Telegraf): void {
  // /start — enregistre l'utilisateur + message de bienvenue.
  bot.start(async (ctx) => {
    try {
      const from = ctx.from;
      if (!from) return;
      const user = await upsertTelegramUser(String(from.id), from.first_name ?? null, from.username ?? null);
      const greeting = user?.firstName ? ` ${escapeMd(user.firstName)}` : "";
      await safeReply(
        ctx,
        `👋🩺 Bienvenue${greeting} sur *DzPharma Express* !\n\n${WELCOME_TEXT}`,
      );
    } catch (error) {
      console.error("[telegram-bot] /start failed:", error);
    }
  });

  // /search <terme> — recherche médicamenteuse avec quota FREE.
  bot.command("search", async (ctx) => {
    try {
      const raw = ctx.message?.text ?? "";
      const terme = extractCommandPayload(raw);
      const from = ctx.from;
      if (!from) return;

      if (!terme) {
        await safeReply(
          ctx,
          "🔎 Utilisation : `/search PARACETAMOL` ou `/search AUGMENTIN` (DCI ou nom de marque).",
        );
        return;
      }

      const telegramId = String(from.id);
      const user = await findTelegramUser(telegramId);
      if (!user) {
        await safeReply(ctx, "⛔ Envoyez d'abord /start pour vous enregistrer.");
        return;
      }

      const quota = await consumeDailySearch(user);
      if (!quota.allowed) {
        await safeReply(
          ctx,
          `⚠️ Limite de ${FREE_DAILY_SEARCH_LIMIT} recherches/jour atteinte. Passez Premium (3 600 DZD/an) depuis l'app web pour des recherches illimitées :\n${APP_URL}`,
        );
        return;
      }

      const result = await searchMedications({
        query: terme,
        availableOnly: true,
        limit: 3,
        offset: 0,
      });

      if (result.items.length === 0) {
        await safeReply(
          ctx,
          `🤷 Aucun médicament trouvé pour « ${escapeMd(terme)} ». Essayez la DCI (ex : PARACETAMOL) ou le nom commercial.`,
        );
        return;
      }

      await safeReply(ctx, formatSearchResults(result.items, result.total));
    } catch (error) {
      console.error("[telegram-bot] /search failed:", error);
    }
  });

  // /premium — pitch d'upgrade via l'app web (BaridiMob / CIB).
  bot.command("premium", async (ctx) => {
    await safeReply(ctx, PREMIUM_TEXT);
  });

  // /help — rappel des commandes.
  bot.command("help", async (ctx) => {
    await safeReply(ctx, HELP_TEXT);
  });

  // Fallback : tout texte qui n'est pas une commande.
  bot.on(message("text"), async (ctx) => {
    await safeReply(
      ctx,
      "🤖 Je réponds uniquement aux commandes 🙂\nEnvoyez /search <DCI ou nom de marque> pour chercher un médicament, ou /help pour l'aide.",
    );
  });
}

/* ------------------------------------------------------------------ */
/* Enregistrement du menu de commandes                                 */
/* ------------------------------------------------------------------ */

/** Publie le menu de commandes Telegram (appelé par /api/telegram/setup). */
export async function registerBotCommands(): Promise<boolean> {
  try {
    const bot = getBot();
    await bot.telegram.setMyCommands([
      { command: "start", description: "Enregistrer votre compte et découvrir le bot" },
      { command: "search", description: "Chercher un médicament (DCI ou marque)" },
      { command: "premium", description: "Passer à Premium — recherches illimitées" },
      { command: "help", description: "Aide" },
    ]);
    return true;
  } catch (error) {
    console.error("[telegram-bot] registerBotCommands failed:", error);
    return false;
  }
}
