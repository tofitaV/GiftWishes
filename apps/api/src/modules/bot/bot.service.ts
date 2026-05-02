import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Telegraf } from "telegraf";
import { PrismaService } from "../prisma/prisma.service.js";
import { WishlistService } from "../wishlist/wishlist.service.js";
import { formatGiftModelEmojiHtml } from "./gift-model-emojis.js";
import { addTelegramNftGiftFromMessage, type TelegramNftGift } from "./telegram-nft.js";

type InlineWishlistItem = {
  collectionName: string;
  modelName: string;
  backdropName: string | null;
  symbolName: string | null;
  sourceUrl?: string | null;
};

type InlineWishlistResult = {
  type: "article";
  id: string;
  title: string;
  description: string;
  input_message_content: {
    message_text: string;
    parse_mode: "HTML";
  };
  reply_markup: {
    inline_keyboard: [[{ text: string; url: string }]];
  };
};

type WishlistProfileReplyMarkup = {
  inline_keyboard: [[{ text: string; web_app: { url: string } }]];
};

type WishlistGiftLinksReplyMarkup = {
  inline_keyboard: { text: string; url: string }[][];
};

const WISHLIST_START_PREFIX = "wishlist_";
const WISHLIST_PROFILE_START_PREFIX = "profile-";
const DEFAULT_BOT_USERNAME = "giftwishes_bot";

export function formatInlineWishlistMessage({ username, items }: { username: string | null; items: InlineWishlistItem[] }) {
  const displayName = username ? `@${username}` : "пользователя";
  if (items.length === 0) {
    return `Wishlist ${displayName} пока пуст`;
  }

  const lines = items.flatMap((item, index) => {
    const itemLines = [`${index + 1}. ${formatGiftTitle(item)}`];
    if (item.backdropName) itemLines.push(`   Фон: ${item.backdropName}`);
    if (item.symbolName) itemLines.push(`   Узор: ${item.symbolName}`);
    return itemLines;
  });

  return [`Wishlist ${displayName}`, "", ...lines].join("\n");
}

export function formatOwnWishlistMessage({ items }: { items: InlineWishlistItem[] }) {
  if (items.length === 0) {
    return "Твой wishlist пока пуст";
  }

  const lines = items.flatMap((item, index) => {
    const itemLines = [`${index + 1}. ${formatGiftTitle(item)}`];
    if (item.backdropName) itemLines.push(`   Фон: ${item.backdropName}`);
    if (item.symbolName) itemLines.push(`   Узор: ${item.symbolName}`);
    return itemLines;
  });

  return ["Твой wishlist", "", ...lines].join("\n");
}

function formatGiftTitle(item: Pick<InlineWishlistItem, "collectionName" | "modelName" | "sourceUrl">) {
  const title = `${escapeTelegramHtml(item.collectionName)} - ${escapeTelegramHtml(item.modelName)}`;
  const linkedTitle = item.sourceUrl ? `<a href="${escapeTelegramHtml(item.sourceUrl)}">${title}</a>` : title;
  const emoji = formatGiftModelEmojiHtml(item.collectionName, item.modelName);
  return emoji ? `${emoji} ${linkedTitle}` : linkedTitle;
}

function escapeTelegramHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function parseWishlistStartPayload(payload: string | undefined) {
  if (!payload?.startsWith(WISHLIST_START_PREFIX)) return null;

  const ownerUserId = payload.slice(WISHLIST_START_PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(ownerUserId)) return null;
  return ownerUserId;
}

export function createBotWishlistDeepLink({ botUsername, appShortName, ownerUserId }: { botUsername: string; appShortName?: string; ownerUserId: string }) {
  const username = botUsername.replace(/^@/, "");
  const appPath = appShortName ? `/${appShortName.replace(/^\//, "")}` : "";
  return `https://t.me/${username}${appPath}?startapp=${WISHLIST_PROFILE_START_PREFIX}${ownerUserId}`;
}

export function isOwnWishlistCommand(text: string) {
  const normalized = text.trim().toLowerCase();
  return (
    /^\/(?:wishlist|list)(?:@\w+)?$/.test(normalized) ||
    normalized === "wishlist" ||
    normalized === "список" ||
    normalized === "показать список" ||
    normalized === "покажи список" ||
    normalized === "показать wishlist" ||
    normalized === "покажи wishlist"
  );
}

export function createWishlistProfileReplyMarkup({ ownerUsername, webAppUrl }: { ownerUsername: string | null; webAppUrl: string }): WishlistProfileReplyMarkup {
  const label = ownerUsername ? `Открыть профиль @${ownerUsername} / Купить гифт` : "Открыть профиль / Купить гифт";

  return {
    inline_keyboard: [[{ text: label, web_app: { url: webAppUrl } }]]
  };
}

export function createWishlistGiftLinksReplyMarkup({ items }: { items: InlineWishlistItem[] }): WishlistGiftLinksReplyMarkup | undefined {
  const buttons = items.flatMap((item, index) => {
    if (!item.sourceUrl) return [];
    return [
      [
        {
          text: `Открыть ${index + 1}. ${item.collectionName} - ${item.modelName}`,
          url: item.sourceUrl
        }
      ]
    ];
  });

  return buttons.length > 0 ? { inline_keyboard: buttons } : undefined;
}

export function createInlineWishlistResult({ wishlistLink, message, itemCount }: { wishlistLink: string; message: string; itemCount: number }): InlineWishlistResult {
  return {
    type: "article",
    id: "wishlist",
    title: "Показать свой wishlist",
    description: itemCount > 0 ? `${itemCount} подарков в списке` : "Wishlist пока пуст",
    input_message_content: {
      message_text: message,
      parse_mode: "HTML"
    },
    reply_markup: {
      inline_keyboard: [[{ text: itemCount > 0 ? "Открыть wishlist" : "Добавить подарки", url: wishlistLink }]]
    }
  };
}

@Injectable()
export class BotService implements OnModuleInit {
  private readonly logger = new Logger(BotService.name);
  private bot?: Telegraf;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly wishlist: WishlistService
  ) {}

  private appUrl(path = "") {
    const base = this.config.getOrThrow<string>("WEB_APP_URL").replace(/\/$/, "");
    return `${base}${path}`;
  }

  private publicWishlistUrl(userId: string) {
    return `${this.appUrl("/")}?${new URLSearchParams({ owner: userId }).toString()}`;
  }

  private botUsername() {
    return this.config.get<string>("BOT_USERNAME") ?? DEFAULT_BOT_USERNAME;
  }

  private botWishlistUrl(userId: string) {
    return createBotWishlistDeepLink({
      botUsername: this.botUsername(),
      appShortName: this.config.get<string>("BOT_APP_SHORT_NAME"),
      ownerUserId: userId
    });
  }

  private async fetchTelegramNftHtml(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Telegram NFT page request failed ${response.status}`);
    }
    return response.text();
  }

  private async upsertTelegramUser(from: { id: number; username?: string; first_name?: string; last_name?: string; language_code?: string }) {
    return this.prisma.user.upsert({
      where: { telegramId: String(from.id) },
      update: {
        username: from.username,
        firstName: from.first_name ?? null,
        lastName: from.last_name ?? null,
        languageCode: from.language_code ?? null,
        isUsernameVisible: true
      },
      create: {
        telegramId: String(from.id),
        username: from.username,
        firstName: from.first_name ?? null,
        lastName: from.last_name ?? null,
        languageCode: from.language_code ?? null,
        isUsernameVisible: true
      }
    });
  }

  private formatAddedGiftMessage(gift: { collectionName: string; modelName: string; backdropName?: string | null; symbolName?: string | null }) {
    const lines = [`Добавлено в wishlist: ${gift.collectionName} - ${gift.modelName}`];
    if (gift.backdropName) lines.push(`Фон: ${gift.backdropName}`);
    if (gift.symbolName) lines.push(`Узор: ${gift.symbolName}`);
    return lines.join("\n");
  }

  onModuleInit() {
    const token = this.config.get<string>("BOT_TOKEN");
    if (!token) {
      this.logger.warn("BOT_TOKEN is not configured; Telegram bot is disabled");
      return;
    }

    this.bot = new Telegraf(token);
    this.bot.catch((error) => {
      this.logger.error("Telegram bot update failed", error instanceof Error ? error.stack : String(error));
    });

    this.bot.start(async (ctx) => {
      const from = ctx.from;
      if (!from) {
        return;
      }

      await this.upsertTelegramUser(from);

      const ownerUserId = parseWishlistStartPayload((ctx as { payload?: string }).payload);
      if (ownerUserId) {
        const owner = await this.prisma.user.findUnique({
          where: { id: ownerUserId },
          include: { wishlistItems: { orderBy: { createdAt: "desc" } } }
        });

        if (!owner) {
          await ctx.reply("Wishlist не найден.");
          return;
        }

        await ctx.reply(formatInlineWishlistMessage({ username: owner.username, items: owner.wishlistItems }), {
          parse_mode: "HTML",
          reply_markup: createWishlistProfileReplyMarkup({
            ownerUsername: owner.username,
            webAppUrl: this.publicWishlistUrl(owner.id)
          })
        });
        return;
      }

      if (!from.username) {
        await ctx.reply("Bot cannot see your Telegram username. Add a username in Telegram and open the bot again.");
        return;
      }

      await ctx.reply("Gift Wishes is ready.", {
        reply_markup: { inline_keyboard: [[{ text: "Open wishlist", web_app: { url: this.appUrl() } }]] }
      });
    });

    this.bot.on("inline_query", async (ctx) => {
      const from = ctx.from;
      const user = await this.prisma.user.findUnique({
        where: { telegramId: String(from.id) },
        include: { wishlistItems: { orderBy: { createdAt: "desc" } } }
      });
      if (!user) return ctx.answerInlineQuery([], { cache_time: 0 });

      const wishlistLink = this.botWishlistUrl(user.id);
      const message = formatInlineWishlistMessage({
        username: user.username,
        items: user.wishlistItems
      });

      return ctx.answerInlineQuery(
        [
          createInlineWishlistResult({
            wishlistLink,
            message,
            itemCount: user.wishlistItems.length
          })
        ],
        { cache_time: 0 }
      );
    });

    this.bot.on("text", async (ctx) => {
      const from = ctx.from;
      if (!from) return;

      const message = ctx.message as { text?: string };
      const text = message.text ?? "";
      try {
        const user = await this.upsertTelegramUser(from);
        if (isOwnWishlistCommand(text)) {
          const wishlist = await this.wishlist.getMine(user.id);
          await ctx.reply(formatOwnWishlistMessage({ items: wishlist.items }), {
            parse_mode: "HTML",
            reply_markup: createWishlistGiftLinksReplyMarkup({ items: wishlist.items })
          });
          return;
        }

        const createdGift = await addTelegramNftGiftFromMessage({
          text,
          fetchHtml: (url) => this.fetchTelegramNftHtml(url),
          createWishlistItem: (input) => this.wishlist.create(user.id, input)
        });

        if (!createdGift) return;
        await ctx.reply(this.formatAddedGiftMessage(createdGift));
      } catch (error) {
        this.logger.warn("Telegram NFT wishlist import failed", error instanceof Error ? error.stack : String(error));
        await ctx.reply(error instanceof Error ? error.message : "Не удалось добавить гифт в wishlist.");
      }
    });

    void this.bot.launch();
  }

  async notifyGiftReceived(recipientTelegramId: string, text: string) {
    if (!this.bot) return;
    await this.bot.telegram.sendMessage(recipientTelegramId, text);
  }
}
